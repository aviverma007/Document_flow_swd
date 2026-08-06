import React, { useEffect, useState, useCallback, useRef, useContext, createContext } from 'react';
import { api } from './api.js';

const POLL_MS = 4000;
const loadUser = () => { try { return JSON.parse(localStorage.getItem('df_user') || 'null'); } catch { return null; } };
const UI = createContext({ run: async () => {}, notify: () => {}, confirm: async () => true });

/* ================= Icons ================= */
const ic = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const IHome = () => <svg viewBox="0 0 24 24" {...ic}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>;
const IFile = () => <svg viewBox="0 0 24 24" {...ic}><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4" /></svg>;
const ICheck = () => <svg viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></svg>;
const IUsers = () => <svg viewBox="0 0 24 24" {...ic}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><path d="M16 6a3 3 0 010 6" /></svg>;
const ILock = () => <svg viewBox="0 0 24 24" {...ic}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
const IFolder = () => <svg viewBox="0 0 24 24" {...ic}><path d="M3 7h6l2 2h10v10H3z" /></svg>;
const IInbox = () => <svg viewBox="0 0 24 24" {...ic}><path d="M4 13l2-8h12l2 8" /><path d="M4 13h5l1 2h4l1-2h5v6H4z" /></svg>;
const ITruck = () => <svg viewBox="0 0 24 24" {...ic}><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>;
const IBell = () => <svg viewBox="0 0 24 24" {...ic}><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 004 0" /></svg>;
const IPower = () => <svg viewBox="0 0 24 24" {...ic}><path d="M12 4v8" /><path d="M7 7a7 7 0 108 0" /></svg>;
const IChevron = () => <svg viewBox="0 0 24 24" {...ic}><path d="M14 6l-6 6 6 6" /></svg>;

function Logo({ sm }) {
  return (<span className={'logo-sq' + (sm ? ' sm' : '')}>
    <svg viewBox="0 0 32 32" width={sm ? 22 : 30} height={sm ? 22 : 30}><path d="M16 3 L25 27 L16 21 L7 27 Z" fill="#105da9" /></svg>
  </span>);
}

/* ================= Constellation + splash ================= */
function Constellation() {
  const nodes = [[60,80],[180,40],[300,120],[440,60],[560,150],[120,220],[260,260],[400,220],[520,300],[80,340],[220,380],[360,340],[500,400],[600,240]];
  const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[8,13],[4,13],[6,2],[7,3]];
  return (
    <svg className="constellation" viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice">
      <g className="grp">
        {links.map(([a, b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />)}
        {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.6 : 1.6} fill="#a9cdf4" style={{ animationDelay: `${i * 0.3}s` }} />)}
      </g>
    </svg>
  );
}
function LoadingSplash({ onDone }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 16 + 6;
      if (p >= 100) { setPct(100); clearInterval(t); setTimeout(onDone, 450); }
      else setPct(Math.floor(p));
    }, 240);
    return () => clearInterval(t);
  }, [onDone]);
  return (
    <div className="splash"><Constellation /><div className="watermark">SMARTWORLD</div>
      <div className="glass"><Logo /><h1>Document Flow</h1>
        <p className="sub">Smart World Developers · Custody Portal</p>
        <div className="progress-row"><span>Loading resources…</span><span>{pct}%</span></div>
        <div className="bar"><span style={{ width: pct + '%' }} /></div>
        <div className="dots">{[0,1,2,3].map(i => <i key={i} className={i === (Math.floor(pct/25) % 4) ? 'on' : ''} />)}</div>
        <div className="foot">Secured connection · Live sync enabled</div>
      </div>
    </div>
  );
}

/* ================= Status badge ================= */
function statusInfo(d) {
  switch (d.status) {
    case 'in_storage': return { label: 'Storage room', cls: 'b-storage' };
    case 'out_admin_review': return { label: 'Awaiting admin', cls: 'b-pending' };
    case 'out_awaiting_pickup': return { label: 'Awaiting pickup', cls: 'b-pending' };
    case 'out_in_transit': return { label: 'In transit → ' + (d.pending_name || ''), cls: 'b-transit' };
    case 'out_delivered': return { label: 'Delivered · to confirm', cls: 'b-pending' };
    case 'with_employee': return { label: d.holder_name || d.current_holder_id, cls: 'b-emp' };
    case 'return_awaiting_pickup': return { label: 'Return · awaiting pickup', cls: 'b-pending' };
    case 'return_in_transit': return { label: 'Return · in transit', cls: 'b-transit' };
    case 'return_delivered': return { label: 'Return · at storage', cls: 'b-pending' };
    default: return { label: d.status, cls: 'b-storage' };
  }
}
const StatusBadge = ({ d }) => { const s = statusInfo(d); return <span className={'badge ' + s.cls}>{s.label}</span>; };

