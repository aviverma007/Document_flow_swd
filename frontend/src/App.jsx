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
const ISettings = () => <svg viewBox="0 0 24 24" {...ic}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1a1.6 1.6 0 00-2.7-1.1l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00-1.1-2.7H3a2 2 0 110-4h.1a1.6 1.6 0 001.1-2.7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 002.7-1.1V3a2 2 0 114 0v.1a1.6 1.6 0 002.7 1.1l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-1.1 2.7H21a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" /></svg>;

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

/* ================= Project-first browsing ================= */
function ProjectBar({ projects, project, setProject }) {
  return (
    <div className="proj-bar">
      <span className="proj-label">Project:</span>
      {projects.map(p => (
        <button key={p} className={'proj-chip' + (project === p ? ' on' : '')} onClick={() => setProject(project === p ? '' : p)}>{p}</button>
      ))}
    </div>
  );
}
function ProjectPrompt() {
  return <div className="card"><div className="empty">Select a project above to view its files.</div></div>;
}

// Read-only overview (admin overview when not editing, and transferrer)
function OverviewTable({ docs, title }) {
  const projects = [...new Set(docs.map(d => d.doc_type).filter(Boolean))].sort();
  const [project, setProject] = useState('');
  const [tower, setTower] = useState(''); const [search, setSearch] = useState('');
  const inProj = docs.filter(d => d.doc_type === project);
  const towers = [...new Set(inProj.map(d => d.tower).filter(Boolean))].sort();
  const list = inProj.filter(d => (!tower || d.tower === tower) &&
    (!search || `${d.document_id} ${d.flat_number} ${d.remarks || ''} ${d.holder_name || ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <>
      <ProjectBar projects={projects} project={project} setProject={setProject} />
      {!project ? <ProjectPrompt /> : (
        <div className="card">
          <h3><span className="live-dot" />{title} — {project} ({list.length})</h3>
          <div className="filters">
            <input placeholder="Search file no / flat / customer / holder" value={search} onChange={e => setSearch(e.target.value)} />
            <select value={tower} onChange={e => setTower(e.target.value)}><option value="">All towers</option>{towers.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div className="panel-scroll" style={{ maxHeight: 460 }}>
            <table><thead><tr><th>File No</th><th>Tower</th><th>Flat</th><th>Customer</th><th>Status</th><th>Transferrer</th></tr></thead>
              <tbody>
                {list.map(d => (<tr key={d.document_id} className={d.record_status === 'cancelled' ? 'row-cancelled' : ''}>
                  <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td className="muted">{d.remarks || '—'}</td>
                  <td><StatusBadge d={d} />{d.record_status === 'cancelled' && <span className="badge b-cancel" style={{ marginLeft: 6 }}>Cancelled</span>}</td>
                  <td className="muted">{d.transferrer_name || '—'}</td></tr>))}
                {list.length === 0 && <tr><td colSpan={6} className="empty">No files match.</td></tr>}
              </tbody></table>
          </div>
        </div>
      )}
    </>
  );
}

/* ================= Admin: documents (edit + add) ================= */
function EditDocModal({ doc, onClose, onSaved }) {
  const { notify } = useContext(UI);
  const [fileNo, setFileNo] = useState(doc.document_id);
  const [customer, setCustomer] = useState(doc.remarks || '');
  const [tower, setTower] = useState(doc.tower || '');
  const [flat, setFlat] = useState(doc.flat_number || '');
  const [status, setStatus] = useState(doc.record_status || 'active');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api(`/api/documents/${encodeURIComponent(doc.document_id)}`, { method: 'PUT',
        body: { file_no: fileNo, customer, tower, flat_number: flat, record_status: status } });
      notify('success', 'Document updated'); onSaved();
    } catch (e) { notify('error', e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <h3>Edit file</h3>
        <div className="field"><label>File No</label><input value={fileNo} onChange={e => setFileNo(e.target.value)} /></div>
        <div className="field"><label>Customer name</label><input value={customer} onChange={e => setCustomer(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>Tower</label><input value={tower} onChange={e => setTower(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Flat</label><input value={flat} onChange={e => setFlat(e.target.value)} /></div>
        </div>
        <div className="field"><label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)}><option value="active">Active</option><option value="cancelled">Cancelled</option></select></div>
        <div className="m-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>
      </div>
    </div>
  );
}

function AddDocsPanel({ project, onClose, onSaved }) {
  const { notify } = useContext(UI);
  const [rows, setRows] = useState([{ file_no: '', tower: '', flat: '', customer: '' }]);
  const [busy, setBusy] = useState(false);
  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const addLine = () => setRows(rs => [...rs, { file_no: '', tower: '', flat: '', customer: '' }]);
  const delLine = (i) => setRows(rs => rs.filter((_, j) => j !== i));
  async function saveAll() {
    const documents = rows.filter(r => r.file_no.trim()).map(r => ({ document_id: r.file_no.trim(), tower: r.tower.trim(), flat_number: r.flat.trim(), doc_type: project, remarks: r.customer.trim() }));
    if (!documents.length) return notify('error', 'Add at least one file no');
    setBusy(true);
    try {
      const res = await api('/api/documents', { method: 'POST', body: { documents } });
      notify('success', `${res.added} added${res.skipped.length ? `, ${res.skipped.length} skipped (already exist)` : ''}`);
      onSaved();
    } catch (e) { notify('error', e.message); } finally { setBusy(false); }
  }
  return (
    <div className="card">
      <h3>Add new files to {project}</h3>
      <table><thead><tr><th>File No *</th><th>Tower</th><th>Flat</th><th>Customer</th><th></th></tr></thead>
        <tbody>{rows.map((r, i) => (<tr key={i}>
          <td><input value={r.file_no} onChange={e => setRow(i, 'file_no', e.target.value)} placeholder="e.g. EDN-9001" /></td>
          <td><input value={r.tower} onChange={e => setRow(i, 'tower', e.target.value)} placeholder="T1" /></td>
          <td><input value={r.flat} onChange={e => setRow(i, 'flat', e.target.value)} placeholder="101" /></td>
          <td><input value={r.customer} onChange={e => setRow(i, 'customer', e.target.value)} placeholder="Customer name" /></td>
          <td className="right">{rows.length > 1 && <button className="ghost" onClick={() => delLine(i)}>✕</button>}</td>
        </tr>))}</tbody></table>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="ghost" onClick={addLine}>＋ Add line</button>
        <div style={{ flex: 1 }} />
        <button className="ghost" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={saveAll} disabled={busy}>{busy ? 'Saving…' : 'Save all'}</button>
      </div>
    </div>
  );
}

function AdminDocuments({ docs, reload }) {
  const projects = [...new Set(docs.map(d => d.doc_type).filter(Boolean))].sort();
  const [project, setProject] = useState('');
  const [tower, setTower] = useState(''); const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); const [adding, setAdding] = useState(false);
  const inProj = docs.filter(d => d.doc_type === project);
  const towers = [...new Set(inProj.map(d => d.tower).filter(Boolean))].sort();
  const list = inProj.filter(d => (!tower || d.tower === tower) &&
    (!search || `${d.document_id} ${d.flat_number} ${d.remarks || ''} ${d.holder_name || ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <>
      <ProjectBar projects={projects} project={project} setProject={p => { setProject(p); setAdding(false); }} />
      {!project ? <ProjectPrompt /> : (
        <>
          {adding && <AddDocsPanel project={project} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
          <div className="card">
            <h3><span className="live-dot" />{project} files ({list.length})
              <button className="primary" style={{ marginLeft: 'auto', padding: '6px 12px' }} onClick={() => setAdding(a => !a)}>＋ Add documents</button>
            </h3>
            <div className="filters">
              <input placeholder="Search file no / flat / customer / holder" value={search} onChange={e => setSearch(e.target.value)} />
              <select value={tower} onChange={e => setTower(e.target.value)}><option value="">All towers</option>{towers.map(t => <option key={t} value={t}>{t}</option>)}</select>
            </div>
            <div className="panel-scroll" style={{ maxHeight: 440 }}>
              <table><thead><tr><th>File No</th><th>Tower</th><th>Flat</th><th>Customer</th><th>Status</th><th className="right">Edit</th></tr></thead>
                <tbody>
                  {list.map(d => (<tr key={d.document_id} className={d.record_status === 'cancelled' ? 'row-cancelled' : ''}>
                    <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td className="muted">{d.remarks || '—'}</td>
                    <td><StatusBadge d={d} />{d.record_status === 'cancelled' && <span className="badge b-cancel" style={{ marginLeft: 6 }}>Cancelled</span>}</td>
                    <td className="right"><button className="ghost" onClick={() => setEditing(d)}>Edit</button></td></tr>))}
                  {list.length === 0 && <tr><td colSpan={6} className="empty">No files match.</td></tr>}
                </tbody></table>
            </div>
          </div>
        </>
      )}
      {editing && <EditDocModal doc={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

/* ================= Admin ================= */
function RejectModal({ doc, onClose }) {
  const { notify, reload } = useContext(UI);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    if (!note.trim()) return notify('error', 'Please add a note explaining the rejection');
    setBusy(true);
    try {
      await api('/api/admin/reject', { method: 'POST', body: { document_id: doc.document_id, note } });
      notify('success', 'Request rejected — employee notified'); await reload(); onClose();
    } catch (e) { notify('error', e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <h3>Reject request for {doc.document_id}</h3>
        <p className="muted" style={{ marginBottom: 8 }}>Requested by {doc.pending_name}{doc.request_doc_name ? ` · “${doc.request_doc_name}”` : ''}{doc.request_reason ? ` — ${doc.request_reason}` : ''}</p>
        <div className="field"><label>Rejection note (shown to the employee) *</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Why is this request being rejected?" style={{ width: '100%', resize: 'vertical' }} autoFocus /></div>
        <div className="m-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={submit} disabled={busy}>{busy ? 'Rejecting…' : 'Reject & notify'}</button></div>
      </div>
    </div>
  );
}
function AdminApprovals({ docs }) {
  const { run } = useContext(UI);
  const [rejecting, setRejecting] = useState(null);
  const list = docs.filter(d => d.status === 'out_admin_review');
  return (
    <div className="card"><h3>Issue requests to approve ({list.length})</h3>
      <div className="panel-scroll" style={{ maxHeight: 460 }}>
      <table><thead><tr><th>File No</th><th>Tower / Flat</th><th>Requested for</th><th>Document name</th><th>Reason</th><th className="right">Decision</th></tr></thead>
        <tbody>
          {list.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{d.pending_name}</td>
            <td>{d.request_doc_name || '—'}</td><td className="muted">{d.request_reason || '—'}</td>
            <td className="right">
              <button className="primary" onClick={() => run({ confirmTitle: 'Approve issue request?', confirmMsg: `Approve issuing ${d.document_id} to ${d.pending_name}? A pickup task will be sent to the transferrer.`, confirmLabel: 'Approve', path: '/api/admin/approve', body: { document_id: d.document_id }, success: 'Approved — pickup sent to transferrer' })}>Approve</button>{' '}
              <button className="ghost" onClick={() => setRejecting(d)}>Reject</button>
            </td></tr>))}
          {list.length === 0 && <tr><td colSpan={6} className="empty">No issue requests waiting.</td></tr>}
        </tbody></table>
      </div>
      {rejecting && <RejectModal doc={rejecting} onClose={() => setRejecting(null)} />}
    </div>
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
            const confirmMsg = isOut ? `Confirm you dropped ${d.document_id} to ${d.pending_name}? It goes straight into their custody.` : `Confirm you dropped ${d.document_id} at storage? Admin will confirm receipt.`;
            return (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td>{to}</td>
              <td className="right"><button className="primary" onClick={() => run({ confirmTitle: 'Mark as dropped?', confirmMsg, confirmLabel: 'Dropped', path: '/api/transferrer/dropped', body: { document_id: d.document_id }, success: 'Marked as dropped' })}>Dropped</button></td></tr>);
          })}
          {list.length === 0 && <tr><td colSpan={4} className="empty">Nothing in transit.</td></tr>}
        </tbody></table></div>
  );
}

/* ================= User ================= */
function RequestModal({ doc, onClose }) {
  const { notify, reload } = useContext(UI);
  const [name, setName] = useState(''); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() {
    if (!name.trim() || !reason.trim()) return notify('error', 'Please enter the document name and a reason');
    setBusy(true);
    try {
      await api('/api/movements/request-take', { method: 'POST', body: { document_id: doc.document_id, doc_name: name, reason } });
      notify('success', 'Request sent for admin approval'); await reload(); onClose();
    } catch (e) { notify('error', e.message); } finally { setBusy(false); }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <h3>Request file {doc.document_id}</h3>
        <p className="muted" style={{ marginBottom: 16 }}>Tower {doc.tower} · Flat {doc.flat_number}{doc.remarks ? ` · ${doc.remarks}` : ''}</p>
        <div className="field"><label>Document name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Which document / paper do you need?" autoFocus /></div>
        <div className="field"><label>Reason for request *</label><textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why do you need this file?" style={{ width: '100%', resize: 'vertical' }} /></div>
        <div className="m-actions"><button className="ghost" onClick={onClose}>Cancel</button><button className="primary" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></div>
      </div>
    </div>
  );
}

function BrowseDocuments({ docs }) {
  const projects = [...new Set(docs.map(d => d.doc_type).filter(Boolean))].sort();
  const [project, setProject] = useState('');
  const [search, setSearch] = useState(''); const [tower, setTower] = useState('');
  const [requesting, setRequesting] = useState(null);
  const inProj = docs.filter(d => d.doc_type === project);
  const towers = [...new Set(inProj.map(d => d.tower).filter(Boolean))].sort();
  const list = inProj.filter(d => (!tower || d.tower === tower) &&
    (!search || `${d.document_id} ${d.flat_number} ${d.remarks || ''}`.toLowerCase().includes(search.toLowerCase())));
  return (
    <>
      <ProjectBar projects={projects} project={project} setProject={setProject} />
      {!project ? <ProjectPrompt /> : (
        <div className="card"><h3><span className="live-dot" />{project} files</h3>
          <div className="filters"><input placeholder="Search file no / flat / customer" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <select value={tower} onChange={e => setTower(e.target.value)}><option value="">All towers</option>{towers.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
          {!search.trim() ? (
            <div className="empty">Type a file no, flat, or customer name to search {project} files.</div>
          ) : (
          <div className="panel-scroll" style={{ maxHeight: 460 }}>
            <table><thead><tr><th>File No</th><th>Tower</th><th>Flat</th><th>Customer</th><th>Status</th><th className="right">Action</th></tr></thead>
              <tbody>
                {list.map(d => (<tr key={d.document_id} className={d.record_status === 'cancelled' ? 'row-cancelled' : ''}>
                  <td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td className="muted">{d.remarks || '—'}</td><td><StatusBadge d={d} /></td>
                  <td className="right">{d.record_status === 'cancelled' ? <span className="badge b-cancel">Cancelled</span>
                    : d.status === 'in_storage'
                      ? <button className="primary" onClick={() => setRequesting(d)}>Request to take</button>
                      : <span className="muted">Unavailable</span>}</td></tr>))}
                {list.length === 0 && <tr><td colSpan={6} className="empty">No files match “{search}”.</td></tr>}
              </tbody></table>
          </div>
          )}
        </div>
      )}
      {requesting && <RequestModal doc={requesting} onClose={() => setRequesting(null)} />}
    </>
  );
}
function MyDocuments({ user }) {
  const { run } = useContext(UI);
  const [docs, setDocs] = useState([]);
  const load = useCallback(() => api('/api/documents/mine').then(setDocs).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);
  const custody = docs.filter(d => ['with_employee', 'return_awaiting_pickup', 'return_in_transit', 'return_delivered'].includes(d.status) && d.current_holder_id === user.employee_id);
  const incoming = docs.filter(d => ['out_admin_review', 'out_awaiting_pickup', 'out_in_transit'].includes(d.status) && d.pending_holder_id === user.employee_id);
  return (
    <>
      <div className="card fixed-panel"><h3>In my custody ({custody.length})</h3>
        <div className="panel-scroll">
        <table><thead><tr><th>Document</th><th>Tower</th><th>Flat</th><th>Status</th><th className="right">Action</th></tr></thead>
          <tbody>
            {custody.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td>{d.tower}</td><td>{d.flat_number}</td><td><StatusBadge d={d} /></td>
              <td className="right">{d.status === 'with_employee'
                ? <button className="primary" onClick={() => run({ confirmTitle: 'Return this document?', confirmMsg: `Request return of ${d.document_id} to storage? A transferrer will pick it up from you.`, confirmLabel: 'Return', path: '/api/movements/request-return', body: { document_id: d.document_id }, success: 'Return requested — transferrer will collect it', after: load })}>Return to storage</button>
                : <span className="muted">Return in progress</span>}</td></tr>))}
            {custody.length === 0 && <tr><td colSpan={5} className="empty">You are not holding any documents.</td></tr>}
          </tbody></table>
        </div></div>
      {incoming.length > 0 && (
        <div className="card"><h3>Incoming to you ({incoming.length})</h3>
          <table><thead><tr><th>Document</th><th>Tower / Flat</th><th>Status</th></tr></thead>
            <tbody>{incoming.map(d => (<tr key={d.document_id}><td>{d.document_id}</td><td className="muted">{d.tower} · {d.flat_number}</td><td><StatusBadge d={d} /></td></tr>))}</tbody></table></div>
      )}
    </>
  );
}

/* ================= Admin: custody report ================= */
const STAGE_LABEL = {
  requested: 'Requested', admin_approved: 'Approved by admin', accepted: 'Picked up by transferrer',
  delivered: 'Delivered to employee', received: 'Received by employee', not_received: 'Not received',
  return_requested: 'Return requested', dropped: 'Dropped at storage', admin_received: 'Received into storage',
  rejected: 'Rejected',
};
function whereNow(row) {
  return statusInfo({ status: row.current_status, holder_name: row.current_holder_name, pending_name: row.pending_name });
}
function Report() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState(''); const [emp, setEmp] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const load = useCallback(() => api('/api/report/custody').then(setRows).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t); }, [load]);

  const list = rows.filter(r => {
    if (search && !`${r.document_id} ${r.flat_number} ${r.remarks || ''}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (emp && !`${r.emp_name || ''} ${r.emp_id || ''}`.toLowerCase().includes(emp.toLowerCase())) return false;
    const at = new Date(r.at);
    if (from && at < new Date(from)) return false;
    if (to) { const end = new Date(to); end.setHours(23, 59, 59); if (at > end) return false; }
    return true;
  });

  function exportCsv() {
    const head = ['File No', 'Project', 'Tower', 'Flat', 'Customer', 'Event', 'Employee', 'By', 'When', 'Current location'];
    const lines = [head.join(',')].concat(list.map(r => [
      r.document_id, r.doc_type, r.tower, r.flat_number, r.remarks, STAGE_LABEL[r.stage] || r.stage,
      r.emp_name || '', r.actor || '', new Date(r.at).toLocaleString(), whereNow(r).label
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `custody_report_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <h3><span className="live-dot" />Custody report ({list.length})
        <button className="ghost" style={{ marginLeft: 'auto' }} onClick={exportCsv}>⭳ Export CSV</button></h3>
      <div className="filters">
        <input placeholder="File no / flat / customer" value={search} onChange={e => setSearch(e.target.value)} />
        <input placeholder="Employee name / id" value={emp} onChange={e => setEmp(e.target.value)} />
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} title="To date" />
      </div>
      <div className="panel-scroll" style={{ maxHeight: 480 }}>
        <table><thead><tr><th>File No</th><th>Tower/Flat</th><th>Customer</th><th>Event</th><th>Employee</th><th>By</th><th>When</th><th>Where now</th></tr></thead>
          <tbody>
            {list.map(r => (<tr key={r.movement_id}>
              <td>{r.document_id}</td><td className="muted">{r.tower} · {r.flat_number}</td>
              <td className="muted">{r.remarks || '—'}</td>
              <td>{STAGE_LABEL[r.stage] || r.stage}</td>
              <td>{r.emp_name || '—'}</td>
              <td className="muted">{r.actor || '—'}</td>
              <td className="muted">{new Date(r.at).toLocaleString()}</td>
              <td><span className={'badge ' + whereNow(r).cls}>{whereNow(r).label}</span></td>
            </tr>))}
            {list.length === 0 && <tr><td colSpan={8} className="empty">No custody events match.</td></tr>}
          </tbody></table>
      </div>
    </div>
  );
}

