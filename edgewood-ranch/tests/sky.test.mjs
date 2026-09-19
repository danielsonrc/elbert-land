// Run with: node --test "edgewood-ranch/tests/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { sunAt, liveMix, ranchClock, ranchHour, typicalWeather, monthName } from '../js/sky.js';

// Peyton, Colorado: the summer solstice sun peaks near 74°, the winter one near 27.5°.
test('sun height at solar noon matches the season', () => {
  const summer = sunAt(new Date('2026-06-21T19:05:00Z')); // about 1:05 PM MDT
  const winter = sunAt(new Date('2026-12-21T19:00:00Z')); // about 12:00 PM MST
  assert.ok(Math.abs(summer.el - 74.4) < 1.5, `summer ${summer.el}`);
  assert.ok(Math.abs(winter.el - 27.5) < 1.5, `winter ${winter.el}`);
});

test('morning and evening are told apart', () => {
  assert.equal(sunAt(new Date('2026-09-18T14:00:00Z')).rising, true); // 8 AM MDT
  assert.equal(sunAt(new Date('2026-09-18T23:00:00Z')).rising, false); // 5 PM MDT
});

test('the live sky moves night → dawn → day → golden hour → night', () => {
  const at = (iso) => liveMix(new Date(iso));
  assert.deepEqual(at('2026-09-18T08:00:00Z'), { from: 'night', to: 'night', t: 0 }); // 2 AM
  assert.equal(at('2026-09-18T12:40:00Z').to, 'dawn'); // shortly before sunrise
  assert.equal(at('2026-09-18T18:00:00Z').from, 'day'); // noon
  assert.equal(at('2026-09-19T00:45:00Z').from, 'golden'); // just before sunset
  assert.equal(at('2026-09-19T03:00:00Z').from, 'night'); // 9 PM
});

test('clock reads in ranch time', () => {
  assert.equal(ranchClock(new Date('2026-09-18T00:30:00Z')), '6:30 PM');
  assert.equal(ranchClock(new Date('2026-12-18T00:30:00Z')), '5:30 PM');
});

test('a typical day is dry; storms and snowfall only roll in if you linger', () => {
  assert.deepEqual(typicalWeather('2026-12-24'), { usual: 'winter', linger: 'snow' });
  assert.deepEqual(typicalWeather('2027-07-04'), { usual: 'partly', linger: 'storm', afternoon: true });
  assert.deepEqual(typicalWeather('2027-05-20'), { usual: 'partly', linger: 'rain', afternoon: true });
  assert.deepEqual(typicalWeather('2026-10-02'), { usual: 'clear' });
  for (let m = 1; m <= 12; m++) {
    const { usual } = typicalWeather(`2027-${String(m).padStart(2, '0')}-15`);
    assert.ok(!['rain', 'storm', 'snow'].includes(usual), `month ${m} is wet by default`);
  }
  assert.equal(monthName('2026-12-24'), 'December');
});

test('the ranch hour is Colorado time', () => {
  assert.equal(ranchHour(new Date('2026-07-04T21:00:00Z')), 15); // 3 PM MDT
  assert.equal(ranchHour(new Date('2026-12-24T06:30:00Z')), 23); // 11:30 PM MST
});
