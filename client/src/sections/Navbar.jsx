import html from './Navbar.html?raw';
import RawHtml from '../components/RawHtml.jsx';

// Markup copied 1:1 from the Webflow page. Edit Navbar.html to change this section.
export default function Navbar() {
  return <RawHtml html={html} />;
}
