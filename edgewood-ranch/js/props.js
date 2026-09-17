// Ranch gate, site posts, the bath house and the selection rings.
import * as THREE from 'three';
import { SITES, GATE, BATH, heightAt } from './world.js';
import { V, V2, box, beam, flatMat, glowMat, stripeTexture, plankTexture } from './kit.js';

const onGround = (x, z, lift = 0) => V(x, heightAt(x, z) + lift, z);
const DISPLAY = '"Big Shoulders Display", Impact, "Arial Narrow", sans-serif';

/** Wood-burned sign face drawn on a canvas; redrawn once web fonts arrive. */
function signTexture(w, h, drawText) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    const g = canvas.getContext('2d');
    g.fillStyle = '#6a4630';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(30, 14, 6, 0.22)';
    g.lineWidth = 3;
    for (let y = 10; y < h; y += 19) {
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y - 7, w * 0.65, y + 9, w, y - 2);
      g.stroke();
    }
    g.strokeStyle = '#f1dfbd';
    g.lineWidth = Math.max(6, h * 0.04);
    g.strokeRect(h * 0.08, h * 0.08, w - h * 0.16, h - h * 0.16);
    g.fillStyle = '#f1dfbd';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    drawText(g);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.ready.then(draw);
  return tex;
}

/** Sets a display font, shrinking it until `text` fits in `maxWidth`. */
function fitText(c, text, weight, size, maxWidth, spacing = 0) {
  if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
  c.font = `${weight} ${size}px ${DISPLAY}`;
  const w = c.measureText(text).width;
  if (w > maxWidth) c.font = `${weight} ${Math.floor(size * (maxWidth / w))}px ${DISPLAY}`;
}

function signBoard(w, h, depth, tex, wood) {
  const face = new THREE.MeshLambertMaterial({ map: tex });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [wood, wood, wood, wood, face, face]);
  board.castShadow = true;
  return board;
}

// --- ranch gate and split-rail fence ----------------------------------------------------
export function createGate(ranchName) {
  const g = new THREE.Group();
  const wood = flatMat('#5e3f2b');
  const half = 4.6;
  const hL = heightAt(GATE.x - half, GATE.z), hR = heightAt(GATE.x + half, GATE.z);
  const top = Math.max(hL, hR) + 6.4;
  for (const [s, h] of [[-1, hL], [1, hR]]) {
    const x = GATE.x + s * half;
    g.add(box(0.55, top + 0.3 - (h - 1), 0.55, wood, x, (top + 0.3 + h - 1) / 2, GATE.z));
    g.add(beam(V(x, top - 1.5, GATE.z), V(x - s * 1.3, top, GATE.z), 0.12, wood));
  }
  g.add(box(11.6, 0.5, 0.55, wood, GATE.x, top, GATE.z));

  const tex = signTexture(1024, 220, (c) => {
    const text = ranchName.toUpperCase();
    fitText(c, text, 900, 124, 1024 - 120, 12);
    c.fillText(text, 512, 118);
  });
  const pivot = new THREE.Group();
  pivot.position.set(GATE.x, top - 0.25, GATE.z);
  const iron = flatMat('#2b2a2c');
  for (const x of [-2.4, 2.4]) pivot.add(beam(V(x, 0, 0), V(x, -0.62, 0), 0.03, iron, 4));
  const board = signBoard(6.2, 1.34, 0.14, tex, wood);
  board.position.y = -1.29;
  pivot.add(board);
  g.add(pivot);

  // split-rail fence running off both sides
  for (const s of [-1, 1]) {
    let prev = null;
    for (let i = 0; i <= 5; i++) {
      const x = GATE.x + s * (half + 0.3 + i * 3.1);
      const z = GATE.z + Math.sin(i * 1.3) * 0.35;
      const base = onGround(x, z);
      g.add(box(0.22, 1.6, 0.22, wood, x, base.y + 0.45, z));
      if (prev) {
        for (const h of [0.55, 1.05]) g.add(beam(prev.clone().setY(prev.y + h), base.clone().setY(base.y + h), 0.07, wood, 5));
      }
      prev = base;
    }
  }
  return {
    object: g,
    tick(t) { pivot.rotation.x = Math.sin(t * 0.9) * 0.035; },
  };
}

