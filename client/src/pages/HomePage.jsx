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

// The home page: same markup and animations as the Webflow site.
export default function HomePage() {
  useEffect(() => {
    // Webflow, GSAP and the custom animations need the page in the DOM first
    runLegacyScripts().then(connectNewsletter);
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
