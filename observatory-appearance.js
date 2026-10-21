/* Keep existing controls and markup; synchronise only the day/night preference. */
(() => {
  const root = document.documentElement;
  function apply(theme) {
    root.dataset.theme = theme;
    document.body.classList.toggle('light', theme === 'light');
    // The legacy CV sets the same colour tokens inline before this script runs.
    if (document.body.classList.contains('observatory-cv')) {
      for (const name of ['--ink','--ink-2','--ink-3','--text','--muted','--teal','--gold','--blue','--line']) root.style.removeProperty(name);
    }
    document.querySelectorAll('#themeBtn,#themeToggle').forEach(button => {
      if (!button.querySelector('svg')) button.textContent = theme === 'dark' ? '☀' : '☾';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to day appearance' : 'Switch to night appearance');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = button.getAttribute('aria-label');
    });
    const checkbox = document.getElementById('themeSwitch');
    if (checkbox) { checkbox.checked = theme === 'light'; checkbox.setAttribute('aria-label','Day appearance'); }
  }
  function persist(theme) { try { localStorage.setItem('theme', theme); } catch (_) {} apply(theme); }
  apply(root.dataset.theme || 'light');
  // Capture prevents the independent legacy handlers from toggling twice.
  document.addEventListener('click', event => {
    if (!event.target.closest('#themeBtn,#themeToggle')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    persist(root.dataset.theme === 'dark' ? 'light' : 'dark');
  }, true);
  document.addEventListener('change', event => {
    if (event.target.id !== 'themeSwitch') return;
    event.stopImmediatePropagation(); persist(event.target.checked ? 'light' : 'dark');
  }, true);
  addEventListener('storage', event => { if (event.key === 'theme' && ['light','dark'].includes(event.newValue)) apply(event.newValue); });
})();
