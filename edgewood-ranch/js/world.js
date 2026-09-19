// Procedural land: noise, layout, terrain, sky dome and layered ridgelines.
import * as THREE from 'three';
import { snowy } from './kit.js';

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
// An impression of the real ranch, not a map: the arrangement is true but the distances are
// squeezed. North is -z and east +x, so the default camera stands at the south end of the
// meadow looking north. The Airstream sits on the left, the A-frame is set back on the right
// against the trees, and the bath house is between them, behind a small stand of trees
// that keeps each stay private.
export const SITES = {
  aframe: { x: 16, z: -15, rot: -0.3, pad: 12 },
  airstream: { x: -14, z: 4, rot: 1.1, pad: 16 },
};
export const BATH = { x: 1.6, z: -18.2, rot: -0.05, pad: 5 };
// The small stand of pines and firs between the stays, like the real one: it screens each stay
// from the other, and the path to the bath house runs through a gap in it. [x, z, kind, scale]
export const PRIVACY_STAND = [
  [-2.8, -8.2, 'fir', 1.05], [-4.6, -11.4, 'fir', 0.9], [-1.6, -12, 'pine', 1.1], [-3.4, -14.8, 'pine', 1],
  [4.9, -9.6, 'fir', 1], [5.2, -12.2, 'pine', 1.15], [7.2, -13.4, 'fir', 0.85],
];
export const LOOKOUT = { x: 104, z: -126 };
// Where the drive leaves the county road, and the old stake-bed truck parked in the grass on
// the right coming in, nosed toward the drive so arrivals see it front-on
export const ENTRANCE = { x: -62, z: 86 };
export const TRUCK = { x: -19.1, z: 62, rot: -1.92, pad: 5 };
// Stands of trees that crowd in close to the stays: [x, z, radius]
export const GROVES = [[27, -31, 16], [37, -9, 10], [-30, -12, 12], [-43, 9, 10]];
// Kept clear of trees so the default camera sees the meadow
export const inViewCorridor = (x, z) => z > 20 && z < 76 && Math.abs(x - 1) < 9;

/** A smooth line through `points` ([x, z] pairs), as straight pieces about `step` long. */
function smoothPath(points, step = 1.5) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  return curve.getSpacedPoints(Math.max(1, Math.ceil(curve.getLength() / step))).map((p) => [p.x, p.z]);
}

// The drive, the way it really runs: in off the county road at the south-west corner, north-east
// through the pines past the truck, then round the meadow in a loop. One branch runs north past
// the Airstream and on to the A-frame, the other cuts straight across to it.
export const DRIVE = smoothPath([
  [-62, 86], [-55, 84.4], [-46, 80.8], [-36.5, 74], [-28.5, 64.8], [-21.5, 53.5], [-15.5, 42.5], [-10.5, 32],
]);
const WEST_BRANCH = smoothPath([[-10.5, 32], [-8, 22], [-5, 14], [-2.4, 6], [1, 0], [6, -3.6], [10.8, -5.1], [14.2, -5.4]]);
const EAST_BRANCH = smoothPath([[-10.5, 32], [-3, 26.4], [4.4, 19.8], [10.3, 11.6], [14.2, 3.2], [15.4, -1.8], [14.2, -5.4]]);
// footpaths to the Airstream's deck, the A-frame's steps and the bath house
const WALKS = [
  smoothPath([[-5, 14], [-7, 10.4], [-8.5, 7.3]]),
  smoothPath([[14.2, -5.4], [13.9, -7.7]]),
  smoothPath([[3.4, -2.3], [2.6, -7], [2.0, -12], [1.75, -15.8]]),
];
// the gravel county road the drive turns off
const ROAD = smoothPath([[-62, 214], [-63, 150], [-62, 86], [-60.5, 20], [-56, -40]], 3);
// The old post-and-rail fence along the north line, behind both stays
export const FENCE = smoothPath([
  [-52, -24.5], [-38, -29.5], [-22, -33], [-8, -35], [6, -34.5], [20, -32.5], [34, -29.2], [47, -24.5],
], 2.8);

/** Straight pieces of a path with their bounds, `width` wide relative to the drive. */
function segments(paths, width = 1) {
  const out = [];
  for (const p of paths) {
    for (let i = 1; i < p.length; i++) {
      const [ax, az] = p[i - 1], [bx, bz] = p[i];
      out.push({
        ax, az, bx, bz, width,
        x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz),
      });
    }
  }
  return out;
}
const TRAIL = [...segments([DRIVE, WEST_BRANCH, EAST_BRANCH]), ...segments(WALKS, 0.65)];
const ROAD_SEGS = segments([ROAD], 1.6);
const FENCE_SEGS = segments([FENCE]);

const FAR = 12; // nothing asks how far a path is beyond this
/** Distance to the nearest of `segs`, measured in their widths. */
function pathDistance(segs, x, z) {
  let d = FAR;
  for (const s of segs) {
    const ex = Math.max(s.x0 - x, 0, x - s.x1), ez = Math.max(s.z0 - z, 0, z - s.z1);
    if (ex * ex + ez * ez >= (d * s.width) ** 2) continue; // its bounds are already too far
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz), 0, 1);
    d = Math.min(d, Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) / s.width);
  }
  return d;
}

/** How far to the drive or a footpath (in drive widths), wandering a little. */
export function trailDistance(x, z) {
  return pathDistance(TRAIL, x, z) + fbm(x * 0.08, z * 0.08, 2) * 0.8;
}
export const roadDistance = (x, z) => pathDistance(ROAD_SEGS, x, z) + fbm(x * 0.05, z * 0.05, 2) * 0.25;
export const fenceDistance = (x, z) => pathDistance(FENCE_SEGS, x, z);

/** A point `dist` along the drive from the road, and the way the drive runs there. */
export function alongDrive(dist) {
  for (let i = 1; i < DRIVE.length; i++) {
    const [ax, az] = DRIVE[i - 1], [bx, bz] = DRIVE[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (dist <= len || i === DRIVE.length - 1) {
      const t = Math.min(1, dist / len);
      return { x: lerp(ax, bx, t), z: lerp(az, bz, t), dx: (bx - ax) / len, dz: (bz - az) / len };
    }
    dist -= len;
  }
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

const PADS = [...Object.values(SITES), BATH, TRUCK];
for (const s of PADS) s.y = baseHeight(s.x, s.z);
LOOKOUT.y = baseHeight(LOOKOUT.x, LOOKOUT.z);

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
    c.lerp(gravel, 1 - smoothstep(1.2, 1.9, roadDistance(x, z)));
    c.lerp(dirt, 1 - smoothstep(0.9, 2.1, trailDistance(x, z)));
    c.multiplyScalar(1 + (rng() - 0.5) * 0.09);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geo,
    snowy(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
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
