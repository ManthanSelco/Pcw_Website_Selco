// Site-wide settings that the admin can change (e.g. the "Book the space" form link).
export const DEFAULT_BOOKING_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScu0Rj-afE8XjFxZjLldXBF4JNQ0GywJl329n9rbpgaVySreg/viewform';

export async function getSite(store) {
  const s = (await store.collection('settings').findOne({ _id: 'site' })) || {};
  return { bookingUrl: s.bookingUrl || DEFAULT_BOOKING_URL, googleVerification: s.googleVerification || '', bingVerification: s.bingVerification || '', sameAs: Array.isArray(s.sameAs) ? s.sameAs : [] };
}

export function cleanSite(body) {
  const errors = {};
  const bookingUrl = String(body?.bookingUrl ?? '').trim().slice(0, 1000);
  if (bookingUrl && !/^https:\/\/[^\s]+$/i.test(bookingUrl)) errors.bookingUrl = 'Paste a full link starting with https://';
  // Search Console / Bing Webmaster verification: accept the code or the whole <meta> tag
  const code = (v) => {
    const t = String(v ?? '').trim();
    return (t.match(/content=["']([^"']+)["']/)?.[1] || t).slice(0, 200);
  };
  const googleVerification = code(body?.googleVerification);
  const bingVerification = code(body?.bingVerification);
  for (const [k, v] of Object.entries({ googleVerification, bingVerification }))
    if (v && !/^[A-Za-z0-9_\-=.]+$/.test(v)) errors[k] = 'Paste only the verification code';
  // official profiles (LinkedIn, YouTube, Instagram...): helps Google / AI tie them to PCW
  const raw = Array.isArray(body?.sameAs) ? body.sameAs : String(body?.sameAs ?? '').split(/[\s,]+/);
  const sameAs = [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))].slice(0, 12);
  if (sameAs.some((u) => !/^https:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(u))) errors.sameAs = 'Each profile link must start with https://';
  return { data: { bookingUrl, googleVerification, bingVerification, sameAs }, errors };
}
