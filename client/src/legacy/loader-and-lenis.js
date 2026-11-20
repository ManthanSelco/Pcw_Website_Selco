window.__pcwOnLoad(function() {
  // Fade out loader
  $('.loader').fadeOut(500, function() {
    // Enable scrolling
    $('body').removeClass('nooverflow');
    $('.hero_section').addClass('active');

    // If Lenis exists, update it after layout changes
    if (window.lenis) lenis.update();
  });
});

// // Lenis setup
// const desktopMediaQuery = window.matchMedia('(min-width: 1200px)');
// let lenis = null;
// let rafId = null;

// const handleMediaQueryChange = (event) => {
//   if (event.matches) {
//     // Enable Lenis on desktop
//     if (!lenis) {
//       console.log('🧠 Lenis initialized (desktop mode)');
//       lenis = new Lenis({
//        	lerp: 0.1,
//       });

//       const raf = (time) => {
//         if (!lenis) return;
//         lenis.raf(time);
//         rafId = requestAnimationFrame(raf);
//       };
//       rafId = requestAnimationFrame(raf);

//       // Optional scroll listener
//       lenis.on('scroll', (e) => {
//         console.log('Lenis scroll position:', e.scroll);
//       });
//     }
//   } else {
//     // Disable Lenis on tablet/mobile
//     if (lenis) {
//       console.log('📱 Lenis destroyed (mobile/tablet mode)');
//       lenis.destroy();
//       lenis = null;
//       cancelAnimationFrame(rafId);
//     }
//   }
// };

// // Run on load + watch for viewport changes
// desktopMediaQuery.addEventListener('change', handleMediaQueryChange);
// handleMediaQueryChange(desktopMediaQuery);




let lenis = null;
let rafId = null;

// ✅ Enable Lenis for all screen sizes
function initLenis() {
  if (!lenis) {
    console.log('🧠 Lenis initialized (all screens)');
    lenis = new Lenis({
      lerp: 0.1, // Adjust smoothness
      smoothWheel: true,
      smoothTouch: true,
    });

    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    // Optional scroll listener
    // lenis.on('scroll', (e) => console.log('Lenis scroll:', e.scroll));
  }
}

// Initialize immediately
initLenis();