/* ================= Login ================= */
function Login({ onLogin }) {
  const [username, setU] = useState(''); const [password, setP] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    setErr(''); setBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      localStorage.setItem('df_token', data.token); localStorage.setItem('df_user', JSON.stringify(data.user)); onLogin(data.user);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="login-shell"><Constellation />
      <div className="login-box"><Logo /><h1>Document Flow</h1>
        <p className="sub">Smart World Developers · Custody Portal</p>
        {err && <div className="err">{err}</div>}
        <div className="field"><label>Username</label>
          <input value={username} onChange={e => setU(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} autoFocus /></div>
        <div className="field"><label>Password</label>
          <input type="password" value={password} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} /></div>
        <button className="primary" style={{ width: '100%', marginTop: 4 }} onClick={submit} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </div>
    </div>
  );
}

/* ================= Change password ================= */
function ChangePassword({ forced, onDone }) {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [nw2, setNw2] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  async function submit() {
    setErr(''); setOk('');
    if (nw !== nw2) return setErr('New passwords do not match');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { current_password: cur, new_password: nw } });
      setOk('Password updated.'); const u = loadUser(); if (u) { u.must_change_password = false; localStorage.setItem('df_user', JSON.stringify(u)); }
      setTimeout(onDone, 700);
    } catch (e) { setErr(e.message); }
  }
  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h3>{forced ? 'Set a new password to continue' : 'Change password'}</h3>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">{ok}</div>}
      {!forced && <div className="field"><label>Current password</label><input type="password" value={cur} onChange={e => setCur(e.target.value)} /></div>}
      <div className="field"><label>New password</label><input type="password" value={nw} onChange={e => setNw(e.target.value)} /></div>
      <div className="field"><label>Confirm new password</label><input type="password" value={nw2} onChange={e => setNw2(e.target.value)} /></div>
      <button className="primary" onClick={submit}>Update password</button>
    </div>
  );
}