// --- site number posts ----------------------------------------------------------------
export function createSitePosts() {
  const g = new THREE.Group();
  const wood = flatMat('#5e3f2b');
  for (const [label, x, z] of [['01', 12.9, -2.3], ['02', -4.8, 9.5]]) {
    const tex = signTexture(256, 180, (c) => {
      fitText(c, 'SITE', 800, 30, 180, 6);
      c.fillText('SITE', 128, 52);
      fitText(c, label, 900, 96, 180);
      c.fillText(label, 128, 118);
    });
    const post = new THREE.Group();
    post.position.copy(onGround(x, z));
    post.rotation.y = Math.atan2(0 - x, 58 - z);
    post.add(box(0.2, 1.6, 0.2, wood, 0, 0.5, 0));
    const plate = signBoard(0.66, 0.46, 0.07, tex, wood);
    plate.position.set(0, 1.12, 0.14);
    post.add(plate);
    g.add(post);
  }
  return { object: g };
}

// --- the A-frame's bath house: a little plank-sided shed, like the real one ----------------
function restroomSign() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f1ea';
  g.beginPath();
  g.roundRect(4, 4, 88, 88, 10);
  g.fill();
  g.fillStyle = '#1f1f22';
  g.fillRect(47, 16, 2, 64);
  for (const [cx, skirt] of [[27, false], [69, true]]) {
    g.beginPath();
    g.arc(cx, 25, 6, 0, Math.PI * 2);
    g.fill();
    if (skirt) {
      g.beginPath();
      g.moveTo(cx - 5, 34);
      g.lineTo(cx + 5, 34);
      g.lineTo(cx + 11, 60);
      g.lineTo(cx - 11, 60);
      g.fill();
    } else {
      g.fillRect(cx - 8, 34, 16, 26);
    }
    g.fillRect(cx - 6, 60, 4, 18);
    g.fillRect(cx + 2, 60, 4, 18);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBathhouse() {
  const g = new THREE.Group();
  const w = 2.5, d = 2.5, base = 0.3, eave = 2.45, peak = 3.2, over = 0.18;
  const wallH = eave - base;

  const planks = plankTexture(14, 11);
  planks.repeat.set(1, 1);
  const siding = new THREE.MeshLambertMaterial({ map: planks });
  g.add(box(w, wallH, d, siding, 0, base + wallH / 2, 0));

  // gable ends share the plank scale (shape UVs are in metres)
  const gablePlanks = plankTexture(14, 23);
  gablePlanks.repeat.set(1 / w, 1 / wallH);
  const gable = new THREE.Shape([V2(-w / 2, 0), V2(w / 2, 0), V2(0, peak - eave)]);
  for (const [z, flip] of [[d / 2, false], [-d / 2, true]]) {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshLambertMaterial({ map: gablePlanks, side: THREE.DoubleSide }));
    m.position.set(0, eave, z);
    if (flip) m.rotation.y = Math.PI;
    g.add(m);
  }

  // dark metal roof, ridge running front to back
  const roofMat = flatMat('#3d4146');
  const pitch = Math.atan2(peak - eave, w / 2);
  const slabLen = Math.hypot(w / 2, peak - eave) + over;
  for (const s of [-1, 1]) {
    const slab = box(slabLen, 0.08, d + over * 2, roofMat);
    slab.position.set(s * (w / 4 + over / 2 - 0.04), eave + (peak - eave) / 2 + 0.03, 0);
    slab.rotation.z = -s * pitch;
    g.add(slab);
  }

  // skirt of vertical boards, corner boards, door trim
  const skirt = new THREE.MeshLambertMaterial({
    color: '#ffffff', map: stripeTexture('#8a6a45', '#6c5134', { repeat: [22, 1], lineWidth: 0.14 }),
  });
  g.add(box(w + 0.05, base, d + 0.05, skirt, 0, base / 2, 0));
  const trim = flatMat('#9b7a50');
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) g.add(box(0.1, wallH, 0.1, trim, x, base + wallH / 2, z));

  const doorW = 0.86, doorH = 1.98, fz = d / 2;
  for (const x of [-(doorW / 2 + 0.07), doorW / 2 + 0.07]) g.add(box(0.12, doorH + 0.08, 0.05, trim, x, base + doorH / 2, fz + 0.02));
  g.add(box(doorW + 0.26, 0.1, 0.05, trim, 0, base + doorH + 0.06, fz + 0.02));
  const doorWood = flatMat('#5b3b27');
  g.add(box(doorW, doorH, 0.05, doorWood, 0, base + doorH / 2, fz + 0.02));
  const panel = flatMat('#4a2f1f');
  for (const y of [0.35, 1.0, 1.62]) {
    for (const x of [-0.2, 0.2]) g.add(box(0.28, y === 1.0 ? 0.62 : 0.46, 0.02, panel, x, base + y, fz + 0.05));
  }
  const hardware = flatMat('#1c1c1e');
  for (const y of [0.98, 1.12]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), hardware);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(0.32, base + y, fz + 0.08);
    g.add(knob);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshLambertMaterial({ map: restroomSign() }));
  sign.position.set(0, base + 1.5, fz + 0.061);
  g.add(sign);
  g.add(box(0.6, 0.02, 0.06, hardware, 0, base + 0.06, fz + 0.06)); // kick plate

  // lantern above the door and a round vent up in the gable
  const lamp = glowMat('#ffd79a', '#1f1d1f');
  g.add(box(0.13, 0.2, 0.12, lamp, 0, eave + 0.2, fz + 0.08));
  g.add(box(0.17, 0.04, 0.16, hardware, 0, eave + 0.32, fz + 0.08));
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), flatMat('#c9c6bf'));
  vent.rotation.x = Math.PI / 2;
  vent.position.set(0, peak - 0.3, fz + 0.02);
  g.add(vent);

  // concrete step with a wooden top
  g.add(box(0.95, 0.24, 0.55, flatMat('#b3afa8'), 0, 0.12, fz + 0.32));
  g.add(box(0.97, 0.06, 0.57, flatMat('#a4845a'), 0, 0.27, fz + 0.32));

  const light = new THREE.PointLight('#ffc98a', 0, 8, 2);
  light.position.set(0, eave, fz + 0.9);
  g.add(light);

  g.position.set(BATH.x, BATH.y, BATH.z);
  g.rotation.y = BATH.rot;
  return {
    object: g,
    update(p) {
      lamp.emissiveIntensity = p.night * 2.4;
      light.intensity = p.night * 5;
    },
  };
}

