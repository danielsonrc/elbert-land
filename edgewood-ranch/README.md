# Edgewood Ranch — booking site

A booking site for the ranch's two stays near Peyton, Colorado: **the A-Frame** (booked
through Airbnb) and **the Airstream** (a 1959 Land Yacht being renovated). Guests arrive
through the ranch gate in a low-poly 3D meadow styled after Firewatch posters (layered
ridgelines, tinted fog, banded sunset sky), then pick a stay by clicking it in the world, on a
map marker, or on a trail-note card.

- **The A-Frame** (set back on the right, against the trees) is the real cabin blended into the
  Firewatch palette: glass gable with painted reflections, weathered teal roof, cedar trim, and
  a cable-rail deck. The grill, a little table and two chairs sit on the right side, the fire
  table in the front-right corner and a telescope in the front-left one. The round hot tub
  sits off the deck under the pines. Its panel shows the listing photos and **live availability
  from the Airbnb calendar**, then hands off to Airbnb with the chosen dates and party size
  filled in. Airbnb shows the price and handles payment and protection.
- **The bath house** between the stays matches the real one: plank siding, front gable, dark
  six-panel door, lantern and concrete step.
- **The Airstream** (front left) keeps the layout of the renovation renders (polished shell
  that reflects the scene, shade sail, deck, hot tub, outdoor cinema) but is dressed warmer: cedar
  deck and soaking tub, wooden loungers, terracotta planters. It's marked **coming soon**, so its
  panel shows the renders and a waitlist form instead of a calendar.

## Run it locally

ES modules and the import map need a web server, so opening `index.html` from disk won't work.

```bash
npx serve edgewood-ranch
```

This skips the calendar function, so the A-Frame panel says live availability didn't load
(everything else works). To run it with the function, use the Netlify CLI from this folder with
the calendar link in a `.env` file (git-ignored): `npx netlify-cli dev`.

Tests for the calendar function: `node --test "edgewood-ranch/netlify/lib/*.test.mjs"`

## Going live on Netlify

1. **Copy the Airbnb calendar link.** In Airbnb's host calendar, open the A-Frame's
   availability settings, find calendar sync (sometimes "Connect calendars"), and choose
   **Export calendar**. The link ends in `.ics`. Keep it private: it only ever lives on the server.
2. **Put the site on GitHub**, either in this repo or as its own repository.
3. **Create the Netlify site:** Add new site → Import an existing project → pick the repo.
   If the site stays inside this repo, set **Base directory** to `edgewood-ranch`. There is no
   build command; `netlify.toml` covers the rest.
4. **Connect the calendar:** Site configuration → Environment variables → add
   `AIRBNB_ICAL_AFRAME` with the link from step 1, then redeploy. Opening
   `https://<your-site>/api/availability?stay=aframe` should show date ranges.
5. **Turn on the waitlist:** in the Forms section, enable form detection and redeploy, then add
   an email notification so Airstream sign-ups reach you. Submit the form once to check.
6. **Add your domain** under Domain management (HTTPS is automatic). Then change `og:image` in
   `index.html` to the full URL so link previews show the picture everywhere.
7. **Fill in `js/data.js`:** the contact email (the Contact link stays hidden until it's set)
   and the A-Frame's rating, which is copied by hand from Airbnb.

Airbnb doesn't allow outside links in listings, so share the site on social media, a Google
Business Profile, cards or a QR code instead.

**When the Airstream opens on Airbnb:** in `js/data.js`, change its `status` to `'open'`, add
`booking: 'airbnb'` and its `airbnb` link, and set `AIRBNB_ICAL_AIRSTREAM` in Netlify.

## What's where

| File | What it does |
| --- | --- |
| `js/data.js` | **All guest-facing content:** location, stays, facts, amenities, rating, Airbnb links, photos, and the time-of-day palettes. Start here. |
| `js/booking.js` | Panel: photo gallery and lightbox, availability calendar, the Airbnb hand-off, waitlist sign-ups, and a direct request form (unused, demo only) with pricing and an `.ics` file. |
| `netlify/functions/availability.mjs` | `/api/availability`: reads a stay's Airbnb calendar export and returns only the booked date ranges. |
| `netlify/lib/ical.mjs` | The calendar-feed parser, with tests beside it. |
| `netlify.toml` | Netlify settings: functions folder, caching, and keeping the function sources private. |
| `js/scene.js` | Renderer, lighting, time-of-day blending, reflections for the Airstream, camera moves, the arrival fly-through, and click/hover picking. |
| `js/models.js` | The A-Frame and everything on its deck. |
| `js/airstream.js` | The Airstream and its site. |
| `js/props.js` | Ranch gate, site posts, bath house, selection rings. |
| `js/world.js` | Noise, the layout of the land, terrain, sky dome and ridgelines. |
| `js/nature.js` | Instanced forest and aspens, rocks, stars, fireflies, clouds and the lookout tower. |
| `js/kit.js` | Shared building blocks: materials, string lights, flames, lanterns, planters, chairs. |
| `js/main.js` | Wires the HUD, cards, markers, keyboard shortcuts and deep links to the world. |
| `images/aframe/` | The listing photos (WebP), shown in the A-Frame panel. |
| `images/` | The Airstream renders and `share-card.jpg` for link previews. |

## Details

- Deep links: `#aframe` and `#airstream` open a stay directly.
- Keyboard: `1` / `2` pick a stay, `Esc` returns to the meadow or skips the intro; arrow keys page through the enlarged photos.
- The availability function is cached for about 15 minutes, so a new Airbnb booking can take that long to show.
- Airbnb's minimum-stay and advance-notice rules aren't in the calendar export; Airbnb applies them when guests book.
- The intro plays once per browser session. Any click, drag or scroll skips it.
- If WebGL is unavailable, the page falls back to an illustrated poster and booking still works.
- Motion is reduced when the visitor asks for it (`prefers-reduced-motion`).
- If the GPU can't hold about 36 fps, the render resolution steps down automatically.
- `?debug` exposes the scene as `window.ranch` for tuning camera poses, including
  `ranch.debug.advance(seconds)`, which steps the animation in background tabs.
- Three.js (0.170) loads from jsDelivr and fonts load from Google Fonts, so the site needs a network connection.
