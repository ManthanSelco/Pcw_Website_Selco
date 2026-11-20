import html from './BrainBanner.html?raw';
import RawHtml from '../components/RawHtml.jsx';

// Markup copied 1:1 from the Webflow page. Edit BrainBanner.html to change this section.
export default function BrainBanner() {
  return <RawHtml html={html} />;
}
