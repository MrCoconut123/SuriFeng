'use strict';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const mobileQuery = window.matchMedia('(max-width: 768px)');
const photoGallery = $('#personalPhotos');
const audio = $('#audio');
const clickSound = $('#sfxClick');
const dock = $('.dock');
const openers = new Map();
const photoOpeners = new Map();
let topZ = 10;
let muted = false;
let toastTimer;

// Each prop has a quiet, one-shot sound. Nothing plays on hover or page load.
const deskEffects = Object.fromEntries(Object.entries({
  notebook: ['page-flip.wav', .34],
  sketchbook: ['page-flip.wav', .24],
  telephone: ['receiver-lift.wav', .3],
  cassette: ['cassette-click.wav', .24],
  lamp: ['lamp-switch.wav', .2]
}).map(([name, [file, volume]]) => {
  const effect = new Audio(`sfx/${file}`);
  effect.preload = 'auto';
  effect.volume = volume;
  return [name, effect];
}));
function stopDeskEffects() {
  Object.values(deskEffects).forEach(effect => { effect.pause(); effect.currentTime = 0; });
}
function playDeskEffect(name) {
  const effect = deskEffects[name];
  if (muted || !effect) return () => {};
  effect.pause(); effect.currentTime = 0;
  effect.play().catch(() => {});
  return () => { effect.pause(); effect.currentTime = 0; };
}
window.portfolioSound = Object.freeze({ play: playDeskEffect });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopDeskEffects(); });

function viewport() {
  return {
    width: document.documentElement.clientWidth,
    height: Math.max(0, (window.visualViewport?.height || innerHeight) - dock.offsetHeight)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

function keepInView(win) {
  if (win.id === 'win-welcome') return;
  if (mobileQuery.matches) return;
  const area = viewport();
  const rect = win.getBoundingClientRect();
  win.style.left = `${clamp(rect.left, 0, area.width - rect.width)}px`;
  win.style.top = `${clamp(rect.top, 0, area.height - rect.height)}px`;
}

function bringToFront(win) {
  $$('.window.is-front').forEach(other => other.classList.remove('is-front'));
  win.classList.add('is-front');
  win.style.zIndex = ++topZ;
}

function syncDock() {
  $$('.dock [data-target]').forEach(button => {
    const active = document.getElementById(button.dataset.target).classList.contains('active');
    button.classList.toggle('active', active);
    button.setAttribute('aria-expanded', String(active));
  });
}

function playClick() {
  if (muted) return;
  clickSound.currentTime = 0;
  clickSound.play().catch(() => {});
}

function openWindow(id, { silent = false, sound = true, opener = document.activeElement } = {}) {
  const win = document.getElementById(id);
  if (!win) return;
  if (!win.contains(opener)) openers.set(id, opener);
  if (mobileQuery.matches) {
    $$('.window.active').forEach(other => {
      if (other !== win) other.classList.remove('active', 'is-front');
    });
    if (id !== 'win-music') audio.pause();
  }
  win.classList.add('active');
  bringToFront(win);
  keepInView(win);
  syncDock();
  if (!silent) {
    win.focus({ preventScroll: true });
    if (sound) playClick();
  }
}

function closeWindow(win) {
  if (win.id === 'win-welcome') return;
  win.classList.remove('active', 'is-front');
  if (win.id === 'win-music') audio.pause();
  const remaining = $$('.window.active').sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex));
  if (!remaining.length) {
    const home = document.getElementById('win-welcome');
    home.classList.add('active');
    remaining.push(home);
  }
  if (remaining.length) bringToFront(remaining[0]);
  syncDock();
  const opener = openers.get(win.id);
  if (opener?.isConnected && opener.getClientRects().length) {
    const parentWindow = opener.closest('.window.active');
    if (parentWindow) bringToFront(parentWindow);
    opener.focus({ preventScroll: true });
  }
  else if (remaining[0]) remaining[0].focus({ preventScroll: true });
  else $('.dock [data-target="win-welcome"]').focus({ preventScroll: true });
  playClick();
}

