// Same-origin in production (served behind the API host / proxy).
// Override with VITE_API_BASE if the API runs elsewhere.
const BASE = import.meta.env.VITE_API_BASE || '';

function token() { return localStorage.getItem('df_token'); }

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: 'Bearer ' + token() } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
