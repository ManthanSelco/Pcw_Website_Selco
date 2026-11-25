// Frequently asked questions, edited in Admin > FAQ.
// Shown on /faq (and in Google / AI answers through FAQPage data and llms.txt).
// The default answers only use facts already on the website.
export const DEFAULT_FAQ = [
  {
    q: 'What is the Platform for Collective Wisdom (PCW)?',
    a: 'The Platform for Collective Wisdom (PCW) is a collaborative, AI-supported platform by SELCO Foundation. It brings scattered threads of knowledge together into actionable insights for problem-solving in the development sector, combining voices from the ground, practitioner perspectives and institutional knowledge.',
  },
  {
    q: 'Who runs PCW?',
    a: 'PCW is an initiative by SELCO Foundation.',
  },
  {
    q: 'Where is the PCW space in Bangalore?',
    a: 'Platform for Collective Wisdom, 1st Floor, 729 J.P. Towers, 8th Main Road, 11th Cross Rd, 3rd Phase, J. P. Nagar, Bengaluru, Karnataka 560078. Google Maps: https://maps.app.goo.gl/x8KkGeiJr2B6JG569',
  },
  {
    q: 'Does PCW have a space in Guwahati?',
    a: 'Yes. PCW in Guwahati is at the SELCO Foundation NE Regional Office, PNGB Rd, Nambari Railway Officers Colony, Gotanagar, Maligaon, Guwahati, Assam 781011. Phone: +91 97067 78232 or +91 70023 91228. Google Maps: https://www.google.com/maps/place/SELCO+Foundation+-+NE+Regional+Office/@26.1458642,91.685078,17z',
  },
  {
    q: 'What happens at the PCW spaces?',
    a: 'The spaces are used to meet and co-create, attend events such as talks, workshops and screenings, and host your own events.',
  },
  {
    q: 'How do I register for a PCW event?',
    a: 'Open the event on the Bangalore or Guwahati page and use its RSVP or Register button. Registration closes by itself once the event date has passed.',
  },
  {
    q: 'How can I book the PCW space for my event?',
    a: 'Use the "Book the space" form at the bottom of the Bangalore or Guwahati page, and the PCW team will get back to you.',
  },
  {
    q: 'Where can I watch recordings of PCW events?',
    a: 'Recordings of talks and events are on the Recordings page, under Videos. Podcasts and reports are on the same page.',
  },
  {
    q: 'How can I contact PCW?',
    a: 'Email contact@thepcw.ai. Phone: Bangalore +91 89048 46800; Guwahati +91 97067 78232 or +91 70023 91228.',
  },
  {
    q: 'How can I stay updated about PCW events?',
    a: 'Join the newsletter at the bottom of any page.',
  },
];

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export async function getFaq(store) {
  const doc = await store.collection('settings').findOne({ _id: 'faq' });
  return Array.isArray(doc?.items) ? doc.items : DEFAULT_FAQ;
}

export function cleanFaq(body) {
  const items = Array.isArray(body?.items) ? body.items : [];
  const errors = {};
  const out = [];
  items.slice(0, 60).forEach((x, i) => {
    const q = str(x?.q, 300);
    const a = str(x?.a, 3000);
    if (!q && !a) return; // empty row: ignore
    if (!q) errors[`q${i}`] = 'Write the question';
    if (!a) errors[`a${i}`] = 'Write the answer';
    out.push({ q, a });
  });
  return { data: { items: out }, errors };
}
