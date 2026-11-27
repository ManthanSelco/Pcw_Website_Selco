import html from './Navbar.html?raw';
import RawHtml from '../components/RawHtml.jsx';
import '../styles/nav.css';

// Markup copied 1:1 from the Webflow page. Edit Navbar.html to change this section.
// Recordings / Bangalore / Guwahati open a small menu on hover (desktop), like the BIC site.
export default function Navbar() {
  return <RawHtml html={html} />;
}
