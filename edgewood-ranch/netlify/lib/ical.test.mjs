// Run with: node --test "edgewood-ranch/netlify/lib/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookedRanges } from './ical.mjs';

// Shaped like Airbnb's export: CRLF line endings, folded lines, reservation details.
const feed = [
  'BEGIN:VCALENDAR',
  'PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 1.0//EN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261009',
  'DTSTART;VALUE=DATE:20261007',
  'UID:1418fb94e984-aaa@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM\r\n ABC123\\nPhone Number (Last 4 Digits): 1234',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261115',
  'DTSTART;VALUE=DATE:20261101',
  'UID:7f2a-bbb@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20260902',
  'DTSTART;VALUE=DATE:20260830',
  'UID:old@airbnb.com',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261224',
  'UID:single@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('returns only future ranges, sorted, with exclusive ends', () => {
  assert.deepEqual(bookedRanges(feed, { today: '2026-09-17' }), [
    { start: '2026-10-07', end: '2026-10-09' },
    { start: '2026-11-01', end: '2026-11-15' },
    { start: '2026-12-24', end: '2026-12-25' },
  ]);
});

test('keeps a stay that is underway today', () => {
  const ranges = bookedRanges(feed, { today: '2026-10-08' });
  assert.deepEqual(ranges[0], { start: '2026-10-07', end: '2026-10-09' });
});

test('never passes along event details', () => {
  const out = JSON.stringify(bookedRanges(feed, { today: '2026-01-01' }));
  assert.doesNotMatch(out, /Reserved|Phone|reservations|HM/);
});

test('handles LF-only feeds and an empty calendar', () => {
  assert.equal(bookedRanges(feed.replaceAll('\r\n', '\n'), { today: '2026-09-17' }).length, 3);
  assert.deepEqual(bookedRanges('BEGIN:VCALENDAR\r\nEND:VCALENDAR'), []);
});
