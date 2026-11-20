import html from './Hero.html?raw';
import RawHtml from '../components/RawHtml.jsx';

// Markup copied 1:1 from the Webflow page. Edit Hero.html to change this section.
export default function Hero() {
  return <RawHtml html={html} />;
}
