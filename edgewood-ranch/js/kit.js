// Small building kit shared by the models: materials, primitives, lights, textures.
import * as THREE from 'three';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const V2 = (x, y) => new THREE.Vector2(x, y);
const UP = V(0, 1, 0);

// Additive glow sprites render on their own layer so the Airstream's reflection probe skips
// them; seen from inside the trailer they would bloom across the whole shell.
export const GLOW_LAYER = 1;

export function flatMat(color, extra = {}) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** A cylinder stretched between two points. */
export function beam(a, b, radius, material, sides = 5) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), sides), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  return mesh;
}

export function glassMat(opacity = 1) {
  return new THREE.MeshLambertMaterial({
    color: '#26303b', emissive: '#ffb35c', emissiveIntensity: 0.06,
    transparent: opacity < 1, opacity, side: THREE.DoubleSide,
  });
}

/** Material that glows warmly after dark: `setNight(n)` drives it. */
export function glowMat(color = '#ffc070', base = '#3a2a1c') {
  return new THREE.MeshLambertMaterial({ color: base, emissive: color, emissiveIntensity: 0 });
}

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Repeating board/corrugation stripes. `repeat` is [u, v]. */
export function stripeTexture(base, line, { repeat = [1, 1], vertical = true, lineWidth = 0.18 } = {}) {
  const c = document.createElement('canvas');
  c.width = vertical ? 32 : 4;
  c.height = vertical ? 4 : 32;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = line;
  if (vertical) g.fillRect(0, 0, Math.max(1, 32 * lineWidth), 4);
  else g.fillRect(0, 0, 4, Math.max(1, 32 * lineWidth));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/** Café lights hung between points, each span sagging a little. */
export function stringLights(points, { sag = 0.35, spacing = 0.6, bulb = 0.06 } = {}) {
  const group = new THREE.Group();
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#6e5f4a' });
  const haloMat = new THREE.SpriteMaterial({
    map: glowTexture(), color: '#ffc46b', blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0,
  });
  const lineMat = new THREE.LineBasicMaterial({ color: '#2a2220' });
  const bulbGeo = new THREE.SphereGeometry(bulb, 6, 4);
  for (let s = 0; s < points.length - 1; s++) {
    const from = points[s], to = points[s + 1];
    const at = (t) => new THREE.Vector3().lerpVectors(from, to, t)
      .setY(from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * sag);
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 17 }, (_, i) => at(i / 16))),
      lineMat,
    ));
    const n = Math.max(2, Math.round(from.distanceTo(to) / spacing));
    for (let i = 1; i < n; i++) {
      const p = at(i / n).add(V(0, -bulb * 1.4, 0));
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      const h = new THREE.Sprite(haloMat);
      b.position.copy(p);
      h.position.copy(p);
      h.scale.setScalar(bulb * 7);
      h.layers.set(GLOW_LAYER);
      group.add(b, h);
    }
  }
  const dim = new THREE.Color('#6e5f4a'), lit = new THREE.Color('#ffe2a8');
  return {
    object: group,
    setNight(n) {
      bulbMat.color.copy(dim).lerp(lit, Math.min(1, n * 1.6));
      haloMat.opacity = n * 0.7;
    },
  };
}

/** Low gas flames for fire tables; call tick(t, night). */
export function flameRow(count = 4, spread = 0.36) {
  const group = new THREE.Group();
  const outerMat = new THREE.MeshBasicMaterial({ color: '#ff7a2e' });
  const innerMat = new THREE.MeshBasicMaterial({ color: '#ffd25e' });
  const tongues = [];
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1) - 0.5) * spread;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), outerMat);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 4), innerMat);
    outer.position.set(x, 0.15, (i % 2) * 0.06 - 0.03);
    inner.position.set(x, 0.09, outer.position.z);
    group.add(outer, inner);
    tongues.push([outer, inner, i * 1.7]);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#ff8a3a', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  glow.scale.set(1.6, 1.1, 1);
  glow.position.y = 0.2;
  glow.layers.set(GLOW_LAYER);
  group.add(glow);
  return {
    object: group,
    tick(t, night) {
      for (const [outer, inner, ph] of tongues) {
        const f = 0.8 + 0.2 * Math.sin(t * 9 + ph) * Math.sin(t * 5.3 + ph * 2);
        outer.scale.set(1, f, 1);
        inner.scale.set(1, 1.8 - f, 1);
      }
      glow.material.opacity = (0.2 + night * 0.6) * (0.9 + 0.1 * Math.sin(t * 13));
    },
  };
}

export function lantern(glow) {
  const g = new THREE.Group();
  const frame = flatMat('#1f1d1f');
  g.add(box(0.2, 0.03, 0.2, frame, 0, 0.015, 0), box(0.22, 0.04, 0.22, frame, 0, 0.36, 0));
  g.add(box(0.15, 0.3, 0.15, glow, 0, 0.18, 0));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI), frame);
  handle.position.y = 0.38;
  g.add(handle);
  return g;
}

