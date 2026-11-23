// Sample events (BIC-style) so the pages are not empty on day one.
// They are marked sample:true, show a small "Sample" tag on the website, and can be
// removed in one click from Admin > Events > "Delete all sample events".
// They are added only once (the first time the database has no events).
import { slugify } from './events.js';

const NOTE = '\n\nThis is a sample event, added to show how event pages work. Edit or delete it from the admin panel.';

const S = [
  // ----- Bangalore: upcoming -----
  {
    city: 'bangalore', date: '2026-12-05', startTime: '18:30', endTime: '20:00', category: 'Talks',
    title: 'Energy for Livelihoods: What Works on the Ground',
    tagline: 'An evening talk on clean energy solutions that help small enterprises earn more.',
    image: '/samples/auditorium.webp', rsvp: 'open', capacity: 120,
    description: 'Practitioners share what they have learnt from working with farmers, artisans and micro-entrepreneurs, and what it takes for a solution to really last in the field.',
    speakers: [{ name: '[Speaker name]', role: '[Role, organisation]' }, { name: '[Moderator name]', role: 'Moderator' }],
  },
  {
    city: 'bangalore', date: '2026-12-12', startTime: '10:00', endTime: '13:00', category: 'Workshops',
    title: 'Designing with End Users: A Hands-on Workshop',
    tagline: 'Map a real livelihood journey and design around the person who will use the solution.',
    image: '/samples/wall.webp', rsvp: 'open', capacity: 30,
    description: 'A practical morning workshop. Work in small groups with real case material, sticky notes and a lot of conversation. No prior experience needed.',
    speakers: [{ name: '[Facilitator name]', role: '[Role, organisation]' }],
  },
  {
    city: 'bangalore', date: '2026-12-19', startTime: '17:00', endTime: '19:00', category: 'Film & Screenings',
    title: 'Work at 45°C: Screening and Conversation',
    tagline: 'Short films on workspaces and heat, followed by an open discussion.',
    image: '/samples/space-green.webp', rsvp: 'closed',
    description: 'A screening of short films about the places people work in, and how design can make work safer and more dignified. RSVPs for this sample event are shown as closed.',
    speakers: [],
  },
  {
    city: 'bangalore', date: '2027-01-09', startTime: '11:00', endTime: '12:30', category: 'Conversations',
    title: 'Voices from Ground: Women Entrepreneurs in Conversation',
    tagline: 'Women running rural enterprises talk about what changed for them, and what still needs to.',
    image: '/samples/women.webp', rsvp: 'open', capacity: 80,
    description: 'An informal conversation in the PCW space with women entrepreneurs, followed by tea and time to meet the speakers.',
    speakers: [{ name: '[Speaker name]', role: '[Enterprise, place]' }, { name: '[Speaker name]', role: '[Enterprise, place]' }],
  },
  // ----- Bangalore: past -----
  {
    city: 'bangalore', date: '2026-10-18', startTime: '16:00', endTime: '17:30', category: 'Talks',
    title: 'Enabling Disability-Friendly Livelihoods',
    tagline: 'How energy solutions can be designed so that people with disabilities can run their own enterprise.',
    image: '/samples/space-yellow.webp', youtubeUrl: 'https://www.youtube.com/watch?v=NT-gVjZCct8',
    description: 'A talk on designing tools and workspaces together with entrepreneurs with disabilities. Watch the video on this page.',
    speakers: [{ name: '[Speaker name]', role: '[Role, organisation]' }],
  },
  {
    city: 'bangalore', date: '2026-09-20', startTime: '15:00', endTime: '17:00', category: 'Panel Discussions',
    title: 'Risk Guarantee Funds: Finance for the Last Mile',
    tagline: 'Can a guarantee fund open up loans for workers and enterprises that banks usually miss?',
    image: '/samples/auditorium.webp', youtubeUrl: 'https://www.youtube.com/watch?v=ps65pgdaw6U',
    description: 'A panel on financing models for small borrowers, with examples from the field.',
    speakers: [{ name: '[Panelist name]', role: '[Organisation]' }, { name: '[Panelist name]', role: '[Organisation]' }],
  },
  {
    city: 'bangalore', date: '2026-08-30', startTime: '10:00', endTime: '16:00', category: 'Community',
    title: 'Open House at the PCW Space',
    tagline: 'A day to walk in, look around and meet the people behind the Collective.',
    image: '/samples/space-pink.webp',
    description: 'The PCW space opened its doors for a day of conversations, tours and small sessions.',
    speakers: [],
  },
  // ----- Guwahati: upcoming -----
  {
    city: 'guwahati', date: '2026-12-10', startTime: '15:00', endTime: '17:00', category: 'Talks',
    title: 'Climate-Adaptive Health Facilities in the Northeast',
    tagline: 'What it takes to keep rural health centres running through heat, rain and power cuts.',
    image: '/samples/auditorium.webp', rsvp: 'open', capacity: 100,
    description: 'Health workers and practitioners talk about energy, building design and care in remote facilities across the region.',
    speakers: [{ name: '[Speaker name]', role: '[Role, organisation]' }],
  },
  {
    city: 'guwahati', date: '2027-01-16', startTime: '11:00', endTime: '15:00', category: 'Community',
    title: "Crafts & Textiles Makers' Meet",
    tagline: 'Weavers, artisans and designers meet to share tools, markets and ideas.',
    image: '/samples/wall.webp', rsvp: 'open', capacity: 60,
    description: 'A relaxed meet-up with short demos, a market table and time to talk.',
    speakers: [],
  },
  // ----- Guwahati: past -----
  {
    city: 'guwahati', date: '2026-10-25', startTime: '10:00', endTime: '13:00', category: 'Film & Screenings',
    title: 'Energy for Health Summit (North Eastern Region): Screening',
    tagline: 'A screening of the summit film, followed by a discussion.',
    image: '/samples/space-green.webp', youtubeUrl: 'https://youtu.be/Yw1oFCemAxE',
    description: 'Watch the film on this page.',
    speakers: [],
  },
  {
    city: 'guwahati', date: '2026-09-12', startTime: '16:00', endTime: '17:30', category: 'Talks',
    title: 'Solar Solutions for Rural Health Centres',
    tagline: 'Stories from health sub-centres that switched to reliable solar power.',
    image: '/samples/women.webp', youtubeUrl: 'https://youtu.be/ZVHO2EPneaA',
    description: 'A short talk and video on solar-powered health centres.',
    speakers: [],
  },
];

export async function seedSamples(store) {
  const settings = store.collection('settings');
  const events = store.collection('events');
  if (await settings.findOne({ _id: 'samplesSeeded' })) return 0;
  if ((await events.count()) > 0) {
    await settings.updateOne({ _id: 'samplesSeeded' }, { at: new Date().toISOString(), skipped: true }, { upsert: true });
    return 0;
  }
  const now = new Date().toISOString();
  for (const e of S) {
    await events.insertOne({
      rsvp: 'none',
      capacity: null,
      venue: e.city === 'bangalore' ? 'PCW Space, Bengaluru' : 'PCW Space, Guwahati',
      youtubeUrl: '',
      published: true,
      ...e,
      description: e.description + NOTE,
      slug: `${slugify(e.title)}-${e.date}`,
      sample: true,
      createdAt: now,
    });
  }
  await settings.updateOne({ _id: 'samplesSeeded' }, { at: now }, { upsert: true });
  return S.length;
}
