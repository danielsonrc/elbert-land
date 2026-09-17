// Procedural land: noise, layout, terrain, sky dome and layered ridgelines.
import * as THREE from 'three';

// --- small math helpers ------------------------------------------------------
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

export function fbm(x, z, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, z * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}

// --- layout ------------------------------------------------------------------
// The default camera looks west (-z) across the meadow toward the mountains.
// The Airstream sits front-left; the A-frame is set back on the right, against the trees.
export const SITES = {
  aframe: { x: 16, z: -15, rot: -0.3, pad: 12 },
  airstream: { x: -14, z: 4, rot: 1.1, pad: 16 },
};
// The A-frame's bath house, a short walk west of its side steps
export const BATH = { x: 2.5, z: -17, rot: -0.05, pad: 5 };
export const LOOKOUT = { x: 104, z: -126 };
export const GATE = { x: 4, z: 80 };
// Stands of trees that crowd in close to the stays: [x, z, radius]
export const GROVES = [[27, -31, 16], [37, -9, 10], [-30, -12, 12], [-43, 9, 10]];
// Kept clear of trees so the default camera sees the meadow
export const inViewCorridor = (x, z) => z > 20 && z < 76 && Math.abs(x - 1) < 9;

const TRAIL = [
  [[5, 120], [3, 44]],
  [[3, 44], [-1, 18]],
  [[-1, 18], [-8.5, 7.3]], // Airstream deck steps
  [[-1, 18], [13.5, -6.9]], // A-frame front steps
  [[11.3, -3.2], [2.3, -14.7]], // off the A-frame path to the bath house
];

function segDist(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function trailDistance(x, z) {
  let d = Infinity;
  for (const [a, b] of TRAIL) d = Math.min(d, segDist(x, z, a, b));
  // let the trail wander a little
  return d + fbm(x * 0.08, z * 0.08, 2) * 0.8;
}

// Distance from the meadow's center, stretched toward the camera side so the
// foreground stays open.
export function meadowRadius(x, z) {
  const dz = z + 10;
  return Math.hypot(x * 0.92, dz * (dz > 0 ? 0.62 : 1));
}

function baseHeight(x, z) {
  const r = meadowRadius(x, z);
  let h = fbm(x * 0.017, z * 0.017, 4) * 7 + fbm(x * 0.07 + 40, z * 0.07, 2) * 1.1;
  h += smoothstep(38, 170, r) * 25 * (0.65 + 0.35 * fbm(x * 0.011 + 7, z * 0.011, 2));
  h = lerp(h, h * 0.22, 1 - smoothstep(16, 58, r));
  // sink everything past the rim so the ridgelines hide the terrain edge
  const d = Math.hypot(x, z);
  if (d > 215) h -= (d - 215) * 1.6;
  return h;
}

const PADS = [...Object.values(SITES), BATH];
for (const s of PADS) s.y = baseHeight(s.x, s.z);
LOOKOUT.y = baseHeight(LOOKOUT.x, LOOKOUT.z);
GATE.y = baseHeight(GATE.x, GATE.z);

/** Drop a model group onto its flattened pad. */
export function placeOnSite(group, id) {
  const s = SITES[id];
  group.position.set(s.x, s.y, s.z);
  group.rotation.y = s.rot;
  group.userData.stay = id;
  return group;
}

export function heightAt(x, z) {
  let h = baseHeight(x, z);
  for (const s of PADS) {
    const k = 1 - smoothstep(s.pad * 0.5, s.pad, Math.hypot(x - s.x, z - s.z));
    h = lerp(h, s.y, k);
  }
  h -= (1 - smoothstep(0.4, 2.2, trailDistance(x, z))) * 0.12;
  return h;
}

// --- terrain -----------------------------------------------------------------
export function createTerrain() {
  let geo = new THREE.PlaneGeometry(470, 470, 150, 150);
  geo.rotateX(-Math.PI / 2);
  const src = geo.attributes.position;
  for (let i = 0; i < src.count; i++) src.setY(i, heightAt(src.getX(i), src.getZ(i)));
  geo = geo.toNonIndexed();
  geo.computeVertexNormals(); // non-indexed → one normal per face

  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const dry = new THREE.Color('#d2aa5a'), olive = new THREE.Color('#9da052');
  const forest = new THREE.Color('#5b5a39'), dirt = new THREE.Color('#a47c52');
  const rock = new THREE.Color('#8d6f5d'), needles = new THREE.Color('#7a6445');
  const gravel = new THREE.Color('#a39687');
  const air = SITES.airstream;
  const c = new THREE.Color();
  const rng = mulberry32(11);

  for (let i = 0; i < pos.count; i += 3) {
    const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const r = meadowRadius(x, z);
    c.copy(dry).lerp(olive, fbm(x * 0.05, z * 0.05, 2) * 0.6 + 0.4);
    c.lerp(forest, smoothstep(30, 85, r));
    c.lerp(rock, 1 - smoothstep(0.64, 0.84, nrm.getY(i)));
    c.lerp(needles, (1 - smoothstep(3.6, 8.4, Math.hypot(x - SITES.aframe.x, z - SITES.aframe.z))) * 0.55);
    c.lerp(needles, (1 - smoothstep(2.5, 4.5, Math.hypot(x - BATH.x, z - BATH.z))) * 0.5);
    c.lerp(gravel, (1 - smoothstep(6.5, 9.5, Math.hypot(x - air.x, z - air.z))) * 0.85);
    c.lerp(dirt, 1 - smoothstep(0.9, 2.1, trailDistance(x, z)));
    c.multiplyScalar(1 + (rng() - 0.5) * 0.09);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// --- sky dome ------------------------------------------------------------------
export function createSky() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color() },
      mid: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
      disc: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, sunColor, sunDir;
      uniform float disc;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = floor(max(d.y, 0.0) * 30.0) / 30.0;          // poster-style banding
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.24, y));
        col = mix(col, top, smoothstep(0.2, 0.78, y));
        float s = max(dot(d, sunDir), 0.0);
        float glow = floor(pow(s, 14.0) * 6.0) / 6.0;
        col = mix(col, sunColor, glow * 0.45 * disc);
        col = mix(col, sunColor * 1.08, smoothstep(0.9989, 0.9992, s) * disc);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), material);
  mesh.name = 'sky';
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

