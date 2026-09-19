// Forest, rocks, sky dressing and the distant lookout tower.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SITES, BATH, PRIVACY_STAND, LOOKOUT, ENTRANCE, TRUCK, GROVES, inViewCorridor, heightAt, meadowRadius,
  trailDistance, roadDistance, fenceDistance, fbm, mulberry32, smoothstep,
} from './world.js';
import { flatMat, beam, glowTexture, snowy } from './kit.js';

const UP = new THREE.Vector3(0, 1, 0);

function tinted(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) c.toArray(arr, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function clearOfStructures(x, z, margin) {
  for (const s of Object.values(SITES)) {
    if (Math.hypot(x - s.x, z - s.z) < s.pad + margin) return false;
  }
  if (Math.hypot(x - BATH.x, z - BATH.z) < BATH.pad + margin) return false;
  for (const [px, pz] of PRIVACY_STAND) if (Math.hypot(x - px, z - pz) < 2.5 + margin) return false;
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 10) return false;
  if (Math.hypot(x - ENTRANCE.x, z - ENTRANCE.z) < 9) return false; // the mouth of the drive
  if (Math.hypot(x - TRUCK.x, z - TRUCK.z) < TRUCK.pad + margin) return false;
  if (fenceDistance(x, z) < 1 + margin) return false; // a mown strip along the fence line
  if (roadDistance(x, z) < 2.4 + margin) return false;
  if (inViewCorridor(x, z)) return false;
  return trailDistance(x, z) > 2.4 + margin;
}

const SIGHT_MARGIN = 0.25; // radians either side of a stay's orbit

/** In front of a stay, where a tree would come between it and the orbiting camera? */
function inSightline(x, z, sightlines) {
  for (const s of sightlines) {
    const dx = x - s.x, dz = z - s.z;
    if (Math.hypot(dx, dz) > s.reach) continue;
    const a = Math.atan2(dx, dz) - s.az;
    const da = Math.atan2(Math.sin(a), Math.cos(a));
    if (da > s.from - SIGHT_MARGIN && da < s.to + SIGHT_MARGIN) return true;
  }
  return false;
}

function scatter(count, seed, density) {
  const rng = mulberry32(seed);
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 60; tries++) {
    // every try draws the same numbers, so clearing one spot doesn't reshuffle the rest
    const x = (rng() * 2 - 1) * 214, z = (rng() * 2 - 1) * 214;
    const keep = rng(), rot = rng() * Math.PI * 2, s = 0.8 + rng() * 0.55, v = rng();
    if (Math.hypot(x, z) > 214) continue;
    const r = meadowRadius(x, z);
    if (keep < density(x, z, r) && clearOfStructures(x, z, 1.5)) out.push({ x, z, r, y: heightAt(x, z), rot, s, v });
  }
  return out;
}