function prepareWindow(win) {
  win.tabIndex = -1;
  win.setAttribute('role', 'region');
  win.setAttribute('aria-label', $('.titlebar .title', win).textContent);
  $('.btn-close', win).setAttribute('aria-label', `Close ${win.getAttribute('aria-label')}`);
  win.addEventListener('pointerdown', () => bringToFront(win));
  // Home is the room behind the floating section windows.
  if (win.id === 'win-welcome') return;
  const handle = $('.titlebar', win);
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (mobileQuery.matches || event.button !== 0 || event.target.closest('button')) return;
    const rect = win.getBoundingClientRect();
    drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    handle.setPointerCapture(event.pointerId);
    handle.style.cursor = 'grabbing';
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || mobileQuery.matches) return;
    const area = viewport();
    win.style.left = `${clamp(event.clientX - drag.x, 0, area.width - win.offsetWidth)}px`;
    win.style.top = `${clamp(event.clientY - drag.y, 0, area.height - win.offsetHeight)}px`;
  });
  const stopDrag = () => { drag = null; handle.style.cursor = ''; };
  handle.addEventListener('pointerup', stopDrag);
  handle.addEventListener('pointercancel', stopDrag);
  handle.addEventListener('lostpointercapture', stopDrag);
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-action="close"]');
  if (close) { closeWindow(close.closest('.window')); return; }
  const button = event.target.closest('[data-open]');
  if (button) openWindow(button.dataset.open, { opener: button });
  const photoButton = event.target.closest('[data-photo]');
  if (photoButton) photoOpeners.get(photoButton.dataset.photo)?.(photoButton);
});

$('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  openWindow('win-welcome', { opener: event.currentTarget });
});

$$('.dock [data-target]').forEach(button => {
  button.setAttribute('aria-controls', button.dataset.target);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', button.dataset.tooltip || 'About Suri');
  const img = $('img', button);
  if (img) img.alt = '';
});

