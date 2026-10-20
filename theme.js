/* Read before styles load so a saved night theme does not flash white. */
(() => {
  const root = document.documentElement;
  const storageKey = 'suri-theme';
  let theme = 'light';
  try { if (localStorage.getItem(storageKey) === 'dark') theme = 'dark'; } catch {}
  root.dataset.theme = theme;

  function syncButton() {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = label;
    button.querySelector('span').textContent = theme === 'dark' ? '☾' : '☼';
  }
  function set(next, persist = true) {
    theme = next === 'dark' ? 'dark' : 'light';
    root.dataset.theme = theme;
    if (persist) { try { localStorage.setItem(storageKey, theme); } catch {} }
    syncButton();
    window.dispatchEvent(new CustomEvent('portfolio-theme-change', { detail: { theme } }));
  }
  window.portfolioTheme = Object.freeze({ get: () => theme, set, toggle: () => {
    window.portfolioSound?.play('lamp');
    set(theme === 'dark' ? 'light' : 'dark');
  } });
  document.addEventListener('DOMContentLoaded', () => {
    syncButton();
    document.getElementById('themeToggle')?.addEventListener('click', window.portfolioTheme.toggle);
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) set(event.newValue, false);
  });
})();