function instanced(geo, material, spots, scaleFn, colorFn) {
  const mesh = new THREE.InstancedMesh(geo, material, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const c = new THREE.Color();
  spots.forEach((t, i) => {
    q.setFromAxisAngle(UP, t.rot);
    const k = scaleFn(t);
    s.set(k, k * (0.9 + t.v * 0.3), k);
    m.compose(p.set(t.x, t.y - 0.25, t.z), q, s);
    mesh.setMatrixAt(i, m);
    if (colorFn) mesh.setColorAt(i, colorFn(t, c));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// --- forest ------------------------------------------------------------------------
/** `sightlines`: wedges in front of each stay to keep clear, as { x, z, az, from, to, reach }. */
export function createForest({ sightlines = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'forest';
  const mat = snowy(flatMat('#ffffff', { vertexColors: true }));
  // filtered after scattering so the rest of the forest keeps its layout
  const open = (t) => !inSightline(t.x, t.z, sightlines);

  const fir = mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.16, 0.26, 1.8, 5).translate(0, 0.9, 0), '#5a3b2a'),
    tinted(new THREE.ConeGeometry(1.75, 3.4, 7).translate(0, 2.9, 0), '#2e5242'),
    tinted(new THREE.ConeGeometry(1.35, 3.0, 7).translate(0, 4.4, 0), '#2c4f40'),
    tinted(new THREE.ConeGeometry(0.9, 2.5, 7).translate(0, 5.8, 0), '#335a48'),
  ]);
  const pine = mergeGeometries([
    tinted(new THREE.CylinderGeometry(0.2, 0.32, 4.6, 5).translate(0, 2.3, 0), '#6b4630'),
    tinted(new THREE.ConeGeometry(1.5, 3.0, 6).translate(0, 5.3, 0), '#3d5c3e'),
    tinted(new THREE.ConeGeometry(1.15, 2.6, 6).translate(0, 6.7, 0), '#3a593b'),
    tinted(new THREE.ConeGeometry(0.7, 2.0, 6).translate(0, 8.0, 0), '#42633f'),
  ]);

  const firSpots = scatter(1150, 3, (x, z, r) => {
    let d = smoothstep(24, 66, r) * (0.6 + 0.4 * fbm(x * 0.035, z * 0.035, 3));
    for (const [gx, gz, gr] of GROVES) if (Math.hypot(x - gx, z - gz) < gr) d = Math.max(d, 0.55);
    return d;
  }).filter(open);
  const pineSpots = scatter(280, 4, (x, z, r) => smoothstep(16, 40, r) * 0.32 + 0.04).filter(open);
  // the stand between the stays, placed by hand (clear of both stays' sightlines)
  for (const [x, z, kind, s] of PRIVACY_STAND) {
    const v = (Math.sin(x * 12.9 + z * 78.2) + 1) / 2;
    (kind === 'pine' ? pineSpots : firSpots).push({ x, z, r: meadowRadius(x, z), y: heightAt(x, z), rot: x * 1.7 + z, s, v });
  }

  const shade = (t, c) => c.setHSL(0, 0, 0.82 + t.v * 0.3).lerp(new THREE.Color('#ffe9c4'), t.v * 0.15);
  group.add(instanced(fir, mat, firSpots, (t) => t.s * (1 + smoothstep(60, 190, t.r) * 0.3), shade));
  group.add(instanced(pine, mat, pineSpots, (t) => t.s * 1.1, shade));

  // Aspens: a golden ring around the meadow
  const aspenSpots = scatter(110, 5, (x, z, r) =>
    Math.exp(-((r - 33) ** 2) / 90) * (fbm(x * 0.06, z * 0.06, 2) > -0.1 ? 0.95 : 0.15)
    * (z < -2 || (Math.abs(x) > 34 && z < 30) ? 1 : 0)) // keep the line of sight to the stays clear
    .filter(open);
  const trunk = new THREE.CylinderGeometry(0.1, 0.15, 3.4, 5).translate(0, 1.7, 0);
  const crown = new THREE.IcosahedronGeometry(1.05, 0).scale(1, 1.4, 1).translate(0, 4, 0);
  const golds = ['#e9b73e', '#f0a13a', '#d98b2b', '#e7c75a', '#9aa34a'].map((h) => new THREE.Color(h));
  group.add(instanced(trunk, flatMat('#e8dfcf'), aspenSpots, (t) => t.s));
  group.add(instanced(crown, flatMat('#ffffff'), aspenSpots, (t) => t.s,
    (t, c) => c.copy(golds[Math.floor(t.v * golds.length)])));

  // Rocks
  const rockSpots = scatter(80, 6, (x, z, r) => (r > 12 ? 0.22 : 0));
  const rocks = instanced(new THREE.DodecahedronGeometry(1, 0), snowy(flatMat('#ffffff')), rockSpots,
    (t) => 0.4 + t.s * t.v * 1.4, (t, c) => c.set('#9a8574').multiplyScalar(0.8 + t.v * 0.3));
  group.add(rocks);
  return { object: group };
}

// --- lookout tower on the far ridge -----------------------------------------------------
export function createLookout() {
  const g = new THREE.Group();
  const wood = flatMat('#4b3427');
  const H = 13;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  corners.forEach(([sx, sz], i) => {
    g.add(beam(V(sx * 3, -1, sz * 3), V(sx * 1.6, H, sz * 1.6), 0.18, wood));
    const [nx, nz] = corners[(i + 1) % 4];
    for (const [y0, y1] of [[0, 4.5], [4.5, 9], [9, H]]) {
      const w0 = 3 - (y0 / H) * 1.4, w1 = 3 - (y1 / H) * 1.4;
      g.add(beam(V(sx * w0, y0, sz * w0), V(nx * w1, y1, nz * w1), 0.07, wood, 4));
      g.add(beam(V(nx * w0, y0, nz * w0), V(sx * w1, y1, sz * w1), 0.07, wood, 4));
    }
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.25, 5.8), wood);
  deck.position.y = H;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3, 4.2), flatMat('#6e4b35'));
  cab.position.y = H + 1.5;
  const glass = new THREE.MeshLambertMaterial({ color: '#2b2a36', emissive: '#ffb45a', emissiveIntensity: 0 });
  const band = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.3, 4.3), glass);
  band.position.y = H + 1.9;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 4), flatMat('#2e2421'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = H + 3.9;
  g.add(deck, cab, band, roof);
  g.scale.setScalar(1.35);
  g.position.set(LOOKOUT.x, LOOKOUT.y - 0.5, LOOKOUT.z);
  g.rotation.y = 0.5;
  return {
    object: g,
    update(p) { glass.emissiveIntensity = p.night * 1.6; },
  };
}

