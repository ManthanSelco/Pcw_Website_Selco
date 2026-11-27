// SEO + AEO (answer engines like ChatGPT, Perplexity, Google AI Overviews).
// Every page is sent with: its own <title> and description, canonical link, Open Graph /
// Twitter share tags, schema.org JSON-LD (Organization, WebSite, Event, PodcastEpisode,
// VideoObject…), and the page's main text as plain HTML inside #root, so crawlers that
// don't run JavaScript can still read and quote it. React replaces that HTML on load.
// Also builds /sitemap.xml, /robots.txt and /llms.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CITIES, todayIST } from './cities.js';
import { youtubeId, mediaFor } from './media.js';
import { TYPES, TYPE_LABELS, publicRecording, eventsOfType, sortRecordings } from './recordings.js';
import { getSpace } from './spaces.js';
import { getSite } from './site.js';
import { getFaq } from './faq.js';

export const SITE_NAME = 'Platform for Collective Wisdom';
const SHORT = 'PCW';
const TAGLINE = 'Powered by communities, Connected by AI, Shared by All. An initiative by SELCO Foundation.';
const ABOUT =
  'The Platform for Collective Wisdom (PCW) is a collaborative, AI-supported platform by SELCO Foundation that brings scattered threads of knowledge together into actionable insights for problem-solving in the development sector. It brings together voices from the ground, practitioner perspectives and institutional knowledge, and runs physical spaces in Bangalore and Guwahati for events, workshops and collaboration.';
const DEFAULT_IMAGE = '/assets/690d965be50a0ef0eeede2b3_Group%2048257.png';
const LOGO = '/cdn/68e4e187853b242ad8ff6567/692019f17205570531fc4118_Fav%20icon_for%20webclip.png';
const EMAIL = 'contact@thepcw.ai';
const PHONE = '+91 89048 46800';
const ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: '1st Floor, 729 J.P. Towers, 8th Main Road, 11th Cross Rd, 3rd Phase, J. P. Nagar',
  addressLocality: 'Bengaluru',
  addressRegion: 'Karnataka',
  postalCode: '560078',
  addressCountry: 'IN',
};
const MAPS = 'https://maps.app.goo.gl/x8KkGeiJr2B6JG569';
const MAPS_GHY = 'https://www.google.com/maps/place/SELCO+Foundation+-+NE+Regional+Office/@26.1458642,91.685078,17z';
const PHONES_GHY = ['+91 97067 78232', '+91 70023 91228'];
const GHY_TEXT = 'SELCO Foundation – NE Regional Office, PNGB Rd, Nambari Railway Officers Colony, Gotanagar, Maligaon, Guwahati, Assam 781011';
const CITY_INFO = {
  bangalore: { locality: 'Bengaluru', region: 'Karnataka', address: ADDRESS },
  guwahati: {
    locality: 'Guwahati',
    region: 'Assam',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'SELCO Foundation - NE Regional Office, PNGB Rd, Nambari Railway Officers Colony, Gotanagar, Maligaon',
      addressLocality: 'Guwahati',
      addressRegion: 'Assam',
      postalCode: '781011',
      addressCountry: 'IN',
    },
  },
};
const POLICY = {
  'contact-us': {
    title: 'Contact Us',
    description: `Contact the Platform for Collective Wisdom (PCW): email ${EMAIL}. Bangalore: ${PHONE}, J. P. Nagar. Guwahati: ${PHONES_GHY.join(', ')}, Maligaon.`,
  },
  'privacy-policy': { title: 'Privacy Policy', description: 'How the Platform for Collective Wisdom (PCW) by SELCO Foundation collects, uses and protects personal data.' },
  'terms-of-use': { title: 'Terms of Use', description: 'Terms of Use and Community Guidelines for the Platform for Collective Wisdom (PCW) by SELCO Foundation.' },
};

// full text of the policy pages (same files the React pages use)
const SECTIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../client/src/sections');
function policyHtml(slug) {
  try {
    return fs.readFileSync(path.join(SECTIONS, `policy-${slug}.html`), 'utf8');
  } catch {
    return '';
  }
}

