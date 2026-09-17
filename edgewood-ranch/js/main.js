// Page wiring: HUD, stay cards, markers, booking panel and the 3D world.
import { RANCH, STAYS, STAY_ORDER, CARD_ORDER, PALETTES, PALETTE_ORDER } from './data.js';
import { createBookingPanel, money, icon } from './booking.js';

const $ = (sel) => document.querySelector(sel);
const body = document.body;
const panelEl = $('#panel');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 760px)');
const TOD_KEY = 'edgewood-ranch.tod';
let world = null;

// --- static copy from the config --------------------------------------------------
for (const el of document.querySelectorAll('[data-ranch]')) el.textContent = RANCH[el.dataset.ranch];
if (RANCH.email) $('#contact').href = `mailto:${RANCH.email}`;
else $('#contact').hidden = true;

// --- stay cards & floating markers --------------------------------------------------
const fromPrice = (s) => money(Math.min(s.rates.weeknight, s.rates.weekend));
const rating = (s) => (s.rating ? `★ ${s.rating.score.toFixed(2)}` : '');
function cardNote(s) {
  if (s.status === 'coming-soon') return '<span class="stay-card__soon">Coming soon</span>';
  if (s.rates) return `<span>from <b>${fromPrice(s)}</b>/night</span>`;
  return `<span><b>${rating(s)}</b> on Airbnb</span>`;
}
function markerNote(s) {
  if (s.status === 'coming-soon') return 'Coming soon · join the waitlist';
  if (s.rates) return `from ${fromPrice(s)} / night`;
  return `${rating(s)} · book on Airbnb`;
}
const cardsEl = $('#stay-cards');
const markerLayer = $('#markers');
const markers = {};

for (const id of CARD_ORDER) {
  const s = STAYS[id];
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'stay-card';
  card.dataset.stay = id;
  card.innerHTML = `
    <span class="stay-card__site">Site ${s.site}</span>
    <span class="stay-card__name"></span>
    <span class="stay-card__meta">${icon('guests')}<span>Sleeps ${s.sleeps}</span><span class="dot"></span>${cardNote(s)}</span>`;
  card.querySelector('.stay-card__name').textContent = s.name;
  cardsEl.append(card);

  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = 'marker';
  marker.dataset.stay = id;
  marker.setAttribute('aria-label', `Look at ${s.name}`);
  marker.innerHTML = `
    <span class="marker__label"><b></b><small>${markerNote(s)}</small></span>
    <span class="marker__stem"></span><span class="marker__pin">${s.site}</span>`;
  marker.querySelector('b').textContent = s.name;
  markerLayer.append(marker);
  markers[id] = marker;
}

for (const el of [cardsEl, markerLayer]) {
  el.addEventListener('click', (e) => {
    const id = e.target.closest('[data-stay]')?.dataset.stay;
    if (id) selectStay(id);
  });
  el.addEventListener('pointerover', (e) => world?.setHighlight(e.target.closest('[data-stay]')?.dataset.stay ?? null));
  el.addEventListener('pointerout', () => world?.setHighlight(null));
  el.addEventListener('focusin', (e) => world?.setHighlight(e.target.closest('[data-stay]')?.dataset.stay ?? null));
  el.addEventListener('focusout', () => world?.setHighlight(null));
}

// --- time of day ---------------------------------------------------------------------
const TOD_ICONS = {
  dawn: '<path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 5v3M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M3 21h18"/>',
  day: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>',
  golden: '<path d="M3 16h18M7 16a5 5 0 0 1 10 0M3 20h18M2 12l5 2M22 12l-5 2"/>',
  night: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
};
const todEl = $('#tod');
for (const key of PALETTE_ORDER) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.tod = key;
  b.title = PALETTES[key].label;
  b.setAttribute('aria-label', PALETTES[key].label);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TOD_ICONS[key]}</svg>`;
  todEl.append(b);
}
todEl.addEventListener('click', (e) => {
  const key = e.target.closest('[data-tod]')?.dataset.tod;
  if (key) setTimeOfDay(key);
});

function setTimeOfDay(key, instant = false) {
  body.dataset.tod = key;
  for (const b of todEl.children) b.setAttribute('aria-pressed', String(b.dataset.tod === key));
  $('#tod-label').textContent = PALETTES[key].label;
  world?.setTimeOfDay(key, instant);
  try { localStorage.setItem(TOD_KEY, key); } catch { /* not persisted */ }
}

let savedTod = 'golden';
try { savedTod = localStorage.getItem(TOD_KEY) || 'golden'; } catch { /* default */ }
if (!PALETTES[savedTod]) savedTod = 'golden';
setTimeOfDay(savedTod, true);

// --- booking panel ----------------------------------------------------------------------
const panel = createBookingPanel(panelEl, {
  onClose: () => backToMeadow(),
  onSwap: (id) => selectStay(id),
});
panelEl.inert = true;
for (const id of STAY_ORDER) panel.preload(id);

function syncInset() {
  if (!world) return;
  const open = body.dataset.view === 'stay';
  // keep the meadow framed above the stay cards
  if (!open) return world.setInset(0, $('.stays').offsetHeight * 0.8);
  if (mobileQuery.matches) world.setInset(0, Math.min(panelEl.offsetHeight, innerHeight * 0.58));
  else world.setInset(panelEl.offsetWidth, 0);
}

function selectStay(id) {
  if (!STAYS[id]) return;
  const wasOpen = body.dataset.view === 'stay';
  body.dataset.view = 'stay';
  body.dataset.stay = id;
  panel.open(id);
  panelEl.inert = false;
  panelEl.setAttribute('aria-hidden', 'false');
  for (const c of cardsEl.children) c.setAttribute('aria-pressed', String(c.dataset.stay === id));
  world?.focus(id);
  syncInset();
  history.replaceState(null, '', `#${id}`);
  if (!wasOpen) panelEl.querySelector('.panel__scroll').scrollTop = 0;
  requestAnimationFrame(() => panelEl.querySelector('#stay-name').focus({ preventScroll: true }));
}

