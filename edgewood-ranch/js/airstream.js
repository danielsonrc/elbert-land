// The 1959 Airstream Land Yacht and its site, laid out like the owners' renovation render: a deck
// along the door side with movie loungers under a shade sail, the screen wall and hot tub at the
// hitch end, and a grill and gas fire pit at the tail end. Placed frame: door side at +z, hitch at +x.
// Everything is modelled with the hitch at -x and then mirrored, which puts the door on the curb
// side like a real trailer.
import * as THREE from 'three';
import { placeOnSite } from './world.js';
import {
  V, box, beam, flatMat, glowMat, stripeTexture, stringLights, lantern, planter, flameRow, snowy,
  inflatableSpa, gasGrill, loungeChair, adirondackChair, pumpkin, wreath, XMAS,
} from './kit.js';

/** A painted mountain-lake sunset for movie night. */
function movieTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 288;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 176);
  sky.addColorStop(0, '#3b2a5c');
  sky.addColorStop(0.55, '#e0674a');
  sky.addColorStop(1, '#fbc27a');
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 176);
  g.fillStyle = '#ffe2a8';
  g.beginPath();
  g.arc(300, 150, 26, 0, Math.PI * 2);
  g.fill();
  const ridge = (color, base, amp, seed) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 176);
    for (let x = 0; x <= 512; x += 24) g.lineTo(x, base - Math.abs(Math.sin(x * 0.011 + seed)) * amp - (x % 48 ? 6 : 0));
    g.lineTo(512, 176);
    g.fill();
  };
  ridge('#c46a62', 132, 46, 1);
  ridge('#7a3a52', 158, 34, 2.4);
  const lake = g.createLinearGradient(0, 176, 0, 288);
  lake.addColorStop(0, '#f2a266');
  lake.addColorStop(1, '#3b2a5c');
  g.fillStyle = lake;
  g.fillRect(0, 176, 512, 112);
  g.fillStyle = 'rgba(255, 226, 168, 0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(282 - i * 4, 186 + i * 13, 36 + i * 8, 3);
  g.fillStyle = '#2a1a2a';
  for (const [x, h] of [[18, 92], [50, 70], [84, 118], [150, 44], [376, 48], [428, 104], [462, 80], [496, 126]]) {
    g.beginPath();
    g.moveTo(x, 180 - h);
    g.lineTo(x + h * 0.22, 182);
    g.lineTo(x - h * 0.22, 182);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Four-cornered shade sail (a-b along one edge, d-c along the opposite one) with concave edges. */
function shadeSail(a, b, c, d, material, { belly = 0.07, curve = 0.1 } = {}) {
  const geo = new THREE.PlaneGeometry(1, 1, 12, 12);
  const pos = geo.attributes.position;
  const center = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
  const p = new THREE.Vector3(), top = new THREE.Vector3(), bottom = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5, v = pos.getY(i) + 0.5;
    top.lerpVectors(a, b, u);
    bottom.lerpVectors(d, c, u);
    p.lerpVectors(top, bottom, v);
    const edge = (t) => (2 * t - 1) ** 8;
    const pull = curve * (Math.sin(Math.PI * u) * edge(v) + Math.sin(Math.PI * v) * edge(u));
    p.lerp(center, pull);
    p.y -= belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true; // shades the deck; receiving its own shadow would speckle the fabric
  return mesh;
}

export function createAirstream() {
  const g = new THREE.Group();
  const mirror = new THREE.Group();
  mirror.scale.x = -1;
  const trailer = new THREE.Group(); // hidden while the scene captures reflections
  const site = new THREE.Group();
  mirror.add(trailer, site);
  g.add(mirror);

  // --- polished shell --------------------------------------------------------------------
  // An elliptical section with a flat belly runs the length of the trailer. Toward each end it
  // closes like an Airstream's: the roof rounds over in a long, soft curve while the lower end
  // stands almost upright off the floor line, so the silhouette reads as a loaf, not a pill.
  // Windows, door and lights are cut from the same surface so they sit flush with it.
  // Heights below are relative to the body's centre `cy`; the section angle th is 0 at the roof,
  // pi/2 on the door side (+z) and pi at the belly.
  const R = 1.35, SZ = 0.93, BELLY = -0.95, lift = 0.55, HALF = 4.05;
  const TOP = { cap: 1.3, p: 2.2 }, BOTTOM = { cap: 0.55, p: 3.6 };
  const cy = lift + 0.95;

  /** Length and bluntness of the end at section angle th. */
  const endShape = (th) => {
    const w = (1 + Math.cos(th)) / 2; // 1 along the roof, 0 along the belly
    return { cap: BOTTOM.cap + (TOP.cap - BOTTOM.cap) * w, p: BOTTOM.p + (TOP.p - BOTTOM.p) * w };
  };
  /** The shell at distance x along the trailer and section angle th. */
  const shellAt = (x, th) => {
    const { cap, p } = endShape(th);
    const u = Math.min(1, Math.max(0, (Math.abs(x) - (HALF - cap)) / cap));
    const s = (1 - u ** p) ** (1 / p);
    return V(x, Math.max(BELLY, R * Math.cos(th) * s), R * SZ * Math.sin(th) * s);
  };
  /** The point on a side (+1 is the door side) at x and height y; along the full-width middle. */
  const sidePoint = (x, y, side) => shellAt(x, side * Math.acos(Math.max(-1, Math.min(1, y / R))));
  /** The point on an end (+1 is the tail) at height y and across-offset z. */
  const endPoint = (y, z, end) => {
    const th = Math.atan2(z / (R * SZ), y / R), rho = Math.hypot(y / R, z / (R * SZ));
    const { cap, p } = endShape(th);
    return V(end * (HALF - cap + cap * (1 - rho ** p) ** (1 / p)), y, z);
  };
  /** Outward normal of the shell near a point on it. */
  const normalAt = (pt) => {
    const th = Math.atan2(pt.z / (R * SZ), pt.y / R), e = 1e-3;
    const dx = shellAt(pt.x + e, th).sub(shellAt(pt.x - e, th));
    const dt = shellAt(pt.x, th + e).sub(shellAt(pt.x, th - e));
    const n = dx.cross(dt);
    if (n.lengthSq() < 1e-12) n.set(Math.sign(pt.x), 0, 0); // at the very tip
    n.normalize();
    return n.dot(V(pt.x * 0.2, pt.y, pt.z)) < 0 ? n.negate() : n;
  };

  /** A grid mesh from at(u, v), lifted `offset` off the shell and wound to face outward. */
  function sheet(at, nu, nv, offset = 0) {
    const pos = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = at(i / nu, j / nv);
        if (offset) p.addScaledVector(normalAt(p), offset);
        pos.push(p.x, p.y + cy, p.z);
      }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // flip the winding if a vertex mid-sheet has its normal pointing into the shell
    const k = Math.floor(nv / 2) * (nu + 1) + Math.floor(nu / 2);
    const n = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, k);
    if (n.dot(V(pos[3 * k] * 0.2, pos[3 * k + 1] - cy, pos[3 * k + 2])) < 0) {
      for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    return geo;
  }

  // smooth shading: faceted mirrors turn into a busy checkerboard
  const alu = new THREE.MeshStandardMaterial({ color: '#eef1f4', metalness: 1, roughness: 0.18 });
  const aluSatin = new THREE.MeshStandardMaterial({ color: '#dfe3e7', metalness: 1, roughness: 0.32 });
  const xs = [];
  const K = 26; // rings per end, bunched toward the tips where the curves turn fastest
  const endStart = HALF - TOP.cap;
  for (let k = K; k >= 1; k--) xs.push(-(endStart + TOP.cap * Math.sin((k / K) * Math.PI / 2)));
  for (let k = 0; k <= 6; k++) xs.push(-endStart + (2 * endStart * k) / 6);
  for (let k = 1; k <= K; k++) xs.push(endStart + TOP.cap * Math.sin((k / K) * Math.PI / 2));
  // the seam of the sweep runs along the belly, out of sight
  const body = new THREE.Mesh(sheet((u, v) => shellAt(xs[Math.round(v * (xs.length - 1))], Math.PI * (1 + 2 * u)), 56, xs.length - 1), alu);
  body.castShadow = true;
  trailer.add(body);

  // windows, door and lights, cut from the shell. Tinted glass shows only a faint sheen by day
  // and glows warm after dark.
  const glass = new THREE.MeshStandardMaterial({
    color: '#0e1318', metalness: 0.05, roughness: 0.25, emissive: '#ffb35c', emissiveIntensity: 0,
  });
  const sidePanel = (x0, x1, y0, y1, side, material, offset = 0.02) => {
    trailer.add(new THREE.Mesh(sheet((u, v) => sidePoint(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, side), 8, 8, offset), material));
  };
  const endPanel = (y0, y1, halfWidth, end, material, offset = 0.02) => {
    trailer.add(new THREE.Mesh(sheet((u, v) => endPoint(y0 + (y1 - y0) * v, halfWidth * (2 * u - 1), end), 12, 6, offset), material));
  };
  for (const x of [-1.9, -0.55, 0.75]) sidePanel(x - 0.45, x + 0.45, 0.12, 0.64, 1, glass);
  for (const x of [-1.8, -0.4, 1.0, 2.2]) sidePanel(x - 0.45, x + 0.45, 0.12, 0.64, -1, glass);
  sidePanel(1.58, 2.32, -0.93, 0.8, 1, aluSatin, 0.03); // door
  sidePanel(1.72, 2.18, 0.22, 0.62, 1, glass, 0.045); // and its window
  endPanel(0.18, 0.64, 0.72, -1, glass); // the big front window over the hitch
  endPanel(0.22, 0.58, 0.5, 1, glass); // the rear window

  // tail lights, bumper, roof AC and vent
  const tail = glowMat('#ff2a1a', '#8e1b16');
  for (const z of [-0.55, 0.55]) {
    const at = endPoint(-0.45, z, 1);
    const n = normalAt(at);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), tail);
    lamp.quaternion.setFromUnitVectors(V(0, 1, 0), n);
    lamp.position.copy(at).addScaledVector(n, 0.02);
    lamp.position.y += cy;
    trailer.add(lamp);
  }
  const dark = flatMat('#2a2a2d');
  trailer.add(box(0.24, 0.14, 2.1, dark, 3.95, lift - 0.02, 0));
  trailer.add(box(0.95, 0.3, 0.8, flatMat('#ecebe6'), 0.3, cy + R + 0.1, 0));
  trailer.add(box(0.5, 0.1, 0.5, flatMat('#d9dcdf'), -1.7, cy + R + 0.02, 0));

  // running gear and hitch
  for (const x of [-0.1, 0.72]) {
    for (const z of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12), flatMat('#2a282c'));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      wheel.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8), aluSatin);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(wheel.position);
      trailer.add(wheel, hub);
    }
  }
  const iron = flatMat('#2b2a2c');
  for (const z of [-0.55, 0.55]) trailer.add(beam(V(-3.3, lift + 0.1, z), V(-4.9, lift, 0), 0.07, iron, 4));
  trailer.add(beam(V(-4.6, 0, 0), V(-4.6, lift + 0.1, 0), 0.06, iron));
  for (const z of [-0.28, 0.28]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 8), flatMat('#ece3d2'));
    tank.position.set(-4.35, lift + 0.4, z);
    trailer.add(tank);
  }
  for (const z of [-1, 1]) trailer.add(beam(V(2.9, 0, z), V(2.9, lift + 0.1, z * 0.9), 0.05, iron));
  // awning rail along the door side, where the shade sail and café lights hang
  const railY = cy + 1.02, railZ = 0.88;
  trailer.add(beam(V(-3.0, railY, railZ), V(3.0, railY, railZ), 0.03, aluSatin, 6));

  // --- deck along the door side --------------------------------------------------------------------
  const dx0 = -2.3, dx1 = 2.9, dz0 = 1.45, dz1 = 4.95, top = 0.5;
  const cx = (dx0 + dx1) / 2, cz = (dz0 + dz1) / 2, dw = dx1 - dx0, dd = dz1 - dz0;
  const decking = snowy(new THREE.MeshLambertMaterial({
    color: '#ffffff',
    map: stripeTexture('#9a6a42', '#80552f', { repeat: [1, dd / 0.14], vertical: false, lineWidth: 0.1 }),
  }));
  const trim = flatMat('#5e3e29');
  site.add(box(dw, 0.08, dd, decking, cx, top - 0.04, cz));
  // fascia boards frame the edge; the skirt sits back in their shadow
  for (const z of [dz0 - 0.02, dz1 + 0.02]) site.add(box(dw + 0.08, 0.18, 0.04, trim, cx, top - 0.11, z));
  for (const x of [dx0 - 0.02, dx1 + 0.02]) site.add(box(0.04, 0.18, dd, trim, x, top - 0.11, cz));
  site.add(box(dw - 0.14, 0.56, dd - 0.14, flatMat('#4a3120'), cx, 0.06, cz));
  const stepX = 0.6, stepW = 1.6;
  for (const [h, z] of [[0.33, dz1 + 0.19], [0.16, dz1 + 0.49]]) site.add(box(stepW, h, 0.3, decking, stepX, h / 2, z));

  // --- movie night: two loungers and the projector, facing the screen at the hitch end --------------
  for (const z of [2.45, 4.0]) {
    const chair = loungeChair('#2e2a27', '#d8c6a2');
    chair.position.set(-0.6, top, z);
    chair.rotation.y = -Math.PI / 2;
    site.add(chair);
  }
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14), flatMat('#6f4b30'));
  tableTop.position.set(-0.6, top + 0.44, 3.22);
  site.add(tableTop, beam(V(-0.6, top, 3.22), V(-0.6, top + 0.42, 3.22), 0.04, dark, 6));
  site.add(box(0.3, 0.11, 0.26, flatMat('#efeeea'), -0.6, top + 0.515, 3.22));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), dark);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(-0.77, top + 0.52, 3.22);
  site.add(lens);

  // screen wall: a framed panel of horizontal slats with the screen hung proud of it
  const wallX = -4.6, wallZ = 3.35, wallW = 3.5, wallH = 3.0;
  const postMat = flatMat('#4e3726');
  for (const z of [wallZ - wallW / 2, wallZ + wallW / 2]) site.add(box(0.16, wallH + 0.3, 0.16, postMat, wallX, (wallH - 0.3) / 2, z));
  const slatMats = ['#8e6b4a', '#84623f', '#977352'].map((c) => flatMat(c));
  for (let i = 0; i < 16; i++) site.add(box(0.04, 0.13, wallW - 0.16, slatMats[i % 3], wallX, 0.24 + i * 0.172, wallZ));
  site.add(box(0.26, 0.06, wallW + 0.2, postMat, wallX, wallH + 0.03, wallZ));
  site.add(box(0.05, 1.54, 2.64, dark, wallX + 0.105, 1.86, wallZ));
  const screen = new THREE.MeshLambertMaterial({
    color: '#d6d8db', emissive: '#ffffff', emissiveMap: movieTexture(), emissiveIntensity: 0.12,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.46, 1.38), screen);
  screenMesh.rotation.y = Math.PI / 2;
  screenMesh.position.set(wallX + 0.15, 1.86, wallZ);
  site.add(screenMesh);

  // --- the hot tub, an inflatable spa like the A-frame's, beside the screen -------------------------
  const spa = inflatableSpa();
  spa.object.position.set(-3.45, 0, 4.25);
  site.add(spa.object);
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.34, 12), flatMat('#b08a55'));
  basket.position.set(-2.35, 0.17, 5.6);
  const towel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 10), flatMat('#e8e4da'));
  towel.rotation.z = Math.PI / 2;
  towel.position.set(-2.35, 0.4, 5.6);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.093, 0.093, 0.1, 10), flatMat('#3f6ea8'));
  stripe.rotation.z = Math.PI / 2;
  stripe.position.copy(towel.position);
  site.add(basket, towel, stripe);

  // --- shade sail from the awning rail to two posts at the front of the deck, café lights -------------
  const sailPost = (x, z, h) => {
    site.add(box(0.14, h + 0.2, 0.14, postMat, x, h / 2 - 0.1, z));
    const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 10), flatMat('#8d8a84'));
    footing.position.set(x, 0.03, z);
    site.add(footing);
    return V(x, h - 0.12, z);
  };
  const postA = sailPost(-2.8, 5.6, 3.6); // taller at the screen end, so the sail twists taut
  const postB = sailPost(3.4, 5.6, 3.1);
  // fabric lets some light through, so its underside never goes dark
  const sailMat = new THREE.MeshLambertMaterial({
    color: '#eadbbd', emissive: '#7a6a4e', emissiveIntensity: 0.28, side: THREE.DoubleSide,
  });
  site.add(shadeSail(V(-1.9, railY + 0.04, railZ), V(2.5, railY + 0.04, railZ), postB, postA, sailMat));
  const lights = [
    stringLights([V(-2.9, railY - 0.1, railZ + 0.06), V(2.9, railY - 0.1, railZ + 0.06)], { sag: 0.12 }),
    stringLights([postA.clone().setY(postA.y - 0.3), postB.clone().setY(postB.y - 0.3)], { sag: 0.4 }),
  ];
  for (const l of lights) site.add(l.object);

  // --- holidays, switched on by setHolidays() -----------------------------------------------------
  // Christmas: coloured strands in place of the café lights, lights wound up the sail posts and a
  // wreath on the door. Fall: pumpkins by the steps and on the deck.
  const christmas = new THREE.Group();
  const merry = [
    stringLights([V(-2.9, railY - 0.1, railZ + 0.06), V(2.9, railY - 0.1, railZ + 0.06)], { sag: 0.12, colors: XMAS }),
    stringLights([postA.clone().setY(postA.y - 0.3), postB.clone().setY(postB.y - 0.3)], { sag: 0.4, colors: XMAS }),
  ];
  for (const [post, h] of [[postA, 3.6], [postB, 3.1]]) {
    const coil = [];
    for (let i = 0; i <= 56; i++) {
      const k = i / 56, a = k * Math.PI * 16;
      coil.push(V(post.x + Math.cos(a) * 0.13, 0.3 + k * (h - 0.6), post.z + Math.sin(a) * 0.13));
    }
    merry.push(stringLights(coil, { sag: 0, spacing: 0.26, bulb: 0.045, colors: XMAS }));
  }
  for (const l of merry) christmas.add(l.object);
  const doorWreath = wreath(0.19);
  const onDoor = sidePoint(1.95, -0.08, 1), outward = normalAt(onDoor);
  doorWreath.position.copy(onDoor).addScaledVector(outward, 0.07);
  doorWreath.position.y += cy;
  doorWreath.quaternion.setFromUnitVectors(V(0, 0, 1), outward);
  trailer.add(doorWreath);
  const fall = new THREE.Group();
  for (const [x, y, z, size, color] of [
    [stepX - 1.6, 0, 5.75, 0.26, '#d9772b'], [stepX - 1.3, 0, 6.05, 0.17, '#e9ddc5'], [stepX + 1.62, 0, 5.8, 0.22, '#c96a26'],
    [-1.8, top, 4.3, 0.2, '#d9772b'], [2.75, top, 3.2, 0.15, '#8f9c6a'],
  ]) {
    const p = pumpkin(size, color);
    p.position.set(x, y, z);
    p.rotation.y = x * 2.1;
    fall.add(p);
  }
  christmas.visible = doorWreath.visible = fall.visible = false;
  site.add(christmas, fall);

  // --- tail end: the grill on the deck corner, a gas fire pit and three chairs off the deck ------------
  const grill = gasGrill();
  grill.position.set(2.35, top, 4.3);
  grill.rotation.y = Math.PI / 2;
  site.add(grill);
  const pitAt = V(5.75, 0, 3.75);
  const pit = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.42, 18), flatMat('#8b857d'));
  bowl.position.y = 0.21;
  bowl.castShadow = true;
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 5, 22), flatMat('#6f6a63'));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.42;
  const embers = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18), flatMat('#3a3330'));
  embers.rotation.x = -Math.PI / 2;
  embers.position.y = 0.4;
  const fire = flameRow(7, 0.5, { ring: true });
  fire.object.position.y = 0.4;
  const fireLight = new THREE.PointLight('#ff9a4a', 0, 9, 2);
  fireLight.position.y = 1.1;
  pit.add(bowl, lip, embers, fire.object, fireLight);
  pit.position.copy(pitAt);
  site.add(pit);
  for (const [a, color] of [[0.75, '#b5553a'], [2.6, '#2f6f73'], [4.9, '#c9a24a']]) {
    const chair = adirondackChair(color);
    chair.position.set(pitAt.x + Math.cos(a) * 1.55, 0, pitAt.z + Math.sin(a) * 1.55);
    chair.rotation.y = Math.atan2(pitAt.x - chair.position.x, pitAt.z - chair.position.z);
    site.add(chair);
  }

  // --- planters at the steps, bollards along the path in, lanterns by the tub -------------------------
  for (const x of [stepX - 1.15, stepX + 1.15]) {
    const pot = planter(0.7, '#9a5b3c');
    pot.position.set(x, 0, 5.5);
    site.add(pot);
  }
  const lampHead = glowMat('#ffd79a', '#2a2522');
  const along = V(0.469, 0, 0.883), across = V(0.883, 0, -0.469); // the trail from the meadow
  for (const d of [1.7, 3.9]) {
    for (const side of [-1, 1]) {
      const at = V(stepX, 0, 5.9).addScaledVector(along, d).addScaledVector(across, side * 1.05);
      site.add(box(0.09, 0.32, 0.09, dark, at.x, 0.16, at.z), box(0.12, 0.06, 0.12, lampHead, at.x, 0.35, at.z));
    }
  }
  const lanternGlow = glowMat('#ffb65c', '#4a3a28');
  for (const [x, y, z] of [[-2.05, top, 4.72], [-1.95, 0, 6.0]]) {
    const l = lantern(lanternGlow);
    l.position.set(x, y, z);
    site.add(l);
  }

  // --- power pedestal and yard light behind the tail, as in the render --------------------------------
  site.add(box(0.34, 1.15, 0.28, flatMat('#3b5e46'), 4.7, 0.575, -1.85));
  site.add(box(0.3, 0.42, 0.14, flatMat('#c9ccce'), 4.7, 0.62, -1.64));
  site.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V(4.7, 0.4, -1.58), V(4.35, 0.03, -1.4), V(3.7, 0.03, -1.15), V(3.3, 0.55, -0.95),
    ]), 16, 0.03, 5),
    dark,
  ));
  site.add(beam(V(5.25, 0, -0.35), V(5.25, 1.45, -0.35), 0.035, dark, 6));
  site.add(box(0.16, 0.22, 0.16, lampHead, 5.25, 1.52, -0.35));

  // --- a few rocks and grass clumps at the edge of the gravel -----------------------------------------
  const stone = flatMat('#9d9285');
  const grass = flatMat('#8f9a52');
  for (const [x, z, turn] of [[-5.7, 1.0, 0.3], [-4.9, 6.9, 1.9], [7.9, 2.4, 3.4], [3.4, -2.9, 5.1]]) {
    for (const [r, ox, oz] of [[0.42, 0, 0], [0.24, 0.55, 0.3]]) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stone);
      rock.position.set(x + ox, r * 0.35, z + oz);
      rock.rotation.set(turn, turn * 2, 0);
      rock.castShadow = true;
      site.add(rock);
    }
    for (let k = 0; k < 6; k++) {
      const a = turn + k;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6 + (k % 3) * 0.12, 3), grass);
      blade.position.set(x - 0.45 + Math.cos(a) * 0.1, 0.3, z + 0.35 + Math.sin(a) * 0.1);
      blade.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
      site.add(blade);
    }
  }

  let night = 0;
  const deckLight = new THREE.PointLight('#ffc27a', 0, 10, 2);
  deckLight.position.set(0.2, 1.7, 3.3);
  const screenLight = new THREE.PointLight('#9fc4ff', 0, 7, 2);
  screenLight.position.set(wallX + 0.8, 1.8, wallZ);
  site.add(deckLight, screenLight);

  return {
    id: 'airstream',
    object: placeOnSite(g, 'airstream'),
    anchor: V(0, 5.3, 1),
    view: { target: V(-1.3, 1.4, 3.0), camera: V(-6.3, 6.5, 15.2) },
    hitBox: { size: [12.6, 4.8, 8.4], center: V(-1.0, 2.2, 2.3) },
    trailer,
    reflectionProbe: V(0, cy, 0),
    setHolidays(h) {
      christmas.visible = doorWreath.visible = Boolean(h.christmas);
      for (const l of lights) l.object.visible = !h.christmas;
      fall.visible = Boolean(h.fall);
    },
    setEnvMap(tex) {
      for (const m of [alu, aluSatin, glass]) {
        m.envMap = tex;
        m.needsUpdate = true;
      }
    },
    update(p) {
      glass.emissiveIntensity = p.night ** 2 * 1.1;
      tail.emissiveIntensity = 0.25 + p.night * 1.2;
      for (const m of [lanternGlow, lampHead]) m.emissiveIntensity = p.night * 2.2;
      spa.water.emissiveIntensity = 0.05 + p.night * 1.1;
      screen.emissiveIntensity = 0.12 + p.night * 1.05;
      sailMat.emissiveIntensity = 0.28 * (1 - p.night);
      deckLight.intensity = p.night * 6;
      screenLight.intensity = p.night * 3;
      for (const l of [...lights, ...merry]) l.setNight(p.night);
      night = p.night;
    },
    tick(t) {
      spa.steam.tick(t, 0.35 + night * 0.65);
      fire.tick(t, night);
      fireLight.intensity = (0.8 + night * 9) * (0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3));
    },
  };
}
