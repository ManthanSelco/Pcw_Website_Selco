import HomePage from './pages/HomePage.jsx';
import CityPage from './pages/CityPage.jsx';
import RecordingsPage from './pages/RecordingsPage.jsx';
import { CITIES } from './cities.js';

// Simple page switch. Links between pages are normal links (full page load), which keeps
// the home page's Webflow/GSAP animations starting fresh every time.
export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const city = path.match(/^\/space\/([a-z-]+)$/)?.[1];
  if (city && CITIES[city]) return <CityPage cityKey={city} />;
  if (path === '/recordings') return <RecordingsPage />;
  return <HomePage />;
}
