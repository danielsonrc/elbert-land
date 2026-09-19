// Page wiring: HUD, stay cards, markers, booking panel and the 3D world.
import { RANCH, STAYS, STAY_ORDER, CARD_ORDER, PALETTES, PALETTE_ORDER } from './data.js';
import { createBookingPanel, money, icon, stars } from './booking.js';
import { createSheet } from './sheet.js';
import { WEATHER, ROLLING_IN, liveMix, ranchClock, ranchHour, typicalWeather, monthName } from './sky.js';
import { HOLIDAYS, holidaysBetween, ranchToday } from './holidays.js';

const $ = (sel) => document.querySelector(sel);
const body = document.body;
const panelEl = $('#panel');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobileQuery = matchMedia('(max-width: 760px)');
let world = null;

// --- static copy from the config --------------------------------------------------
for (const el of document.querySelectorAll('[data-ranch]')) el.textContent = RANCH[el.dataset.ranch];
if (RANCH.email) $('#contact').href = `mailto:${RANCH.email}`;
else $('#contact').hidden = true;

// --- stay cards & floating markers --------------------------------------------------
const fromPrice = (s) => money(Math.min(s.rates.weeknight, s.rates.weekend));
const rating = (s) => (s.rating ? `★ ${stars(s.rating.score)}` : '');
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

// --- sky: time of day and weather, live by default ----------------------------------------------
// Live follows the sun over the ranch and the latest weather observation next door. Pick a time
// or a weather to override either. With weather on Live, chosen dates preview their season.
const svg = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
const LIVE = '<circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2"/>';
const SUN = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M5.3 18.7 7 17M17 7l1.7-1.7"/>';
const CLOUD = '<path d="M7 15.5h10.4a3.6 3.6 0 0 0 .5-7.2A5.5 5.5 0 0 0 7.4 7.5 4 4 0 0 0 7 15.5z"/>';
const TIME_ICONS = {
  live: LIVE,
  dawn: '<path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 5v3M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M3 21h18"/>',
  day: SUN,
  golden: '<path d="M3 16h18M7 16a5 5 0 0 1 10 0M3 20h18M2 12l5 2M22 12l-5 2"/>',
  night: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
};
const WEATHER_ICONS = {
  live: LIVE,
  clear: SUN,
  cloudy: '<path d="M6.5 18.5h11a4.2 4.2 0 0 0 .6-8.35A6.2 6.2 0 0 0 6.2 8.8a4.9 4.9 0 0 0 .3 9.7z"/>',
  rain: `${CLOUD}<path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5"/>`,
  storm: `${CLOUD}<path d="M12.8 16 10.7 19.2h3l-1.9 3.3"/>`,
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4"/>',
};

const todEl = $('#tod'), weatherEl = $('#weather'), skyLabel = $('#sky-label');
function skyButton(parent, name, key, label, icon) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset[name] = key;
  b.title = label;
  b.setAttribute('aria-label', label);
  b.innerHTML = svg(icon);
  parent.append(b);
  return b;
}
skyButton(todEl, 'tod', 'live', 'Live: the sky at the ranch right now', TIME_ICONS.live);
for (const key of PALETTE_ORDER) skyButton(todEl, 'tod', key, PALETTES[key].label, TIME_ICONS[key]);
const weatherToggle = skyButton(todEl, 'toggle', 'weather', 'Weather', '<path d="M12 5v14M5 12h14"/>');
weatherToggle.setAttribute('aria-expanded', 'false');
weatherToggle.setAttribute('aria-controls', 'weather');
for (const key of Object.keys(WEATHER_ICONS)) {
  skyButton(weatherEl, 'weather', key, key === 'live' ? 'Live weather' : WEATHER[key].label, WEATHER_ICONS[key]);
}

const sky = { time: 'live', weather: 'live', live: null, tempF: null, season: null };
let shownWeather = null;
const LINGER_MS = 45 * 1000; // how long on a season's dates before its weather may roll in

/** Is the sky showing afternoon or evening, when summer storms build? */
function afternoonSky(now) {
  if (sky.time !== 'live') return sky.time === 'day' || sky.time === 'golden';
  const hour = ranchHour(now);
  return hour >= 12 && hour < 20;
}

