// Run with: node --test "edgewood-ranch/netlify/lib/*.test.mjs"
// Exercises the availability function end to end with a stubbed calendar feed.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler, { config } from '../functions/availability.mjs';

const FEED_URL = 'https://calendar.example/listing.ics';
const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
const later = new Date(Date.now() + 33 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
const feed = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${future}\r\nDTEND;VALUE=DATE:${later}\r\nSUMMARY:Reserved\r\nDESCRIPTION:Phone Number (Last 4 Digits): 1234\r\nEND:VEVENT\r\nEND:VCALENDAR`;

const realFetch = globalThis.fetch;
let requested;
beforeEach(() => {
  requested = [];
  process.env.AIRBNB_ICAL_AFRAME = FEED_URL;
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return String(url) === FEED_URL ? new Response(feed) : new Response('nope', { status: 500 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.AIRBNB_ICAL_AFRAME;
});

const call = (query) => handler(new Request(`https://edgewood.example/api/availability${query}`));

test('serves date ranges for a connected stay', async () => {
  const res = await call('?stay=aframe');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Cache-Control'), /max-age=300/);
  const body = await res.json();
  assert.equal(body.stay, 'aframe');
  assert.equal(body.ranges.length, 1);
  assert.deepEqual(Object.keys(body.ranges[0]), ['start', 'end']);
  assert.doesNotMatch(JSON.stringify(body), /Phone|Reserved/);
  assert.deepEqual(requested, [FEED_URL]);
});

test('404s for stays without a feed, without fetching anything', async () => {
  for (const query of ['?stay=airstream', '?stay=__proto__', '?stay=', '']) {
    const res = await call(query);
    assert.equal(res.status, 404, query);
  }
  assert.deepEqual(requested, []);
});

test('502s when the feed is down', async () => {
  process.env.AIRBNB_ICAL_AFRAME = 'https://calendar.example/broken.ics';
  const original = console.error;
  console.error = () => {};
  try {
    const res = await call('?stay=aframe');
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  } finally {
    console.error = original;
  }
});

test('is routed at /api/availability', () => {
  assert.equal(config.path, '/api/availability');
});
