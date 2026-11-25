// Same motion as the home page, for every other public page:
//  - Lenis smooth scroll (same settings as the home page: lerp 0.1)
//  - headings slide up out of a mask, blocks/cards fade up as they scroll into view
//  - the striped thread draws in
// Elements are tagged automatically (also when content loads later), and
// everything is skipped for people who turn on "reduce motion".
import { useLayoutEffect } from 'react';

const MASK = ['.pcw-page h1', '.pcw-page h2.pcw-h2', '.pcw-page h2.pcw-h3', '.pcw-space .heading-2'].join(',');
const UP = [
  '.pcw-page .pcw-eyebrow',
  '.pcw-subnav',
  '.pcw-chips',
  '.pcw-card',
  '.pcw-rec-card',
  '.pcw-rec-tools',
  '.pcw-rec-count',
  '.pcw-rec-empty',
  '.pcw-empty',
  '.pcw-cal',
  '.pcw-book',
  '.pcw-detail-meta',
  '.pcw-detail-actions',
  '.pcw-detail-tagline',
  '.pcw-detail-image',
  '.pcw-detail-body > *',
  '.pcw-detail-video .pcw-yt',
  '.pcw-yt-wrap',
  '.pcw-space .left_right_content > *',
  '.pcw-space .vertical_cards',
  '.pcw-prog-group',
  '.pcw-policy .full-content > *',
].join(',');
const SKIP = '.pcw-modal-backdrop, .navbar, .footer, nav.navbar, [data-no-motion]';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let lenisLoading = null;
function startLenis() {
  if (window.lenis || reduced()) return;
  lenisLoading ||= new Promise((ok) => {
    if (window.Lenis) return ok();
    const s = document.createElement('script');
    s.src = '/assets/lenis.min.js';
    s.onload = ok;
    s.onerror = ok;
    document.head.appendChild(s);
  }).then(() => {
    if (!window.Lenis || window.lenis) return;
    const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, smoothTouch: true });
    window.lenis = lenis;
    const raf = (t) => {
      lenis.raf(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    // pause smooth scroll while a popup is open (so the popup itself scrolls)
    new MutationObserver(() => (document.body.classList.contains('pcw-modal-open') ? lenis.stop() : lenis.start())).observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
  });
}

// Smooth-scroll to a section (uses Lenis when it is running)
export function scrollToId(id, offset = -24) {
  const el = document.getElementById(id);
  if (!el) return;
  if (window.lenis) window.lenis.scrollTo(el, { offset, duration: 1.2 });
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function useSiteMotion() {
  useLayoutEffect(() => {
    if (reduced()) return;
    document.documentElement.classList.add('pcw-motion');
    startLenis();

    // A masked heading is clipped to nothing, so the browser can't see it scroll in;
    // we watch its parent block instead and reveal the heading with it.
    const waiting = new Map(); // watched element -> elements to reveal
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (waiting.get(e.target) || []).forEach((el) => el.classList.add('is-in'));
          waiting.delete(e.target);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 }
    );

    const tag = () => {
      const root = document.querySelector('.pcw-page');
      if (!root) return;
      const add = (el, kind) => {
        if (el.dataset.motion || el.closest(SKIP)) return;
        el.dataset.motion = kind;
        // small stagger for items in the same row/grid
        const sibs = el.parentElement ? [...el.parentElement.children].filter((c) => c.dataset.motion || c.matches(UP)) : [];
        const i = Math.max(0, sibs.indexOf(el));
        el.style.setProperty('--motion-delay', `${Math.min(i % 4, 3) * 0.12}s`);
        const watch = kind === 'mask' ? el.parentElement || el : el;
        if (!waiting.has(watch)) {
          waiting.set(watch, []);
          io.observe(watch);
        }
        waiting.get(watch).push(el);
      };
      root.querySelectorAll(MASK).forEach((el) => add(el, 'mask'));
      root.querySelectorAll(UP).forEach((el) => add(el, 'up'));
    };
    tag();
    // content arrives after loading: tag it before it is painted
    const mo = new MutationObserver(tag);
    mo.observe(document.body, { childList: true, subtree: true });
    // safety net: never leave something hidden
    const t = setTimeout(() => document.querySelectorAll('[data-motion]:not(.is-in)').forEach((el) => {
      const r = (el.dataset.motion === 'mask' ? el.parentElement || el : el).getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in');
    }), 2500);
    return () => {
      mo.disconnect();
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
}