/** Tall pot with a spray of ornamental grass. */
export function planter(height = 0.7, pot = '#3d3a3a') {
  const g = new THREE.Group();
  const potMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, height, 10), flatMat(pot));
  potMesh.position.y = height / 2;
  potMesh.castShadow = true;
  g.add(potMesh);
  const grass = flatMat('#8f9a52');
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.75, 3), grass);
    const a = (i / 7) * Math.PI * 2;
    blade.position.set(Math.cos(a) * 0.09, height + 0.3, Math.sin(a) * 0.09);
    blade.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    g.add(blade);
  }
  return g;
}

/** Sling-style outdoor chair facing +z. */
export function slingChair(frameColor = '#1f1f22', seatColor = '#2b2b2f') {
  const g = new THREE.Group();
  const frame = flatMat(frameColor), seat = flatMat(seatColor);
  g.add(box(0.58, 0.05, 0.55, seat, 0, 0.42, 0));
  const back = box(0.58, 0.62, 0.05, seat, 0, 0.76, -0.3);
  back.rotation.x = -0.18;
  g.add(back);
  for (const s of [-1, 1]) {
    g.add(box(0.04, 0.42, 0.04, frame, s * 0.29, 0.21, 0.24));
    g.add(box(0.04, 1.02, 0.04, frame, s * 0.29, 0.51, -0.3));
    g.add(box(0.05, 0.04, 0.62, frame, s * 0.29, 0.62, -0.02));
  }
  return g;
}

/** A single ponderosa, for trees that belong to a site rather than the forest. */
export function pineTree(scale = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 4.6, 6), flatMat('#6b4630'));
  trunk.position.y = 2.3;
  trunk.castShadow = true;
  g.add(trunk);
  const needles = flatMat('#35573f');
  for (const [r, h, y] of [[1.9, 3.3, 4.8], [1.5, 2.9, 6.2], [1.05, 2.5, 7.5], [0.6, 1.7, 8.6]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), needles);
    cone.position.y = y;
    cone.castShadow = true;
    g.add(cone);
  }
  g.scale.setScalar(scale);
  return g;
}

/** Cartoon glass: a sky-to-ground gradient with two highlight streaks. */
export function paintedGlassTexture(top = '#f3c48f', middle = '#8fb0b2', bottom = '#34484c') {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, top);
  grad.addColorStop(0.45, middle);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = 'rgba(255, 250, 240, 0.3)';
  for (const [x0, w] of [[6, 12], [26, 4]]) {
    g.beginPath();
    g.moveTo(x0, 128);
    g.lineTo(x0 + w, 128);
    g.lineTo(x0 + w + 36, 0);
    g.lineTo(x0 + 36, 0);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Weathered horizontal planks in mixed tones, like reclaimed siding. */
export function plankTexture(planks = 12, seed = 7) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const tones = ['#a88b62', '#8f7351', '#b69c72', '#7d6448', '#9d8f78', '#6f5a43', '#bfa47a'];
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const h = 256 / planks;
  for (let i = 0; i < planks; i++) {
    let x = 0;
    while (x < 256) {
      const len = 60 + rand() * 140;
      g.fillStyle = tones[Math.floor(rand() * tones.length)];
      g.fillRect(x, i * h, len, h);
      g.fillStyle = 'rgba(40, 26, 16, 0.18)';
      g.fillRect(x, i * h + h * (0.3 + rand() * 0.4), len, 1.5);
      g.fillStyle = 'rgba(30, 20, 12, 0.55)';
      g.fillRect(x + len - 1.5, i * h, 1.5, h);
      x += len;
    }
    g.fillStyle = 'rgba(30, 20, 12, 0.6)';
    g.fillRect(0, i * h, 256, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** A soft sprite that drifts up and fades: steam or chimney smoke. */
export function wisps(count = 4, { color = '#f2ede6', rise = 1.6, size = 0.9, opacity = 0.35 } = {}) {
  const group = new THREE.Group();
  const puffs = Array.from({ length: count }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0,
    }));
    s.userData.phase = i / count;
    group.add(s);
    return s;
  });
  return {
    object: group,
    tick(t, strength = 1) {
      for (const s of puffs) {
        const k = (t * 0.18 + s.userData.phase) % 1;
        s.position.set(Math.sin(k * 6 + s.userData.phase * 9) * 0.25, k * rise, Math.cos(k * 5) * 0.15);
        s.scale.setScalar(size * (0.5 + k));
        s.material.opacity = opacity * strength * Math.sin(Math.PI * k);
      }
    },
  };
}