// ---------- helpers ----------
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n = 158) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
};
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

export function siteUrlFor(req, config = {}) {
  if (config.siteUrl) return config.siteUrl.replace(/\/+$/, '');
  return `${req.protocol}://${req.get('host')}`;
}
const abs = (base, p) => (!p ? '' : /^https?:\/\//.test(p) ? p : base + (p.startsWith('/') ? '' : '/') + encodeURI(decodeURI(p)));

const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const fmtTime = (t) => {
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`;
};
const isoAt = (date, time) => (date ? (time ? `${date}T${time}:00+05:30` : date) : undefined);

// ---------- schema.org ----------
function orgLd(base, sameAs = []) {
  return {
    sameAs: sameAs.length ? sameAs : undefined,
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: SITE_NAME,
    alternateName: SHORT,
    url: `${base}/`,
    logo: abs(base, LOGO),
    description: ABOUT,
    email: EMAIL,
    telephone: PHONE,
    address: ADDRESS,
    parentOrganization: { '@type': 'Organization', name: 'SELCO Foundation' },
    contactPoint: [
      { '@type': 'ContactPoint', contactType: 'general enquiries', email: EMAIL, telephone: PHONE, areaServed: 'IN', availableLanguage: ['en'], name: 'Bangalore' },
      ...PHONES_GHY.map((t) => ({ '@type': 'ContactPoint', contactType: 'general enquiries', email: EMAIL, telephone: t, areaServed: 'IN', availableLanguage: ['en'], name: 'Guwahati' })),
    ],
    location: [
      { '@type': 'Place', name: 'PCW Space, Bengaluru', address: ADDRESS, hasMap: MAPS },
      { '@type': 'Place', name: 'PCW Guwahati (SELCO Foundation – NE Regional Office)', address: CITY_INFO.guwahati.address, hasMap: MAPS_GHY },
    ],
  };
}
function websiteLd(base) {
  return { '@type': 'WebSite', '@id': `${base}/#website`, name: SITE_NAME, alternateName: SHORT, url: `${base}/`, publisher: { '@id': `${base}/#organization` }, inLanguage: 'en-IN' };
}
function crumbs(base, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...items].map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: base + x.path })),
  };
}
function placeLd(city, venue) {
  const c = CITY_INFO[city] || {};
  return { '@type': 'Place', name: venue || `PCW Space, ${c.locality || ''}`.trim(), address: c.address };
}
function eventLd(base, e, today) {
  const yt = youtubeId(e.youtubeUrl || e.recordingUrl);
  const ld = {
    '@type': 'Event',
    '@id': `${base}/event/${e.slug}#event`,
    name: e.title,
    description: clip(e.description || e.tagline, 500) || undefined,
    url: `${base}/event/${e.slug}`,
    startDate: isoAt(e.date, e.startTime),
    endDate: e.endTime ? isoAt(e.date, e.endTime) : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: placeLd(e.city, e.venue),
    image: e.image ? [abs(base, e.image)] : yt ? [`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`] : [abs(base, DEFAULT_IMAGE)],
    organizer: { '@id': `${base}/#organization` },
    inLanguage: 'en-IN',
    isAccessibleForFree: true,
  };
  const people = (e.speakers || []).filter((s) => s.name && !s.name.startsWith('['));
  if (people.length) ld.performer = people.map((s) => ({ '@type': 'Person', name: s.name, jobTitle: s.role || undefined }));
  const vlink = e.youtubeUrl || e.recordingUrl;
  if (vlink) ld.recordedIn = videoLd({ title: `${e.title} (recording)`, description: e.tagline, date: e.date, media: mediaFor(vlink), link: yt ? `https://www.youtube.com/watch?v=${yt}` : vlink });
  if (e.date && e.date < today) delete ld.eventStatus; // past event: no status claim needed
  return ld;
}
function videoLd(x) {
  const yt = x.media?.youtubeId;
  return {
    '@type': 'VideoObject',
    name: x.title,
    description: clip(x.description || x.speakers || x.title, 300),
    uploadDate: x.date || undefined,
    thumbnailUrl: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : undefined,
    embedUrl: yt ? `https://www.youtube-nocookie.com/embed/${yt}` : x.media?.embed || undefined,
    contentUrl: yt ? undefined : x.link || undefined,
    url: x.link || undefined,
  };
}
function recordingLd(base, x) {
  if (x.type === 'video') return videoLd(x);
  if (x.type === 'podcast')
    return {
      '@type': 'PodcastEpisode',
      name: x.title,
      episodeNumber: x.number || undefined,
      datePublished: x.date || undefined,
      description: clip(x.description || x.speakers || x.title, 300),
      url: x.link || `${base}/recordings/podcasts`,
      image: x.image ? abs(base, x.image) : undefined,
      partOfSeries: { '@type': 'PodcastSeries', name: `${SHORT} Podcast`, url: `${base}/recordings/podcasts` },
      associatedMedia: x.link ? { '@type': 'MediaObject', url: x.link } : undefined,
    };
  return {
    '@type': 'Report',
    name: x.title,
    author: x.speakers ? { '@type': 'Organization', name: x.speakers } : { '@id': `${base}/#organization` },
    datePublished: x.date || undefined,
    description: clip(x.description || x.title, 300),
    url: x.link ? abs(base, x.link) : `${base}/recordings/reports`,
    encodingFormat: x.link?.endsWith('.pdf') ? 'application/pdf' : undefined,
    image: x.image ? abs(base, x.image) : undefined,
  };
}

