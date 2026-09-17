// GET /api/availability?stay=aframe
// Returns the stay's unavailable date ranges, read from its Airbnb calendar export.
// Only dates leave this function: the feed's event details never reach the browser.
//
// Set the export link (Airbnb > Listings > Availability > Connect calendars >
// Export calendar) in Netlify > Site configuration > Environment variables:
//   AIRBNB_ICAL_AFRAME = https://www.airbnb.com/calendar/ical/...
import { bookedRanges } from '../lib/ical.mjs';

const FEEDS = {
  aframe: 'AIRBNB_ICAL_AFRAME',
  airstream: 'AIRBNB_ICAL_AIRSTREAM',
};

const json = (body, status, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});

export default async (req) => {
  const stay = new URL(req.url).searchParams.get('stay');
  const feed = Object.hasOwn(FEEDS, stay) ? process.env[FEEDS[stay]] : undefined;
  if (!feed) return json({ error: 'No calendar is connected for this stay.' }, 404);

  try {
    const res = await fetch(feed, { headers: { 'User-Agent': 'EdgewoodRanchSite/1.0' } });
    if (!res.ok) throw new Error(`calendar feed returned ${res.status}`);
    const ranges = bookedRanges(await res.text());
    return json({ stay, ranges, updated: new Date().toISOString() }, 200, {
      // browsers keep it 5 minutes; Netlify's CDN refreshes it every 15
      'Cache-Control': 'public, max-age=300',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
    });
  } catch (err) {
    console.error(`availability for ${stay}:`, err);
    return json({ error: 'The calendar could not be loaded.' }, 502);
  }
};

export const config = { path: '/api/availability' };
