/* Runs before first paint. Every page shares one explicit preference. */
(() => {
  let theme = 'light';
  let motion = 'on';
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') theme = saved;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
    if (localStorage.getItem('observatory-motion') === 'off') motion = 'off';
  } catch (_) { /* Private browsing still has a fully usable day theme. */ }
  const appearance = new URLSearchParams(location.search).get('appearance');
  if (appearance === 'day') theme = 'light';
  if (appearance === 'night') theme = 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.motion = motion;
})();