function backToMeadow() {
  const last = body.dataset.stay;
  body.dataset.view = 'meadow';
  delete body.dataset.stay;
  panelEl.inert = true;
  panelEl.setAttribute('aria-hidden', 'true');
  panelEl.classList.remove('is-expanded');
  for (const c of cardsEl.children) c.setAttribute('aria-pressed', 'false');
  world?.overview();
  syncInset();
  history.replaceState(null, '', location.pathname + location.search);
  cardsEl.querySelector(`[data-stay="${last}"]`)?.focus({ preventScroll: true });
}

panelEl.querySelector('[data-expand]').addEventListener('click', () => {
  panelEl.classList.toggle('is-expanded');
});

new ResizeObserver(syncInset).observe(panelEl);
mobileQuery.addEventListener('change', syncInset);

// --- keyboard ----------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // the lightbox handles its own Esc
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
  if (e.key === 'Escape' && body.dataset.view === 'stay') backToMeadow();
  else if (e.key === 'Escape' && body.dataset.view === 'intro') world?.skipIntro();
  else if (e.key === '1' || e.key === '2') selectStay(STAY_ORDER[Number(e.key) - 1]);
});

// --- compass -----------------------------------------------------------------------------
const rose = $('#compass-rose');
const bearingEl = $('#compass-bearing');
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
let lastBearing = null;
function onHeading(deg) {
  const rounded = Math.round(deg);
  if (rounded === lastBearing) return;
  lastBearing = rounded;
  rose.style.transform = `rotate(${-deg}deg)`;
  bearingEl.textContent = `${POINTS[Math.round(deg / 45) % 8]} ${String(rounded % 360).padStart(3, '0')}°`;
}

// --- boot the world ------------------------------------------------------------------------
const deepLink = location.hash.slice(1);
body.dataset.view = 'loading';

// The arrival fly-through plays once per browser session.
let introSeen = false;
try {
  introSeen = sessionStorage.getItem('edgewood-ranch.intro') === 'seen';
  sessionStorage.setItem('edgewood-ranch.intro', 'seen');
} catch { /* play it */ }

function reveal() {
  $('#loader').classList.add('is-done');
  if (body.dataset.view === 'stay') {
    world?.focus(body.dataset.stay); // a stay was picked from the keyboard while loading
  } else if (STAYS[deepLink]) {
    body.dataset.view = 'meadow';
    selectStay(deepLink);
  } else if (world && !reducedMotion && !introSeen) {
    body.dataset.view = 'intro';
    world.playIntro();
  } else {
    body.dataset.view = 'meadow';
    world?.overview();
  }
}

$('#skip-intro').addEventListener('click', () => world?.skipIntro());

try {
  const { createRanchScene } = await import('./scene.js');
  world = createRanchScene({
    canvas: $('#world'),
    markers,
    ranchName: RANCH.name,
    reducedMotion,
    onHover: (id) => {
      if (id) body.dataset.hover = id;
      else delete body.dataset.hover;
    },
    onSelect: (id) => selectStay(id),
    onHeading,
    onIntroEnd: () => {
      if (body.dataset.view === 'intro') body.dataset.view = 'meadow';
    },
    onReady: () => setTimeout(reveal, reducedMotion ? 0 : 450),
  });
  world.setTimeOfDay(body.dataset.tod, true);
  syncInset();
  if (new URLSearchParams(location.search).has('debug')) window.ranch = world;
} catch (err) {
  console.error('3D world unavailable, falling back to the flat page.', err);
  body.classList.add('no-webgl');
  world = null;
  reveal();
}
