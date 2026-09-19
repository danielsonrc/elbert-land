// Weather over the ranch: cloud cover, rain, thunderstorms, snow that settles on the ground and
// the trees, and fog. Everything eases toward the chosen sky, so a change of season rolls in
// over several seconds instead of snapping.
import * as THREE from 'three';
import { glowTexture, SNOW } from './kit.js';

const PRESETS = {
  clear: { cloud: 0.04, rain: 0, snow: 0, fog: 0, storm: 0 },
  partly: { cloud: 0.4, rain: 0, snow: 0, fog: 0.05, storm: 0 },
  cloudy: { cloud: 0.82, rain: 0, snow: 0, fog: 0.18, storm: 0 },
  rain: { cloud: 0.92, rain: 0.8, snow: 0, fog: 0.3, storm: 0 },
  storm: { cloud: 1, rain: 1, snow: 0, fog: 0.28, storm: 1 },
  snow: { cloud: 0.85, rain: 0, snow: 0.85, fog: 0.36, storm: 0 },
  fog: { cloud: 0.6, rain: 0, snow: 0, fog: 0.85, storm: 0 },
  // a Colorado winter's day: blue sky, snow lying from the last storm
  winter: { cloud: 0.12, rain: 0, snow: 0, fog: 0.05, storm: 0, cover: 0.8 },
};
const KEYS = ['cloud', 'rain', 'snow', 'fog', 'storm'];
const EASE = 2.6; // seconds for most of a change to happen
const BOX = { w: 70, below: 14, above: 26 }; // precipitation fills this box around the camera

/** Keep v within size/2 of c, wrapping around. */
const wrap = (v, c, size) => c + ((((v - c + size / 2) % size) + size) % size) - size / 2;