// --- layered ridgelines ------------------------------------------------------------
// Flat, fog-tinted silhouettes: the Firewatch-poster depth trick.
export const RIDGE_HAZE = [0.42, 0.56, 0.7, 0.83];

export function createRidges() {
  const layers = [
    { R: 245, base: 34, amp: 16, freq: 5.0, seed: 1 },
    { R: 325, base: 62, amp: 26, freq: 4.0, seed: 2 },
    { R: 425, base: 104, amp: 40, freq: 3.0, seed: 3, peak: { at: -0.62, h: 64, w: 0.13 } },
    { R: 545, base: 146, amp: 30, freq: 2.4, seed: 4 },
  ];
  const group = new THREE.Group();
  group.name = 'ridges';

  for (const L of layers) {
    const N = 240;
    const positions = new Float32Array((N + 1) * 6);
    const hNorm = new Float32Array((N + 1) * 2);
    const index = [];
    for (let k = 0; k <= N; k++) {
      const t = (k / N) * Math.PI * 2 - Math.PI;
      const cx = Math.cos(t) * L.freq + L.seed * 13.1, cz = Math.sin(t) * L.freq - L.seed * 7.3;
      let h = L.base + L.amp * (fbm(cx, cz, 4) * 1.4 + 0.4 * Math.abs(fbm(cx * 3.1, cz * 3.1, 2)));
      if (L.peak) h += L.peak.h * Math.exp(-Math.abs(t - L.peak.at) / L.peak.w);
      const x = Math.sin(t) * L.R, z = -Math.cos(t) * L.R;
      positions.set([x, -40, z, x, h, z], k * 6);
      hNorm.set([-0.6, 1], k * 2);
      if (k < N) {
        const b = k * 2;
        index.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('hNorm', new THREE.BufferAttribute(hNorm, 1));
    geo.setIndex(index);

    const mat = new THREE.ShaderMaterial({
      uniforms: { cTop: { value: new THREE.Color() }, cBot: { value: new THREE.Color() } },
      vertexShader: /* glsl */ `
        attribute float hNorm;
        varying float vH;
        void main() {
          vH = hNorm;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 cTop, cBot;
        varying float vH;
        void main() {
          gl_FragColor = vec4(mix(cBot, cTop, smoothstep(0.0, 1.0, vH)), 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.DoubleSide,
      fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
