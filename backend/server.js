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

function roleOnly(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'Not allowed for your role' });
}

/* Append an event to the custody log */
async function logEvent(pool, { document_id, action, stage, actor_id, from_holder = null, to_holder = null }) {
  const r = q(pool)
    .input('doc', sql.NVarChar, document_id)
    .input('act', sql.NVarChar, action)
    .input('stg', sql.NVarChar, stage)
    .input('actor', sql.Int, actor_id)
    .input('from', sql.NVarChar, from_holder)
    .input('to', sql.NVarChar, to_holder);
  await r.query(`INSERT INTO docflow.movements
    (document_id, action, stage, actor_id, requested_by, from_holder_id, to_holder_id, status, decided_at)
    VALUES (@doc, @act, @stg, @actor, @actor, @from, @to, @stg, SYSDATETIME())`);
}

async function getDoc(pool, id) {
  const r = await q(pool).input('doc', sql.NVarChar, id).query('SELECT * FROM docflow.documents WHERE document_id = @doc');
  return r.recordset[0];
}
async function setDoc(pool, id, fields) {
  const sets = []; const rq = q(pool).input('doc', sql.NVarChar, id);
  if ('status' in fields) { sets.push('status = @status'); rq.input('status', sql.NVarChar, fields.status); }
  if ('current_holder_id' in fields) { sets.push('current_holder_id = @chi'); rq.input('chi', sql.NVarChar, fields.current_holder_id); }
  if ('pending_holder_id' in fields) { sets.push('pending_holder_id = @phi'); rq.input('phi', sql.NVarChar, fields.pending_holder_id); }
  if ('transferrer_user_id' in fields) { sets.push('transferrer_user_id = @tui'); rq.input('tui', sql.Int, fields.transferrer_user_id); }
  sets.push('updated_at = SYSDATETIME()');
  await rq.query(`UPDATE docflow.documents SET ${sets.join(', ')} WHERE document_id = @doc`);
}

/* ---------------- AUTH ---------------- */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  try {
    const pool = await getPool();
    const r = await q(pool).input('u', sql.NVarChar, username)
      .query('SELECT * FROM docflow.users WHERE username = @u AND is_active = 1');
    const user = r.recordset[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: sign(user), user: {
      user_id: user.user_id, username: user.username, role: user.role,
      employee_id: user.employee_id, must_change_password: !!user.must_change_password } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Login failed', detail: e.message }); }
});

app.post('/api/auth/change-password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  try {
    const pool = await getPool();
    const r = await q(pool).input('id', sql.Int, req.user.user_id).query('SELECT * FROM docflow.users WHERE user_id = @id');
    const user = r.recordset[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.must_change_password && !(await bcrypt.compare(current_password || '', user.password_hash)))
      return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await q(pool).input('id', sql.Int, req.user.user_id).input('h', sql.NVarChar, hash)
      .query('UPDATE docflow.users SET password_hash = @h, must_change_password = 0 WHERE user_id = @id');
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Change password failed', detail: e.message }); }
});

/* ---------------- DOCUMENTS ---------------- */
const DOC_SELECT = `
  SELECT d.document_id, d.tower, d.flat_number, d.doc_type, d.remarks, d.status,
         d.current_holder_id, e.name AS holder_name,
         d.pending_holder_id, pe.name AS pending_name,
         d.transferrer_user_id, tu.username AS transferrer_name, d.updated_at
  FROM docflow.documents d
  LEFT JOIN docflow.employees e  ON e.employee_id = d.current_holder_id
  LEFT JOIN docflow.employees pe ON pe.employee_id = d.pending_holder_id
  LEFT JOIN docflow.users tu     ON tu.user_id = d.transferrer_user_id`;

