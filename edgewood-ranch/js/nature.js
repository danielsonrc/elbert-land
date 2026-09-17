// Forest, rocks, sky dressing and the distant lookout tower.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SITES, BATH, LOOKOUT, GATE, GROVES, inViewCorridor, heightAt, meadowRadius, trailDistance, fbm, mulberry32, smoothstep,
} from './world.js';
import { flatMat, beam, glowTexture } from './kit.js';

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
  if (Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 10) return false;
  if (Math.hypot(x - GATE.x, z - GATE.z) < 10) return false;
  if (Math.abs(z - GATE.z) < 2.6 && Math.abs(x - GATE.x) < 22) return false; // fence line
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
    const x = (rng() * 2 - 1) * 214, z = (rng() * 2 - 1) * 214;
    if (Math.hypot(x, z) > 214) continue;
    const r = meadowRadius(x, z);
    if (rng() < density(x, z, r) && clearOfStructures(x, z, 1.5)) {
      out.push({ x, z, r, y: heightAt(x, z), rot: rng() * Math.PI * 2, s: 0.8 + rng() * 0.55, v: rng() });
    }
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
  const mat = flatMat('#ffffff', { vertexColors: true });
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
  const rocks = instanced(new THREE.DodecahedronGeometry(1, 0), flatMat('#ffffff'), rockSpots,
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
    update(p) { strength = Math.max(0, p.night - 0.25) / 0.75; points.visible = strength > 0.01; },
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
  for (let i = 0; i < 11; i++) {
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
      mat.color.copy(colors.skyMid).lerp(colors.horizon, 0.6).lerp(tmp.set('#ffffff'), 0.38 - 0.34 * p.night);
    },
    tick(t, dt) { group.rotation.y += dt * 0.0025; },
  };
}
