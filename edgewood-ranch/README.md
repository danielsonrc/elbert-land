# Edgewood Ranch — booking site

A booking site for the ranch's two stays near Peyton, Colorado: **the A-Frame** (booked
through Airbnb) and **the Airstream** (a 1959 Land Yacht being renovated). Guests arrive
up the ranch's drive into a low-poly 3D meadow styled after Firewatch posters (layered
ridgelines, tinted fog, banded sunset sky), then pick a stay by clicking it in the world, on a
map marker, or on a trail-note card.

The meadow keeps the real arrangement of the property, squeezed together (see the notes at the
end): the view looks north, the Airstream sits on the left, the A-Frame at the north end on the
right, and the bath house between them, behind a small stand of pines and firs that screens
each stay from the other. The drive comes in off the county road at the south-west corner,
passes the old green Chevy stake-bed parked on the right, and loops round the
meadow: one branch north past the Airstream and on to the A-Frame, the other straight across to
it. A post-and-rail fence runs along the north line. The arrival plays that drive: up the county
road, a right turn in under the ranch's name (the page's own lettering, hung over the drive with
CSS 3D transforms, stacked on narrow screens and lit after dark), past the truck, and up for the
view.

- **The A-Frame** (set back on the right, against the trees) is the real cabin blended into the
  Firewatch palette: glass gable with painted reflections, weathered teal roof, cedar trim, and
  a cable-rail deck. The grill, a little table and two chairs sit on the right side, the fire
  table in the front-right corner and a telescope in the front-left one. The round hot tub
  sits off the deck under the pines. Its panel shows the listing photos and **live availability
  from the Airbnb calendar**, then hands off to Airbnb with the chosen dates and party size
  filled in. Airbnb shows the price and handles payment and protection.
- **The bath house** between the stays matches the real one: plank siding, front gable, dark
  six-panel door, lantern and concrete step.
- **The Airstream** (front left) follows the layout of the renovation render: a polished shell
  that reflects the scene, a cedar deck along the door side with movie loungers under a shade
  sail, the screen wall and an inflatable hot tub like the A-Frame's at the hitch end, and a grill
  and a gas fire pit with Adirondack chairs at the tail end. It's marked **coming soon**, so its
  panel shows the renders and a waitlist form instead of a calendar.
- **The sky is live.** By default the sun sits where it really is over Peyton right now, and the
  weather follows the latest National Weather Service observation from Meadow Lake Airport next
  door: clear, cloudy, rain, thunderstorms, snow or fog. Visitors can pick a time of day, and
  the **+** beside the times opens the weather choices. With weather on Live, picking dates on
  the A-Frame's calendar shows a typical day for that month, which here means dry and mostly
  sunny, with snow lying under blue skies in winter. Stay on the dates a while (about 45 seconds)
  and the season's weather may roll in: an afternoon thunderstorm in July or August (only when
  the sky shows afternoon or evening), a May shower, or snow from November to April. Clearing
  the dates brings back the live sky. The months are set in `js/sky.js`.
- **Wildlife:** mule deer, wild turkeys and cottontails graze the meadow. Like the real ones
  they're shy: fly or zoom close and they freeze, then bolt (the deer bound, the rabbits jink), and
  drift back once the camera moves on. Small flocks of birds cross the sky by day.
- **Holidays** follow the dates a guest would be staying (today in Colorado, or the stay picked
  in the calendar), with a hello the first time each shows:

  | Holiday | Dates | What appears |
  | --- | --- | --- |
  | Fall | Sep 22 – Nov 30 | Pumpkins (no faces) at the steps and the bath house, and a hay bale and pumpkins in the old truck's bed |
  | Christmas | Dec 1 – Jan 6 | Coloured lights outlining the A-Frame and wound round the pine by its tub, on the Airstream and its sail posts, the bath house and the rails of the truck's bed; wreaths on the doors and the truck's grille |
  | New Year's | Dec 31 – Jan 1 | Fireworks far off over the ridges after dark |
  | Fourth of July | Jul 1 – 7 | A bald eagle circling over the meadow by day; red, white and blue fireworks after dark |

  The windows live in `js/holidays.js`.

## Run it locally

ES modules and the import map need a web server, so opening `index.html` from disk won't work.

```bash
npx serve edgewood-ranch
```

This skips the server functions, so the A-Frame panel says live availability didn't load and the
live weather stays clear (everything else works). To run it with the functions, use the Netlify
CLI from this folder with the calendar link in a `.env` file (git-ignored): `npx netlify-cli dev`.

