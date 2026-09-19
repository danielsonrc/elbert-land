// The ranch dresses up for the holidays. Which ones fall on a date, or on any night of a stay.
// No three.js in here.

export const HOLIDAYS = {
  fall: { from: '09-22', to: '11-30', greeting: 'Fall at the ranch. The pumpkins are out.' },
  christmas: { from: '12-01', to: '01-06', greeting: 'Merry Christmas from Edgewood Ranch.' },
  newyear: { from: '12-31', to: '01-01', greeting: 'Happy New Year! Fireworks out west after dark.' },
  july4: { from: '07-01', to: '07-07', greeting: 'Happy Fourth! Look up by day, and out west after dark.' },
};

const DAY = 86400000;
const within = (md, { from, to }) => (from <= to ? md >= from && md <= to : md >= from || md <= to);

/**
 * The holidays on a day (YYYY-MM-DD), or on any night from check-in up to check-out:
 * e.g. { christmas: true, newyear: true }.
 */
export function holidaysBetween(fromKey, toKey = null) {
  const on = {};
  const start = Date.parse(`${fromKey}T12:00:00Z`);
  const end = toKey ? Date.parse(`${toKey}T12:00:00Z`) : start + DAY;
  for (let t = start, n = 0; t < end && n < 60; t += DAY, n++) {
    const md = new Date(t).toISOString().slice(5, 10);
    for (const [key, h] of Object.entries(HOLIDAYS)) if (within(md, h)) on[key] = true;
  }
  return on;
}

/** Today at the ranch, as YYYY-MM-DD. */
export function ranchToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
}
