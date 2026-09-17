// Reads an iCal (.ics) calendar export and returns just the unavailable stretches.
// Airbnb's export has one event per reservation or blocked range, as all-day
// dates with an exclusive end (the checkout day).

const dateOf = (value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

function nextDay(key) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string} ics calendar text
 * @param {{ today?: string }} [options] YYYY-MM-DD; ranges that ended before it are dropped
 * @returns {{ start: string, end: string }[]} end is exclusive, both YYYY-MM-DD
 */
export function bookedRanges(ics, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = ics.replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // unfold continuation lines
  const ranges = [];
  let event = null;
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      event = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (event?.start) {
        const end = event.end && event.end > event.start ? event.end : nextDay(event.start);
        if (end > today) ranges.push({ start: event.start, end });
      }
      event = null;
    } else if (event) {
      const m = /^(DTSTART|DTEND)[^:]*:(\d{8})/.exec(line);
      if (m) event[m[1] === 'DTSTART' ? 'start' : 'end'] = dateOf(m[2]);
    }
  }
  return ranges.sort((a, b) => a.start.localeCompare(b.start));
}
