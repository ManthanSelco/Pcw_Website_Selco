import html from './Footer.html?raw';
import RawHtml from '../components/RawHtml.jsx';

// Markup copied 1:1 from the Webflow page. Edit Footer.html to change this section.
export default function Footer() {
  return <RawHtml html={html} />;
}