function notify(message) {
  const toast = $('#copyConfirm');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

$('#copyEmail').addEventListener('click', async () => {
  const email = 'surizixuansun@gmail.com';
  try {
    await navigator.clipboard.writeText(email);
    notify('Email copied. Say hello!');
  } catch {
    // Older browsers and file previews may not provide the Clipboard API.
    const previousFocus = document.activeElement;
    const input = document.createElement('textarea');
    input.value = email;
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.append(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* Show an honest failure message below. */ }
    input.remove();
    previousFocus?.focus({ preventScroll: true });
    notify(copied ? 'Email copied. Say hello!' : 'Couldn’t copy. Select the email address to copy it.');
  }
});

/* Native modal dialog handles focus containment and Escape. */
const artDialog = $('#artLightbox');
const artEntries = $$('#win-art .art-item:not(.placeholder)').map(item => {
  const thumb = $('.thumb', item);
  const src = /url\(["']?(.*?)["']?\)/.exec(thumb.style.backgroundImage)?.[1];
  return { thumb, src: thumb.dataset.fullSrc || src, title: $('.caption .title', item).textContent, meta: $('.meta', item).textContent };
});
let artIndex = 0;
let artOpener;

function showArt(index) {
  artIndex = (index + artEntries.length) % artEntries.length;
  const art = artEntries[artIndex];
  $('#artLightboxImg').src = art.src;
  $('#artLightboxImg').alt = art.title;
  $('#artLightboxTitle').textContent = `${art.title} · ${artIndex + 1} / ${artEntries.length}`;
  $('#artLightboxMeta').textContent = art.meta;
}

artEntries.forEach((art, index) => {
  art.thumb.setAttribute('role', 'button');
  art.thumb.tabIndex = 0;
  art.thumb.setAttribute('aria-label', `View ${art.title}`);
  art.thumb.setAttribute('aria-haspopup', 'dialog');
  const open = () => {
    artOpener = art.thumb;
    showArt(index);
    artDialog.showModal();
    $('#artLightboxClose').focus();
  };
  art.thumb.addEventListener('click', open);
  art.thumb.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
});
$('#artLightboxClose').addEventListener('click', () => artDialog.close());
$('#artLightboxPrev').addEventListener('click', () => showArt(artIndex - 1));
$('#artLightboxNext').addEventListener('click', () => showArt(artIndex + 1));
artDialog.addEventListener('click', event => { if (event.target === artDialog) artDialog.close(); });
artDialog.addEventListener('close', () => artOpener?.focus({ preventScroll: true }));

const photos = [
  { id: 'cat', file: 'photos/cat.jpg', label: 'cat', caption: "She wandered into our home one day! She’s such an attention seeker and will be annoyed with you if you don’t pet her." },
  { id: 'doggo', file: 'photos/doggo.jpg', label: 'doggo', caption: 'This guy has been with me since 5th grade. So crazy.' },
  { id: 'sheep', file: 'photos/sheep.jpg', label: 'sheep', caption: 'I saw this group of sheep when traveling to the French countryside.' },
  { id: 'drumming', file: 'photos/drumming.jpg', label: 'drumming', caption: 'Playing a mashup of JoJo openings with my band.' },
  { id: 'food', file: 'photos/fire food.jpg', label: 'food', caption: '' },
  { id: 'pretzel', file: 'photos/big pretzel.jpg', label: 'pretzel', caption: '' }
];

photos.forEach(photo => {
  const button = document.createElement('button');
  button.className = 'photo-icon';
  button.setAttribute('aria-label', `Open ${photo.label} photo`);
  const thumbnail = document.createElement('img');
  thumbnail.className = 'photo-thumb';
  thumbnail.src = `photos/previews/${photo.id}.webp`;
  thumbnail.alt = '';
  thumbnail.loading = 'lazy';
  thumbnail.decoding = 'async';
  const label = document.createElement('span');
  label.className = 'photo-label';
  label.textContent = photo.label;
  button.append(thumbnail, label);
  photoGallery.append(button);
  let win;
  const openPhoto = (opener = button) => {
    if (!win) {
      win = document.createElement('section');
      win.id = `win-photo-${photo.id}`;
      win.className = 'window';
      win.style.cssText = 'width:560px;height:540px;';
      win.innerHTML = '<div class="titlebar"><div class="title"></div><button class="btn-close" data-action="close">✕</button></div><div class="win-body photo-body"><img class="photo-img"><p class="photo-cap"></p></div>';
      $('.title', win).textContent = photo.label;
      const image = $('.photo-img', win);
      image.src = photo.file;
      image.alt = photo.caption || `${photo.label} from Suri’s photo collection`;
      image.decoding = 'async';
      $('.photo-cap', win).textContent = photo.caption;
      if (!photo.caption) $('.photo-cap', win).remove();
      document.body.append(win);
      prepareWindow(win);
      openWindow(win.id, { opener });
      centerWindow(win);
    } else openWindow(win.id, { opener });
  };
  photoOpeners.set(photo.id, openPhoto);
  button.addEventListener('click', () => openPhoto(button));
});
window.portfolioPhotos = Object.freeze({ items: photos, open: (id, opener) => photoOpeners.get(id)?.(opener) });

/* Music never autoplays on page load. All controls are keyboard accessible. */
const tracks = [
  { title: 'Menu Theme', src: 'sfx/BubbleWeaverMenuMusic.mp3' },
  { title: 'Level 1', src: 'sfx/BubbleWeaverLevel1Music.mp3' },
  { title: 'Level 2', src: 'sfx/BubbleWeaverLevel2Music.mp3' }
];
const playButton = $('#playBtn');
const progress = $('#progress');
const status = $('#playerStatus');
let trackIndex = 0;
let playRequest = 0;
audio.volume = 0.4;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

function updatePlayer() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const elapsed = audio.currentTime || 0;
  $('#songTime').textContent = `${formatTime(elapsed)} / ${formatTime(duration)}`;
  progress.disabled = duration <= 0;
  progress.value = duration ? elapsed / duration * 100 : 0;
  progress.setAttribute('aria-valuetext', `${formatTime(elapsed)} of ${formatTime(duration)}`);
  const playing = !audio.paused && !audio.ended;
  $('#win-music').classList.toggle('is-playing', playing);
  playButton.textContent = playing ? '⏸' : '▶';
  playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  playButton.title = playing ? 'Pause' : 'Play';
}

async function playTrack() {
  const request = ++playRequest;
  status.textContent = '';
  try { await audio.play(); }
  catch (error) {
    if (request === playRequest && error.name !== 'AbortError') {
      status.textContent = 'This track couldn’t play. Try pressing play again.';
    }
  }
}

function loadTrack(index, autoplay = false) {
  ++playRequest;
  trackIndex = (index + tracks.length) % tracks.length;
  audio.pause();
  audio.src = tracks[trackIndex].src;
  audio.load();
  $('#songTitle').textContent = tracks[trackIndex].title;
  status.textContent = '';
  $$('.song-item').forEach((row, i) => {
    row.classList.toggle('active', i === trackIndex);
    row.setAttribute('aria-pressed', String(i === trackIndex));
  });
  updatePlayer();
  if (autoplay) playTrack();
}

tracks.forEach((track, index) => {
  const button = document.createElement('button');
  button.className = 'song-item';
  button.innerHTML = `<span class="track-index">${String(index + 1).padStart(2, '0')}</span><span class="track-name">${track.title}</span><span class="track-indicator" aria-hidden="true">▷</span>`;
  button.addEventListener('click', () => loadTrack(index, true));
  $('#songList').append(button);
});
playButton.addEventListener('click', () => {
  if (audio.paused || audio.ended) playTrack();
  else { ++playRequest; audio.pause(); }
});
$('#prevBtn').addEventListener('click', () => loadTrack(trackIndex - 1, true));
$('#nextBtn').addEventListener('click', () => loadTrack(trackIndex + 1, true));
progress.addEventListener('input', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    audio.currentTime = Number(progress.value) / 100 * audio.duration;
    updatePlayer();
  }
});
['play', 'pause', 'timeupdate', 'loadedmetadata', 'durationchange', 'emptied'].forEach(type => audio.addEventListener(type, updatePlayer));
audio.addEventListener('ended', () => loadTrack(trackIndex + 1, true));
audio.addEventListener('error', () => {
  status.textContent = 'This track is unavailable. Try another track or come back soon.';
  updatePlayer();
});