export function createWeather() {
  const now = { ...PRESETS.clear, cover: 0, flash: 0 };
  let goal = PRESETS.clear;
  let nextFlash = 5, secondFlash = 0;
  const rng = Math.random;
  const group = new THREE.Group();

  // --- snow: soft flakes that drift as they fall ---------------------------------------------
  const SNOW_N = 3200;
  const flakes = new Float32Array(SNOW_N * 3);
  const drift = Float32Array.from({ length: SNOW_N }, () => rng() * Math.PI * 2);
  const fall = Float32Array.from({ length: SNOW_N }, () => 0.8 + rng() * 0.8);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const snowMat = new THREE.PointsMaterial({
    color: '#ffffff', size: 0.16, map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.95,
  });
  const snowPts = new THREE.Points(snowGeo, snowMat);
  snowPts.frustumCulled = false;

  // --- rain: short streaks, slanted by a light wind -------------------------------------------
  const RAIN_N = 2400;
  const drops = new Float32Array(RAIN_N * 3);
  const streaks = new Float32Array(RAIN_N * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(streaks, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#c9d4e0', transparent: true, opacity: 0.42, depthWrite: false });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  group.add(snowPts, rainLines);

  let seeded = false;
  function seed(camera) {
    const { x, y, z } = camera.position;
    for (let i = 0; i < SNOW_N; i++) {
      flakes.set([x + (rng() - 0.5) * BOX.w, y - BOX.below + rng() * (BOX.below + BOX.above), z + (rng() - 0.5) * BOX.w], i * 3);
    }
    for (let i = 0; i < RAIN_N; i++) {
      drops.set([x + (rng() - 0.5) * BOX.w, y - BOX.below + rng() * (BOX.below + BOX.above), z + (rng() - 0.5) * BOX.w], i * 3);
    }
    seeded = true;
  }

  const grey = new THREE.Color(), FLASH = new THREE.Color('#e6ecff');

  return {
    object: group,
    get now() { return now; },

    /** Head for one of the PRESETS; `instant` skips the easing (and settles any snow). */
    set(kind, { instant = false } = {}) {
      goal = PRESETS[kind] ?? PRESETS.clear;
      if (instant) {
        for (const key of KEYS) now[key] = goal[key];
        now.cover = goal.cover ?? (goal.snow > 0.3 ? 0.75 : 0);
        SNOW.value = now.cover;
      }
    },

    /** Advance by dt seconds. Returns true while the sky's look is still changing. */
    tick(dt, t, camera) {
      let changing = false;
      const k = 1 - Math.exp(-dt / EASE);
      for (const key of KEYS) {
        const d = goal[key] - now[key];
        if (Math.abs(d) > 0.002) { now[key] += d * k; changing = true; } else now[key] = goal[key];
      }
      // falling snow settles over half a minute; a preset may say how much already lies; snow
      // melts a little slower than it lands
      const lying = goal.cover ?? (now.snow > 0.25 ? Math.min(1, now.snow * 1.1) : 0);
      const cover = Math.max(lying, now.snow > 0.25 ? Math.min(1, now.snow * 1.1) : 0);
      if (now.cover < cover) now.cover = Math.min(cover, now.cover + dt * (goal.cover ? 0.05 : 0.045 * now.snow));
      else if (now.cover > cover) now.cover = Math.max(cover, now.cover - dt * 0.03);
      SNOW.value = now.cover * now.cover * (3 - 2 * now.cover);

      // lightning: an occasional double flash while a storm is overhead
      if (now.storm > 0.5) {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          now.flash = 1;
          secondFlash = rng() < 0.6 ? 0.14 : 0;
          nextFlash = 5 + rng() * 9;
        }
        if (secondFlash > 0 && (secondFlash -= dt) <= 0) now.flash = 0.8;
      }
      if (now.flash > 0) {
        now.flash = Math.max(0, now.flash - dt * 5);
        changing = true;
      }

      // precipitation around the camera
      if (!seeded) seed(camera);
      const c = camera.position;
      const nSnow = Math.floor(SNOW_N * now.snow), nRain = Math.floor(RAIN_N * now.rain);
      snowPts.visible = nSnow > 0;
      rainLines.visible = nRain > 0;
      if (snowPts.visible) {
        for (let i = 0; i < nSnow; i++) {
          const j = i * 3;
          flakes[j] = wrap(flakes[j] + Math.sin(t * 0.7 + drift[i]) * 0.4 * dt, c.x, BOX.w);
          flakes[j + 1] = wrap(flakes[j + 1] - fall[i] * dt, c.y + (BOX.above - BOX.below) / 2, BOX.below + BOX.above);
          flakes[j + 2] = wrap(flakes[j + 2] + Math.cos(t * 0.5 + drift[i]) * 0.4 * dt, c.z, BOX.w);
        }
        snowGeo.setDrawRange(0, nSnow);
        snowGeo.attributes.position.needsUpdate = true;
      }
      if (rainLines.visible) {
        for (let i = 0; i < nRain; i++) {
          const j = i * 3, s = i * 6;
          drops[j] = wrap(drops[j] + 2.2 * dt, c.x, BOX.w);
          drops[j + 1] = wrap(drops[j + 1] - 15 * dt, c.y + (BOX.above - BOX.below) / 2, BOX.below + BOX.above);
          drops[j + 2] = wrap(drops[j + 2], c.z, BOX.w);
          streaks[s] = drops[j]; streaks[s + 1] = drops[j + 1]; streaks[s + 2] = drops[j + 2];
          streaks[s + 3] = drops[j] - 0.08; streaks[s + 4] = drops[j + 1] + 0.55; streaks[s + 5] = drops[j + 2];
        }
        rainGeo.setDrawRange(0, nRain * 2);
        rainGeo.attributes.position.needsUpdate = true;
      }
      return changing;
    },

    /**
     * Write into `out` the time-of-day state `base` as this weather would show it: greyer skies,
     * a dimmer sun, lightning. Adds cloud/rain/snow/fog/cover to its numbers for the scene parts.
     */
    shade(base, out) {
      for (const key of Object.keys(base.colors)) out.colors[key].copy(base.colors[key]);
      Object.assign(out.nums, base.nums);
      out.dir.copy(base.dir);
      const o = now.cloud;
      for (const key of ['skyTop', 'skyMid', 'horizon', 'fog', 'hemiSky', 'ridge']) {
        const col = out.colors[key];
        const l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
        grey.setRGB(l, l * 1.01, l * 1.05).multiplyScalar(1 - 0.35 * now.storm);
        col.lerp(grey, o * 0.75);
      }
      const haze = Math.max(now.fog * 0.6, now.snow * 0.35);
      out.colors.horizon.lerp(out.colors.fog, haze);
      out.colors.skyMid.lerp(out.colors.fog, haze * 0.7);
      out.nums.sunI *= 1 - 0.82 * o;
      out.nums.disc *= Math.max(0, 1 - o * 1.4);
      out.nums.hemiI *= 1 + 0.12 * o - 0.3 * now.storm;
      out.nums.stars *= Math.max(0, 1 - o * 1.3);
      if (now.flash > 0) {
        out.nums.hemiI += now.flash * 2.5;
        for (const key of ['skyTop', 'skyMid', 'horizon']) out.colors[key].lerp(FLASH, now.flash * 0.55);
      }
      Object.assign(out.nums, { cloud: o, rain: now.rain, snow: now.snow, fog: now.fog, cover: now.cover });
      // flakes and streaks pick up the light of the moment instead of glowing in the dark
      snowMat.color.copy(out.colors.hemiSky).lerp(grey.set('#ffffff'), 0.55);
      rainMat.color.copy(out.colors.fog).lerp(grey.set('#ffffff'), 0.4);
      return out;
    },

    /** Pull the fog in with rain, snow and fog. */
    fog(sceneFog) {
      sceneFog.near = 12 - 9 * now.fog;
      sceneFog.far = 520 - 450 * now.fog ** 0.8;
    },
  };
}
