import React, { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const POLL_MS = 5000;

function loadUser() {
  try { return JSON.parse(localStorage.getItem('df_user') || 'null'); } catch { return null; }
}

/* ---------------- Location badge ---------------- */
function LocationBadge({ doc }) {
  if (doc.status === 'in_storage') return <span className="badge b-storage">Storage room</span>;
  if (doc.status === 'with_employee')
    return <span className="badge b-emp">{doc.holder_name || doc.current_holder_id}</span>;
  if (doc.status === 'pending_out') return <span className="badge b-pending">Pending issue</span>;
  if (doc.status === 'pending_return') return <span className="badge b-pending">Pending return</span>;
  return <span className="badge">{doc.status}</span>;
}

/* ---------------- Login ---------------- */
function Login({ onLogin }) {
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      localStorage.setItem('df_token', data.token);
      localStorage.setItem('df_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="login-shell">
      <div className="login-box">
        <h1>Document Flow</h1>
        <p className="sub">Smart World Developers · custody tracking</p>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={e => setU(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submit()} autoFocus />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={e => setP(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <button className="primary" style={{ width: '100%' }} onClick={submit} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

/* ---------------- Change password ---------------- */
function ChangePassword({ forced, onDone }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [nw2, setNw2] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit() {
    setErr(''); setOk('');
    if (nw !== nw2) return setErr('New passwords do not match');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { current_password: cur, new_password: nw } });
      setOk('Password updated.');
      const u = loadUser(); if (u) { u.must_change_password = false; localStorage.setItem('df_user', JSON.stringify(u)); }
      setTimeout(onDone, 700);
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="card" style={{ maxWidth: 440 }}>
      <h3>{forced ? 'Set a new password to continue' : 'Change password'}</h3>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}
      {!forced && (
        <div className="field"><label>Current password</label>
          <input type="password" value={cur} onChange={e => setCur(e.target.value)} /></div>
      )}
      <div className="field"><label>New password</label>
        <input type="password" value={nw} onChange={e => setNw(e.target.value)} /></div>
      <div className="field"><label>Confirm new password</label>
        <input type="password" value={nw2} onChange={e => setNw2(e.target.value)} /></div>
      <button className="primary" onClick={submit}>Update password</button>
    </div>
  );
}

/* ---------------- Admin: live documents ---------------- */
function IssueControl({ doc, employees, reload }) {
  const [emp, setEmp] = useState('');
  const [busy, setBusy] = useState(false);
  async function issue() {
    if (!emp) return;
    setBusy(true);
    try { await api('/api/admin/issue', { method: 'POST', body: { document_id: doc.document_id, employee_id: emp } }); await reload(); setEmp(''); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      <select value={emp} onChange={e => setEmp(e.target.value)} style={{ maxWidth: 170 }}>
        <option value="">Issue to…</option>
        {employees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.name}</option>)}
      </select>
      <button className="primary" disabled={!emp || busy} onClick={issue}>Issue</button>
    </div>
  );
}

function DocumentsTable({ docs, employees, reload }) {
  const [tower, setTower] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const towers = [...new Set(docs.map(d => d.tower).filter(Boolean))].sort();

  const filtered = docs.filter(d =>
    (!tower || d.tower === tower) &&
    (!status || d.status === status) &&
    (!search || `${d.document_id} ${d.flat_number} ${d.holder_name || ''}`.toLowerCase().includes(search.toLowerCase()))
  );

  async function doReturn(id) {
    setBusy(id);
    try { await api('/api/admin/return', { method: 'POST', body: { document_id: id } }); await reload(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="card">
      <h3><span className="live-dot" />Live document locations ({filtered.length})</h3>
      <div className="filters">
        <input placeholder="Search id / flat / holder" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={tower} onChange={e => setTower(e.target.value)}>
          <option value="">All towers</option>
          {towers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_storage">In storage</option>
          <option value="with_employee">With employee</option>
          <option value="pending_out">Pending issue</option>
          <option value="pending_return">Pending return</option>
        </select>
      </div>
      <table>
        <thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Type</th><th>Current location</th><th className="right">Action</th></tr></thead>
        <tbody>
          {filtered.map(d => (
            <tr key={d.document_id}>
              <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td>
              <td className="muted">{d.doc_type || '—'}</td>
              <td><LocationBadge doc={d} /></td>
              <td className="right">
                {d.status === 'in_storage' && <IssueControl doc={d} employees={employees} reload={reload} />}
                {(d.status === 'with_employee' || d.status === 'pending_return') &&
                  <button className="ghost" disabled={busy === d.document_id}
                          onClick={() => doReturn(d.document_id)}>Return to storage</button>}
                {d.status === 'pending_out' && <span className="muted">In approvals</span>}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={6} className="empty">No documents match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Admin: approvals ---------------- */
function Approvals({ pending, reload }) {
  const [busy, setBusy] = useState(null);
  async function decide(id, decision) {
    setBusy(id);
    try { await api(`/api/movements/${id}/decide`, { method: 'POST', body: { decision } }); await reload(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  }
  return (
    <div className="card">
      <h3>Pending approvals ({pending.length})</h3>
      <table>
        <thead><tr><th>Document</th><th>Tower / Flat</th><th>Action</th><th>Employee</th><th>Requested by</th><th>When</th><th className="right">Decision</th></tr></thead>
        <tbody>
          {pending.map(m => (
            <tr key={m.movement_id}>
              <td>{m.document_id}</td>
              <td className="muted">{m.tower} · {m.flat_number}</td>
              <td>{m.action === 'issue'
                ? <span className="badge b-emp">Take out</span>
                : <span className="badge b-storage">Return</span>}</td>
              <td>{m.action === 'issue' ? m.to_name : m.from_name}</td>
              <td className="muted">{m.requested_by}</td>
              <td className="muted">{new Date(m.requested_at).toLocaleString()}</td>
              <td className="right">
                <button className="primary" disabled={busy === m.movement_id}
                        onClick={() => decide(m.movement_id, 'approve')}>Approve</button>{' '}
                <button className="ghost" disabled={busy === m.movement_id}
                        onClick={() => decide(m.movement_id, 'reject')}>Reject</button>
              </td>
            </tr>
          ))}
          {pending.length === 0 && <tr><td colSpan={7} className="empty">Nothing waiting for approval.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Admin: users ---------------- */
function Users() {
  const [users, setUsers] = useState([]);
  const load = useCallback(() => api('/api/users').then(setUsers).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function reset(id) {
    if (!confirm('Reset this user to the default password and force a change on next login?')) return;
    try { const r = await api(`/api/users/${id}/reset-password`, { method: 'POST' }); alert(`Reset. Default password: ${r.default_password}`); load(); }
    catch (e) { alert(e.message); }
  }
  return (
    <div className="card">
      <h3>Users ({users.length})</h3>
      <table>
        <thead><tr><th>Username</th><th>Role</th><th>Employee</th><th>Must change pwd</th><th className="right">Action</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.user_id}>
              <td>{u.username}</td>
              <td>{u.role === 'admin' ? <span className="badge b-storage">admin</span> : 'user'}</td>
              <td className="muted">{u.employee_name || '—'}</td>
              <td>{u.must_change_password ? 'yes' : 'no'}</td>
              <td className="right"><button className="ghost" onClick={() => reset(u.user_id)}>Reset password</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- User: browse + request ---------------- */
function BrowseDocuments({ docs, reload }) {
  const [search, setSearch] = useState('');
  const [tower, setTower] = useState('');
  const [busy, setBusy] = useState(null);
  const towers = [...new Set(docs.map(d => d.tower).filter(Boolean))].sort();
  const filtered = docs.filter(d =>
    (!tower || d.tower === tower) &&
    (!search || `${d.document_id} ${d.flat_number}`.toLowerCase().includes(search.toLowerCase())));

  async function requestTake(id) {
    setBusy(id);
    try { await api('/api/movements/request-take', { method: 'POST', body: { document_id: id } }); await reload(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="card">
      <h3><span className="live-dot" />All documents ({filtered.length})</h3>
      <div className="filters">
        <input placeholder="Search id / flat" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={tower} onChange={e => setTower(e.target.value)}>
          <option value="">All towers</option>
          {towers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Location</th><th className="right">Action</th></tr></thead>
        <tbody>
          {filtered.map(d => (
            <tr key={d.document_id}>
              <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td>
              <td><LocationBadge doc={d} /></td>
              <td className="right">
                {d.status === 'in_storage'
                  ? <button className="primary" disabled={busy === d.document_id}
                            onClick={() => requestTake(d.document_id)}>Request to take</button>
                  : <span className="muted">Unavailable</span>}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan={5} className="empty">No documents match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- User: my documents ---------------- */
function MyDocuments({ reload }) {
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api('/api/documents/mine').then(setDocs).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);

  async function requestReturn(id) {
    setBusy(id);
    try { await api('/api/movements/request-return', { method: 'POST', body: { document_id: id } }); await load(); await reload(); }
    catch (e) { alert(e.message); } finally { setBusy(null); }
  }
  const held = docs.filter(d => d.status === 'with_employee' || d.status === 'pending_return');
  return (
    <div className="card">
      <h3>In my custody ({held.length})</h3>
      <table>
        <thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Status</th><th className="right">Action</th></tr></thead>
        <tbody>
          {held.map(d => (
            <tr key={d.document_id}>
              <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td>
              <td>{d.status === 'pending_return'
                ? <span className="badge b-pending">Return pending</span>
                : <span className="badge b-emp">Held by you</span>}</td>
              <td className="right">
                {d.status === 'with_employee'
                  ? <button className="primary" disabled={busy === d.document_id}
                            onClick={() => requestReturn(d.document_id)}>Return to storage</button>
                  : <span className="muted">Waiting for admin</span>}
              </td>
            </tr>
          ))}
          {held.length === 0 && <tr><td colSpan={5} className="empty">You are not holding any documents.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Shell ---------------- */
export default function App() {
  const [user, setUser] = useState(loadUser());
  const [tab, setTab] = useState('documents');
  const [docs, setDocs] = useState([]);
  const [pending, setPending] = useState([]);
  const [employees, setEmployees] = useState([]);

  const reload = useCallback(async () => {
    if (!user) return;
    try { setDocs(await api('/api/documents')); } catch {}
    if (user.role === 'admin') {
      try { setPending(await api('/api/movements/pending')); } catch {}
      try { setEmployees(await api('/api/employees')); } catch {}
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reload();
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [user, reload]);

  function logout() {
    localStorage.removeItem('df_token'); localStorage.removeItem('df_user'); setUser(null);
  }

  if (!user) return <Login onLogin={u => { setUser(u); setTab(u.role === 'admin' ? 'documents' : 'browse'); }} />;
  if (user.must_change_password) return (
    <>
      <TopBar user={user} onLogout={logout} />
      <div className="wrap"><ChangePassword forced onDone={() => setUser(loadUser())} /></div>
    </>
  );

  const adminTabs = [['documents', 'Documents'], ['approvals', `Approvals${pending.length ? ` (${pending.length})` : ''}`], ['users', 'Users'], ['password', 'Password']];
  const userTabs = [['browse', 'All documents'], ['mine', 'My documents'], ['password', 'Password']];
  const tabs = user.role === 'admin' ? adminTabs : userTabs;

  return (
    <>
      <TopBar user={user} onLogout={logout} />
      <div className="wrap">
        <div className="tabs">
          {tabs.map(([k, label]) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {user.role === 'admin' && tab === 'documents' && <DocumentsTable docs={docs} employees={employees} reload={reload} />}
        {user.role === 'admin' && tab === 'approvals' && <Approvals pending={pending} reload={reload} />}
        {user.role === 'admin' && tab === 'users' && <Users />}

        {user.role !== 'admin' && tab === 'browse' && <BrowseDocuments docs={docs} reload={reload} />}
        {user.role !== 'admin' && tab === 'mine' && <MyDocuments reload={reload} />}

        {tab === 'password' && <ChangePassword onDone={() => setTab(user.role === 'admin' ? 'documents' : 'browse')} />}
      </div>
    </>
  );
}

function TopBar({ user, onLogout }) {
  return (
    <div className="topbar">
      <div className="brand">Document Flow · Smart World</div>
      <div className="who">
        <span>{user.username} · {user.role}</span>
        <button onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}