Tests: `node --test "edgewood-ranch/netlify/lib/*.test.mjs" "edgewood-ranch/tests/*.test.mjs"`

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
6. **Add your domain** under Domain management (HTTPS is automatic). Then point `og:url` and
   `og:image` in `index.html` at it; they use the netlify.app address until then, and link
   previews need the full URL.
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
| `netlify/functions/weather.mjs` | `/api/weather`: the latest weather observation near the ranch (Meadow Lake Airport, then Colorado Springs), boiled down by `netlify/lib/weather.mjs` to one of the skies the scene can draw. |
| `netlify.toml` | Netlify settings: functions folder, caching, and keeping the function sources private. |
| `js/scene.js` | Renderer, lighting, time-of-day blending, reflections for the Airstream, camera moves, the arrival up the drive with the entrance sign, and click/hover picking. |
| `js/sky.js` | The live sky: the sun's height over Peyton, the palettes that match it, the ranch clock, and the weather usual for each month. Tested in `tests/`. |
| `js/weather.js` | Clouds, rain, lightning, snow that settles on the ground, decks and trees, and fog, all easing in. |
| `js/wildlife.js` | The deer, turkeys and rabbits and how they wander and spook, the bird flocks, and the Fourth of July eagle. |
| `js/holidays.js` | Which holidays fall on a date or a stay, and their greetings. Tested in `tests/`. |
| `js/sheet.js` | On phones, the booking panel as a bottom sheet you can pull up, down or away. |
| `js/models.js` | The A-Frame and everything on its deck. |
| `js/airstream.js` | The Airstream and its site. |
| `js/props.js` | The old stake-bed truck, the post-and-rail fence, site posts, bath house, selection rings. |
| `js/world.js` | Noise, the layout of the land, terrain, sky dome and ridgelines. |
| `js/nature.js` | Instanced forest and aspens, rocks, stars, fireflies, clouds, the lookout tower, the northern lights and the holiday fireworks. |
| `js/kit.js` | Shared building blocks: materials, string lights (warm or coloured), flames, lanterns, planters, chairs, pumpkins, wreaths, and the hot tub and grill both stays use. |
| `js/main.js` | Wires the HUD, the sky controls, cards, markers, keyboard shortcuts and deep links to the world. |
| `images/aframe/` | The listing photos (WebP), shown in the A-Frame panel. |
| `images/` | The Airstream renders and `share-card.jpg` for link previews. |

## Details

- The 3D ranch is an impression, not a map. It follows the real layout (traced from a satellite
  view: entrance, drive, fork, stays, bath house and fence line, all in `js/world.js`), but the
  distances are squeezed and the drive is only roughly drawn. So the compass reads true but is
  captioned "Not to scale", and the booking panel tells guests that directions and check-in
  details come through Airbnb once they book. The owners' house beside the drive is left out on
  purpose.
- The sun keeps to the real sky over the north-facing view: it comes up in the east-south-east,
  sits in the south-west in the afternoon and sets in the west-north-west.
- Deep links: `#aframe` and `#airstream` open a stay directly.
- Keyboard: `1` / `2` pick a stay, `Esc` returns to the meadow or skips the intro; arrow keys page through the enlarged photos.
- The availability function is cached for about 15 minutes, so a new Airbnb booking can take that long to show.
- The weather function is cached the same way, and the page checks it again every 15 minutes. The
  National Weather Service data is free to use, needs no key, and is fine for a commercial site.
  If it's unreachable the live sky just stays clear.
- Each visit starts on Live; a picked time or weather isn't remembered.
- Easter egg: type `aurora`, or click the telescope on the A-Frame's deck, for the northern lights
  as they really show from Colorado (the listing has a photo of them over the A-Frame). It turns
  the sky to a clear night; do it again to put them away.
- Airbnb's minimum-stay and advance-notice rules aren't in the calendar export; Airbnb applies them when guests book.
- The intro plays once per browser session. Any click, drag or scroll skips it.
- If WebGL is unavailable, the page falls back to an illustrated poster and booking still works.
- Motion is reduced when the visitor asks for it (`prefers-reduced-motion`).
- If the GPU can't hold about 36 fps, the render resolution steps down automatically.
- `?debug` exposes the scene as `window.ranch` for tuning camera poses, including
  `ranch.debug.advance(seconds)`, which steps the animation in background tabs.
- Three.js (0.170) loads from jsDelivr and fonts load from Google Fonts, so the site needs a network connection.
