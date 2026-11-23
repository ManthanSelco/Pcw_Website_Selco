import { useEffect } from 'react';
import Navbar from '../sections/Navbar.jsx';
import Footer from '../sections/Footer.jsx';
import { connectNewsletter } from '../features/newsletter.js';
import { useSiteMotion } from '../motion.js';

// Nav + footer for the inner pages (same markup as the home page).
// `active` = data-nav key of the menu item to underline, e.g. "bangalore".
export default function SiteChrome({ active, light = false, children }) {
  useSiteMotion();
  useEffect(() => {
    document.body.classList.remove('nooverflow'); // home page's loader lock, not used here
    document.querySelectorAll(`[data-nav="${active}"]`).forEach((a) => {
      a.classList.add('is-current');
      a.setAttribute('aria-current', 'page');
    });
    const brand = document.querySelector('.w-nav-brand');
    brand?.classList.remove('w--current');
    brand?.removeAttribute('aria-current');

    // mobile menu (same behaviour as the home page)
    const burger = document.querySelector('.hamburger-wrapper');
    const panel = document.querySelector('.hamburgercontent');
    const toggle = (e) => {
      e.preventDefault();
      burger.classList.toggle('active');
      panel.classList.toggle('active');
      document.body.classList.toggle('nooverflow');
    };
    const close = () => {
      burger.classList.remove('active');
      panel.classList.remove('active');
      document.body.classList.remove('nooverflow');
    };
    burger?.addEventListener('click', toggle);
    panel?.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));

    const year = document.getElementById('currentYear');
    if (year) year.textContent = new Date().getFullYear();
    connectNewsletter();
    return () => burger?.removeEventListener('click', toggle);
  }, [active]);

  return (
    <>
      <Navbar />
      <main className={light ? 'pcw-page pcw-page-light' : 'pcw-page'}>{children}</main>
      <Footer />
    </>
  );
}
