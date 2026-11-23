// "A Space to Connect in Person" section on each city page.
// Defaults below; the admin panel (City spaces) saves changes in the database.
import { CITIES } from './cities.js';

const CARDS = [
  { title: 'Meet & Co-Create', text: 'A shared space for learning, co-creation, and collective impact — where ideas turn into action.' },
  { title: 'Attend an Event', text: 'Join conversations that foster trust, dialogue, and collaboration among partners, practitioners, and communities.' },
  { title: 'Host an Event', text: 'Bring your network together through workshops, events, or focus groups that drive real-world change.' },
];

// Bangalore uses the photos of the Bengaluru space from the original website
const BANGALORE_PHOTOS = [
  '/assets/690d965be50a0ef0eeede2b3_Group 48257.png',
  '/assets/693fba8d48018c3dc18ea304_Group 48263 (2).png',
  '/assets/690d974870a043105c419cf9_Group 48255.png',
];

export function defaultSpace(city) {
  return {
    city,
    title: 'A Space to Connect in Person',
    intro: 'Beyond the digital platform, we’ve created a physical hub where connection turns into collaboration.',
    cards: CARDS.map((c, i) => ({ ...c, image: city === 'bangalore' ? BANGALORE_PHOTOS[i] : '' })),
  };
}

export async function getSpace(store, city) {
  const saved = await store.collection('settings').findOne({ _id: `space-${city}` });
  return saved ? { city, title: saved.title, intro: saved.intro, cards: saved.cards } : defaultSpace(city);
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function cleanSpace(b) {
  const errors = {};
  const data = {
    title: str(b.title, 120),
    intro: str(b.intro, 600),
    cards: (Array.isArray(b.cards) ? b.cards : []).slice(0, 6).map((c) => ({
      title: str(c?.title, 80),
      text: str(c?.text, 400),
      image: str(c?.image, 500),
    })),
  };
  if (!data.title) errors.title = 'Heading is required';
  data.cards.forEach((c, i) => {
    if (!c.title) errors[`card${i}`] = 'Card title is required';
    if (c.image && !/^(https?:\/\/|\/uploads\/|\/assets\/|\/samples\/)/i.test(c.image)) errors[`card${i}`] = 'Invalid image';
  });
  return { data, errors };
}

export const spaceCities = () => Object.keys(CITIES);
