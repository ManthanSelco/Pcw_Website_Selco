import { useEffect } from 'react';
import Navbar from '../sections/Navbar.jsx';
import Loader from '../sections/Loader.jsx';
import Hero from '../sections/Hero.jsx';
import WhatIsPcw from '../sections/WhatIsPcw.jsx';
import PartnerScroll from '../sections/PartnerScroll.jsx';
import Collective from '../sections/Collective.jsx';
import OurSpace from '../sections/OurSpace.jsx';
import BrainBanner from '../sections/BrainBanner.jsx';
import Instagram from '../sections/Instagram.jsx';
import Footer from '../sections/Footer.jsx';
import { runLegacyScripts } from '../legacy/runLegacy.js';
import { connectNewsletter } from '../features/newsletter.js';
import { connectNavMenus } from '../features/navMenus.js';

// The home page: same markup and animations as the Webflow site.
export default function HomePage() {
  useEffect(() => {
    // Webflow, GSAP and the custom animations need the page in the DOM first
    runLegacyScripts().then(connectNewsletter);
    const offMenus = connectNavMenus();
    // Coming from another page with a link like /#about-us: once the loader is gone, scroll there.
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) {
      const go = () => {
        const el = document.getElementById(id);
        if (!el) return;
        if (window.lenis) window.lenis.scrollTo(el, { offset: -20, duration: 1.4 });
        else el.scrollIntoView({ behavior: 'smooth' });
      };
      const ready = () => !document.body.classList.contains('nooverflow');
      if (ready()) setTimeout(go, 300);
      else {
        const mo = new MutationObserver(() => {
          if (!ready()) return;
          mo.disconnect();
          setTimeout(go, 300);
        });
        mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      }
    }
    return offMenus;
  }, []);

  return (
    <>
      <Navbar />
      <Loader />
      <Hero />
      <WhatIsPcw />
      <PartnerScroll />
      <Collective />
      <OurSpace />
      <BrainBanner />
      <Instagram />
      <Footer />
    </>
  );
}