function applySky(instant = false) {
  const now = new Date();
  if (sky.time === 'live') {
    const { from, to, t } = liveMix(now);
    world?.setTimeMix(from, to, t, instant);
    body.dataset.tod = t < 0.5 ? from : to;
  } else {
    world?.setTimeOfDay(sky.time, instant);
    body.dataset.tod = sky.time;
  }
  // chosen dates show a typical day; linger and the season's weather may roll in
  const season = sky.weather === 'live' ? sky.season : null;
  const rolling = Boolean(season?.linger && performance.now() - season.since >= LINGER_MS && (!season.afternoon || afternoonSky(now)));
  const kind = sky.weather !== 'live' ? sky.weather : season ? (rolling ? season.linger : season.usual) : sky.live ?? 'clear';
  if (world && kind !== shownWeather) {
    world.setWeather(kind, { instant });
    shownWeather = kind;
  }
  const parts = [sky.time === 'live' ? `Live · ${ranchClock(now)}` : PALETTES[sky.time].label];
  if (season) parts.push(rolling ? `${ROLLING_IN[kind]}, ${season.month}-style` : `${WEATHER[kind].label}, usual for ${season.month}`);
  else if (sky.weather !== 'live' || sky.live) parts.push(WEATHER[kind].label);
  if (sky.weather === 'live' && !season && sky.tempF != null) parts.push(`${sky.tempF}°F`);
  skyLabel.textContent = parts.join(' · ');
  for (const b of todEl.querySelectorAll('[data-tod]')) b.setAttribute('aria-pressed', String(b.dataset.tod === sky.time));
  for (const b of weatherEl.children) b.setAttribute('aria-pressed', String(b.dataset.weather === sky.weather));
}

todEl.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b === weatherToggle) {
    weatherEl.hidden = !weatherEl.hidden;
    weatherToggle.setAttribute('aria-expanded', String(!weatherEl.hidden));
  } else if (b?.dataset.tod) {
    sky.time = b.dataset.tod;
    applySky();
  }
});
weatherEl.addEventListener('click', (e) => {
  const key = e.target.closest('[data-weather]')?.dataset.weather;
  if (!key) return;
  sky.weather = key;
  applySky();
});

/**
 * With weather on Live, chosen dates show a typical day for that month; stay on them a while
 * and that season's storms or snow may roll in.
 */
let lingerTimer = 0;
function previewSeason(checkIn) {
  const month = checkIn ? monthName(checkIn) : null;
  if (!checkIn) sky.season = null;
  else if (sky.season?.month !== month) sky.season = { ...typicalWeather(checkIn), month, since: performance.now() };
  clearTimeout(lingerTimer);
  if (sky.season?.linger) lingerTimer = setTimeout(() => applySky(), sky.season.since + LINGER_MS + 100 - performance.now());
  applySky();
}

async function loadLiveWeather() {
  try {
    const res = await fetch('/api/weather', { signal: AbortSignal.timeout?.(6000) });
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return;
    const data = await res.json();
    if (!WEATHER[data.kind]) return;
    sky.live = data.kind;
    sky.tempF = data.tempF ?? null;
    applySky(body.dataset.view === 'loading');
  } catch {
    // no observation: the live sky just stays clear
  }
}

applySky(true);
loadLiveWeather();
setInterval(() => applySky(), 30 * 1000); // the live clock and sun move on
setInterval(loadLiveWeather, 15 * 60 * 1000);

// --- booking panel ----------------------------------------------------------------------
const panel = createBookingPanel(panelEl, {
  onClose: () => backToMeadow(),
  onSwap: (id) => selectStay(id),
  onDates: (checkIn, checkOut) => {
    previewSeason(checkIn);
    previewHolidays(checkIn, checkOut);
  },
});
panelEl.inert = true;
for (const id of STAY_ORDER) panel.preload(id);

// on phones the panel is a bottom sheet you can pull up, down or away
const sheet = createSheet(panelEl, {
  active: () => mobileQuery.matches && body.dataset.view === 'stay',
  onDismiss: () => backToMeadow(),
});

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
  sheet.reset();
  for (const c of cardsEl.children) c.setAttribute('aria-pressed', 'false');
  world?.overview();
  syncInset();
  history.replaceState(null, '', location.pathname + location.search);
  cardsEl.querySelector(`[data-stay="${last}"]`)?.focus({ preventScroll: true });
}

new ResizeObserver(syncInset).observe(panelEl);
mobileQuery.addEventListener('change', () => {
  sheet.reset();
  syncInset();
});

