// PCW spaces. Add a city here (and in client/src/cities.js) to get a new event page.
export const CITIES = {
  bangalore: { name: 'Bangalore' },
  guwahati: { name: 'Guwahati' },
};

// "Today" in India, as YYYY-MM-DD (events are split into upcoming / past by this)
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
