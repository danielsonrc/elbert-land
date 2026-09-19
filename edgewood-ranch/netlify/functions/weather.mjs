// GET /api/weather → { kind, description, tempF, observed, station }
// The latest National Weather Service observation near the ranch: Meadow Lake Airport in Peyton,
// falling back to Colorado Springs. The site uses it to draw the sky as it is right now.
import { skyFrom } from '../lib/weather.mjs';

const STATIONS = ['KFLY', 'KCOS'];
const STALE_MS = 3 * 60 * 60 * 1000;
// api.weather.gov asks every caller to identify itself
const HEADERS = { 'User-Agent': 'EdgewoodRanch/1.0 (edgewoodranchglamping.netlify.app)', Accept: 'application/geo+json' };

const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });

export default async () => {
  for (const station of STATIONS) {
    try {
      const res = await fetch(`https://api.weather.gov/stations/${station}/observations/latest`, {
        headers: HEADERS, signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const { properties } = await res.json();
      if (!properties || Date.now() - Date.parse(properties.timestamp) > STALE_MS) continue;
      return json({ ...skyFrom(properties), station }, 200, {
        'Cache-Control': 'public, max-age=600',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      });
    } catch {
      // try the next station
    }
  }
  return json({ error: 'No recent weather observation near the ranch.' }, 502);
};

export const config = { path: '/api/weather' };
