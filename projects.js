'use strict';

// Native hash links let applications point directly at a particular project.
(() => {
  const entries = new Map();
  for (const item of document.querySelectorAll('[data-project-route]')) {
    const panel = item.closest('.window');
    const section = panel?.id === 'win-projects' ? 'projects' : panel?.id === 'win-art' ? 'art' : null;
    const slug = item.dataset.projectRoute;
    if (section && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) entries.set(`#${section}/${slug}`, { item, panel });
  }
  let lastWasProject = false;
  let revealFrame;
  function route(focus = false) {
    if (revealFrame) cancelAnimationFrame(revealFrame);
    const entry = entries.get(location.hash);
    if (!entry) {
      if (lastWasProject && !location.hash) window.openWindow('win-welcome', { silent: !focus, sound: false });
      lastWasProject = false;
      return;
    }
    lastWasProject = true;
    window.openWindow(entry.panel.id, { silent: true, sound: false });
    revealFrame = requestAnimationFrame(() => {
      const scroller = entry.panel.querySelector('.win-body');
      const navigation = entry.panel.querySelector('.section-nav');
      const bounds = scroller.getBoundingClientRect();
      const scale = bounds.height / scroller.offsetHeight || 1;
      scroller.scrollTop += (entry.item.getBoundingClientRect().top - bounds.top) / scale - navigation.offsetHeight - 16;
      if (focus) entry.item.querySelector('.project-title, h3').focus({ preventScroll: true });
    });
  }
  window.addEventListener('hashchange', () => route(true));
  document.addEventListener('click', event => {
    const link = event.target.closest('.project-permalink, .project-index a');
    if (!link || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.getAttribute('href') === location.hash) {
      event.preventDefault();
      route(true);
    }
  });
  const reloading = window.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
  if (reloading && entries.has(location.hash)) {
    window.history.replaceState(window.history.state, '', location.href.split('#')[0]);
  } else route();
})();