/* ================= Sidebar / bell / modal / toasts ================= */
function Sidebar({ user, items, tab, setTab, collapsed, onToggle, onSettings, onLogout }) {
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
      <div className="side-footer">
        <button className={'nav-item' + (tab === 'password' ? ' active' : '')} onClick={onSettings} title="Settings">
          <ISettings /><span>Settings</span>
        </button>
        <div className="user-block"><div className="avatar">{initials}</div>
          <div className="meta"><div className="nm">{user.username}</div><div className="rl"><span className="g" />{user.role}</div></div>
        </div>
        <button className="logout-btn" onClick={onLogout} title="Logout"><IPower /><span>Logout</span></button>
      </div>
    </div>
  );
}
function NotifBell({ items, onOpen }) {
  const [open, setOpen] = useState(false);
  function toggle() { const n = !open; setOpen(n); if (n && onOpen) onOpen(); }
  const count = items.filter(i => i.unseen !== false).length;
  return (
    <div className="bellwrap">
      <button className="bell" onClick={toggle}><IBell />{count > 0 && <span className="count">{count}</span>}</button>
      {open && (
        <div className="notif-dropdown">
          <div className="nh">Notifications</div>
          {items.length === 0 ? <div className="empty2">You're all caught up 🎉</div>
            : items.map(i => (<div className="ni" key={i.key}><span className="dot" /><div><div>{i.text}</div><div className="muted" style={{ fontSize: 12 }}>{i.sub}</div></div></div>))}
        </div>
      )}
    </div>
  );
}
function AlertModal({ state, onClose }) {
  if (!state) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="m-icon" style={{ background: '#fdecec', color: '#a32d2d' }}><IBell /></div>
        <h3>{state.title}</h3><p>{state.message}</p>
        <div className="m-actions"><button className="primary" onClick={onClose}>OK</button></div>
      </div>
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
  const [userNotes, setUserNotes] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [alertMsg, setAlertMsg] = useState(null);
  const prevNotif = useRef(null);
  const seenNoteIds = useRef(new Set());

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
    if (user.role === 'user') {
      try {
        const notes = await api('/api/my-notifications'); setUserNotes(notes);
        const fresh = notes.filter(x => !x.seen && !seenNoteIds.current.has(x.id));
        if (fresh.length) { setAlertMsg({ title: 'Request update', message: fresh[0].message }); notify('info', 'You have a new note from admin'); }
        notes.forEach(x => seenNoteIds.current.add(x.id));
      } catch {}
    }
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
    <UI.Provider value={{ run, notify, confirm, reload }}><div className="page"><ChangePassword forced onDone={() => setUser(loadUser())} /></div>
      <ConfirmModal state={modal} onResolve={resolveModal} /><Toasts toasts={toasts} /></UI.Provider>
  );

  const c = {
    approvals: docs.filter(d => d.status === 'out_admin_review').length,
    receiving: docs.filter(d => d.status === 'return_delivered').length,
    pickups: docs.filter(d => d.status === 'out_awaiting_pickup' || d.status === 'return_awaiting_pickup').length,
    transit: docs.filter(d => (d.status === 'out_in_transit' || d.status === 'return_in_transit') && d.transferrer_user_id === user.user_id).length,
    // documents currently in the employee's hand (held or return-in-progress) + any awaiting their receipt
    mine: docs.filter(d => (d.current_holder_id === user.employee_id) ||
      (d.status === 'out_delivered' && d.pending_holder_id === user.employee_id)).length,
  };
  const itemsByRole = {
    admin: [
      { key: 'documents', label: 'Documents', icon: <IHome /> },
      { key: 'approvals', label: 'Approvals', icon: <ICheck />, badge: c.approvals },
      { key: 'receiving', label: 'Receiving', icon: <IInbox />, badge: c.receiving },
      { key: 'report', label: 'Report', icon: <IFile /> },
      { key: 'users', label: 'Users', icon: <IUsers /> },
    ],
    transferrer: [
      { key: 'pickups', label: 'Pickups', icon: <ITruck />, badge: c.pickups },
      { key: 'transit', label: 'In Transit', icon: <IInbox />, badge: c.transit },
      { key: 'documents', label: 'Documents', icon: <IHome /> },
    ],
    user: [
      { key: 'browse', label: 'All Documents', icon: <IFile /> },
      { key: 'mine', label: 'My Documents', icon: <IFolder />, badge: c.mine },
    ],
  };
  const items = itemsByRole[user.role] || itemsByRole.user;
  const bellItems = user.role === 'user'
    ? userNotes.map(n => ({ key: n.id, text: n.message, sub: new Date(n.created_at).toLocaleString(), unseen: !n.seen }))
    : notif.list.map(d => ({ key: d.document_id, text: `${d.document_id} — ${statusInfo(d).label}`, sub: `Tower ${d.tower} · Flat ${d.flat_number}`, unseen: true }));
  async function onBellOpen() {
    if (user.role === 'user' && userNotes.some(n => !n.seen)) {
      try { await api('/api/my-notifications/seen', { method: 'POST' }); setUserNotes(ns => ns.map(n => ({ ...n, seen: true }))); } catch {}
    }
  }
  const titles = { documents: 'Live Document Locations', approvals: 'Issue Approvals', receiving: 'Returns Receiving', report: 'Custody Report', users: 'User Management', pickups: 'Pickup Requests', transit: 'In Transit', browse: 'All Documents', mine: 'My Custody', password: 'Account Settings' };
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <UI.Provider value={{ run, notify, confirm, reload }}>
      <div className="layout">
        <Sidebar user={user} items={items} tab={tab} setTab={setTab} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} onSettings={() => setTab('password')} onLogout={logout} />
        <div className="content">
          <div className="topbar2">
            <div className="title">{titles[tab] || 'Document Flow'}<small>Smart World Developers · Custody Portal</small></div>
            <div className="right"><NotifBell items={bellItems} onOpen={onBellOpen} /><span className="live-pill"><span className="g" />LIVE</span><span className="date">{today}</span></div>
          </div>
          <div className="page">
            {user.role === 'admin' && tab === 'documents' && <AdminDocuments docs={docs} reload={reload} />}
            {user.role === 'admin' && tab === 'approvals' && <AdminApprovals docs={docs} />}
            {user.role === 'admin' && tab === 'receiving' && <AdminReceiving docs={docs} />}
            {user.role === 'admin' && tab === 'report' && <Report />}
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
      <AlertModal state={alertMsg} onClose={() => setAlertMsg(null)} />
      <Toasts toasts={toasts} />
    </UI.Provider>
  );
}
