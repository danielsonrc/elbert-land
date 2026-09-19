// ---------------------------------------------------------------------------
// Site content & configuration: everything guests read lives here.
// Facts and photos come from the A-Frame's Airbnb listing; the Airstream uses
// its renovation renders. Anything marked TODO is still a placeholder.
// ---------------------------------------------------------------------------

export const RANCH = {
  name: 'Edgewood Ranch',
  location: 'Peyton, Colorado',
  tagline: 'A glass A-frame and a vintage Airstream on ten acres of Colorado pines.',
  hosts: 'Daniel & Riley',
  email: 'hello@edgewoodranchglamping.com', // shows the Contact link; privacy.html and terms.html list the same address
  checkIn: '3:00 PM',
  checkOut: '11:00 AM',
  // Online, waitlist sign-ups go to Netlify Forms. On localhost they're kept in the browser.
  forms: 'netlify',
  // Only used by stays that take direct booking requests (none do right now):
  // those requests are kept in the browser until a booking backend exists.
  demoMode: true,
  taxRate: 0.09,
};

const aframePhoto = (file, caption, alt) => ({ src: `images/aframe/${file}.webp`, caption, alt });

// status 'coming-soon' shows a waitlist. booking 'airbnb' shows live availability
// from the listing's calendar and hands off to Airbnb to book.
export const STAYS = {
  aframe: {
    id: 'aframe',
    site: '01',
    name: 'The A-Frame',
    status: 'open',
    booking: 'airbnb',
    blurb:
      'A tiny glass A-frame at the north end of the property, tucked into the ponderosas. ' +
      'Watch the forest and the stars through floor-to-peak windows, soak in the hot tub under the pines, ' +
      'and end the night with a movie on the projector. Deer and wild turkeys wander through.',
    sleeps: 4,
    facts: [
      ['bed', 'Loft double bed + sofa bed'],
      ['bath', 'Bath house 150 ft away'],
      ['tub', 'Hot tub under the pines'],
      ['fire', 'Fire table & grill'],
    ],
    amenities: [
      'Starlink Wi-Fi', 'Projector movie nights', 'Air conditioning', 'Workspace',
      'Coffee station', 'Telescope', 'Outdoor games', 'Pets welcome', 'Park at the cabin',
    ],
    rating: { score: 4.91, reviews: 74, note: 'Guest favorite' }, // TODO: refresh now and then
    airbnb: 'https://www.airbnb.com/rooms/946347867664984251',
    photos: [
      aframePhoto('front', 'The A-frame and its deck',
        'The glass-front A-frame on its raised wooden deck among ponderosa pines, doors open to the loft ladder'),
      aframePhoto('night', 'Lit up under the stars',
        'The A-frame glowing warm at night under a starry sky, with a line of pines behind it'),
      aframePhoto('projector', 'Movie night on the projector',
        'Inside the A-frame: a picture projected on the wall, the loft ladder and the sofa, glass doors beyond'),
      aframePhoto('living', 'The living area',
        'Plywood-lined interior with the sofa bed, a small desk and the loft overhead'),
      aframePhoto('loft', 'The loft bed',
        'A double bed with white pillows in the loft, under the peak and a small window'),
      aframePhoto('coffee', 'Coffee station',
        'A coffee maker, stoneware mugs and jars of coffee pods on a wooden shelf'),
      aframePhoto('deck', 'The side deck and grill',
        'Two sling chairs and a round glass table on the side deck, with the gas grill at the far end'),
      aframePhoto('fire-table', 'The fire table after dark',
        'The square gas fire table burning on the deck at dusk, with the meadow and pines beyond'),
      aframePhoto('hot-tub', 'Hot tub under the pines',
        'The round hot tub on the ground beside the deck, with pines behind the A-frame'),
      aframePhoto('aurora', 'Northern lights over the A-frame',
        'A pink aurora over the dark forest, with the A-frame glowing small below'),
      aframePhoto('bath-house', 'The bath house, 150 ft away',
        'The small plank-sided bath house with a dark wooden door and a concrete step'),
      aframePhoto('bathroom', 'Inside the bath house',
        'A tiled bathroom with a toilet, a pedestal sink and a shower with a clear curtain'),
    ],
    rates: null, // Airbnb shows the live nightly price and total
    minNights: 1,
  },
  airstream: {
    id: 'airstream',
    site: '02',
    name: 'The Airstream',
    status: 'coming-soon',
    blurb:
      'A 1959 Airstream Land Yacht, fully remodeled with fluted oak, brass and a blush-pink retro fridge. ' +
      'It gets its own deck under a shade sail, a hot tub, and an outdoor movie screen for nights under the pines.',
    sleeps: 2,
    facts: [
      ['bed', 'Full-size bed'],
      ['bath', 'Bathroom & shower on board'],
      ['tub', 'Private hot tub'],
      ['film', 'Outdoor movie screen'],
    ],
    amenities: [
      'Kitchenette', 'Induction cooktop', 'Retro fridge', 'Air conditioning',
      'Shade-sail deck', 'Lounge chairs', 'String lights', 'Projector',
    ],
    waitlist:
      'We\u2019re installing and renovating the Airstream now. Join the list and we\u2019ll email you as soon as it opens for booking.',
    photos: [
      {
        src: 'images/airstream-exterior.webp',
        alt: 'Rendering of the polished Airstream with a shade sail, deck, hot tub and outdoor movie screen under ponderosa pines',
        caption: 'The deck, hot tub and movie screen',
        tag: 'Rendering',
      },
      {
        src: 'images/airstream-interior.webp',
        alt: 'Rendering of the Airstream interior with fluted oak cabinets, a pink retro fridge, a galley kitchen and the bed at the back',
        caption: 'The oak galley and bedroom',
        tag: 'Rendering',
      },
    ],
    rates: null,
    minNights: 1,
  },
};