// ---------- plain HTML for crawlers ----------
const li = (href, text, extra = '') => `<li><a href="${esc(href)}">${esc(text)}</a>${extra ? ' — ' + esc(extra) : ''}</li>`;
function eventLine(e) {
  return [fmtDate(e.date), e.startTime && fmtTime(e.startTime), CITIES[e.city]?.name, e.category].filter(Boolean).join(' · ');
}
function navHtml() {
  return `<nav aria-label="Main"><ul>${li('/', 'Home')}${li('/#about-us', 'About Us')}${li('/recordings', 'Recordings')}${li('/space/bangalore', 'Bangalore')}${li('/space/guwahati', 'Guwahati')}${li('/contact-us', 'Contact us')}</ul></nav>`;
}
function footerHtml() {
  return `<footer><p>${esc(SITE_NAME)} (${SHORT}), an initiative by SELCO Foundation. Email: <a href="mailto:${EMAIL}">${EMAIL}</a> · Phone: ${esc(PHONE)}</p><ul>${li('/contact-us', 'Contact us')}${li('/faq', 'FAQ')}${li('/privacy-policy', 'Privacy Policy')}${li('/terms-of-use', 'Terms of Use')}</ul></footer>`;
}

// ---------- data ----------
async function loadEvents(store) {
  return (await store.collection('events').find({}, { sort: { date: 1 } })).filter((e) => e.published !== false);
}
async function loadRecordings(store, events) {
  const all = (await store.collection('recordings').find({})).filter((x) => x.published !== false);
  const out = {};
  for (const t of TYPES) {
    out[t] = sortRecordings([...sortRecordings(all.filter((x) => x.type === t)).map(publicRecording), ...eventsOfType(events, t)]);
  }
  return out;
}

