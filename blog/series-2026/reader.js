/* Same chapter-navigation behaviour as the established long-form articles. */
(() => {
  const links = [...document.querySelectorAll('.section-nav a')];
  const sections = [...document.querySelectorAll('.story section[id]')];
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of links) {
        const active = link.hash === '#' + entry.target.id;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
  sections.forEach(section => observer.observe(section));
  addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