// --- stars, fireflies, clouds ----------------------------------------------------------
export function createStars() {
  const group = new THREE.Group();
  const rng = mulberry32(99);
  for (const [n, size] of [[1500, 1.5], [90, 2.8]]) {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 0.04 + 0.96 * Math.pow(rng(), 0.7);
      const a = rng() * Math.PI * 2, rr = Math.sqrt(1 - y * y);
      arr.set([Math.cos(a) * rr * 1200, y * 1200, Math.sin(a) * rr * 1200], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      color: '#fff4dc', size, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    group.add(new THREE.Points(geo, mat));
  }
  return {
    object: group,
    update(p) { group.children.forEach((pts) => { pts.material.opacity = p.stars; }); group.visible = p.stars > 0.01; },
    tick(t, dt, camera) { group.position.copy(camera.position); group.rotation.y = t * 0.004; },
  };
}

export function createFireflies() {
  const N = 80;
  const rng = mulberry32(21);
  const base = [];
  const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rng() * Math.PI * 2, r = 6 + rng() * 30;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.8;
    base.push({ x, z, y: heightAt(x, z) + 0.6 + rng() * 2.2, ph: rng() * 10, sp: 0.3 + rng() * 0.5 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffd873', size: 0.5, map: glowTexture(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let strength = 0;
  return {
    object: points,
    update(p) {
      strength = (Math.max(0, p.night - 0.25) / 0.75) * (1 - (p.rain ?? 0)) * (1 - (p.snow ?? 0)) * (1 - (p.cover ?? 0));
      points.visible = strength > 0.01;
    },
    tick(t) {
      if (!points.visible) return;
      base.forEach((b, i) => {
        arr[i * 3] = b.x + Math.sin(t * b.sp + b.ph) * 1.6;
        arr[i * 3 + 1] = b.y + Math.sin(t * b.sp * 1.7 + b.ph) * 0.5;
        arr[i * 3 + 2] = b.z + Math.cos(t * b.sp * 0.8 + b.ph) * 1.6;
      });
      geo.attributes.position.needsUpdate = true;
      mat.opacity = strength * (0.75 + 0.25 * Math.sin(t * 3));
    },
  };
}

export function createClouds() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.92, depthWrite: false });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  const rng = mulberry32(8);
  // the first 11 are the fair-weather clouds; the rest fill the sky as cover builds
  for (let i = 0; i < 28; i++) {
    const cloud = new THREE.Group();
    const n = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(puff, mat);
      const w = 16 + rng() * 14;
      m.scale.set(w, (6 + rng() * 6) * (j === Math.floor(n / 2) ? 1.5 : 1), 9);
      m.position.set((j - n / 2) * 15 + rng() * 6, rng() * 4, rng() * 5);
      cloud.add(m);
    }
    const t = (rng() - 0.5) * 2.6 + (i % 4 === 3 ? Math.PI : 0);
    const R = 720 + rng() * 260;
    cloud.position.set(Math.sin(t) * R, 190 + rng() * 150, -Math.cos(t) * R);
    cloud.lookAt(0, cloud.position.y, 0);
    group.add(cloud);
  }
  const tmp = new THREE.Color();
  return {
    object: group,
    update(p, colors) {
      const shown = 11 + Math.round(Math.max(0, (p.cloud ?? 0) - 0.2) * 22);
      group.children.forEach((cloud, i) => { cloud.visible = i < shown; });
      mat.color.copy(colors.skyMid).lerp(colors.horizon, 0.6).lerp(tmp.set('#ffffff'), 0.38 - 0.34 * p.night);
    },
    tick(t, dt) { group.rotation.y += dt * 0.0025; },
  };
}

