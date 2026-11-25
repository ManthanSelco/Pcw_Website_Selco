// Video / audio / document links: what the website can show for each link.
// YouTube, Vimeo, Google Drive and .mp4/.mp3 play on the website; other links open in a new tab.
// Accepts youtube.com/watch?v=, youtu.be/, /embed/, /shorts/, /live/ or a bare 11-char id
export function youtubeId(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m =
    s.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    s.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

// What the website can do with a link: play it on the site, or open it in a new tab.
export function mediaFor(link) {
  const url = String(link || '').trim();
  if (!url) return { kind: 'none', embed: '' };
  // a document uploaded to the website (Admin > Recordings > Upload report)
  const file = url.match(/^\/files\/[a-f0-9-]{36}\.(pdf|docx?|pptx?)$/i);
  if (file) return { kind: file[1].toLowerCase() === 'pdf' ? 'pdf' : 'doc', embed: '', uploaded: true };
  const yt = youtubeId(url);
  if (yt) return { kind: 'youtube', youtubeId: yt, embed: `https://www.youtube-nocookie.com/embed/${yt}` };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { kind: 'none', embed: '' };
  }
  const host = u.hostname.replace(/^www\./, '');
  const p = u.pathname;
  if (host === 'open.spotify.com') {
    const m = p.match(/^\/(?:intl-[a-z-]+\/)?(episode|show|track|playlist|album)\/([A-Za-z0-9]+)/);
    if (m) return { kind: 'spotify', embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, tall: m[1] !== 'episode' && m[1] !== 'track' };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = p.match(/\/(?:video\/)?(\d{6,})/);
    if (m) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}` };
  }
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com')
    return { kind: 'soundcloud', embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23205c40&visual=false` };
  if (host === 'podcasts.apple.com') return { kind: 'apple', embed: `https://embed.podcasts.apple.com${p}${u.search}` };
  if (host === 'drive.google.com') {
    const m = p.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || [null, u.searchParams.get('id')];
    if (m[1]) return { kind: 'drive', embed: `https://drive.google.com/file/d/${m[1]}/preview` };
  }
  if (/\.(mp3|m4a|wav|ogg|aac)$/i.test(p)) return { kind: 'audio', src: url, embed: '' };
  if (/\.(mp4|webm|mov)$/i.test(p)) return { kind: 'video', src: url, embed: '' };
  if (/\.pdf$/i.test(p)) return { kind: 'pdf', embed: '' };
  return { kind: 'link', embed: '' };
}