function applyMute() {
  audio.muted = muted;
  clickSound.muted = muted;
  Object.values(deskEffects).forEach(effect => { effect.muted = muted; });
  if (muted) stopDeskEffects();
  const label = muted ? 'Unmute sound' : 'Mute sound';
  $('#volBtn').textContent = muted ? '🔇' : '🔊';
  $('#musicMuteBtn').textContent = label;
  [$('#volBtn'), $('#musicMuteBtn')].forEach(button => {
    button.title = label;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(muted));
  });
}
function toggleMute() {
  muted = !muted;
  applyMute();
  try { localStorage.setItem('suri-muted', String(muted)); } catch { /* Storage is optional. */ }
}
$('#volBtn').addEventListener('click', toggleMute);
$('#musicMuteBtn').addEventListener('click', toggleMute);
try { muted = localStorage.getItem('suri-muted') === 'true'; } catch { /* Use default volume. */ }
applyMute();

function centerWindow(win) {
  if (win.id === 'win-welcome') return;
  if (mobileQuery.matches) return;
  const area = viewport();
  win.style.left = `${Math.max(0, (area.width - win.offsetWidth) / 2)}px`;
  win.style.top = `${Math.max(0, (area.height - win.offsetHeight) / 2)}px`;
}

let resizeFrame;
function fitWindows() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const active = $$('.window.active');
    if (mobileQuery.matches && active.length > 1) {
      const front = active.sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
      active.forEach(win => { if (win !== front) win.classList.remove('active', 'is-front'); });
      if (front.id !== 'win-music') audio.pause();
      if (active.some(win => win !== front && win.contains(document.activeElement))) front.focus();
    }
    $$('.window.active').forEach(keepInView);
    syncDock();
  });
}
window.addEventListener('resize', fitWindows);
window.visualViewport?.addEventListener('resize', fitWindows);
mobileQuery.addEventListener('change', fitWindows);

document.addEventListener('keydown', event => {
  if (artDialog.open) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showArt(artIndex - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showArt(artIndex + 1); }
    return;
  }
  if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const shortcuts = { '1': 'win-projects', '2': 'win-art', '3': 'win-music', '4': 'win-contact', '0': 'win-welcome' };
  if (event.altKey && shortcuts[event.key]) {
    event.preventDefault();
    openWindow(shortcuts[event.key]);
  } else if (event.key === 'Escape') {
    const front = $('.window.active.is-front');
    if (front) { event.preventDefault(); closeWindow(front); }
  }
});

function updateClock() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  $('#clock').dateTime = now.toISOString();
  $('#clock').title = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClock(); });
updateClock();
setInterval(updateClock, 15000);

// A plain loading state replaces the retired illustrated desk from first paint.
const deskRoom = $('#win-welcome .desk-room');
const deskLoadStatus = $('#deskLoadStatus');
let deskLoadTimer;
function setDeskState(state) {
  clearTimeout(deskLoadTimer);
  deskRoom.classList.remove('scene-loading', 'scene-ready', 'scene-unavailable');
  deskRoom.classList.add(`scene-${state}`);
  deskRoom.setAttribute('aria-busy', 'false');
  if (state === 'unavailable') deskLoadStatus.textContent = 'The 3D desk couldn’t load. You can still explore using these links.';
}
window.portfolioDesk = Object.freeze({ ready: () => setDeskState('ready'), unavailable: () => setDeskState('unavailable') });
$('#deskSceneScript').addEventListener('error', window.portfolioDesk.unavailable);
deskLoadTimer = setTimeout(() => window.portfolioDesk.unavailable(), 12000);

$$('.window').forEach(prepareWindow);
loadTrack(0);
openWindow('win-welcome', { silent: true });
centerWindow($('#win-welcome'));
