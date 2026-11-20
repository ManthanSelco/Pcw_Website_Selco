import { memo } from 'react';

// Renders a block of the original Webflow markup exactly as it was.
// display: contents keeps the page structure identical (no extra box in the layout).
// memo + no props changes = React never re-renders it, so Webflow/GSAP can safely
// work on these elements after they are on the page.
function RawHtml({ html }) {
  return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;
}
export default memo(RawHtml, () => true);