// --- dashed selection ring hugging the ground around a stay ----------------------------------
export function createSiteRing(id, radius = 8.2, [ox, oz] = [0, 0]) {
  const s = SITES[id];
  const cx = s.x + ox * Math.cos(s.rot) + oz * Math.sin(s.rot);
  const cz = s.z - ox * Math.sin(s.rot) + oz * Math.cos(s.rot);
  const dashes = 48, perDash = 4, width = 0.32;
  const pos = [];
  for (let dsh = 0; dsh < dashes; dsh++) {
    for (let k = 0; k < perDash; k++) {
      const a0 = ((dsh + (k / perDash) * 0.6) / dashes) * Math.PI * 2;
      const a1 = ((dsh + ((k + 1) / perDash) * 0.6) / dashes) * Math.PI * 2;
      const quad = [[a0, radius - width], [a0, radius + width], [a1, radius - width], [a1, radius + width]]
        .map(([a, r]) => {
          const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          return [x, heightAt(x, z) + 0.07, z];
        });
      pos.push(...quad[0], ...quad[1], ...quad[2], ...quad[1], ...quad[3], ...quad[2]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.MeshBasicMaterial({
    color: '#fff1cf', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  let level = 0;
  return {
    object: mesh,
    target: 0,
    tick(t, dt) {
      level += (this.target - level) * Math.min(1, dt * 6);
      mat.opacity = level * (0.75 + 0.25 * Math.sin(t * 3));
      mesh.visible = level > 0.01;
    },
  };
}
