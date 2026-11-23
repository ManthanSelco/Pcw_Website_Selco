export async function api(path, body, method) {
  let res;
  const opts = { credentials: 'same-origin' };
  if (body instanceof FormData) Object.assign(opts, { method: method || 'POST', body });
  else if (body !== undefined) Object.assign(opts, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  else if (method) opts.method = method;
  try {
    res = await fetch(path, opts);
  } catch {
    throw Object.assign(new Error('Could not reach the server. Please check your internet and try again.'), { errors: {}, status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong'), { errors: data.errors || {}, status: res.status });
  return data;
}

export function formatDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return 'Date to be announced';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', opts);
}

// "18:30" -> "6:30 PM"
export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function timeRange(e) {
  if (e.startTime) return [formatTime(e.startTime), formatTime(e.endTime)].filter(Boolean).join(' – ');
  return e.timeText || '';
}

export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
