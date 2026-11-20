var Webflow = Webflow || [];

Webflow.push(function () {
  const mq = window.matchMedia("(max-width: 992px)");
  let tl;

  function initDesktopAnimation() {
    $.get(
      "/snippets/pcwLogo.html",
      function (data) {
        $("#ajaxContentMobile").html(data);

        gsap.registerPlugin(ScrollTrigger);

        // ✅ Initial states (no CSS needed)
        gsap.set(".image2, .image3", { opacity: 0 });
        gsap.set(".text2, .text3", { y: 100, opacity: 0 });
        gsap.set(".textop2, .textop3", { opacity: 0.3 });

        // ✅ Build GSAP timeline
        tl = gsap.timeline({
          scrollTrigger: {
            trigger: "#pinned-section-mobile",
            start: "top top",
            end: "+=800", // smoother scroll length
            scrub: true,
            pin: true,
            // markers: true,
          },
        });

        // Step 0: slight pause before anything
        tl.to({}, { duration: 0.3 });

        // Step 1: image2 + text2 slide in, text1 slides out
        tl.addLabel("step1")
          .to(".image2", { opacity: 1 }, "step1")
          .to(".text1", { y: -100, opacity: 0 }, "step1")
          .to(".text2", { y: 0, opacity: 1 }, "step1")
          .to(".textop2", { opacity: 1 }, "step1");

        // Step 2: image3 + text3 slide in, text2 slides out
        tl.addLabel("step2")
          .to(".image3", { opacity: 1 }, "step2")
          .to(".text2", { y: -100, opacity: 0 }, "step2")
          .to(".text3", { y: 0, opacity: 1 }, "step2")
          .to(".textop3", { opacity: 1 }, "step2");
      }
    );
  }

  function destroyDesktopAnimation() {
    if (tl) {
      tl.kill();
      tl = null;
    }
    ScrollTrigger.getAll().forEach((st) => st.kill());
    $("#ajaxContentMobile").empty();
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
