export async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  } catch {
    throw Object.assign(new Error('Could not reach the server. Please check your internet and try again.'), { errors: {} });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { errors: data.errors || {} });
  return data;
}

export function formatDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return 'Date to be announced';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts);
}
