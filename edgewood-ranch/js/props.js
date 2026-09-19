// The old truck, the fence, site posts, the bath house and the selection rings.
import * as THREE from 'three';
import { SITES, BATH, TRUCK, FENCE, heightAt, mulberry32 } from './world.js';
import {
  V, V2, box, beam, flatMat, glowMat, stripeTexture, plankTexture, snowy, stringLights, pumpkin, wreath, XMAS,
} from './kit.js';

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

// --- the old stake-bed truck, parked in the grass on the right as you come in ----------------------
// The ranch's early-1950s Chevrolet: paint faded to lime on top and rusting through, a five-bar
// grille with the headlamps out in the fenders, the bumper long gone, rusty duals, and a wooden
// grain bed with red-painted stakes and a tall headboard. Its nose faces +z, driver's side +x.
function sideProfile(points, depth, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([z, y]) => V2(z, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4,
  });
  geo.rotateY(-Math.PI / 2); // drawn in the z-y plane, extruded toward -x
  return geo;
}

/** Seventy years of weather on green paint: lime where the sun bleached it, rust coming through. */
function patinaTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#6b8d52';
  g.fillRect(0, 0, size, size);
  const rng = mulberry32(8);
  /** A soft-edged spot, drawn wrapped round the edges so the texture tiles. */
  const spot = (x, y, r, [red, green, blue], alpha, hard = 0) => {
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        grad.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
        grad.addColorStop(hard, `rgba(${red}, ${green}, ${blue}, ${alpha})`);
        grad.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`);
        g.fillStyle = grad;
        g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  };
  for (let i = 0; i < 8; i++) spot(rng() * size, rng() * size, 40 + rng() * 40, [146, 176, 92], 0.35); // sun-faded lime
  for (let i = 0; i < 6; i++) spot(rng() * size, rng() * size, 30 + rng() * 30, [62, 92, 52], 0.3); // held its colour
  // rust breaking through in small patches
  for (let i = 0; i < 8; i++) {
    const cx = rng() * size, cy = rng() * size;
    for (let k = 0, n = 4 + Math.floor(rng() * 5); k < n; k++) {
      spot(cx + (rng() - 0.5) * 30, cy + (rng() - 0.5) * 22, 3 + rng() * 8, [138, 84, 46], 0.85, 0.6);
    }
  }
  for (let i = 0; i < 4; i++) spot(rng() * size, rng() * size, 5 + rng() * 5, [205, 200, 180], 0.5); // chalky primer
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.35, 0.35); // the paint's uvs are in metres
  return tex;
}

export function createTruck() {
  const g = new THREE.Group();
  const patina = patinaTexture();
  const paint = snowy(new THREE.MeshLambertMaterial({ map: patina, flatShading: true }));
  const fenderPaint = snowy(new THREE.MeshLambertMaterial({ map: patina, color: '#b6c4ad', flatShading: true }));
  const grilleGreen = flatMat('#5a7f45');
  const rust = flatMat('#7a4a2c');
  const redPaint = snowy(flatMat('#8e3b2b'));
  const chrome = flatMat('#c9c5bb');
  const dark = flatMat('#262320');
  const glass = flatMat('#1f2a30');
  const rubber = flatMat('#1f1e1d');
  const woods = ['#8f7a64', '#86705b', '#958069'].map((c) => snowy(flatMat(c)));
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // wheels: singles up front, duals under the bed, on rusty steel rims
  const FRONT = 1.95, REAR = -2.55;
  const tire = new THREE.CylinderGeometry(0.47, 0.47, 0.28, 12).rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.09, 0.12, 0.36, 8).rotateZ(Math.PI / 2);
  for (const [x, z] of [[0.86, FRONT], [-0.86, FRONT], [0.7, REAR], [0.99, REAR], [-0.7, REAR], [-0.99, REAR]]) {
    mesh(tire, rubber, x, 0.45, z);
    if (Math.abs(x) === 0.7) continue; // the inner duals are hidden
    mesh(rim, rust, x, 0.45, z);
    mesh(hub, dark, x + Math.sign(x) * 0.02, 0.45, z);
  }
  g.add(box(0.12, 0.2, 6.5, rust, 0.45, 0.66, -0.65), box(0.12, 0.2, 6.5, rust, -0.45, 0.66, -0.65));

  // front fenders sweep down into the running boards
  const arch = [];
  for (let a = 12; a <= 168; a += 26) {
    const r = THREE.MathUtils.degToRad(a);
    arch.push([FRONT + Math.cos(r) * 0.6, 0.45 + Math.sin(r) * 0.6]);
  }
  const fender = sideProfile([
    [0.98, 0.64], [1.05, 0.9], [1.28, 1.13], [1.62, 1.27], [2.02, 1.3], [2.42, 1.23], [2.76, 1.06],
    [2.97, 0.86], [3.0, 0.68], [2.62, 0.66], ...arch, [1.3, 0.64],
  ], 0.36);
  mesh(fender, fenderPaint, 1.05, 0, 0);
  mesh(fender, fenderPaint, -0.69, 0, 0);
  for (const s of [-1, 1]) g.add(box(0.3, 0.06, 1.5, rust, s * 0.95, 0.62, 0.26));

  // the long rounded hood, its emblem, and the five-bar grille painted to match
  const hoodShape = new THREE.Shape([
    [-0.56, 0.92], [0.56, 0.92], [0.56, 1.3], [0.47, 1.44], [0.25, 1.52], [-0.25, 1.52], [-0.47, 1.44], [-0.56, 1.3],
  ].map(([x, y]) => V2(x, y)));
  mesh(new THREE.ExtrudeGeometry(hoodShape, {
    depth: 1.8, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1,
  }), paint, 0, 0, 0.98);
  g.add(box(0.22, 0.07, 0.08, flatMat('#9a6a42'), 0, 1.42, 2.83));
  g.add(box(0.98, 0.56, 0.05, dark, 0, 1.06, 2.81));
  [0.92, 1.02, 1.06, 1.06, 1.0].forEach((w, i) => g.add(box(w, 0.075, 0.08, grilleGreen, 0, 0.84 + i * 0.11, 2.85)));
  const lamp = new THREE.CylinderGeometry(0.15, 0.15, 0.14, 10).rotateX(Math.PI / 2);
  const ring = new THREE.CylinderGeometry(0.135, 0.135, 0.03, 10).rotateX(Math.PI / 2);
  const lens = new THREE.CylinderGeometry(0.11, 0.11, 0.035, 10).rotateX(Math.PI / 2);
  for (const s of [-1, 1]) {
    mesh(lamp, fenderPaint, s * 0.87, 1.16, 2.74);
    mesh(ring, chrome, s * 0.87, 1.16, 2.81);
    mesh(lens, flatMat('#e7e2d3'), s * 0.87, 1.16, 2.82);
  }
  // no bumper any more, just its brackets, one bent down
  for (const s of [-1, 1]) g.add(beam(V(s * 0.45, 0.64, 2.62), V(s * 0.5, 0.56, 3.32), 0.035, rust, 4));
  g.add(beam(V(0.5, 0.56, 3.32), V(0.74, 0.3, 3.46), 0.03, rust, 4), box(0.26, 0.08, 0.05, rust, -0.54, 0.54, 3.34));

  // cab: rounded roof, split windshield, a window each side and a small one at the back
  mesh(sideProfile([
    [-0.42, 0.88], [0.98, 0.88], [0.98, 1.56], [0.72, 2.18], [0.52, 2.3], [-0.12, 2.32], [-0.36, 2.22], [-0.42, 2.02],
  ], 1.66), paint, 0.83, 0, 0);
  for (const s of [-1, 1]) {
    const pane = box(0.68, 0.44, 0.03, glass, s * 0.37, 1.92, 0.9);
    pane.rotation.x = -0.37;
    g.add(pane);
    g.add(box(0.02, 0.48, 0.74, glass, s * 0.885, 1.87, 0.24));
    g.add(box(0.03, 0.05, 0.16, chrome, s * 0.89, 1.5, -0.14)); // door handle
  }
  g.add(box(0.9, 0.34, 0.02, glass, 0, 1.93, -0.48));

  // the grain bed: plank sides with red stakes and top rails, and a tall headboard behind the cab
  const L = 3.35, Z0 = -0.56, ZM = Z0 - L / 2, Z1 = Z0 - L;
  g.add(box(2.1, 0.2, L, rust, 0, 0.93, ZM));
  g.add(box(2.16, 0.1, L, woods[0], 0, 1.09, ZM));
  for (const s of [-1, 1]) {
    [1.27, 1.53, 1.79].forEach((y, i) => g.add(box(0.06, 0.24, L, woods[i], s * 1.08, y, ZM)));
    g.add(box(0.1, 0.07, L + 0.04, redPaint, s * 1.08, 1.945, ZM));
    for (let i = 0; i < 5; i++) g.add(box(0.1, 0.9, 0.08, redPaint, s * 1.12, 1.5, Z0 - 0.1 - i * ((L - 0.18) / 4)));
    g.add(box(0.1, 0.08, 0.04, flatMat('#9e2a22'), s * 0.95, 0.92, Z1 - 0.05)); // tail light
  }
  [1.27, 1.53, 1.79].forEach((y, i) => g.add(box(2.16, 0.24, 0.06, woods[(i + 1) % 3], 0, y, Z1)));
  g.add(box(2.2, 0.07, 0.1, redPaint, 0, 1.945, Z1));
  [1.27, 1.53, 1.79, 2.05, 2.31].forEach((y, i) => g.add(box(2.16, 0.24, 0.07, woods[i % 3], 0, y, Z0)));
  g.add(box(2.22, 0.06, 0.16, flatMat('#6f6a62'), 0, 2.46, Z0));
  for (const s of [-1, 1]) g.add(box(0.1, 1.38, 0.1, flatMat('#6f6a62'), s * 1.08, 1.76, Z0));

  // grass grown up round the tires
  const tuft = new THREE.ConeGeometry(0.1, 0.42, 4);
  const grass = snowy(flatMat('#9c9446'));
  const rng = mulberry32(5);
  for (const [x, z] of [[0.86, FRONT], [-0.86, FRONT], [0.85, REAR], [-0.85, REAR]]) {
    for (let i = 0; i < 5; i++) {
      const a = rng() * Math.PI * 2;
      const t = mesh(tuft, grass, x + Math.cos(a) * 0.42, 0.14, z + Math.sin(a) * 0.5);
      t.scale.setScalar(0.7 + rng() * 0.6);
      t.rotation.z = (rng() - 0.5) * 0.5;
    }
  }

  // holidays: a wreath on the grille and lights round the bed's rails at Christmas; a hay bale
  // and pumpkins in the bed in the fall
  const christmas = new THREE.Group();
  const rails = stringLights(
    [V(1.15, 1.99, Z0 - 0.05), V(1.15, 1.99, Z1 - 0.02), V(-1.15, 1.99, Z1 - 0.02), V(-1.15, 1.99, Z0 - 0.05)],
    { sag: 0.1, spacing: 0.34, bulb: 0.06, colors: XMAS },
  );
  const grilleWreath = wreath(0.3);
  grilleWreath.position.set(0, 1.06, 2.92);
  christmas.add(rails.object, grilleWreath);
  const fall = new THREE.Group();
  const bale = box(1.1, 0.52, 0.62, flatMat('#cfa653'), -0.35, 1.4, -1.7);
  bale.rotation.y = 0.2;
  fall.add(bale);
  for (const [x, y, z, size, color] of [
    [0.55, 1.14, -2.6, 0.26, '#d9772b'], [0.1, 1.14, -3.0, 0.17, '#e9ddc5'], [-0.55, 1.66, -1.65, 0.19, '#c96a26'],
    [1.25, 0, 2.45, 0.3, '#d9772b'], [1.45, 0, 1.8, 0.18, '#8f9c6a'],
  ]) {
    const p = pumpkin(size, color);
    p.position.set(x, y, z);
    p.rotation.y = x * 2.1 + z;
    fall.add(p);
  }
  christmas.visible = fall.visible = false;
  g.add(christmas, fall);

  // settled into the grass after years parked
  g.position.set(TRUCK.x, TRUCK.y - 0.06, TRUCK.z);
  g.rotation.set(0, TRUCK.rot, 0.018);
  return {
    object: g,
    update(p) { rails.setNight(p.night); },
    setHolidays(h) {
      christmas.visible = Boolean(h.christmas);
      fall.visible = Boolean(h.fall);
    },
  };
}

// --- the post-and-rail fence along the north line -------------------------------------------------
export function createFence() {
  const wood = snowy(flatMat('#86735f'));
  const rng = mulberry32(17);
  const ground = FENCE.map(([x, z]) => V(x, heightAt(x, z), z));
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 6), wood, ground.length);
  const RAILS = [0.5, 1.0];
  const rails = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 1, 5), wood, (ground.length - 1) * RAILS.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V(1, 1, 1);
  const UP = V(0, 1, 0), dir = V(0, 0, 0), mid = V(0, 0, 0);
  ground.forEach((p, i) => {
    e.set((rng() - 0.5) * 0.06, rng() * 3, (rng() - 0.5) * 0.06); // weathered, not quite plumb
    m.compose(V(p.x, p.y + 0.5, p.z), q.setFromEuler(e), s.set(1, 1, 1));
    posts.setMatrixAt(i, m);
  });
  let k = 0;
  for (let i = 1; i < ground.length; i++) {
    for (const h of RAILS) {
      const a = ground[i - 1].clone().setY(ground[i - 1].y + h), b = ground[i].clone().setY(ground[i].y + h);
      dir.subVectors(b, a);
      mid.copy(a).addScaledVector(dir, 0.5);
      q.setFromUnitVectors(UP, dir.clone().normalize());
      m.compose(mid, q, s.set(1, dir.length() + 0.2, 1));
      rails.setMatrixAt(k++, m);
    }
  }
  const g = new THREE.Group();
  for (const im of [posts, rails]) {
    im.castShadow = im.receiveShadow = true;
    g.add(im);
  }
  return { object: g };
}

// --- site number posts ----------------------------------------------------------------
export function createSitePosts() {
  const g = new THREE.Group();
  const wood = flatMat('#5e3f2b');
  for (const [label, x, z] of [['01', 11.6, -2.6], ['02', -8, 13]]) {
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
  const roofMat = snowy(flatMat('#3d4146'));
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

  // holidays: lights along the front gable and a wreath round the sign; pumpkins by the step
  const christmas = new THREE.Group();
  const ez = fz + over + 0.04;
  const gableLights = stringLights(
    [V(-w / 2 - 0.2, eave - 0.04, ez), V(0, peak + 0.12, ez), V(w / 2 + 0.2, eave - 0.04, ez)],
    { sag: 0.02, spacing: 0.3, bulb: 0.05, colors: XMAS },
  );
  const doorWreath = wreath(0.21);
  doorWreath.position.set(0, base + 1.5, fz + 0.13);
  christmas.add(gableLights.object, doorWreath);
  const fall = new THREE.Group();
  for (const [x, z, size, color] of [[0.66, fz + 0.52, 0.22, '#d9772b'], [0.86, fz + 0.2, 0.15, '#e9ddc5']]) {
    const p = pumpkin(size, color);
    p.position.set(x, 0, z);
    fall.add(p);
  }
  christmas.visible = fall.visible = false;
  g.add(christmas, fall);

  g.position.set(BATH.x, BATH.y, BATH.z);
  g.rotation.y = BATH.rot;
  return {
    object: g,
    update(p) {
      lamp.emissiveIntensity = p.night * 2.4;
      light.intensity = p.night * 5;
      gableLights.setNight(p.night);
    },
    setHolidays(h) {
      christmas.visible = Boolean(h.christmas);
      fall.visible = Boolean(h.fall);
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