// ---------- page metadata for one URL ----------
export async function pageFor(store, rawPath, base) {
  const path = rawPath.replace(/\/+$/, '') || '/';
  const today = todayIST();
  const site = await getSite(store);
  const ld = [orgLd(base, site.sameAs), websiteLd(base)];
  const page = { status: 200, type: 'website', image: abs(base, DEFAULT_IMAGE), noindex: false, ld };

  if (path === '/') {
    const all = (await loadEvents(store)).filter((e) => !e.sample);
    const events = all.filter((e) => e.date >= today).slice(0, 6);
    const recent = all.filter((e) => e.date < today).reverse().slice(0, 6);
    const faq = (await getFaq(store)).slice(0, 5);
    Object.assign(page, {
      title: `${SHORT} | ${SITE_NAME} by SELCO Foundation`,
      description: clip(`${SITE_NAME}: ${TAGLINE} Knowledge from communities, practitioners and institutions, plus event spaces in Bangalore and Guwahati.`),
      canonical: `${base}/`,
      body: `<h1>${esc(SITE_NAME)} (${SHORT})</h1><p>${esc(TAGLINE)}</p><h2>What is the PCW?</h2><p>${esc(ABOUT)}</p>
<h2>Be part of the Collective</h2><p>PCW brings together three knowledge perspectives that are often held separately: voices from the ground (first-hand accounts from farmers, SHG members, health workers and rural entrepreneurs), practitioner perspectives (program teams and field staff), and institutional knowledge.</p>
<h2>A space to connect in person</h2><p>Beyond the digital platform, PCW runs physical spaces in <a href="/space/bangalore">Bangalore</a> and <a href="/space/guwahati">Guwahati</a> to meet and co-create, attend events and host events.</p>
${events.length ? `<h2>Upcoming events</h2><ul>${events.map((e) => li(`/event/${e.slug}`, e.title, eventLine(e))).join('')}</ul>` : ''}
${recent.length ? `<h2>Recent events</h2><ul>${recent.map((e) => li(`/event/${e.slug}`, e.title, eventLine(e))).join('')}</ul>` : ''}
<h2>Recordings</h2><ul>${li('/recordings/podcasts', 'Podcasts')}${li('/recordings/reports', 'Reports')}${li('/recordings/videos', 'Videos')}</ul>
${faq.length ? `<h2>Frequently asked questions</h2>${faq.map((x) => `<h3>${esc(x.q)}</h3><p>${esc(x.a)}</p>`).join('')}<p><a href="/faq">All questions</a></p>` : ''}`,
    });
    return page;
  }

  if (path === '/faq') {
    const items = await getFaq(store);
    Object.assign(page, {
      title: `FAQ: Platform for Collective Wisdom (PCW)`,
      description: clip(`Answers about the ${SITE_NAME} (PCW) by SELCO Foundation: what it is, the spaces in Bangalore and Guwahati, events, booking the space, recordings and contact.`),
      canonical: `${base}/faq`,
      body: `<h1>Frequently asked questions</h1>${items.map((x) => `<h2>${esc(x.q)}</h2><p>${esc(x.a)}</p>`).join('')}`,
    });
    ld.push(crumbs(base, [{ name: 'FAQ', path: '/faq' }]));
    if (items.length)
      ld.push({ '@type': 'FAQPage', mainEntity: items.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })) });
    return page;
  }

  const cityKey = path.match(/^\/space\/([a-z-]+)$/)?.[1];
  if (cityKey) {
    if (!CITIES[cityKey]) return notFound(page, base);
    const name = CITIES[cityKey].name;
    const all = (await loadEvents(store)).filter((e) => e.city === cityKey);
    const real = all.filter((e) => !e.sample);
    const upcoming = real.filter((e) => e.date >= today);
    const past = real.filter((e) => e.date < today).reverse();
    const space = await getSpace(store, cityKey);
    const c = CITY_INFO[cityKey];
    Object.assign(page, {
      title: `${SHORT} ${name}: Events, Talks & Workshops | ${SITE_NAME}`,
      description: clip(`Upcoming and past events at the PCW space in ${name}: talks, workshops, screenings and community gatherings by the ${SITE_NAME}, SELCO Foundation. RSVP, watch recordings or book the space.`),
      canonical: `${base}/space/${cityKey}`,
      body: `<h1>${esc(SITE_NAME)} in ${esc(name)}</h1><p>Events, talks, workshops and community gatherings at the PCW space in ${esc(name)}.</p>
<h2>Upcoming events in ${esc(name)}</h2>${upcoming.length ? `<ul>${upcoming.map((e) => li(`/event/${e.slug}`, e.title, eventLine(e))).join('')}</ul>` : '<p>New events will be announced soon.</p>'}
${past.length ? `<h2>Past events in ${esc(name)}</h2><ul>${past.slice(0, 30).map((e) => li(`/event/${e.slug}`, e.title, eventLine(e))).join('')}</ul>` : ''}
<h2>${esc(space.title)}</h2><p>${esc(space.intro)}</p><ul>${space.cards.map((x) => `<li><strong>${esc(x.title)}</strong>: ${esc(x.text)}</li>`).join('')}</ul>
<h2>Book the space</h2><p>Host a workshop, a meeting or a community event at the PCW space in ${esc(name)} using the booking form on this page.</p>
${cityKey === 'bangalore' ? `<h2>Address</h2><address>1st Floor, 729 J.P. Towers, 8th Main Road, 11th Cross Rd, 3rd Phase, J. P. Nagar, Bengaluru, Karnataka 560078. Phone ${esc(PHONE)}. <a href="${MAPS}">Google Maps</a></address>` : `<h2>Address</h2><address>${esc(GHY_TEXT)}. Phone ${PHONES_GHY.map(esc).join(', ')}. <a href="${MAPS_GHY}">Google Maps</a></address>`}`,
    });
    ld.push(crumbs(base, [{ name, path: `/space/${cityKey}` }]));
    ld.push({ '@type': 'Place', '@id': `${base}/space/${cityKey}#place`, name: `PCW Space, ${c.locality}`, address: c.address, url: `${base}/space/${cityKey}` });
    if (upcoming.length) ld.push({ '@type': 'ItemList', name: `Upcoming PCW events in ${name}`, itemListElement: upcoming.slice(0, 20).map((e, i) => ({ '@type': 'ListItem', position: i + 1, item: eventLd(base, e, today) })) });
    return page;
  }

  const slug = path.match(/^\/event\/([^/]+)$/)?.[1];
  if (slug) {
    const events = await loadEvents(store);
    const want = decodeURIComponent(slug);
    const e = events.find((x) => x.slug === want || x._id === want);
    if (!e) {
      const moved = events.find((x) => (x.oldSlugs || []).includes(want));
      return moved ? { redirect: `/event/${moved.slug}` } : notFound(page, base);
    }
    const cityName = CITIES[e.city]?.name || '';
    const yt = youtubeId(e.youtubeUrl || e.recordingUrl);
    const when = [fmtDate(e.date), e.startTime && `${fmtTime(e.startTime)}${e.endTime ? ' – ' + fmtTime(e.endTime) : ''}`].filter(Boolean).join(', ');
    const people = (e.speakers || []).filter((s) => s.name && !s.name.startsWith('['));
    Object.assign(page, {
      title: `${e.title} | ${SHORT} ${cityName}`,
      description: clip(`${e.tagline ? e.tagline + ' ' : ''}${when}${e.venue ? ' at ' + e.venue : ''}, ${cityName}. ${e.description || ''}`),
      canonical: `${base}/event/${e.slug}`,
      type: 'article',
      image: e.image ? abs(base, e.image) : yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : page.image,
      noindex: !!e.sample, // sample events are placeholders: keep them out of Google
      body: `<article><h1>${esc(e.title)}</h1>${e.tagline ? `<p>${esc(e.tagline)}</p>` : ''}
<dl><dt>Date</dt><dd>${esc(when || 'To be announced')}</dd><dt>Venue</dt><dd>${esc([e.venue, cityName].filter(Boolean).join(', '))}</dd>${e.category ? `<dt>Category</dt><dd>${esc(e.category)}</dd>` : ''}</dl>
${e.description ? `<h2>About this event</h2>${String(e.description).split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}` : ''}
${people.length ? `<h2>Speakers</h2><ul>${people.map((s) => `<li>${esc(s.name)}${s.role ? ', ' + esc(s.role) : ''}</li>`).join('')}</ul>` : ''}
${e.youtubeUrl || e.recordingUrl ? `<h2>Watch the recording</h2><p><a href="${esc(yt ? `https://www.youtube.com/watch?v=${yt}` : e.youtubeUrl || e.recordingUrl)}">Watch the recording</a></p>` : ''}
<p><a href="/space/${esc(e.city)}">More events at PCW ${esc(cityName)}</a></p></article>`,
    });
    ld.push(crumbs(base, [{ name: cityName, path: `/space/${e.city}` }, { name: e.title, path: `/event/${e.slug}` }]));
    if (!e.sample) ld.push(eventLd(base, e, today));
    return page;
  }

  const rec = path === '/recordings' ? 'podcasts' : path.match(/^\/recordings\/(podcasts|reports|videos)$/)?.[1];
  if (rec) {
    const type = { podcasts: 'podcast', reports: 'report', videos: 'video' }[rec];
    const events = await loadEvents(store);
    const items = (await loadRecordings(store, events))[type].filter((x) => !x.sample);
    const label = TYPE_LABELS[type];
    Object.assign(page, {
      title: `${SHORT} ${label} | ${SITE_NAME}`,
      description: clip(
        {
          podcast: `Listen to PCW podcasts: conversations with communities, practitioners and partners from the ${SITE_NAME}, SELCO Foundation.`,
          report: `Read PCW reports and field notes from the ${SITE_NAME}, SELCO Foundation, on development practice and community knowledge.`,
          video: `Watch recordings of PCW talks, workshops and events in Bangalore and Guwahati from the ${SITE_NAME}, SELCO Foundation.`,
        }[type]
      ),
      canonical: `${base}/recordings/${rec}`,
      body: `<h1>${esc(SHORT)} ${esc(label)}</h1><ul>${li('/recordings/podcasts', 'Podcasts')}${li('/recordings/reports', 'Reports')}${li('/recordings/videos', 'Videos')}</ul>
${items.length ? `<ul>${items.map((x) => `<li>${x.link ? `<a href="${esc(x.link)}">${esc((x.number ? x.number + '. ' : '') + x.title)}</a>` : esc(x.title)}${x.speakers ? ' — ' + esc(x.speakers) : ''}${x.date ? ' (' + esc(fmtDate(x.date)) + ')' : ''}${x.description ? `<p>${esc(clip(x.description, 300))}</p>` : ''}</li>`).join('')}</ul>` : `<p>${esc(label)} from PCW will appear here soon.</p>`}`,
    });
    ld.push(crumbs(base, [{ name: 'Recordings', path: '/recordings' }, { name: label, path: `/recordings/${rec}` }]));
    if (items.length)
      ld.push({ '@type': 'ItemList', name: `PCW ${label}`, itemListElement: items.slice(0, 30).map((x, i) => ({ '@type': 'ListItem', position: i + 1, item: recordingLd(base, x) })) });
    return page;
  }

  const pol = path.match(/^(?:\/policy)?\/(contact-us|privacy-policy|terms-of-use)$/)?.[1];
  if (pol) {
    const p = POLICY[pol];
    Object.assign(page, {
      title: `${p.title} | ${SITE_NAME}`,
      description: p.description,
      canonical: `${base}/${pol}`,
      body:
        pol === 'contact-us'
          ? `<h1>Contact Us</h1><p>Whether you’d like to learn more about the Platform for Collective Wisdom, explore collaboration, or share feedback, we’d be glad to hear from you.</p><h2>Email</h2><p><a href="mailto:${EMAIL}">${EMAIL}</a></p><h2>Phone</h2><p>Bangalore: <a href="tel:+918904846800">${esc(PHONE)}</a>. Guwahati: <a href="tel:+919706778232">${PHONES_GHY[0]}</a>, <a href="tel:+917002391228">${PHONES_GHY[1]}</a>.</p><h2>Visit Us</h2><h3>Bangalore</h3><address>Platform for Collective Wisdom, 1st Floor, 729 J.P. Towers, 8th Main Road, 11th Cross Rd, 3rd Phase, J. P. Nagar, Bengaluru, Karnataka 560078. <a href="${MAPS}">Google Maps</a></address><h3>Guwahati</h3><address>${esc(GHY_TEXT)}. <a href="${MAPS_GHY}">Google Maps</a></address>`
          : `<h1>${esc(p.title)}</h1>${policyHtml(pol) || `<p>${esc(p.description)}</p>`}`,
    });
    ld.push(crumbs(base, [{ name: p.title, path: `/${pol}` }]));
    if (pol === 'contact-us') ld.push({ '@type': 'ContactPage', name: 'Contact PCW', url: `${base}/contact-us`, about: { '@id': `${base}/#organization` } });
    return page;
  }

  if (path === '/admin' || path.startsWith('/admin/')) return Object.assign(page, { title: `Admin | ${SHORT}`, description: '', canonical: '', noindex: true, body: '', ld: [] });
  return notFound(page, base);
}

