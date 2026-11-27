import { scrollToId } from '../motion.js';

// Top-nav hover menus: after a click the menu closes, and links to a part of the page
// you are already on (e.g. Bangalore > Past events while on /space/bangalore) scroll smoothly.
export function connectNavMenus() {
  const off = [];
  document.querySelectorAll('.pcw-nav-dd').forEach((dd) => {
    const reopen = () => dd.classList.remove('is-closed');
    dd.addEventListener('mouseleave', reopen);
    off.push(() => dd.removeEventListener('mouseleave', reopen));
    dd.querySelectorAll('.pcw-nav-dd-menu a').forEach((a) => {
      const click = (e) => {
        dd.classList.add('is-closed');
        a.blur();
        if (a.pathname === window.location.pathname && a.hash) {
          e.preventDefault();
          window.history.replaceState(null, '', a.hash);
          scrollToId(decodeURIComponent(a.hash.slice(1)));
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      };
      a.addEventListener('click', click);
      off.push(() => a.removeEventListener('click', click));
    });
  });
  return () => off.forEach((f) => f());
}
