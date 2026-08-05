const express = require('express');
const cors = require('cors');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('./db');
const { sign, authRequired, adminOnly } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const q = (pool) => pool.request();

/* ---------------- AUTH ---------------- */

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const pool = await getPool();
    const r = await q(pool)
      .input('u', sql.NVarChar, username)
      .query('SELECT * FROM docflow.users WHERE username = @u AND is_active = 1');
    const user = r.recordset[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({
      token: sign(user),
      user: {
        user_id: user.user_id, username: user.username, role: user.role,
        employee_id: user.employee_id, must_change_password: !!user.must_change_password
      }
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Login failed', detail: e.message }); }
});

app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const pool = await getPool();
    const r = await q(pool)
      .input('id', sql.Int, req.user.user_id)
      .query('SELECT * FROM docflow.users WHERE user_id = @id');
    const user = r.recordset[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    // If not forced, verify current password
    if (!user.must_change_password) {
      const ok = await bcrypt.compare(current_password || '', user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await q(pool)
      .input('id', sql.Int, req.user.user_id)
      .input('h', sql.NVarChar, hash)
      .query('UPDATE docflow.users SET password_hash = @h, must_change_password = 0 WHERE user_id = @id');
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Change password failed', detail: e.message }); }
});

/* ---------------- DOCUMENTS ---------------- */

// Live list of all documents with current location
app.get('/api/documents', authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool).query(`
      SELECT d.document_id, d.tower, d.flat_number, d.doc_type, d.remarks,
             d.status, d.current_holder_id, e.name AS holder_name,
             e.department AS holder_department, d.updated_at
      FROM docflow.documents d
      LEFT JOIN docflow.employees e ON e.employee_id = d.current_holder_id
      ORDER BY d.tower, d.flat_number, d.document_id`);
    res.json(r.recordset);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load documents', detail: e.message }); }
});

// Documents currently held by the logged-in employee
app.get('/api/documents/mine', authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool)
      .input('emp', sql.NVarChar, req.user.employee_id)
      .query(`SELECT * FROM docflow.documents WHERE current_holder_id = @emp ORDER BY tower, flat_number`);
    res.json(r.recordset);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed', detail: e.message }); }
});

// Full custody history for one document
app.get('/api/documents/:id/history', authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool)
      .input('doc', sql.NVarChar, req.params.id)
      .query(`
        SELECT m.movement_id, m.action, m.status, m.remarks,
               m.from_holder_id, ef.name AS from_name,
               m.to_holder_id, et.name AS to_name,
               ur.username AS requested_by, ua.username AS approved_by,
               m.requested_at, m.decided_at
        FROM docflow.movements m
        LEFT JOIN docflow.employees ef ON ef.employee_id = m.from_holder_id
        LEFT JOIN docflow.employees et ON et.employee_id = m.to_holder_id
        LEFT JOIN docflow.users ur ON ur.user_id = m.requested_by
        LEFT JOIN docflow.users ua ON ua.user_id = m.approved_by
        WHERE m.document_id = @doc
        ORDER BY m.requested_at DESC`);
    res.json(r.recordset);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- MOVEMENTS (requests + approvals) ---------------- */

