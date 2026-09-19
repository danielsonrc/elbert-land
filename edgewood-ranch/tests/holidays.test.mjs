// Run with: node --test "edgewood-ranch/tests/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { holidaysBetween, ranchToday } from '../js/holidays.js';

test('single days', () => {
  assert.deepEqual(holidaysBetween('2026-07-04'), { july4: true });
  assert.deepEqual(holidaysBetween('2026-12-25'), { christmas: true });
  assert.deepEqual(holidaysBetween('2026-10-15'), { fall: true });
  assert.deepEqual(holidaysBetween('2026-08-15'), {});
});

test('windows that cross the new year', () => {
  assert.deepEqual(holidaysBetween('2026-12-31'), { christmas: true, newyear: true });
  assert.deepEqual(holidaysBetween('2027-01-01'), { christmas: true, newyear: true });
  assert.deepEqual(holidaysBetween('2027-01-06'), { christmas: true });
  assert.deepEqual(holidaysBetween('2027-01-07'), {});
});

test('a stay counts every night up to, not including, check-out', () => {
  assert.deepEqual(holidaysBetween('2026-06-29', '2026-07-02'), { july4: true }); // the night of the 1st
  assert.deepEqual(holidaysBetween('2026-06-28', '2026-07-01'), {}); // leaves the morning of the 1st
  assert.deepEqual(holidaysBetween('2026-12-29', '2027-01-02'), { christmas: true, newyear: true });
});

test('today is the date in Colorado', () => {
  assert.equal(ranchToday(new Date('2026-09-19T05:30:00Z')), '2026-09-18'); // 11:30 PM MDT
  assert.equal(ranchToday(new Date('2026-09-19T07:30:00Z')), '2026-09-19');
});