app.get('/api/documents', authRequired, async (req, res) => {
  try { const pool = await getPool();
    const r = await q(pool).query(`${DOC_SELECT} ORDER BY d.tower, d.flat_number, d.document_id`);
    res.json(r.recordset);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load documents', detail: e.message }); }
});

// documents relevant to the logged-in employee (custody + incoming to receive)
app.get('/api/documents/mine', authRequired, async (req, res) => {
  try { const pool = await getPool();
    const r = await q(pool).input('emp', sql.NVarChar, req.user.employee_id)
      .query(`${DOC_SELECT} WHERE d.current_holder_id = @emp OR d.pending_holder_id = @emp
              ORDER BY d.tower, d.flat_number`);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.get('/api/documents/:id/history', authRequired, async (req, res) => {
  try { const pool = await getPool();
    const r = await q(pool).input('doc', sql.NVarChar, req.params.id).query(`
      SELECT m.movement_id, m.action, m.stage, m.requested_at,
             m.from_holder_id, m.to_holder_id, u.username AS actor
      FROM docflow.movements m LEFT JOIN docflow.users u ON u.user_id = m.actor_id
      WHERE m.document_id = @doc ORDER BY m.requested_at DESC, m.movement_id DESC`);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- NOTIFICATIONS (per role) ---------------- */
app.get('/api/notifications', authRequired, async (req, res) => {
  try { const pool = await getPool(); let where = '1=0'; const rq = q(pool);
    if (req.user.role === 'admin') where = `d.status IN ('out_admin_review','return_delivered')`;
    else if (req.user.role === 'transferrer') where = `d.status IN ('out_awaiting_pickup','return_awaiting_pickup','out_in_transit','return_in_transit')`;
    else { where = `d.status = 'out_delivered' AND d.pending_holder_id = @emp`; rq.input('emp', sql.NVarChar, req.user.employee_id); }
    const r = await rq.query(`${DOC_SELECT} WHERE ${where} ORDER BY d.updated_at DESC`);
    res.json({ count: r.recordset.length, list: r.recordset });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- USER actions ---------------- */
app.post('/api/movements/request-take', authRequired, roleOnly('user'), async (req, res) => {
  const { document_id } = req.body || {};
  if (!req.user.employee_id) return res.status(400).json({ error: 'Your login is not linked to an employee' });
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'in_storage') return res.status(409).json({ error: 'Document is not available' });
    await setDoc(pool, document_id, { status: 'out_admin_review', pending_holder_id: req.user.employee_id });
    await logEvent(pool, { document_id, action: 'issue', stage: 'requested', actor_id: req.user.user_id, to_holder: req.user.employee_id });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Request failed', detail: e.message }); }
});

app.post('/api/user/received', authRequired, roleOnly('user'), async (req, res) => {
  const { document_id, received } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'out_delivered' || doc.pending_holder_id !== req.user.employee_id)
      return res.status(409).json({ error: 'This document is not awaiting your confirmation' });
    if (received) {
      await setDoc(pool, document_id, { status: 'with_employee', current_holder_id: doc.pending_holder_id, pending_holder_id: null, transferrer_user_id: null });
      await logEvent(pool, { document_id, action: 'issue', stage: 'received', actor_id: req.user.user_id, to_holder: doc.pending_holder_id });
    } else {
      await setDoc(pool, document_id, { status: 'out_in_transit' });
      await logEvent(pool, { document_id, action: 'issue', stage: 'not_received', actor_id: req.user.user_id });
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.post('/api/movements/request-return', authRequired, roleOnly('user'), async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (doc.status !== 'with_employee' || doc.current_holder_id !== req.user.employee_id)
      return res.status(409).json({ error: 'You are not holding this document' });
    await setDoc(pool, document_id, { status: 'return_awaiting_pickup' });
    await logEvent(pool, { document_id, action: 'return', stage: 'return_requested', actor_id: req.user.user_id, from_holder: doc.current_holder_id });
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- ADMIN actions ---------------- */
app.post('/api/admin/approve', authRequired, adminOnly, async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc || doc.status !== 'out_admin_review') return res.status(409).json({ error: 'No issue request to approve' });
    await setDoc(pool, document_id, { status: 'out_awaiting_pickup' });
    await logEvent(pool, { document_id, action: 'issue', stage: 'admin_approved', actor_id: req.user.user_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.post('/api/admin/reject', authRequired, adminOnly, async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc || doc.status !== 'out_admin_review') return res.status(409).json({ error: 'No issue request to reject' });
    await setDoc(pool, document_id, { status: 'in_storage', pending_holder_id: null });
    await logEvent(pool, { document_id, action: 'issue', stage: 'rejected', actor_id: req.user.user_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.post('/api/admin/received', authRequired, adminOnly, async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc || doc.status !== 'return_delivered') return res.status(409).json({ error: 'No return awaiting receipt' });
    await setDoc(pool, document_id, { status: 'in_storage', current_holder_id: null, pending_holder_id: null, transferrer_user_id: null });
    await logEvent(pool, { document_id, action: 'return', stage: 'admin_received', actor_id: req.user.user_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- TRANSFERRER actions ---------------- */
app.post('/api/transferrer/accept', authRequired, roleOnly('transferrer'), async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    let next;
    if (doc.status === 'out_awaiting_pickup') next = 'out_in_transit';
    else if (doc.status === 'return_awaiting_pickup') next = 'return_in_transit';
    else return res.status(409).json({ error: 'No pickup task for this document' });
    await setDoc(pool, document_id, { status: next, transferrer_user_id: req.user.user_id });
    await logEvent(pool, { document_id, action: next.startsWith('out') ? 'issue' : 'return', stage: 'accepted', actor_id: req.user.user_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.post('/api/transferrer/dropped', authRequired, roleOnly('transferrer'), async (req, res) => {
  const { document_id } = req.body || {};
  try { const pool = await getPool(); const doc = await getDoc(pool, document_id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    let next, action;
    if (doc.status === 'out_in_transit') { next = 'out_delivered'; action = 'issue'; }
    else if (doc.status === 'return_in_transit') { next = 'return_delivered'; action = 'return'; }
    else return res.status(409).json({ error: 'This document is not in transit' });
    await setDoc(pool, document_id, { status: next });
    await logEvent(pool, { document_id, action, stage: 'dropped', actor_id: req.user.user_id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

/* ---------------- ADMIN: users ---------------- */
app.get('/api/employees', authRequired, async (req, res) => {
  try { const pool = await getPool();
    const r = await q(pool).query('SELECT * FROM docflow.employees WHERE is_active = 1 ORDER BY name');
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.get('/api/users', authRequired, adminOnly, async (req, res) => {
  try { const pool = await getPool();
    const r = await q(pool).query(`SELECT u.user_id, u.username, u.role, u.employee_id, e.name AS employee_name,
      u.must_change_password, u.is_active, u.created_at
      FROM docflow.users u LEFT JOIN docflow.employees e ON e.employee_id = u.employee_id ORDER BY u.username`);
    res.json(r.recordset);
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.post('/api/users/:id/reset-password', authRequired, adminOnly, async (req, res) => {
  try { const pool = await getPool();
    const def = process.env.DEFAULT_USER_PASSWORD || 'SmartWorld@2026';
    const hash = await bcrypt.hash(def, 10);
    await q(pool).input('id', sql.Int, req.params.id).input('h', sql.NVarChar, hash)
      .query('UPDATE docflow.users SET password_hash = @h, must_change_password = 1 WHERE user_id = @id');
    res.json({ ok: true, default_password: def });
  } catch (e) { res.status(500).json({ error: 'Failed', detail: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'docflow', time: new Date().toISOString() }));

const PORT = process.env.PORT || 5097;
app.listen(PORT, '0.0.0.0', () => console.log(`Document Flow API on http://0.0.0.0:${PORT}`));
