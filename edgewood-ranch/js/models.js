// The A-Frame: the real tall glass-front cabin, repainted in the Firewatch palette
// (weathered teal metal, warm cedar, painted glass). Faces +z locally; the round hot
// tub sits off the deck, under the pines on its right.
import * as THREE from 'three';
import { placeOnSite } from './world.js';
import {
  V, V2, box, beam, flatMat, glassMat, glowMat, stripeTexture, flameRow, slingChair,
  stringLights, lantern, pineTree, paintedGlassTexture, wisps,
} from './kit.js';

export function createAFrame() {
  const g = new THREE.Group();
  const W = 2.55, H = 6.0, D = 5.4, F = 0.95; // half-width, peak above deck, depth, deck height
  const slope = Math.atan2(H, W);
  const sin = Math.sin(slope), cos = Math.cos(slope);
  const len = Math.hypot(W, H);
  const halfAt = (y, inset = 0.2) => (W - inset) * (1 - y / H);

  const metal = new THREE.MeshLambertMaterial({
    color: '#ffffff',
    map: stripeTexture('#40535a', '#314249', { repeat: [1, (D + 0.7) / 0.16], vertical: false, lineWidth: 0.35 }),
  });
  const cedar = flatMat('#b87440'), ply = flatMat('#dcbd8c'), iron = flatMat('#2a2d31');
  const glassTex = paintedGlassTexture();
  glassTex.repeat.set(1 / (halfAt(0) * 2), 1 / (H - 0.35));
  glassTex.offset.set(0.5, 0);
  const glass = new THREE.MeshLambertMaterial({
    map: glassTex, transparent: true, opacity: 0.82, side: THREE.DoubleSide,
    emissive: '#ffb35c', emissiveIntensity: 0,
  });
  const lamp = glowMat('#fff0d0', '#d9d4c8');

  // --- the A: metal skin, plywood lining, cedar trim on the front edges ---------------
  // Each slab is laid along a rafter line and pushed `offset` along its outward normal.
  const slab = (s, mat, length, thickness, depth, offset, z = 0) => {
    const m = box(length, thickness, depth, mat);
    m.position.set(s * (W / 2 + sin * offset), F + H / 2 + cos * offset, z);
    m.rotation.z = -s * slope;
    return m;
  };
  for (const s of [-1, 1]) {
    g.add(slab(s, metal, len + 0.45, 0.16, D + 0.7, 0.08));
    g.add(slab(s, ply, len - 0.3, 0.05, D - 0.1, -0.03));
    g.add(slab(s, cedar, len - 0.1, 0.24, 0.3, -0.12, D / 2 + 0.12));
  }
  g.add(box(0.34, 0.2, D + 0.75, iron, 0, F + H + 0.1, 0));

  // --- glass gable ---------------------------------------------------------------------
  const hy = 2.35, gz = D / 2 - 0.05;
  const pane = new THREE.Mesh(
    new THREE.ShapeGeometry(new THREE.Shape([V2(-halfAt(0), 0), V2(halfAt(0), 0), V2(0, H - 0.35)])),
    glass,
  );
  pane.position.set(0, F, gz);
  g.add(pane);
  g.add(box(halfAt(hy) * 2 + 0.1, 0.16, 0.16, iron, 0, F + hy, gz + 0.03));
  g.add(box(0.08, H - hy - 0.55, 0.1, iron, 0, F + (hy + H - 0.55) / 2, gz + 0.03));
  g.add(box(halfAt(0) * 2, 0.1, 0.18, iron, 0, F + 0.05, gz + 0.02));
  g.add(box(0.05, hy, 0.06, iron, 0, F + hy / 2, gz + 0.03));
  for (const x of [-1.2, 1.2]) {
    g.add(box(0.14, hy, 0.18, iron, x, F + hy / 2, gz + 0.03));
    const light = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 10), lamp);
    light.rotation.x = Math.PI / 2;
    light.position.set(x, F + hy + 0.16, gz + 0.14);
    g.add(light);
  }

  // back gable: dark outside, plywood inside, a small window above the loft
  const backShape = new THREE.Shape([V2(-halfAt(0, 0.1), 0), V2(halfAt(0, 0.1), 0), V2(0, H - 0.2)]);
  const back = new THREE.Mesh(
    new THREE.ExtrudeGeometry(backShape, { depth: 0.1, bevelEnabled: false }),
    flatMat('#34454b'),
  );
  back.position.set(0, F, -D / 2);
  back.castShadow = true;
  const backInside = new THREE.Mesh(new THREE.ShapeGeometry(backShape), ply);
  backInside.position.set(0, F, -D / 2 + 0.11);
  g.add(back, backInside, box(0.6, 0.5, 0.16, glassMat(), 0, F + 3.45, -D / 2 + 0.05));

  // --- interior, glimpsed through the glass ------------------------------------------------
  g.add(box(W * 2 - 0.3, 0.06, D - 0.4, ply, 0, F + 0.03, 0));
  const loftY = 2.45, loftDepth = 2.5;
  g.add(box(halfAt(loftY, 0.25) * 2, 0.12, loftDepth, ply, 0, F + loftY, -D / 2 + loftDepth / 2 + 0.1));
  g.add(box(1.25, 0.22, 1.9, flatMat('#8a6a52'), 0, F + loftY + 0.17, -D / 2 + 1.2));
  for (const x of [-0.3, 0.3]) g.add(box(0.5, 0.16, 0.26, flatMat('#f1ede4'), x, F + loftY + 0.36, -D / 2 + 0.4));
  const ladderWood = flatMat('#c89a62');
  for (const x of [0.32, 0.78]) g.add(beam(V(x, F, 0.95), V(x, F + loftY + 0.1, -0.08), 0.035, ladderWood, 4));
  for (let i = 1; i <= 7; i++) {
    const k = i / 8;
    g.add(box(0.46, 0.04, 0.08, ladderWood, 0.55, F + k * (loftY + 0.1), 0.95 - k * 1.03));
  }
  const sofa = flatMat('#cac6bf');
  g.add(box(0.85, 0.42, 1.55, sofa, -1.35, F + 0.21, 0.75));
  g.add(box(0.22, 0.5, 1.55, sofa, -1.71, F + 0.62, 0.75));
  for (const z of [0.3, 1.2]) g.add(box(0.14, 0.32, 0.36, flatMat('#4f5e3f'), -1.51, F + 0.6, z));
  // movie night: the projector throws a picture onto the back wall under the loft
  const movie = new THREE.MeshLambertMaterial({ color: '#dcbd8c', emissive: '#9fb8ff', emissiveIntensity: 0 });
  g.add(box(1.25, 0.7, 0.02, movie, 0, F + 1.3, -D / 2 + 0.16));

  // --- raised deck with cable railing and front steps -----------------------------------------
  const dx0 = -4.5, dx1 = 4.5, dz0 = -3.5, dz1 = 6.0;
  const dw = dx1 - dx0, dd = dz1 - dz0, dcz = (dz0 + dz1) / 2;
  const boards = new THREE.MeshLambertMaterial({
    color: '#ffffff', map: stripeTexture('#8a5a38', '#744a2d', { repeat: [1, dd / 0.14], vertical: false, lineWidth: 0.12 }),
  });
  g.add(box(dw, 0.12, dd, boards, 0, F - 0.06, dcz));
  const skirt = new THREE.MeshLambertMaterial({
    color: '#ffffff', map: stripeTexture('#5d3c28', '#4a2f1f', { repeat: [1, (F + 0.5) / 0.18], vertical: false, lineWidth: 0.12 }),
  });
  g.add(box(dw - 0.2, F + 0.5, dd - 0.2, skirt, 0, (F - 0.12 - 0.62) / 2, dcz));

  const post = flatMat('#6b4429');
  const stairHalf = 0.95;
  const runs = [
    [[dx0, dz0], [dx1, dz0]],
    [[dx1, dz0], [dx1, dz1]],
    [[dx1, dz1], [stairHalf, dz1]],
    [[-stairHalf, dz1], [dx0, dz1]],
    [[dx0, dz1], [dx0, dz0]],
  ];
  const cablePts = [];
  for (const [[ax, az], [bx, bz]] of runs) {
    const runLen = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(runLen / 1.6));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      g.add(box(0.12, 1.05, 0.12, post, ax + (bx - ax) * t, F + 0.5, az + (bz - az) * t));
    }
    const alongZ = ax === bx;
    g.add(box(alongZ ? 0.18 : runLen, 0.08, alongZ ? runLen : 0.18, post, (ax + bx) / 2, F + 1.02, (az + bz) / 2));
    for (const h of [0.3, 0.55, 0.8]) cablePts.push(V(ax, F + h, az), V(bx, F + h, bz));
  }
  // dark, half-transparent cables so the wood posts carry the look
  g.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(cablePts),
    new THREE.LineBasicMaterial({ color: '#4b3d33', transparent: true, opacity: 0.55 }),
  ));

  const steps = 5, rise = F / steps, run = 0.3;
  for (let i = 0; i < steps; i++) {
    const top = F - rise * (i + 1);
    const tread = i % 2 ? post : boards;
    g.add(box(stairHalf * 2, top + 0.04, run, tread, 0, (top + 0.04) / 2 - 0.02, dz1 + run * (i + 0.5)));
  }
  for (const x of [-stairHalf, stairHalf]) {
    g.add(beam(V(x, F + 0.95, dz1), V(x, 0.95, dz1 + run * steps), 0.035, post, 4));
  }

  // café lights along the front rail, lanterns on the stair posts
  const railTop = F + 1.1;
  const deckLights = stringLights([V(dx0, railTop, dz1), V(-stairHalf, railTop, dz1)], { sag: 0.14, spacing: 0.45, bulb: 0.045 });
  const deckLights2 = stringLights([V(stairHalf, railTop, dz1), V(dx1, railTop, dz1), V(dx1, railTop, 1.2)], { sag: 0.14, spacing: 0.45, bulb: 0.045 });
  g.add(deckLights.object, deckLights2.object);
  const lanternGlow = glowMat('#ffb65c', '#4a3a28');
  for (const x of [-stairHalf, stairHalf]) {
    const l = lantern(lanternGlow);
    l.scale.setScalar(0.8);
    l.position.set(x, F + 1.03, dz1);
    g.add(l);
  }

  // --- on the deck: the right side holds the grill, a little table and two chairs; the fire
  // table sits in the front-right corner and a telescope in the front-left one -----------------
  const fireTable = new THREE.Group();
  fireTable.add(box(0.95, 0.55, 0.95, flatMat('#2b2a2c'), 0, 0.275, 0));
  fireTable.add(box(0.6, 0.02, 0.6, flatMat('#5f6778'), 0, 0.56, 0));
  const flames = flameRow(4, 0.34);
  flames.object.position.y = 0.56;
  const fireLight = new THREE.PointLight('#ff9a4a', 0, 10, 2);
  fireLight.position.y = 1.2;
  fireTable.add(flames.object, fireLight);
  fireTable.position.set(3.25, F, 4.75);
  g.add(fireTable);
  const chairAt = (x, z, lookX, lookZ) => {
    const chair = slingChair('#2a2826', '#34302d');
    chair.position.set(x, F, z);
    chair.rotation.y = Math.atan2(lookX - x, lookZ - z);
    g.add(chair);
  };

  const grill = new THREE.Group();
  const black = flatMat('#1f2023');
  grill.add(box(0.9, 0.34, 0.55, black, 0, 0.82, 0));
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.9, 8, 1, false, 0, Math.PI), black);
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.99;
  grill.add(lid, box(0.36, 0.04, 0.45, flatMat('#4a4c52'), 0.66, 0.9, 0));
  for (const x of [-0.38, 0.38]) for (const z of [-0.22, 0.22]) grill.add(box(0.04, 0.66, 0.04, black, x, 0.33, z));
  grill.position.set(3.75, F, -2.45);
  grill.rotation.y = -Math.PI / 2;
  g.add(grill);

  const sideTable = new THREE.Group();
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 16), flatMat('#23272b'));
  tableTop.position.y = 0.66;
  sideTable.add(tableTop);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    sideTable.add(beam(V(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26), V(Math.cos(a) * 0.12, 0.65, Math.sin(a) * 0.12), 0.015, black, 4));
  }
  sideTable.position.set(3.7, F, 0.3);
  g.add(sideTable);
  chairAt(3.7, -0.65, 3.7, 0.3);
  chairAt(3.7, 1.25, 3.7, 0.3);

  const scope = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    scope.add(beam(V(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4), V(0, 1.02, 0), 0.02, black, 4));
  }
  scope.add(box(0.12, 0.14, 0.12, black, 0, 1.08, 0));
  const tubeArm = new THREE.Group();
  tubeArm.position.y = 1.18;
  tubeArm.rotation.z = 0.95; // aimed up at the sky
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 1.05, 10), flatMat('#e9e5dc'));
  tube.position.y = 0.18;
  tube.castShadow = true;
  const dewCap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 10), black);
  dewCap.position.y = 0.72;
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), black);
  eyepiece.position.set(0.1, -0.22, 0);
  eyepiece.rotation.z = Math.PI / 2;
  tubeArm.add(tube, dewCap, eyepiece);
  scope.add(tubeArm);
  scope.position.set(-3.75, F, 5.25);
  scope.rotation.y = -0.6;
  g.add(scope);

  // --- the round hot tub, off the deck and under the pines -------------------------------------
  const tub = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.06, 18), flatMat('#9d9080'));
  pad.position.y = 0.03;
  pad.receiveShadow = true;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.68, 24), flatMat('#8b8884'));
  shell.position.y = 0.37;
  shell.castShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.11, 6, 24), flatMat('#98948f'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.72;
  const water = new THREE.MeshLambertMaterial({ color: '#5aa9b5', emissive: '#58d6e6', emissiveIntensity: 0.05 });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.84, 24), water);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.64;
  const rope = glowMat('#ffcf86', '#6d604c');
  const ropeRing = new THREE.Mesh(new THREE.TorusGeometry(1.04, 0.035, 5, 36), rope);
  ropeRing.rotation.x = Math.PI / 2;
  ropeRing.position.y = 0.1;
  const steam = wisps(4, { rise: 1.4, size: 0.8, opacity: 0.3 });
  steam.object.position.y = 0.7;
  tub.add(pad, shell, rim, surface, ropeRing, steam.object);
  tub.position.set(6.35, 0, -0.7);
  g.add(tub);
  for (const [x, z, s] of [[7.7, -3.3, 1.2], [5.1, -4.3, 0.95], [9.3, -1.5, 1.3]]) {
    const tree = pineTree(s);
    tree.position.set(x, -0.1, z);
    tree.rotation.y = x * 1.7;
    g.add(tree);
  }
  const stone = flatMat('#a39888');
  for (const [x, z] of [[2.1, 7.3], [3.6, 6.9], [5.0, 6.3], [5.9, 5.0], [6.4, 3.6], [6.6, 2.2], [6.6, 1.0]]) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34, 0), stone);
    s.scale.set(1, 0.18, 1);
    s.rotation.y = x * 3;
    s.position.set(x, 0.03, z);
    s.receiveShadow = true;
    g.add(s);
  }

  const interior = new THREE.PointLight('#ffb866', 0, 9, 2);
  interior.position.set(0, F + 1.9, 0.3);
  g.add(interior);

  let night = 0;
  return {
    id: 'aframe',
    object: placeOnSite(g, 'aframe'),
    anchor: V(0, F + H + 1.6, 0),
    // orbit stops before the hot tub pines fill the view
    view: { target: V(1.2, 2.8, 1), camera: V(9.4, 4.6, 16.4), orbit: [-1, 0.55] },
    hitBox: { size: [13.4, 8.8, 11.4], center: V(1.4, 4.2, 1.3) },
    update(p) {
      night = p.night;
      glass.emissiveIntensity = night ** 1.5 * 0.9;
      glass.opacity = 0.82 - night * 0.3;
      lamp.emissiveIntensity = night * 2.2;
      rope.emissiveIntensity = night * 2.4;
      water.emissiveIntensity = 0.05 + night * 0.9;
      movie.emissiveIntensity = night * 0.9;
      lanternGlow.emissiveIntensity = night * 2.2;
      interior.intensity = night * 16;
      deckLights.setNight(night);
      deckLights2.setNight(night);
    },
    tick(t) {
      flames.tick(t, night);
      fireLight.intensity = (1.2 + night * 12) * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3));
      steam.tick(t, 0.35 + night * 0.65);
    },
  };
}