// --- keyboard ----------------------------------------------------------------------------
addEventListener('keydown', (e) => {
  if (document.querySelector('dialog[open]')) return; // the lightbox handles its own Esc
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
  if (e.key.length === 1) {
    typed = (typed + e.key.toLowerCase()).slice(-6);
    if (typed === 'aurora') {
      typed = '';
      toggleAurora();
    }
  }
  if (e.key === 'Escape' && body.dataset.view === 'stay') backToMeadow();
  else if (e.key === 'Escape' && body.dataset.view === 'intro') world?.skipIntro();
  else if (e.key === '1' || e.key === '2') selectStay(STAY_ORDER[Number(e.key) - 1]);
});

// --- easter egg: the northern lights ---------------------------------------------------------
// Type "aurora", or look through the A-frame's telescope (click it). They really do reach
// Colorado: the listing has a photo of them over the A-frame.
let typed = '';
const toast = $('#toast');
let toastTimer = 0;
function note(text) {
  toast.textContent = text;
  toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-on'), 5200);
}
function toggleAurora() {
  if (!world) return;
  const on = !world.aurora;
  world.setAurora(on);
  if (on) {
    // they need a dark, clear sky
    if (body.dataset.tod !== 'night') sky.time = 'night';
    if (['cloudy', 'rain', 'storm', 'snow', 'fog'].includes(shownWeather)) sky.weather = 'clear';
    applySky();
    note('Northern lights over the ranch. They really do reach Colorado.');
  } else {
    note('The lights fade back into the north.');
  }
}

// --- holidays ------------------------------------------------------------------------------
// The ranch dresses for the dates you'd be here: today in Colorado, or the stay picked in the
// calendar. Pumpkins in the fall, lights at Christmas, fireworks at New Year's and on the Fourth
// (when a bald eagle circles too). Each gets a hello the first time it shows.
const GREET_FIRST = ['newyear', 'july4', 'christmas', 'fall'];
const greeted = new Set();
let stayDates = null, holidaysNow = {}, today = ranchToday();

function applyHolidays({ greet = true } = {}) {
  holidaysNow = stayDates ? holidaysBetween(...stayDates) : holidaysBetween(today);
  world?.setHolidays(holidaysNow);
  if (greet) greetHolidays();
}
function greetHolidays() {
  const fresh = GREET_FIRST.find((key) => holidaysNow[key] && !greeted.has(key));
  for (const key of Object.keys(holidaysNow)) greeted.add(key);
  if (fresh) note(HOLIDAYS[fresh].greeting);
}
function previewHolidays(checkIn, checkOut) {
  stayDates = checkIn ? [checkIn, checkOut] : null;
  applyHolidays();
}
setInterval(() => {
  if (ranchToday() === today) return; // a page left open past midnight moves on to the new day
  today = ranchToday();
  if (!stayDates) applyHolidays();
}, 60 * 1000);

// --- compass -----------------------------------------------------------------------------
// The meadow keeps the ranch's real layout (north is straight ahead in the meadow view), so the
// compass reads true. The distances are squeezed, hence "Not to scale" under it.
const rose = $('#compass-rose');
const bearingEl = $('#compass-bearing');
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
let lastBearing = null;
function onHeading(deg) {
  const rounded = Math.round(deg) % 360;
  if (rounded === lastBearing) return;
  lastBearing = rounded;
  rose.style.transform = `rotate(${-deg}deg)`;
  bearingEl.textContent = `${POINTS[Math.round(deg / 45) % 8]} ${String(rounded).padStart(3, '0')}°`;
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
  // say hello to any holiday once the view has settled (the arrival says it when it ends)
  if (body.dataset.view !== 'intro') setTimeout(greetHolidays, 1200);
}

$('#skip-intro').addEventListener('click', () => world?.skipIntro());

try {
  const { createRanchScene } = await import('./scene.js');
  world = createRanchScene({
    canvas: $('#world'),
    markers,
    sign: $('#entrance-sign'),
    reducedMotion,
    onHover: (id) => {
      if (id) body.dataset.hover = id;
      else delete body.dataset.hover;
    },
    onSelect: (id) => selectStay(id),
    onHeading,
    onIntroEnd: () => {
      if (body.dataset.view === 'intro') body.dataset.view = 'meadow';
      setTimeout(greetHolidays, 600);
    },
    onReady: () => setTimeout(reveal, reducedMotion ? 0 : 450),
    onEasterEgg: (egg) => { if (egg === 'aurora') toggleAurora(); },
  });
  applySky(true);
  applyHolidays({ greet: false });
  syncInset();
  if (new URLSearchParams(location.search).has('debug')) window.ranch = world;
} catch (err) {
  console.error('3D world unavailable, falling back to the flat page.', err);
  body.classList.add('no-webgl');
  world = null;
  reveal();
}
