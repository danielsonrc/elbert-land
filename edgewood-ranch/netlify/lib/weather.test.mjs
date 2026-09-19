// Run with: node --test "edgewood-ranch/netlify/lib/*.test.mjs"
import test from 'node:test';
import assert from 'node:assert/strict';
import { skyFrom } from './weather.mjs';

const obs = (props) => ({ textDescription: '', presentWeather: [], cloudLayers: [], ...props });

test('clear, partly and cloudy skies come from the cloud layers', () => {
  assert.equal(skyFrom(obs({ textDescription: 'Clear', cloudLayers: [{ amount: 'CLR' }] })).kind, 'clear');
  assert.equal(skyFrom(obs({ textDescription: 'Partly Cloudy', cloudLayers: [{ amount: 'SCT' }] })).kind, 'partly');
  assert.equal(skyFrom(obs({ textDescription: 'Mostly Cloudy', cloudLayers: [{ amount: 'FEW' }, { amount: 'BKN' }] })).kind, 'cloudy');
  assert.equal(skyFrom(obs({ textDescription: 'Overcast', cloudLayers: [{ amount: 'OVC' }] })).kind, 'cloudy');
});

test('precipitation wins over cloud cover', () => {
  const snow = obs({ textDescription: 'Light Snow', presentWeather: [{ intensity: 'light', weather: 'snow' }], cloudLayers: [{ amount: 'OVC' }] });
  const rain = obs({ textDescription: 'Rain', presentWeather: [{ weather: 'rain' }], cloudLayers: [{ amount: 'BKN' }] });
  const storm = obs({ textDescription: 'Thunderstorms and Rain', presentWeather: [{ weather: 'thunderstorms' }, { weather: 'rain' }] });
  assert.equal(skyFrom(snow).kind, 'snow');
  assert.equal(skyFrom(rain).kind, 'rain');
  assert.equal(skyFrom(storm).kind, 'storm');
  assert.equal(skyFrom(obs({ textDescription: 'Freezing Drizzle' })).kind, 'snow');
  assert.equal(skyFrom(obs({ textDescription: 'Fog/Mist' })).kind, 'fog');
});

test('temperature comes back in Fahrenheit, and gaps stay empty', () => {
  const out = skyFrom(obs({ textDescription: 'Clear', temperature: { value: 10 }, timestamp: '2026-09-18T12:00:00+00:00' }));
  assert.equal(out.tempF, 50);
  assert.equal(out.observed, '2026-09-18T12:00:00+00:00');
  assert.equal(skyFrom(obs({ temperature: { value: null } })).tempF, null);
});
