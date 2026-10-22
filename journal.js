'use strict';

(() => {
  const panel = document.getElementById('win-journal');
  if (!panel) return;
  const index = document.getElementById('journalIndex');
  const reader = document.getElementById('journalReader');
  const list = document.getElementById('journalEntries');
  const empty = document.getElementById('journalEmpty');
  const filters = document.getElementById('journalFilters');
  const search = document.getElementById('journalSearch');
  const count = document.getElementById('journalCount');
  const heading = document.getElementById('journalPostTitle');
  const meta = document.getElementById('journalPostMeta');
  const body = document.getElementById('journalPostBody');
  let category = 'all';
  const posts = [];
  const ids = new Set();
  const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const text = value => typeof value === 'string' ? value.trim() : '';
  const reference = value => {
    const label = text(value?.label);
    if (!label) return null;
    try {
      const url = new URL(text(value.url));
      return ['https:', 'http:'].includes(url.protocol) ? { label, url: url.href } : null;
    } catch { return null; }
  };
  for (const entry of window.portfolioJournalPosts || []) {
    if (!entry || entry.draft === true || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '') || ids.has(entry.id)) continue;
    const title = text(entry.title), date = text(entry.date);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) continue;
    const paragraphs = Array.isArray(entry.paragraphs) ? entry.paragraphs.map(text).filter(Boolean) : [];
    if (!paragraphs.length) continue;
    ids.add(entry.id);
    const references = Array.isArray(entry.references) ? entry.references.map(reference).filter(Boolean) : [];
    posts.push({ id: entry.id, title, date, day, paragraphs, references, category: entry.category === 'games' ? 'games' : 'thoughts', game: text(entry.game), spoilers: entry.spoilers === true, excerpt: text(entry.excerpt) || paragraphs[0].slice(0, 180), minutes: Math.max(1, Math.ceil(paragraphs.join(' ').split(/\s+/).length / 220)) });
  }
  posts.sort((a, b) => b.date.localeCompare(a.date));
  const create = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value) element.textContent = value;
    return element;
  };
  const categoryLabel = post => post.category === 'games' ? 'Games' : 'Thoughts';
  const addMeta = (target, post) => {
    const time = create('time', '', dateFormat.format(post.day));
    time.dateTime = post.date;
    target.append(time, create('span', 'journal-category', categoryLabel(post)));
    if (post.game) target.append(create('span', '', post.game));
    if (post.spoilers) target.append(create('span', 'journal-spoiler', 'Spoilers'));
    target.append(create('span', '', `${post.minutes} min read`));
  };
  function renderList() {
    const query = search.value.trim().toLocaleLowerCase();
    const visible = posts.filter(post => (category === 'all' || category === post.category) && [post.title, post.game, post.excerpt, ...post.paragraphs].join(' ').toLocaleLowerCase().includes(query));
    list.replaceChildren();
    for (const post of visible) {
      const item = create('li', 'journal-entry');
      const metadata = create('p', 'journal-meta');
      addMeta(metadata, post);
      const title = create('h3', 'journal-entry-title');
      const link = create('a', '', post.title);
      link.href = `#journal/${post.id}`;
      title.append(link);
      item.append(metadata, title, create('p', 'journal-excerpt', post.excerpt));
      list.append(item);
    }
    empty.hidden = visible.length > 0;
    empty.textContent = posts.length ? 'No entries match. Try another search or category.' : 'No entries yet.';
    count.textContent = posts.length ? `${visible.length} ${visible.length === 1 ? 'entry' : 'entries'}` : '';
    filters.hidden = posts.length === 0;
  }
  function route(focus = false) {
    if (location.hash !== '#journal' && !location.hash.startsWith('#journal/')) return;
    const id = location.hash.slice('#journal/'.length);
    const post = posts.find(entry => entry.id === id);
    const article = location.hash.startsWith('#journal/');
    index.hidden = article;
    reader.hidden = !article;
    if (article) {
      heading.textContent = post?.title || 'Entry not found';
      meta.replaceChildren();
      body.replaceChildren();
      if (post) {
        addMeta(meta, post);
        for (const paragraph of post.paragraphs) body.append(create('p', '', paragraph));
        if (post.references.length) {
          const credits = create('p', 'journal-references', 'Mentioned: ');
          post.references.forEach((source, index) => {
            if (index) credits.append(create('span', '', ' · '));
            const link = create('a', '', source.label);
            link.href = source.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            credits.append(link);
          });
          body.append(credits);
        }
      } else body.append(create('p', '', 'This entry may have moved or has not been published.'));
    }
    window.openWindow('win-journal', { silent: true, sound: false });
    panel.querySelector('.win-body').scrollTop = 0;
    if (focus) (article ? heading : document.getElementById('journalTitle')).focus({ preventScroll: true });
  }
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-journal-category]');
    if (!button) return;
    category = button.dataset.journalCategory;
    for (const filter of filters.querySelectorAll('[data-journal-category]')) filter.setAttribute('aria-pressed', String(filter === button));
    renderList();
  });
  search.addEventListener('input', renderList);
  window.addEventListener('hashchange', () => route(true));
  renderList();
  const reloading = window.performance?.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
  if (reloading && (location.hash === '#journal' || location.hash.startsWith('#journal/'))) {
    // An entry's address is useful for sharing, but refreshing returns home.
    window.history.replaceState(window.history.state, '', location.href.split('#')[0]);
  } else route();
})();