// Employee requests to TAKE a document out of storage
app.post('/api/movements/request-take', authRequired, async (req, res) => {
  const { document_id } = req.body || {};
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  if (!req.user.employee_id) return res.status(400).json({ error: 'Your login is not linked to an employee' });
  try {
    const pool = await getPool();
    const d = await q(pool).input('doc', sql.NVarChar, document_id)
      .query('SELECT * FROM docflow.documents WHERE document_id = @doc');
    const doc = d.recordset[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'in_storage')
      return res.status(409).json({ error: 'Document is not available — it must be back in storage first' });

    await q(pool)
      .input('doc', sql.NVarChar, document_id)
      .input('to', sql.NVarChar, req.user.employee_id)
      .input('by', sql.Int, req.user.user_id)
      .query(`INSERT INTO docflow.movements (document_id, action, to_holder_id, requested_by, status)
              VALUES (@doc, 'issue', @to, @by, 'pending')`);
    await q(pool).input('doc', sql.NVarChar, document_id)
      .query(`UPDATE docflow.documents SET status = 'pending_out', updated_at = SYSDATETIME() WHERE document_id = @doc`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Request failed', detail: e.message }); }
});

// Holding employee requests to RETURN a document to storage
app.post('/api/movements/request-return', authRequired, async (req, res) => {
  const { document_id } = req.body || {};
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  try {
    const pool = await getPool();
    const d = await q(pool).input('doc', sql.NVarChar, document_id)
      .query('SELECT * FROM docflow.documents WHERE document_id = @doc');
    const doc = d.recordset[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'with_employee' || doc.current_holder_id !== req.user.employee_id)
      return res.status(409).json({ error: 'You are not holding this document' });

    await q(pool)
      .input('doc', sql.NVarChar, document_id)
      .input('from', sql.NVarChar, req.user.employee_id)
      .input('by', sql.Int, req.user.user_id)
      .query(`INSERT INTO docflow.movements (document_id, action, from_holder_id, requested_by, status)
              VALUES (@doc, 'return', @from, @by, 'pending')`);
    await q(pool).input('doc', sql.NVarChar, document_id)
      .query(`UPDATE docflow.documents SET status = 'pending_return', updated_at = SYSDATETIME() WHERE document_id = @doc`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Request failed', detail: e.message }); }
});

// Admin: pending requests queue
app.get('/api/movements/pending', authRequired, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool).query(`
      SELECT m.movement_id, m.document_id, d.tower, d.flat_number, m.action,
             m.to_holder_id, et.name AS to_name, m.from_holder_id, ef.name AS from_name,
             ur.username AS requested_by, m.requested_at
      FROM docflow.movements m
      JOIN docflow.documents d ON d.document_id = m.document_id
      LEFT JOIN docflow.employees et ON et.employee_id = m.to_holder_id
      LEFT JOIN docflow.employees ef ON ef.employee_id = m.from_holder_id
      LEFT JOIN docflow.users ur ON ur.user_id = m.requested_by
      WHERE m.status = 'pending'
      ORDER BY m.requested_at ASC`);
    res.json(r.recordset);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed', detail: e.message }); }
});

// Admin: approve or reject a pending request
app.post('/api/movements/:id/decide', authRequired, adminOnly, async (req, res) => {
  const { decision } = req.body || {}; // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
  try {
    const pool = await getPool();
    const mr = await q(pool).input('id', sql.Int, req.params.id)
      .query(`SELECT * FROM docflow.movements WHERE movement_id = @id AND status = 'pending'`);
    const m = mr.recordset[0];
    if (!m) return res.status(404).json({ error: 'Pending request not found' });

    const newMoveStatus = decision === 'approve' ? 'approved' : 'rejected';
    await q(pool)
      .input('id', sql.Int, m.movement_id)
      .input('st', sql.NVarChar, newMoveStatus)
      .input('by', sql.Int, req.user.user_id)
      .query(`UPDATE docflow.movements SET status = @st, approved_by = @by, decided_at = SYSDATETIME() WHERE movement_id = @id`);

    // Update document state based on action + decision
    let docStatus, holder;
    if (m.action === 'issue') {
      docStatus = decision === 'approve' ? 'with_employee' : 'in_storage';
      holder = decision === 'approve' ? m.to_holder_id : null;
    } else { // return
      docStatus = decision === 'approve' ? 'in_storage' : 'with_employee';
      holder = decision === 'approve' ? null : m.from_holder_id;
    }
    const upd = q(pool)
      .input('doc', sql.NVarChar, m.document_id)
      .input('st', sql.NVarChar, docStatus);
    if (holder === null) {
      await upd.query(`UPDATE docflow.documents SET status = @st, current_holder_id = NULL, updated_at = SYSDATETIME() WHERE document_id = @doc`);
    } else {
      await upd.input('h', sql.NVarChar, holder)
        .query(`UPDATE docflow.documents SET status = @st, current_holder_id = @h, updated_at = SYSDATETIME() WHERE document_id = @doc`);
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Decision failed', detail: e.message }); }
});

/* ---------------- ADMIN: employees & users ---------------- */

app.get('/api/employees', authRequired, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool).query('SELECT * FROM docflow.employees WHERE is_active = 1 ORDER BY name');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.get('/api/users', authRequired, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await q(pool).query(`
      SELECT u.user_id, u.username, u.role, u.employee_id, e.name AS employee_name,
             u.must_change_password, u.is_active, u.created_at
      FROM docflow.users u LEFT JOIN docflow.employees e ON e.employee_id = u.employee_id
      ORDER BY u.username`);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

// Admin resets a user's password back to default + forces change
app.post('/api/users/:id/reset-password', authRequired, adminOnly, async (req, res) => {
  try {
    const pool = await getPool();
    const def = process.env.DEFAULT_USER_PASSWORD || 'SmartWorld@2026';
    const hash = await bcrypt.hash(def, 10);
    await q(pool).input('id', sql.Int, req.params.id).input('h', sql.NVarChar, hash)
      .query('UPDATE docflow.users SET password_hash = @h, must_change_password = 1 WHERE user_id = @id');
    res.json({ ok: true, default_password: def });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- ADMIN: direct issue / return (storekeeper actions) ---------------- */

// Admin hands a document directly to an employee (no approval round-trip)
app.post('/api/admin/issue', authRequired, adminOnly, async (req, res) => {
  const { document_id, employee_id } = req.body || {};
  if (!document_id || !employee_id) return res.status(400).json({ error: 'document_id and employee_id required' });
  try {
    const pool = await getPool();
    const d = await q(pool).input('doc', sql.NVarChar, document_id)
      .query('SELECT * FROM docflow.documents WHERE document_id = @doc');
    const doc = d.recordset[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'in_storage')
      return res.status(409).json({ error: 'Document must be in storage to issue it' });

    await q(pool)
      .input('doc', sql.NVarChar, document_id)
      .input('to', sql.NVarChar, employee_id)
      .input('by', sql.Int, req.user.user_id)
      .query(`INSERT INTO docflow.movements (document_id, action, to_holder_id, requested_by, status, approved_by, decided_at)
              VALUES (@doc, 'issue', @to, @by, 'approved', @by, SYSDATETIME())`);
    await q(pool).input('doc', sql.NVarChar, document_id).input('h', sql.NVarChar, employee_id)
      .query(`UPDATE docflow.documents SET status = 'with_employee', current_holder_id = @h, updated_at = SYSDATETIME() WHERE document_id = @doc`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Issue failed', detail: e.message }); }
});

// Admin records a document coming back into storage directly
app.post('/api/admin/return', authRequired, adminOnly, async (req, res) => {
  const { document_id } = req.body || {};
  if (!document_id) return res.status(400).json({ error: 'document_id required' });
  try {
    const pool = await getPool();
    const d = await q(pool).input('doc', sql.NVarChar, document_id)
      .query('SELECT * FROM docflow.documents WHERE document_id = @doc');
    const doc = d.recordset[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'with_employee' && doc.status !== 'pending_return')
      return res.status(409).json({ error: 'Document is not currently out with an employee' });

    await q(pool)
      .input('doc', sql.NVarChar, document_id)
      .input('from', sql.NVarChar, doc.current_holder_id)
      .input('by', sql.Int, req.user.user_id)
      .query(`INSERT INTO docflow.movements (document_id, action, from_holder_id, requested_by, status, approved_by, decided_at)
              VALUES (@doc, 'return', @from, @by, 'approved', @by, SYSDATETIME())`);
    // close any open pending_return request on this doc
    await q(pool).input('doc', sql.NVarChar, document_id).input('by', sql.Int, req.user.user_id)
      .query(`UPDATE docflow.movements SET status = 'approved', approved_by = @by, decided_at = SYSDATETIME()
              WHERE document_id = @doc AND status = 'pending'`);
    await q(pool).input('doc', sql.NVarChar, document_id)
      .query(`UPDATE docflow.documents SET status = 'in_storage', current_holder_id = NULL, updated_at = SYSDATETIME() WHERE document_id = @doc`);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Return failed', detail: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'docflow', time: new Date().toISOString() }));

const PORT = process.env.PORT || 5096;
app.listen(PORT, '0.0.0.0', () => console.log(`Document Flow API on http://0.0.0.0:${PORT}`));
