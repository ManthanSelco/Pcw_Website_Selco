(() => {
  const groups = document.querySelectorAll(".braid-group");
  groups.forEach(group => {
    const paths = group.querySelectorAll("path");
    paths.forEach((path, i) => {
      path.style.transitionDelay = `${i * 0.1}s`; // adjust 0.1s for speed
    });
  });
})();