/**
 * The northern lights as they show from Colorado: not green curtains but a crimson glow off the
 * northern treeline, with faint pillars drifting through it. An easter egg; see setAurora().
 */
export function createAurora() {
  // a wide arc of the northern sky, centred due north so it rises behind the ridges the meadow
  // looks out on (bearing b lies at cylinder angle pi - b; north is -z)
  const span = 2.5, centre = Math.PI;
  const geo = new THREE.CylinderGeometry(950, 950, 560, 96, 1, true, centre - span / 2, span);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uStrength;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main() {
        float u = vUv.x, v = vUv.y;
        float pillars = 0.5 + 0.5 * noise(u * 110.0 + uTime * 0.3) * noise(u * 27.0 - uTime * 0.11);
        float bands = 0.55 + 0.45 * noise(u * 7.0 + uTime * 0.04);
        float glow = smoothstep(0.04, 0.22, v) * pow(1.0 - v, 1.2);
        float ends = smoothstep(0.0, 0.2, u) * smoothstep(1.0, 0.8, u);
        vec3 col = mix(vec3(0.95, 0.1, 0.3), vec3(0.62, 0.12, 0.58), smoothstep(0.3, 0.85, v));
        gl_FragColor = vec4(col, glow * pillars * bands * ends * uStrength);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, fog: false,
  });
  const band = new THREE.Mesh(geo, mat);
  band.position.y = 270; // glows up from behind the ridges, brightest just above them
  band.frustumCulled = false;
  band.renderOrder = -1; // with the sky, behind everything else
  const group = new THREE.Group();
  group.add(band);
  group.visible = false;
  let on = false, sky = 0, strength = 0;
  return {
    object: group,
    set(value) { on = value; },
    get on() { return on; },
    // only after dark, and cloud hides it
    update(p) { sky = Math.max(0, (p.night - 0.6) / 0.4) * (1 - 0.9 * (p.cloud ?? 0)); },
    tick(t, dt, camera) {
      strength += ((on ? sky : 0) - strength) * Math.min(1, dt * 0.6);
      group.visible = strength > 0.005;
      if (!group.visible) return;
      group.position.copy(camera.position);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uStrength.value = strength * 1.3;
    },
  };
}

/**
 * Fireworks far off for New Year's and the Fourth of July, as if from a town down the road: bursts
 * popping up over the ridges the meadow looks out on, after dark. Switched on by setHolidays().
 */