// Site numbers (and the 1 / 2 keys) follow STAY_ORDER; the cards follow the
// meadow from left to right.
export const STAY_ORDER = ['aframe', 'airstream'];
export const CARD_ORDER = ['airstream', 'aframe'];

// ---------------------------------------------------------------------------
// Time-of-day palettes (sRGB hex). The default camera faces north (-z), out
// over the meadow. `el` / `az` place the sun (or moon) in degrees: az 0 = due
// north, -90 = west, +90 = east, 180 = south (behind the default camera). The sun
// keeps to the real sky: up in the east-south-east, afternoon in the south-west,
// down in the west-north-west.
// `night` (0..1) drives window glow, string lights, fire tables and stars.
// ---------------------------------------------------------------------------

export const PALETTES = {
  dawn: {
    label: 'Dawn',
    skyTop: '#3e4a7a', skyMid: '#b98aa6', horizon: '#f4c7a1', fog: '#e8b9a2',
    ridge: '#5b4a6e',
    sun: '#ffe2c2', sunI: 2.4, el: 7, az: 115, disc: 0.0,
    hemiSky: '#c2afd6', hemiGround: '#6b4f4a', hemiI: 1.9,
    stars: 0.12, night: 0.3,
  },
  day: {
    label: 'Day',
    skyTop: '#3a73b3', skyMid: '#8fbfd9', horizon: '#dfe8dc', fog: '#cfdcd0',
    ridge: '#4d6c78',
    sun: '#fff5e3', sunI: 3.4, el: 52, az: -120, disc: 0.0,
    hemiSky: '#d3e6f2', hemiGround: '#7a6a4a', hemiI: 2.0,
    stars: 0, night: 0,
  },
  golden: {
    label: 'Golden hour',
    skyTop: '#4b2f63', skyMid: '#e0674a', horizon: '#fbb66a', fog: '#f0a266',
    ridge: '#6b2e3e',
    sun: '#ffb877', sunI: 3.8, el: 12, az: -40, disc: 1.0,
    hemiSky: '#c9a0c0', hemiGround: '#4a3040', hemiI: 1.9,
    stars: 0, night: 0.4,
  },
  night: {
    label: 'Night',
    skyTop: '#070b24', skyMid: '#1b2552', horizon: '#34497a', fog: '#26365e',
    ridge: '#11173a',
    sun: '#c9d4ff', sunI: 0.9, el: 16, az: -28, disc: 0.8,
    hemiSky: '#3e4f8c', hemiGround: '#171728', hemiI: 1.1,
    stars: 1, night: 1,
  },
};

export const PALETTE_ORDER = ['dawn', 'day', 'golden', 'night'];
