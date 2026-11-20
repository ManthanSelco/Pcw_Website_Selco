import html from './Loader.html?raw';
import RawHtml from '../components/RawHtml.jsx';

// Markup copied 1:1 from the Webflow page. Edit Loader.html to change this section.
export default function Loader() {
  return <RawHtml html={html} />;
}