/* ================= Overview table (read-only) ================= */
function OverviewTable({ docs, title }) {
  const [tower, setTower] = useState(''); const [search, setSearch] = useState('');
  const towers = [...new Set(docs.map(d => d.tower).filter(Boolean))].sort();
  const list = docs.filter(d => (!tower || d.tower === tower) &&
    (!search || `${d.document_id} ${d.flat_number} ${d.holder_name || ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="card">
      <h3><span className="live-dot" />{title} ({list.length})</h3>
      <div className="filters">
        <input placeholder="Search id / flat / holder" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={tower} onChange={e => setTower(e.target.value)}><option value="">All towers</option>{towers.map(t => <option key={t} value={t}>{t}</option>)}</select>
      </div>
      <table>
        <thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Type</th><th>Status</th><th>Transferrer</th></tr></thead>
        <tbody>
          {list.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td>
            <td className="muted">{d.doc_type || '—'}</td><td><StatusBadge d={d} /></td><td className="muted">{d.transferrer_name || '—'}</td></tr>))}
          {list.length === 0 && <tr><td colSpan={6} className="empty">No documents.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ================= Admin ================= */
function AdminApprovals({ docs }) {
  const { run } = useContext(UI);
  const list = docs.filter(d => d.status === 'out_admin_review');
  return (
    <div className="card"><h3>Issue requests to approve ({list.length})</h3>
      <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Requested for</th><th className="right">Decision</th></tr></thead>
        <tbody>
          {list.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{d.pending_name}</td>
            <td className="right">
              <button className="primary" onClick={() => run({ confirmTitle: 'Approve issue request?', confirmMsg: `Approve issuing ${d.document_id} to ${d.pending_name}? A pickup task will be sent to the transferrer.`, confirmLabel: 'Approve', path: '/api/admin/approve', body: { document_id: d.document_id }, success: 'Approved — pickup sent to transferrer' })}>Approve</button>{' '}
              <button className="ghost" onClick={() => run({ confirmTitle: 'Reject request?', confirmMsg: `Reject the request for ${d.document_id}? It stays in storage.`, confirmLabel: 'Reject', path: '/api/admin/reject', body: { document_id: d.document_id }, success: 'Request rejected' })}>Reject</button>
            </td></tr>))}
          {list.length === 0 && <tr><td colSpan={4} className="empty">No issue requests waiting.</td></tr>}
        </tbody></table></div>
  );
}
function AdminReceiving({ docs }) {
  const { run } = useContext(UI);
  const list = docs.filter(d => d.status === 'return_delivered');
  return (
    <div className="card"><h3>Returns to receive into storage ({list.length})</h3>
      <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Returned by</th><th>Transferrer</th><th className="right">Action</th></tr></thead>
        <tbody>
          {list.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{d.holder_name}</td><td className="muted">{d.transferrer_name || '—'}</td>
            <td className="right"><button className="primary" onClick={() => run({ confirmTitle: 'Confirm receipt?', confirmMsg: `Confirm ${d.document_id} is physically back in storage?`, confirmLabel: 'Received', path: '/api/admin/received', body: { document_id: d.document_id }, success: 'Document back in storage' })}>Received</button></td></tr>))}
          {list.length === 0 && <tr><td colSpan={5} className="empty">No returns waiting.</td></tr>}
        </tbody></table></div>
  );
}
function Users() {
  const [users, setUsers] = useState([]); const { notify } = useContext(UI);
  const load = useCallback(() => api('/api/users').then(setUsers).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  async function reset(id) {
    if (!confirm('Reset this user to the default password and force a change on next login?')) return;
    try { const r = await api(`/api/users/${id}/reset-password`, { method: 'POST' }); notify('success', `Reset. Default password: ${r.default_password}`); load(); }
    catch (e) { notify('error', e.message); }
  }
  return (
    <div className="card"><h3>Users ({users.length})</h3>
      <table><thead><tr><th>Username</th><th>Role</th><th>Employee</th><th>Must change pwd</th><th className="right">Action</th></tr></thead>
        <tbody>{users.map(u => (<tr key={u.user_id}><td>{u.username}</td>
          <td>{u.role === 'admin' ? <span className="badge b-storage">admin</span> : u.role === 'transferrer' ? <span className="badge b-transit">transferrer</span> : 'user'}</td>
          <td className="muted">{u.employee_name || '—'}</td><td>{u.must_change_password ? 'yes' : 'no'}</td>
          <td className="right"><button className="ghost" onClick={() => reset(u.user_id)}>Reset password</button></td></tr>))}
        </tbody></table></div>
  );
}

/* ================= Transferrer ================= */
function TransferrerPickups({ docs }) {
  const { run } = useContext(UI);
  const list = docs.filter(d => d.status === 'out_awaiting_pickup' || d.status === 'return_awaiting_pickup');
  return (
    <div className="card"><h3>Pickup requests ({list.length})</h3>
      <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Task</th><th className="right">Action</th></tr></thead>
        <tbody>
          {list.map(d => {
            const isOut = d.status === 'out_awaiting_pickup';
            const task = isOut ? `Pick from storage → deliver to ${d.pending_name}` : `Pick from ${d.holder_name} → deliver to storage`;
            return (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{task}</td>
              <td className="right"><button className="primary" onClick={() => run({ confirmTitle: 'Accept this task?', confirmMsg: task + '?', confirmLabel: 'Accept', path: '/api/transferrer/accept', body: { document_id: d.document_id }, success: 'Task accepted — now in transit' })}>Accept</button></td></tr>);
          })}
          {list.length === 0 && <tr><td colSpan={4} className="empty">No pickup requests.</td></tr>}
        </tbody></table></div>
  );
}
function TransferrerTransit({ docs, user }) {
  const { run } = useContext(UI);
  const list = docs.filter(d => (d.status === 'out_in_transit' || d.status === 'return_in_transit') && d.transferrer_user_id === user.user_id);
  return (
    <div className="card"><h3>In transit — mark dropped ({list.length})</h3>
      <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Deliver to</th><th className="right">Action</th></tr></thead>
        <tbody>
          {list.map(d => {
            const isOut = d.status === 'out_in_transit';
            const to = isOut ? d.pending_name : 'Storage room';
            const confirmMsg = isOut ? `Confirm you dropped ${d.document_id} to ${d.pending_name}? They will confirm receipt.` : `Confirm you dropped ${d.document_id} at storage? Admin will confirm receipt.`;
            return (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{to}</td>
              <td className="right"><button className="primary" onClick={() => run({ confirmTitle: 'Mark as dropped?', confirmMsg, confirmLabel: 'Dropped', path: '/api/transferrer/dropped', body: { document_id: d.document_id }, success: 'Marked as dropped' })}>Dropped</button></td></tr>);
          })}
          {list.length === 0 && <tr><td colSpan={4} className="empty">Nothing in transit.</td></tr>}
        </tbody></table></div>
  );
}

/* ================= User ================= */
function BrowseDocuments({ docs }) {
  const { run } = useContext(UI);
  const [search, setSearch] = useState(''); const [tower, setTower] = useState('');
  const towers = [...new Set(docs.map(d => d.tower).filter(Boolean))].sort();
  const list = docs.filter(d => (!tower || d.tower === tower) && (!search || `${d.document_id} ${d.flat_number}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="card"><h3><span className="live-dot" />All documents ({list.length})</h3>
      <div className="filters"><input placeholder="Search id / flat" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={tower} onChange={e => setTower(e.target.value)}><option value="">All towers</option>{towers.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
      <table><thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Status</th><th className="right">Action</th></tr></thead>
        <tbody>
          {list.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td><StatusBadge d={d} /></td>
            <td className="right">{d.status === 'in_storage'
              ? <button className="primary" onClick={() => run({ confirmTitle: 'Request this document?', confirmMsg: `Send a request to take ${d.document_id} (Tower ${d.tower}, Flat ${d.flat_number})? Admin will review it.`, confirmLabel: 'Request', path: '/api/movements/request-take', body: { document_id: d.document_id }, success: 'Request sent for admin approval' })}>Request to take</button>
              : <span className="muted">Unavailable</span>}</td></tr>))}
          {list.length === 0 && <tr><td colSpan={5} className="empty">No documents match.</td></tr>}
        </tbody></table></div>
  );
}
function MyDocuments({ user }) {
  const { run } = useContext(UI);
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api('/api/documents/mine').then(setDocs).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);
  const toReceive = docs.filter(d => d.status === 'out_delivered' && d.pending_holder_id === user.employee_id);
  const custody = docs.filter(d => ['with_employee', 'return_awaiting_pickup', 'return_in_transit', 'return_delivered'].includes(d.status) && d.current_holder_id === user.employee_id);
  const incoming = docs.filter(d => ['out_admin_review', 'out_awaiting_pickup', 'out_in_transit'].includes(d.status) && d.pending_holder_id === user.employee_id);
  return (
    <>
      {toReceive.length > 0 && (
        <div className="card"><h3>Awaiting your confirmation ({toReceive.length})</h3>
          <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Delivered by</th><th className="right">Did you get it?</th></tr></thead>
            <tbody>{toReceive.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td className="muted">{d.transferrer_name || '—'}</td>
              <td className="right">
                <button className="primary" onClick={() => run({ confirmTitle: 'Confirm received?', confirmMsg: `Confirm you received ${d.document_id}? It will be logged in your custody.`, confirmLabel: 'Received', path: '/api/user/received', body: { document_id: d.document_id, received: true }, success: 'Document is now in your custody', after: load })}>Received</button>{' '}
                <button className="ghost" onClick={() => run({ confirmTitle: 'Not received?', confirmMsg: `Report that ${d.document_id} was NOT handed to you? It goes back to the transferrer.`, confirmLabel: 'Not received', path: '/api/user/received', body: { document_id: d.document_id, received: false }, success: 'Sent back to the transferrer', after: load })}>Not received</button>
              </td></tr>))}</tbody></table></div>
      )}
      <div className="card"><h3>In my custody ({custody.length})</h3>
        <table><thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Status</th><th className="right">Action</th></tr></thead>
          <tbody>
            {custody.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td><StatusBadge d={d} /></td>
              <td className="right">{d.status === 'with_employee'
                ? <button className="primary" onClick={() => run({ confirmTitle: 'Return this document?', confirmMsg: `Request return of ${d.document_id} to storage? A transferrer will pick it up from you.`, confirmLabel: 'Return', path: '/api/movements/request-return', body: { document_id: d.document_id }, success: 'Return requested — transferrer will collect it', after: load })}>Return to storage</button>
                : <span className="muted">Return in progress</span>}</td></tr>))}
            {custody.length === 0 && <tr><td colSpan={5} className="empty">You are not holding any documents.</td></tr>}
          </tbody></table></div>
      {incoming.length > 0 && (
        <div className="card"><h3>Incoming to you ({incoming.length})</h3>
          <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Status</th></tr></thead>
            <tbody>{incoming.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td><StatusBadge d={d} /></td></tr>))}</tbody></table></div>
      )}
    </>
  );
}