function notFound(page, base) {
  return Object.assign(page, {
    status: 404,
    title: `Page not found | ${SITE_NAME}`,
    description: 'This page could not be found.',
    canonical: '',
    noindex: true,
    body: `<h1>Page not found</h1><p><a href="/">Go to the PCW home page</a></p>`,
    ld: [orgLd(base)],
  });
}

// ---------- put the metadata into index.html ----------
export function renderHtml(template, page, site = {}) {
  const head = [
    page.description && `<meta name="description" content="${esc(page.description)}">`,
    page.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    page.canonical && `<link rel="canonical" href="${esc(page.canonical)}">`,
    page.canonical && `<link rel="alternate" hreflang="en-IN" href="${esc(page.canonical)}">`,
    `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
    `<meta property="og:locale" content="en_IN">`,
    `<meta property="og:type" content="${page.type}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    page.description && `<meta property="og:description" content="${esc(page.description)}">`,
    page.canonical && `<meta property="og:url" content="${esc(page.canonical)}">`,
    page.image && `<meta property="og:image" content="${esc(page.image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    page.description && `<meta name="twitter:description" content="${esc(page.description)}">`,
    page.image && `<meta name="twitter:image" content="${esc(page.image)}">`,
    `<meta name="theme-color" content="#205c40">`,
    site.googleVerification && `<meta name="google-site-verification" content="${esc(site.googleVerification)}">`,
    site.bingVerification && `<meta name="msvalidate.01" content="${esc(site.bingVerification)}">`,
    `<link rel="sitemap" type="application/xml" href="/sitemap.xml">`,
    page.ld?.length && `<script type="application/ld+json">${json({ '@context': 'https://schema.org', '@graph': page.ld.map(strip) })}</script>`,
  ]
    .filter(Boolean)
    .join('\n');
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>\n?/, '')
    .replace('</head>', `${head}\n</head>`);
  if (page.body) html = html.replace('<div id="root"></div>', `<div id="root"><div class="pcw-ssr">${navHtml()}<main>${page.body}</main>${footerHtml()}</div></div>`);
  return html;
}
// drop undefined values so the JSON-LD stays clean
function strip(o) {
  if (Array.isArray(o)) return o.map(strip);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, strip(v)]));
  return o;
}

// ---------- sitemap.xml / robots.txt / llms.txt ----------
export async function sitemapXml(store, base) {
  const events = (await loadEvents(store)).filter((e) => !e.sample);
  const today = todayIST();
  const urls = [
    ['/', 'daily', '1.0'],
    ['/space/bangalore', 'daily', '0.9'],
    ['/space/guwahati', 'daily', '0.9'],
    ['/recordings/podcasts', 'weekly', '0.8'],
    ['/recordings/reports', 'weekly', '0.8'],
    ['/recordings/videos', 'weekly', '0.8'],
    ['/faq', 'monthly', '0.7'],
    ['/contact-us', 'monthly', '0.6'],
    ['/privacy-policy', 'yearly', '0.2'],
    ['/terms-of-use', 'yearly', '0.2'],
  ].map(([p, f, pr]) => ({ loc: base + p, changefreq: f, priority: pr }));
  for (const e of events)
    urls.push({ loc: `${base}/event/${e.slug}`, lastmod: (e.updatedAt || e.createdAt || '').slice(0, 10) || undefined, changefreq: e.date >= today ? 'weekly' : 'monthly', priority: e.date >= today ? '0.8' : '0.5', image: e.image ? abs(base, e.image) : '' });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority>${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ''}</url>`
  )
  .join('\n')}
