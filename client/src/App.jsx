import HomePage from './pages/HomePage.jsx';
import CityPage from './pages/CityPage.jsx';
import RecordingsPage from './pages/RecordingsPage.jsx';
import EventPage from './pages/EventPage.jsx';
import PolicyPage, { POLICIES } from './pages/PolicyPage.jsx';
import FaqPage from './pages/FaqPage.jsx';
import { CITIES } from './cities.js';
import { lazy, Suspense } from 'react';

// Admin panel is loaded only when someone opens /admin
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

// Simple page switch. Links between pages are normal links (full page load), which keeps
// the home page's Webflow/GSAP animations starting fresh every time.
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const city = path.match(/^\/space\/([a-z-]+)$/)?.[1];
  if (city && CITIES[city]) return <CityPage cityKey={city} />;
  if (path === '/recordings' || /^\/recordings\/(podcasts|reports|videos)$/.test(path)) return <RecordingsPage />;
  if (path === '/faq') return <FaqPage />;
  const policy = path.match(/^(?:\/policy)?\/(contact-us|privacy-policy|terms-of-use)$/)?.[1];
  if (policy && POLICIES[policy]) return <PolicyPage slug={policy} />;
  const slug = path.match(/^\/event\/([^/]+)$/)?.[1];
  if (slug) return <EventPage slug={decodeURIComponent(slug)} />;
  if (path === '/admin' || path.startsWith('/admin/'))
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  return <HomePage />;
}