/* ================= Sidebar / bell / modal / toasts ================= */
function Sidebar({ user, items, tab, setTab, collapsed, onToggle, onLogout }) {
  const initials = (user.username || '?').slice(0, 2).toUpperCase();
  return (
    <div className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <button className="collapse-btn" onClick={onToggle} title="Collapse"><IChevron /></button>
      <div className="brand"><Logo sm /><div className="name">Document Flow<small>Custody Portal</small></div></div>
      <div className="seclabel">EXPLORE</div>
      <div className="nav">{items.map(it => (
        <button key={it.key} className={'nav-item' + (tab === it.key ? ' active' : '')} onClick={() => setTab(it.key)} title={it.label}>
          {it.icon}<span>{it.label}</span>{it.badge ? <span className="badge-count">{it.badge}</span> : null}
        </button>))}
      </div>
      <div className="user-block"><div className="avatar">{initials}</div>
        <div className="meta"><div className="nm">{user.username}</div><div className="rl"><span className="g" />{user.role}</div></div>
        <button className="pw" onClick={onLogout} title="Logout"><IPower /></button>
      </div>
    </div>
  );
}
function NotifBell({ notif }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bellwrap">
      <button className="bell" onClick={() => setOpen(o => !o)}><IBell />{notif.count > 0 && <span className="count">{notif.count}</span>}</button>
      {open && (
        <div className="notif-dropdown">
          <div className="nh">Needs your action</div>
          {notif.list.length === 0 ? <div className="empty2">You're all caught up 🎉</div>
            : notif.list.map(d => (<div className="ni" key={d.document_id}><span className="dot" /><div><b>{d.document_id}</b> — {statusInfo(d).label}<div className="muted" style={{ fontSize: 12 }}>Tower {d.tower} · Flat {d.flat_number}</div></div></div>))}
        </div>
      )}
    </div>
  );
}
function ConfirmModal({ state, onResolve }) {
  if (!state) return null;
  return (
    <div className="modal-overlay" onClick={() => onResolve(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="m-icon"><ICheck /></div>
        <h3>{state.title}</h3><p>{state.message}</p>
        <div className="m-actions">
          <button className="ghost" onClick={() => onResolve(false)}>Cancel</button>
          <button className="primary" onClick={() => onResolve(true)}>{state.confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}
function Toasts({ toasts }) {
  return (
    <div className="toasts">{toasts.map(t => (
      <div key={t.id} className={'toast ' + t.type}><span className="ti"><ICheck /></span><div><div className="tt">{t.type === 'error' ? 'Something went wrong' : t.type === 'info' ? 'Notification' : 'Success'}</div>{t.msg}</div></div>
    ))}</div>
  );
}

/* ================= App ================= */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(loadUser());
  const [tab, setTab] = useState('documents');
  const [collapsed, setCollapsed] = useState(false);
  const [docs, setDocs] = useState([]);
  const [notif, setNotif] = useState({ count: 0, list: [] });
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const prevNotif = useRef(null);

  const notify = useCallback((type, msg) => {
    const id = Math.random(); setToasts(t => [...t, { id, type, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const confirm = useCallback((opts) => new Promise(res => setModal({ ...opts, res })), []);
  const resolveModal = useCallback((v) => { setModal(m => { m && m.res(v); return null; }); }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    try { setDocs(await api('/api/documents')); } catch {}
    try {
      const n = await api('/api/notifications'); setNotif(n);
      if (prevNotif.current !== null && n.count > prevNotif.current) notify('info', `${n.count - prevNotif.current} new item(s) need your action`);
      prevNotif.current = n.count;
    } catch {}
  }, [user, notify]);

  const run = useCallback(async ({ confirmTitle, confirmMsg, confirmLabel, path, body, success, after }) => {
    if (confirmTitle && !(await confirm({ title: confirmTitle, message: confirmMsg, confirmLabel }))) return;
    try { await api(path, { method: 'POST', body }); notify('success', success || 'Done'); await reload(); if (after) await after(); }
    catch (e) { notify('error', e.message); }
  }, [confirm, notify, reload]);

  useEffect(() => { if (!user || booting) return; reload(); const t = setInterval(reload, POLL_MS); return () => clearInterval(t); }, [user, booting, reload]);

  function logout() { localStorage.removeItem('df_token'); localStorage.removeItem('df_user'); prevNotif.current = null; setUser(null); }

  if (booting) return <LoadingSplash onDone={() => setBooting(false)} />;
  if (!user) return <Login onLogin={u => { setUser(u); setTab(u.role === 'admin' ? 'documents' : u.role === 'transferrer' ? 'pickups' : 'browse'); }} />;
  if (user.must_change_password) return (
    <UI.Provider value={{ run, notify, confirm }}><div className="page"><ChangePassword forced onDone={() => setUser(loadUser())} /></div>
      <ConfirmModal state={modal} onResolve={resolveModal} /><Toasts toasts={toasts} /></UI.Provider>
  );

  const c = {
    approvals: docs.filter(d => d.status === 'out_admin_review').length,
    receiving: docs.filter(d => d.status === 'return_delivered').length,
    pickups: docs.filter(d => d.status === 'out_awaiting_pickup' || d.status === 'return_awaiting_pickup').length,
    transit: docs.filter(d => (d.status === 'out_in_transit' || d.status === 'return_in_transit') && d.transferrer_user_id === user.user_id).length,
    mine: docs.filter(d => d.status === 'out_delivered' && d.pending_holder_id === user.employee_id).length,
  };
  const itemsByRole = {
    admin: [
      { key: 'documents', label: 'Documents', icon: <IHome /> },
      { key: 'approvals', label: 'Approvals', icon: <ICheck />, badge: c.approvals },
      { key: 'receiving', label: 'Receiving', icon: <IInbox />, badge: c.receiving },
      { key: 'users', label: 'Users', icon: <IUsers /> },
      { key: 'password', label: 'Password', icon: <ILock /> },
    ],
    transferrer: [
      { key: 'pickups', label: 'Pickups', icon: <ITruck />, badge: c.pickups },
      { key: 'transit', label: 'In Transit', icon: <IInbox />, badge: c.transit },
      { key: 'documents', label: 'Documents', icon: <IHome /> },
      { key: 'password', label: 'Password', icon: <ILock /> },
    ],
    user: [
      { key: 'browse', label: 'All Documents', icon: <IFile /> },
      { key: 'mine', label: 'My Documents', icon: <IFolder />, badge: c.mine },
      { key: 'password', label: 'Password', icon: <ILock /> },
    ],
  };
  const items = itemsByRole[user.role] || itemsByRole.user;
  const titles = { documents: 'Live Document Locations', approvals: 'Issue Approvals', receiving: 'Returns Receiving', users: 'User Management', pickups: 'Pickup Requests', transit: 'In Transit', browse: 'All Documents', mine: 'My Custody', password: 'Account Settings' };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <UI.Provider value={{ run, notify, confirm }}>
      <div className="layout">
        <Sidebar user={user} items={items} tab={tab} setTab={setTab} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} onLogout={logout} />
        <div className="content">
          <div className="topbar2">
            <div className="title">{titles[tab] || 'Document Flow'}<small>Smart World Developers · Custody Portal</small></div>
            <div className="right"><NotifBell notif={notif} /><span className="live-pill"><span className="g" />LIVE</span><span className="date">{today}</span></div>
          </div>
          <div className="page">
            {user.role === 'admin' && tab === 'documents' && <OverviewTable docs={docs} title="Live document locations" />}
            {user.role === 'admin' && tab === 'approvals' && <AdminApprovals docs={docs} />}
            {user.role === 'admin' && tab === 'receiving' && <AdminReceiving docs={docs} />}
            {user.role === 'admin' && tab === 'users' && <Users />}
            {user.role === 'transferrer' && tab === 'pickups' && <TransferrerPickups docs={docs} />}
            {user.role === 'transferrer' && tab === 'transit' && <TransferrerTransit docs={docs} user={user} />}
            {user.role === 'transferrer' && tab === 'documents' && <OverviewTable docs={docs} title="Live document locations" />}
            {user.role === 'user' && tab === 'browse' && <BrowseDocuments docs={docs} />}
            {user.role === 'user' && tab === 'mine' && <MyDocuments user={user} />}
            {tab === 'password' && <ChangePassword onDone={() => setTab(user.role === 'admin' ? 'documents' : user.role === 'transferrer' ? 'pickups' : 'browse')} />}
          </div>
        </div>
      </div>
      <ConfirmModal state={modal} onResolve={resolveModal} />
      <Toasts toasts={toasts} />
    </UI.Provider>
  );
}
