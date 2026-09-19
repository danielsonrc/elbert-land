// What the sky over the ranch is doing: the ranch's clock, the sun's height there, the palette
// blend that matches it, and the weather that's typical for a month. No three.js in here.

/** Peyton, Colorado. */
export const RANCH_SKY = { lat: 39.03, lon: -104.48, zone: 'America/Denver' };

const rad = Math.PI / 180;

/** The sun at the ranch: elevation in degrees, and whether it's still climbing (morning). */
export function sunAt(date, { lat, lon } = RANCH_SKY) {
  // NOAA's low-precision solar position, good to a fraction of a degree
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda)) / rad;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  let hour = (gmst * 15 + lon - ra) % 360; // hour angle: negative before solar noon
  if (hour > 180) hour -= 360;
  if (hour < -180) hour += 360;
  const phi = lat * rad, h = hour * rad;
  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)) / rad;
  return { el, rising: hour < 0 };
}

/**
 * The two palettes to blend for the live sky, and how far between them: `{ from, to, t }`.
 * Night, then dawn (or golden hour in the evening) around sunrise and sunset, then day.
 */
export function liveMix(date) {
  const { el, rising } = sunAt(date);
  const glow = rising ? 'dawn' : 'golden';
  if (el <= -9) return { from: 'night', to: 'night', t: 0 };
  if (el < -3) return { from: 'night', to: glow, t: (el + 9) / 6 }; // twilight
  if (el < 6) return { from: glow, to: glow, t: 0 };
  if (el < 18) return { from: glow, to: 'day', t: (el - 6) / 12 };
  return { from: 'day', to: 'day', t: 0 };
}

/** The ranch's local time, e.g. "6:42 PM". */
export function ranchClock(date) {
  return date.toLocaleTimeString('en-US', { timeZone: RANCH_SKY.zone, hour: 'numeric', minute: '2-digit' });
}

/** The hour (0-23) at the ranch. */
export function ranchHour(date) {
  return Number(date.toLocaleString('en-US', { timeZone: RANCH_SKY.zone, hour: 'numeric', hourCycle: 'h23' }));
}

export const WEATHER = {
  clear: { label: 'Clear' },
  partly: { label: 'Partly cloudy' },
  cloudy: { label: 'Cloudy' },
  rain: { label: 'Rain' },
  storm: { label: 'Thunderstorms' },
  snow: { label: 'Snow' },
  fog: { label: 'Fog' },
  winter: { label: 'Snowy and clear' },
};

// A typical day each month in the Black Forest, and what can roll in if you stay a while. It's a
// sunny, dry place: snow lies through the winter under mostly blue skies (March snows the most),
// May brings the odd shower, and the July and August monsoon builds afternoon thunderstorms.
// `afternoon` weather only arrives when the sky shows afternoon or evening.
const SEASONS = [
  { usual: 'winter', linger: 'snow' }, // January
  { usual: 'winter', linger: 'snow' },
  { usual: 'winter', linger: 'snow' },
  { usual: 'partly', linger: 'snow' },
  { usual: 'partly', linger: 'rain', afternoon: true }, // May
  { usual: 'clear' },
  { usual: 'partly', linger: 'storm', afternoon: true }, // July
  { usual: 'partly', linger: 'storm', afternoon: true },
  { usual: 'clear' },
  { usual: 'clear' },
  { usual: 'partly', linger: 'snow' }, // November
  { usual: 'winter', linger: 'snow' },
];

/** The weather of a typical day in the month of a YYYY-MM-DD date: { usual, linger?, afternoon? }. */
export function typicalWeather(dateKey) {
  return SEASONS[Number(dateKey.slice(5, 7)) - 1];
}

/** How a lingering spell of weather is described, e.g. "Afternoon storm, July-style". */
export const ROLLING_IN = { storm: 'Afternoon storm', rain: 'Spring shower', snow: 'Snow starting' };

/** "December" for a YYYY-MM-DD date. */
export function monthName(dateKey) {
  return new Date(`${dateKey}T12:00:00`).toLocaleString('en-US', { month: 'long' });
}