export function createFireworks() {
  const BURSTS = 10, SPARKS = 110, N = BURSTS * SPARKS;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const tint = new Float32Array(N * 3), alpha = new Float32Array(N);
  const life = new Float32Array(BURSTS), span = new Float32Array(BURSTS);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 3 } },
    vertexShader: /* glsl */ `
      attribute vec3 tint;
      attribute float alpha;
      uniform float uSize;
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        vTint = tint;
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vTint;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vTint, vAlpha * smoothstep(0.5, 0.1, d));
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;
  const PALETTES = { july4: ['#ff3b3b', '#ffffff', '#4f86ff'], newyear: ['#ffd166', '#ff5ec4', '#6ecbff', '#7bff8a', '#ffffff'] };
  let on = false, dark = 0, next = 0, palette = PALETTES.newyear;
  const a = new THREE.Color(), b = new THREE.Color();
  const pick = () => palette[Math.floor(Math.random() * palette.length)];

  function launch() {
    const slot = life.findIndex((l) => l <= 0);
    if (slot < 0) return;
    const bearing = THREE.MathUtils.degToRad(-30 + Math.random() * 60); // around north, straight out from the meadow
    const dist = 300 + Math.random() * 40;
    const cx = Math.sin(bearing) * dist, cz = -Math.cos(bearing) * dist, cy = 60 + Math.random() * 30; // against the far ridges
    // colours are written straight to the screen, so keep them in sRGB
    a.set(pick()).convertLinearToSRGB();
    if (Math.random() < 0.35) b.set(pick()).convertLinearToSRGB(); // sometimes a two-tone burst
    else b.copy(a);
    const speed = 20 + Math.random() * 10;
    for (let i = 0; i < SPARKS; i++) {
      const k = slot * SPARKS + i;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const sp = speed * (0.85 + Math.random() * 0.3);
      vel.set([r * Math.cos(th) * sp, u * sp, r * Math.sin(th) * sp], k * 3);
      pos.set([cx, cy, cz], k * 3);
      const col = i % 3 ? a : b;
      tint.set([col.r, col.g, col.b], k * 3);
    }
    span[slot] = life[slot] = 1.8 + Math.random() * 0.8;
  }

  return {
    object: points,
    setHolidays(h) {
      on = Boolean(h.july4 || h.newyear);
      palette = h.july4 ? PALETTES.july4 : PALETTES.newyear;
    },
    // only after dark, and low cloud hides them
    update(p) { dark = Math.max(0, (p.night - 0.55) / 0.45) * (1 - 0.7 * (p.cloud ?? 0)); },
    tick(t, dt) {
      if (on && dark > 0.05 && (next -= dt) <= 0) {
        launch();
        if (Math.random() < 0.3) launch();
        next = 0.5 + Math.random() * 1.7;
      }
      let live = false;
      for (let s = 0; s < BURSTS; s++) {
        if (life[s] <= 0) continue;
        live = true;
        life[s] -= dt;
        const fade = Math.max(0, life[s] / span[s]);
        for (let i = 0; i < SPARKS; i++) {
          const k = s * SPARKS + i, j = k * 3;
          const drag = 1 - 1.1 * dt;
          vel[j] *= drag;
          vel[j + 1] = vel[j + 1] * drag - 5 * dt;
          vel[j + 2] *= drag;
          pos[j] += vel[j] * dt;
          pos[j + 1] += vel[j + 1] * dt;
          pos[j + 2] += vel[j + 2] * dt;
          const twinkle = fade < 0.35 ? 0.5 + 0.5 * Math.sin(t * 40 + i) : 1;
          alpha[k] = life[s] > 0 ? fade ** 1.3 * twinkle * dark : 0;
        }
      }
      points.visible = live;
      if (live) {
        mat.uniforms.uSize.value = 3.6 * Math.min(2, window.devicePixelRatio || 1);
        for (const name of ['position', 'tint', 'alpha']) geo.attributes[name].needsUpdate = true;
      }
    },
  };
}