</urlset>
`;
}

export function robotsTxt(base) {
  // Search engines and AI answer engines are welcome; the admin panel and private API are not indexed.
  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot'];
  return `# ${SITE_NAME}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

${bots.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /admin\nDisallow: /api/admin`).join('\n\n')}

Sitemap: ${base}/sitemap.xml
`;
}

export async function llmsTxt(store, base) {
  const today = todayIST();
  const events = (await loadEvents(store)).filter((e) => !e.sample);
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today).reverse().slice(0, 20);
  const rec = await loadRecordings(store, events);
  const faq = await getFaq(store);
  const site = await getSite(store);
  const line = (e) => `- [${e.title}](${base}/event/${e.slug}): ${[eventLine(e), e.tagline].filter(Boolean).join('. ')}`;
  const recLine = (x) => `- ${x.link ? `[${x.title}](${abs(base, x.link)})` : x.title}${x.speakers ? `: ${x.speakers}` : ''}${x.date ? ` (${fmtDate(x.date)})` : ''}`;
  return `# ${SITE_NAME} (${SHORT})

> ${ABOUT}

${TAGLINE}

## Key facts
- Organisation: ${SITE_NAME} (${SHORT}), an initiative by SELCO Foundation, India.
- Spaces: Bangalore (Bengaluru, Karnataka) and Guwahati (Assam), used for talks, workshops, screenings, meetings and community events.
- Bangalore address: 1st Floor, 729 J.P. Towers, 8th Main Road, 11th Cross Rd, 3rd Phase, J. P. Nagar, Bengaluru, Karnataka 560078 (${MAPS}).
- Guwahati address: ${GHY_TEXT} (${MAPS_GHY}).
- Contact: ${EMAIL} (both cities). Phone Bangalore: ${PHONE}. Phone Guwahati: ${PHONES_GHY.join(', ')}.
- Booking the space: use the "Book the space" form on the Bangalore or Guwahati page.

${site.sameAs.length ? `- Official profiles: ${site.sameAs.join(', ')}\n` : ''}
## Main pages
- [Home](${base}/): what PCW is, the Collective, partners and the physical space.
- [PCW Bangalore](${base}/space/bangalore): upcoming and past events, calendar, the space, booking.
- [PCW Guwahati](${base}/space/guwahati): upcoming and past events, calendar, the space, booking.
- [Podcasts](${base}/recordings/podcasts), [Reports](${base}/recordings/reports), [Videos](${base}/recordings/videos): recordings and publications.
- [FAQ](${base}/faq): common questions and answers.
- [Contact us](${base}/contact-us)

## Upcoming events
${upcoming.length ? upcoming.map(line).join('\n') : '- New events will be announced soon.'}
${past.length ? `\n## Recent past events\n${past.map(line).join('\n')}\n` : ''}
${TYPES.map((t) => {
  const items = rec[t].filter((x) => !x.sample).slice(0, 20);
  return items.length ? `## ${TYPE_LABELS[t]}\n${items.map(recLine).join('\n')}\n` : '';
})
  .filter(Boolean)
  .join('\n')}
${faq.length ? `## Frequently asked questions\n${faq.map((x) => `### ${x.q}\n${x.a}`).join('\n\n')}\n\n` : ''}## Optional
- [Privacy Policy](${base}/privacy-policy)
- [Terms of Use](${base}/terms-of-use)
- [Sitemap](${base}/sitemap.xml)
`;
}

export { getSite };
