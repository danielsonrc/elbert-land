// Booking panel: photo gallery, availability calendar, and one of three endings:
//   airbnb   - live availability from the listing's calendar, then book on Airbnb
//   waitlist - a sign-up form for stays that aren't open yet
//   request  - a direct booking request (demo only until there's a booking backend)
// Independent of the 3D scene so it still works if WebGL is unavailable.
import { RANCH, STAYS, STAY_ORDER } from './data.js';

// --- dates -------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const nightsBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
function today() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
const isWeekendNight = (d) => d.getDay() === 5 || d.getDay() === 6;
const shortDate = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const tinyDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const longDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function money(n) {
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2,
  });
}

export const modeFor = (s) => (s.status === 'coming-soon' ? 'waitlist' : s.booking === 'airbnb' ? 'airbnb' : 'request');

// Online (not localhost), the waitlist posts to Netlify Forms.
const LIVE_FORMS = RANCH.forms === 'netlify' && !/^(localhost|127\.|\[::1\])/.test(location.hostname);

// --- availability ------------------------------------------------------------
// Airbnb stays: booked nights come from /api/availability (a Netlify function that
// reads the listing's calendar export). Request stays: nights booked in this browser.
const live = {}; // stayId -> { status: 'loading' | 'ready' | 'error', nights: Set, promise }

