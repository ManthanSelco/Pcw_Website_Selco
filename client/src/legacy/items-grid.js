var Webflow = Webflow || [];

Webflow.push(function () {
  const mq = window.matchMedia("(min-width: 992px)");
  let tl;

  function initDesktopAnimation() {
    $.get(
      "/snippets/item.html",
      function (data) {
        $("#items").html(data);

        gsap.registerPlugin(ScrollTrigger);

const rects = gsap.utils.toArray(".pcw_right_contentwrapper svg rect");

gsap.set(rects, {
  x: (i) => {
    const mod = i % 3;
    if (mod === 0) return -500;   // from left
    if (mod === 1) return 0;      // from center
    return 500;                   // from right
  },
  y: (i) => {
    if (i < rects.length / 3) return -400;       // top rows
    if (i > (rects.length / 3) * 2) return 400;  // bottom rows
    return 0;                                    // middle
  }
});

gsap.to(rects, {
  x: 0,
  y: 0,
  ease: "power2.out",
  duration: 2,
  scrollTrigger: {
    trigger: ".pcw_right_contentwrapper",
    start: "top 80%",
    end: "top top",
    scrub: true,
  }
});
      }
    );
  }

  function destroyDesktopAnimation() {
    if (tl) {
      tl.kill();
      tl = null;
    }
    ScrollTrigger.getAll().forEach((st) => st.kill());
    $("#item").empty();
  }

  if (mq.matches) {
    initDesktopAnimation();
  }

  mq.addEventListener("change", (e) => {
    if (e.matches) {
      initDesktopAnimation();
    } else {
      destroyDesktopAnimation();
    }
  });
});