function loadAvailability(stayId) {
  if (live[stayId]) return live[stayId].promise;
  const entry = (live[stayId] = { status: 'loading', nights: new Set() });
  entry.promise = (async () => {
    try {
      const res = await fetch(`/api/availability?stay=${encodeURIComponent(stayId)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`HTTP ${res.status}`);
      const { ranges } = await res.json();
      const first = today(), last = addDays(first, 400);
      for (const { start, end } of ranges) {
        const stop = fromKey(end) < last ? fromKey(end) : last;
        for (let d = fromKey(start) > first ? fromKey(start) : first; d < stop; d = addDays(d, 1)) entry.nights.add(dayKey(d));
      }
      entry.status = 'ready';
    } catch {
      entry.status = 'error';
    }
    return entry;
  })();
  return entry.promise;
}

const STORE_KEY = 'edgewood-ranch.bookings.v1';
let requests = [];
try { requests = JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { requests = []; }

function bookedNights(s) {
  if (s.booking === 'airbnb') return new Set(live[s.id]?.nights ?? []);
  const set = new Set();
  for (const b of requests) {
    if (b.stayId !== s.id) continue;
    for (let d = fromKey(b.checkIn); dayKey(d) < b.checkOut; d = addDays(d, 1)) set.add(dayKey(d));
  }
  return set;
}

export function quote(stay, checkIn, checkOut) {
  let weeknights = 0, weekends = 0;
  for (let d = fromKey(checkIn); dayKey(d) < checkOut; d = addDays(d, 1)) {
    if (isWeekendNight(d)) weekends++; else weeknights++;
  }
  const lodging = weeknights * stay.rates.weeknight + weekends * stay.rates.weekend;
  const tax = Math.round((lodging + stay.cleaningFee) * RANCH.taxRate * 100) / 100;
  return { weeknights, weekends, nights: weeknights + weekends, lodging, tax, total: lodging + stay.cleaningFee + tax };
}

// --- sending -------------------------------------------------------------------------
const WAITLIST_KEY = 'edgewood-ranch.waitlist.v1';

/** `kind` is 'waitlist' or 'request'. Resolves with the saved record. */
async function submitRequest(kind, request, honeypot = '') {
  const record = { ...request, createdAt: new Date().toISOString() };
  if (kind === 'waitlist' && LIVE_FORMS) {
    const body = new URLSearchParams({
      'form-name': 'waitlist', 'bot-field': honeypot,
      stay: request.stayId, name: request.name, email: request.email, phone: request.phone, notes: request.notes,
    });
    const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!res.ok) throw new Error(`Form submission failed: ${res.status}`);
    return record;
  }
  // Preview: keep it in this browser.
  await new Promise((r) => setTimeout(r, 600));
  if (kind === 'waitlist') {
    try {
      const list = JSON.parse(localStorage.getItem(WAITLIST_KEY)) || [];
      localStorage.setItem(WAITLIST_KEY, JSON.stringify([...list, record]));
    } catch { /* memory only */ }
    return record;
  }
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  record.code = `EWR-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
  requests.push(record);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(requests)); } catch { /* memory only */ }
  return record;
}

function icsUrl(rec, stay) {
  const esc = (s) => String(s).replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Edgewood Ranch//Booking//EN', 'BEGIN:VEVENT',
    `UID:${rec.code}@edgewood-ranch`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${rec.checkIn.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${rec.checkOut.replaceAll('-', '')}`,
    `SUMMARY:${esc(`${stay.name} at ${RANCH.name}`)}`,
    `LOCATION:${esc(RANCH.location)}`,
    `DESCRIPTION:${esc(`Reservation ${rec.code}. Check-in ${RANCH.checkIn}, check-out ${RANCH.checkOut}.`)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
}

// --- icons -------------------------------------------------------------------------
const ICONS = {
  bed: '<path d="M3 18v-7h18v7M3 14.5h18M6 11V8.5h5V11"/>',
  bath: '<path d="M4 12h16v1.5A5.5 5.5 0 0 1 14.5 19h-5A5.5 5.5 0 0 1 4 13.5zM6.5 12V6.5a2 2 0 0 1 4 0"/>',
  fire: '<path d="M12 21c-3.5 0-6-2.3-6-5.5 0-3.8 4-5.5 4-9.5 2.5 1.5 4 4 4 6 1-.5 1.5-1.5 1.5-2.5 1.6 1.5 2.5 3.5 2.5 6 0 3.2-2.5 5.5-6 5.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  star: '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 3.9 1.2 5.7L12 16.2l-5.2 2.9L8 13.4 3.7 9.5l5.8-.7z"/>',
  tub: '<path d="M3 13h18v1.5a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 14.5zM7.5 10c0-1.5 1.4-1.6 1.4-3S7.5 5.4 7.5 4M12 10c0-1.5 1.4-1.6 1.4-3S12 5.4 12 4M16.5 10c0-1.5 1.4-1.6 1.4-3s-1.4-1.6-1.4-3"/>',
  film: '<rect x="3" y="4.5" width="18" height="11.5" rx="1.5"/><path d="M8 20h8M12 16v4M10.2 7.8v4.9l4.1-2.45z"/>',
  guests: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.3"/><path d="M16 14.1c2.8.4 5 2.8 5 5.9"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// --- panel ---------------------------------------------------------------------------
export function createBookingPanel(root, { onClose, onSwap }) {
  const $ = (name) => root.querySelector(`[data-bind="${name}"]`);
  const form = root.querySelector('form');
  const grid = $('grid');
  const state = { stayId: null, checkIn: null, checkOut: null, hover: null, month: null, guests: 2, busy: false };
  let booked = new Set();
  let lastIcs = null;
  let photos = [], photoIndex = 0;
  const lightbox = document.getElementById('lightbox');

  const stay = () => STAYS[state.stayId];
  const mode = () => root.dataset.mode;
  const firstOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const rangeFree = (a, b) => {
    for (let d = fromKey(a); dayKey(d) < b; d = addDays(d, 1)) if (booked.has(dayKey(d))) return false;
    return true;
  };
  const say = (msg) => { $('date-msg').textContent = msg; };

  function fillStay() {
    const s = stay();
    root.dataset.stay = s.id;
    root.dataset.mode = modeFor(s);
    $('site').textContent = s.site;
    $('kicker').textContent = `${RANCH.name} · Site ${s.site}`;
    // keep "A-Frame" together; only break between words
    $('name').replaceChildren(...s.name.split(' ').flatMap((word, i) => [
      ...(i ? [' '] : []),
      Object.assign(document.createElement('span'), { className: 'nowrap', textContent: word }),
    ]));
    $('blurb').textContent = s.blurb;
    const facts = [['guests', `Sleeps ${s.sleeps}`], ...s.facts];
    $('facts').innerHTML = facts.map(([ic]) => `<li>${icon(ic)}<span></span></li>`).join('');
    [...$('facts').children].forEach((li, i) => { li.lastChild.textContent = facts[i][1]; });
    $('amenities').replaceChildren(...s.amenities.map((a) => Object.assign(document.createElement('li'), { textContent: a })));
    $('rates').hidden = !s.rates;
    if (s.rates) $('rates').textContent = `${money(s.rates.weeknight)} weeknights · ${money(s.rates.weekend)} Fri & Sat`;
    $('min-nights').textContent = s.minNights > 1 ? `${s.minNights}-night minimum` : 'one night is fine';
    $('sleeps').textContent = `sleeps up to ${s.sleeps}`;

    $('status').hidden = s.status !== 'coming-soon';
    $('waitlist-copy').textContent = s.waitlist ?? '';
    $('fine').textContent = mode() === 'waitlist'
      ? 'We’ll only email you about the opening.'
      : 'You won’t be charged yet. We confirm every request personally.';

    $('rating').hidden = !s.rating;
    if (s.rating) {
      $('rating').href = s.airbnb;
      $('rating-text').textContent = `${s.rating.score.toFixed(2)} · ${s.rating.reviews} reviews · ${s.rating.note} on Airbnb`;
    }

    photos = s.photos ?? [];
    photoIndex = 0;
    renderPhoto();

    const other = STAYS[STAY_ORDER.find((id) => id !== s.id)];
    $('swap').textContent = `Or have a look at ${other.name}${other.status === 'coming-soon' ? ' (coming soon)' : ''} →`;
    $('swap').dataset.target = other.id;
  }

  function renderPhoto() {
    $('gallery').hidden = photos.length === 0;
    if (!photos.length) return;
    const p = photos[photoIndex];
    Object.assign($('gallery-img'), { src: p.src, alt: p.alt });
    $('gallery-caption').textContent = photos.length > 1 ? `${p.caption} · ${photoIndex + 1} of ${photos.length}` : p.caption;
    $('gallery-tag').hidden = !p.tag;
    $('gallery-tag').textContent = p.tag ?? '';
    for (const b of root.querySelectorAll('.gallery__nav')) b.hidden = photos.length < 2;
    // warm the next picture so paging feels instant
    if (photos.length > 1) new Image().src = photos[(photoIndex + 1) % photos.length].src;
  }

  function showLightbox() {
    const p = photos[photoIndex];
    Object.assign(lightbox.querySelector('img'), { src: p.src, alt: p.alt });
    lightbox.querySelector('figcaption').textContent = p.tag ? `${p.caption} (${p.tag.toLowerCase()})` : p.caption;
    if (!lightbox.open) lightbox.showModal();
  }
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.closest('[data-close]')) lightbox.close();
  });
  lightbox.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step || photos.length < 2) return;
    photoIndex = (photoIndex + step + photos.length) % photos.length;
    renderPhoto();
    showLightbox();
  });
  $('gallery-img').addEventListener('click', showLightbox);

  function renderCalendar() {
    const t0 = dayKey(today());
    const m = state.month;
    $('month').textContent = monthLabel.format(m);
    root.querySelector('[data-action="prev"]').disabled = m <= firstOfMonth(today());
    root.querySelector('[data-action="next"]').disabled = m >= firstOfMonth(addDays(today(), 330));

    const cells = [];
    for (let i = 0; i < m.getDay(); i++) cells.push('<span class="day is-blank" aria-hidden="true"></span>');
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= days; n++) {
      const d = new Date(m.getFullYear(), m.getMonth(), n);
      const key = dayKey(d);
      const past = key < t0;
      const taken = booked.has(key);
      const label = `${longDate.format(d)}${past ? ', past' : taken ? ', booked' : ''}`;
      cells.push(
        `<button type="button" class="day${past ? ' is-past' : ''}${taken ? ' is-booked' : ''}${key === t0 ? ' is-today' : ''}"` +
        ` data-key="${key}" aria-label="${label}"${past ? ' disabled' : ''}>${n}</button>`,
      );
    }
    grid.innerHTML = cells.join('');
    paintRange();
  }

  function renderCalendarStatus() {
    const s = stay();
    const el = $('cal-status');
    if (s.booking !== 'airbnb') {
      el.hidden = true;
      return;
    }
    const status = live[s.id]?.status ?? 'loading';
    el.hidden = false;
    el.dataset.status = status;
    el.textContent = {
      loading: 'Checking the Airbnb calendar…',
      ready: 'Availability is synced from Airbnb.',
      error: 'Live availability didn’t load. Airbnb will confirm your dates.',
    }[status];
  }

  function paintRange() {
    const { checkIn: a, checkOut: b, hover } = state;
    const end = b || (a && hover && hover > a ? hover : null);
    for (const el of grid.querySelectorAll('.day[data-key]')) {
      const k = el.dataset.key;
      el.classList.toggle('is-start', k === a);
      el.classList.toggle('is-end', k === end);
      el.classList.toggle('is-between', !!(a && end && k > a && k < end));
      el.classList.toggle('is-preview', !b && !!end && k > a && k <= end);
      el.setAttribute('aria-pressed', String(k === a || k === b));
    }
    $('in-label').textContent = a ? shortDate.format(fromKey(a)) : 'Add date';
    $('out-label').textContent = b ? shortDate.format(fromKey(b)) : 'Add date';
    root.querySelector('[data-action="focus-in"]').classList.toggle('is-active', !a || !!b);
    root.querySelector('[data-action="focus-out"]').classList.toggle('is-active', !!a && !b);
    renderPrice();
    renderAirbnb();
  }

  /** The hand-off to Airbnb carries the chosen dates and party size. */
  function renderAirbnb() {
    const s = stay();
    if (mode() !== 'airbnb') return;
    const url = new URL(s.airbnb);
    const { checkIn: a, checkOut: b } = state;
    if (a && b) {
      url.searchParams.set('check_in', a);
      url.searchParams.set('check_out', b);
    }
    url.searchParams.set('adults', String(state.guests));
    const link = $('airbnb-cta');
    link.href = url.toString();
    link.firstChild.textContent = a && b
      ? `Book ${tinyDate.format(fromKey(a))} – ${tinyDate.format(fromKey(b))} on Airbnb `
      : 'See prices & book on Airbnb ';
    $('airbnb-note').textContent = a && b
      ? `${plural(nightsBetween(a, b), 'night')} for ${plural(state.guests, 'guest')}. Airbnb shows the total and handles payment and protection.`
      : 'Pick dates to carry them over. Airbnb shows the total and handles payment and protection.';
  }

  function renderPrice() {
    const s = stay();
    const box = $('price');
    const submit = $('submit');
    if (mode() === 'waitlist') {
      submit.textContent = 'Join the waitlist';
      return;
    }
    if (mode() !== 'request' || !s.rates || !(state.checkIn && state.checkOut)) {
      box.hidden = true;
      submit.textContent = 'Request to book';
      return;
    }
    const q = quote(s, state.checkIn, state.checkOut);
    const rows = [];
    if (q.weeknights) rows.push([`${money(s.rates.weeknight)} × ${plural(q.weeknights, 'weeknight')}`, q.weeknights * s.rates.weeknight]);
    if (q.weekends) rows.push([`${money(s.rates.weekend)} × ${plural(q.weekends, 'Fri/Sat night')}`, q.weekends * s.rates.weekend]);
    rows.push(['Cleaning fee', s.cleaningFee]);
    rows.push([`Lodging tax (est. ${Math.round(RANCH.taxRate * 1000) / 10}%)`, q.tax]);
    $('price-rows').replaceChildren(...rows.flatMap(([k, v]) => [
      Object.assign(document.createElement('dt'), { textContent: k }),
      Object.assign(document.createElement('dd'), { textContent: money(v) }),
    ]));
    $('total').textContent = money(q.total);
    $('nights').textContent = plural(q.nights, 'night');
    box.hidden = false;
    submit.textContent = `Request to book · ${money(q.total)}`;
  }

  function pickDay(key) {
    const s = stay();
    const { checkIn: a, checkOut: b } = state;
    if (a && !b && key > a) {
      if (rangeFree(a, key)) {
        const n = nightsBetween(a, key);
        if (n < s.minNights) return say(`${s.name} has a ${s.minNights}-night minimum — pick a later check-out.`);
        state.checkOut = key;
        say(`${plural(n, 'night')} selected.`);
      } else if (!booked.has(key)) {
        state.checkIn = key;
        say('Those dates cross a booked night, so we started over here. Now pick a check-out date.');
      } else {
        say('Someone is already booked in between. Try a shorter stay.');
      }
    } else if (booked.has(key)) {
      say('That night is already booked. Pick another check-in date.');
    } else {
      state.checkIn = key;
      state.checkOut = null;
      say('Now pick your check-out date.');
    }
    state.hover = null;
    paintRange();
  }

  grid.addEventListener('click', (e) => {
    const el = e.target.closest('.day[data-key]');
    if (el && !el.disabled) pickDay(el.dataset.key);
  });
  grid.addEventListener('pointerover', (e) => {
    const el = e.target.closest('.day[data-key]');
    if (!el || !state.checkIn || state.checkOut) return;
    state.hover = el.dataset.key;
    paintRange();
  });
  grid.addEventListener('pointerleave', () => { state.hover = null; paintRange(); });
  grid.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    const el = e.target.closest('.day[data-key]');
    if (!step || !el) return;
    e.preventDefault();
    const next = addDays(fromKey(el.dataset.key), step);
    if (dayKey(next) < dayKey(today())) return;
    if (next.getMonth() !== state.month.getMonth()) {
      state.month = firstOfMonth(next);
      renderCalendar();
    }
    grid.querySelector(`[data-key="${dayKey(next)}"]`)?.focus();
  });

  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const s = stay();
    switch (action) {
      case 'prev':
      case 'next':
        state.month = new Date(state.month.getFullYear(), state.month.getMonth() + (action === 'next' ? 1 : -1), 1);
        renderCalendar();
        break;
      case 'focus-in':
        state.checkIn = state.checkOut = null;
        say('Pick your check-in date.');
        paintRange();
        grid.querySelector('.day:not([disabled]):not(.is-booked)')?.focus();
        break;
      case 'focus-out':
        if (state.checkIn) grid.querySelector(`[data-key="${state.checkIn}"]`)?.focus();
        break;
      case 'guests-dec':
      case 'guests-inc':
        state.guests = Math.min(s.sleeps, Math.max(1, state.guests + (action === 'guests-inc' ? 1 : -1)));
        renderGuests();
        break;
      case 'photo-prev':
      case 'photo-next':
        photoIndex = (photoIndex + (action === 'photo-next' ? 1 : -1) + photos.length) % photos.length;
        renderPhoto();
        break;
      case 'photo-zoom':
        showLightbox();
        break;
      case 'swap':
        onSwap(e.target.closest('[data-action]').dataset.target);
        break;
      case 'close':
      case 'done':
        onClose();
        break;
    }
  });

  function renderGuests() {
    const s = stay();
    $('guests').textContent = plural(state.guests, 'guest');
    root.querySelector('[data-action="guests-dec"]').disabled = state.guests <= 1;
    root.querySelector('[data-action="guests-inc"]').disabled = state.guests >= s.sleeps;
    renderAirbnb();
  }

  function showError(msg, field) {
    $('form-error').textContent = msg;
    if (field) form.elements[field].focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.busy || mode() === 'airbnb') return;
    const s = stay();
    const waitlist = mode() === 'waitlist';
    const data = Object.fromEntries(new FormData(form));
    for (const el of form.querySelectorAll('.field')) el.classList.remove('is-invalid');
    const flag = (name) => form.elements[name].closest('.field').classList.add('is-invalid');
    if (!waitlist && !(state.checkIn && state.checkOut)) {
      showError('Pick your check-in and check-out dates first.');
      root.querySelector('.cal').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!data.name.trim()) { flag('name'); return showError('Please add your name.', 'name'); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) { flag('email'); return showError('That email address doesn’t look right.', 'email'); }
    if (!waitlist && !rangeFree(state.checkIn, state.checkOut)) return showError('Those dates were just taken. Please pick new ones.');
    showError('');

    state.busy = true;
    const submit = $('submit');
    submit.disabled = true;
    submit.textContent = waitlist ? 'Adding you to the list…' : 'Sending your request…';
    const guest = { name: data.name.trim(), email: data.email.trim(), phone: data.phone.trim(), notes: data.notes.trim() };
    try {
      if (waitlist) {
        showConfirmation(await submitRequest('waitlist', { stayId: s.id, ...guest }, data['bot-field'] ?? ''), null);
      } else {
        const q = s.rates ? quote(s, state.checkIn, state.checkOut) : null;
        const rec = await submitRequest('request', {
          stayId: s.id, checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, ...guest, total: q?.total,
        });
        showConfirmation(rec, q ?? { nights: nightsBetween(state.checkIn, state.checkOut), total: null });
      }
    } catch {
      showError('Something went wrong sending that. Please try again, or message us on Airbnb.');
    } finally {
      state.busy = false;
      submit.disabled = false;
      renderPrice();
    }
  });

  /** `q` is the price quote for a request, or null for a waitlist sign-up. */
  function showConfirmation(rec, q) {
    const s = stay();
    const first = rec.name.split(' ')[0];
    $('c-demo').hidden = q ? !RANCH.demoMode : LIVE_FORMS;
    if (!q) {
      $('c-stamp').textContent = 'You’re on the list';
      $('c-title').textContent = `Thanks, ${first}.`;
      $('c-next').textContent = `We’ll email ${rec.email} as soon as ${s.name} opens for booking.`;
    } else {
      $('c-stamp').textContent = 'Request received';
      $('c-title').textContent = `See you out here, ${first}.`;
      $('c-next').textContent = `A confirmation will go to ${rec.email} once we accept your request.`;
      $('c-code').textContent = rec.code;
      $('c-stay').textContent = s.name;
      $('c-dates').textContent = `${shortDate.format(fromKey(rec.checkIn))} → ${shortDate.format(fromKey(rec.checkOut))}`;
      $('c-times').textContent = `Check-in ${RANCH.checkIn} · Check-out ${RANCH.checkOut}`;
      $('c-guests').textContent = `${plural(rec.guests, 'guest')} · ${plural(q.nights, 'night')}`;
      $('c-total').textContent = q.total == null ? 'Confirmed with you directly' : money(q.total);
      if (lastIcs) URL.revokeObjectURL(lastIcs);
      lastIcs = icsUrl(rec, s);
      $('c-ics').href = lastIcs;
      $('c-ics').download = `${RANCH.name.replace(/\s+/g, '-')}-${rec.code}.ics`;
    }
    form.hidden = true;
    $('confirm').hidden = false;
    $('confirm').focus({ preventScroll: true });
    $('confirm').scrollIntoView({ block: 'start', behavior: 'smooth' });
    booked = bookedNights(s);
    state.checkIn = state.checkOut = null;
    form.reset();
  }

  /** Re-check the chosen dates against the latest availability. */
  function settleDates() {
    const s = stay();
    const { checkIn: a, checkOut: b } = state;
    if (a && b) {
      const n = nightsBetween(a, b);
      if (rangeFree(a, b) && n >= s.minNights) {
        say(`${plural(n, 'night')} selected.`);
      } else {
        state.checkIn = state.checkOut = null;
        say(`Those dates aren’t available at ${s.name}. Pick new ones below.`);
      }
    } else {
      if (a && booked.has(a)) state.checkIn = null;
      say(state.checkIn ? 'Now pick your check-out date.' : 'Pick your check-in date.');
    }
  }

  return {
    open(stayId) {
      state.stayId = stayId;
      const s = stay();
      booked = bookedNights(s);
      fillStay();
      form.hidden = false;
      $('confirm').hidden = true;
      $('form-error').textContent = '';
      $('form-stay').value = s.id;
      settleDates();
      if (!state.month) state.month = firstOfMonth(today());
      state.guests = Math.min(state.guests, s.sleeps);
      renderCalendar();
      renderGuests();
      renderCalendarStatus();
      if (s.booking === 'airbnb') {
        loadAvailability(s.id).then(() => {
          if (state.stayId !== s.id) return;
          booked = bookedNights(s);
          settleDates();
          renderCalendar();
          renderCalendarStatus();
        });
      }
    },
    /** Start fetching availability early (e.g. while the intro plays). */
    preload(stayId) {
      if (STAYS[stayId]?.booking === 'airbnb') loadAvailability(stayId);
    },
    get stayId() { return state.stayId; },
  };
}
