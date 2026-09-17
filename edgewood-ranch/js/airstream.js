// The 1959 Airstream Land Yacht and its site: the layout of the owners' renovation
// renders (deck, shade sail, hot tub, outdoor cinema), dressed warmer and more rustic
// to sit in the Firewatch palette. Placed frame: door side at +z, hitch at +x.
// Everything is modelled with the hitch at -x and then mirrored, which puts the
// door on the curb side like a real trailer.
import * as THREE from 'three';
import { placeOnSite, mulberry32 } from './world.js';
import {
  V, box, beam, flatMat, glassMat, glowMat, stripeTexture, stringLights, lantern, planter, slingChair, wisps,
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

/** Four-cornered shade sail with a slight belly and concave edges. */
function shadeSail(a, b, c, d, material) {
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
    const pull = 0.13 * (Math.sin(Math.PI * u) * edge(v) + Math.sin(Math.PI * v) * edge(u));
    p.lerp(center, pull);
    p.y -= 0.22 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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

  const R = 1.35, L = 5.4, lift = 0.55, SZ = 0.93;
  const cy = lift + 0.95; // body centre height; the belly is flattened at -0.95

  // --- polished shell --------------------------------------------------------------------
  // smooth shading: faceted mirrors turn into a busy checkerboard
  const alu = new THREE.MeshStandardMaterial({ color: '#eef1f4', metalness: 1, roughness: 0.18 });
  const aluSatin = new THREE.MeshStandardMaterial({ color: '#dfe3e7', metalness: 1, roughness: 0.32 });
  const bodyGeo = new THREE.CapsuleGeometry(R, L, 6, 20);
  bodyGeo.rotateZ(Math.PI / 2);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    bp.setZ(i, bp.getZ(i) * SZ);
    if (bp.getY(i) < -0.95) bp.setY(i, -0.95);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, alu);
  body.position.y = cy;
  body.castShadow = true;
  trailer.add(body);

  // curved panels that hug the shell: windows, door
  const glass = glassMat();
  const shell = (x, len, y0, y1, mat, back = false, r = R + 0.025) => {
    let t0 = Math.asin(y0 / R), t1 = Math.asin(y1 / R);
    if (back) [t0, t1] = [Math.PI - t1, Math.PI - t0];
    const geo = new THREE.CylinderGeometry(r, r, len, 12, 1, true, t0, t1 - t0);
    geo.rotateZ(Math.PI / 2);
    geo.scale(1, 1, SZ);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, cy, 0);
    trailer.add(m);
    return m;
  };
  for (const back of [false, true]) {
    for (const x of back ? [-1.8, -0.4, 1.0, 2.2] : [-1.9, -0.55, 0.75]) shell(x, 0.9, 0.12, 0.64, glass, back);
  }
  shell(1.95, 0.74, -0.93, 0.8, aluSatin, false, R + 0.04);
  shell(1.95, 0.42, 0.22, 0.62, glass, false, R + 0.06);
  for (const [x, dir] of [[-L / 2, -1], [L / 2, 1]]) {
    const geo = new THREE.CylinderGeometry(1.2, 1.36, 0.55, 12, 1, true, dir * Math.PI / 2 - 0.6, 1.2);
    geo.scale(1, 1, SZ);
    const w = new THREE.Mesh(geo, glass);
    w.position.set(x, cy + 0.38, 0);
    trailer.add(w);
  }

  // tail lights, bumper, roof AC and vent
  const tail = glowMat('#ff2a1a', '#8e1b16');
  for (const z of [-0.55, 0.55]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), tail);
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(3.83, cy - 0.45, z);
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

  // --- cedar deck along the door side ---------------------------------------------------------
  const dx0 = -2.3, dx1 = 2.9, dz0 = 1.45, dz1 = 5.0, top = 0.5;
  const decking = new THREE.MeshLambertMaterial({
    color: '#ffffff',
    map: stripeTexture('#9a6a42', '#80552f', { repeat: [1, (dz1 - dz0) / 0.14], vertical: false, lineWidth: 0.1 }),
  });
  const wood = flatMat('#7a5236');
  site.add(box(dx1 - dx0, 0.1, dz1 - dz0, decking, (dx0 + dx1) / 2, top - 0.05, (dz0 + dz1) / 2));
  site.add(box(dx1 - dx0 - 0.1, top + 0.3, dz1 - dz0 - 0.1, flatMat('#5f4029'), (dx0 + dx1) / 2, (top - 0.1 - 0.3) / 2, (dz0 + dz1) / 2));
  for (const [h, z] of [[0.33, dz1 + 0.15], [0.16, dz1 + 0.45]]) site.add(box(1.5, h, 0.3, decking, 0.45, h / 2, z));

  // camp loungers and a projector, all facing the screen at the far end
  for (const z of [2.75, 4.05]) {
    const chair = slingChair('#7a5236', '#d6c09a');
    chair.scale.setScalar(1.12);
    chair.position.set(-0.4, top, z);
    chair.rotation.y = -Math.PI / 2;
    site.add(chair);
  }
  const sideTable = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.46, 8), wood);
  sideTable.position.set(-0.55, top + 0.23, 3.4);
  site.add(sideTable);
  const lanternGlow = glowMat('#ffb65c', '#4a3a28');
  const tableLantern = lantern(lanternGlow);
  tableLantern.scale.setScalar(0.7);
  tableLantern.position.set(-0.55, top + 0.46, 3.4);
  site.add(tableLantern);
  site.add(box(0.42, 0.5, 0.42, wood, -1.75, top + 0.25, 3.4));
  site.add(box(0.3, 0.12, 0.26, flatMat('#f2f2ef'), -1.75, top + 0.56, 3.4));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), dark);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(-1.91, top + 0.57, 3.4);
  site.add(lens);

  // --- outdoor cinema: a plain privacy fence of horizontal slats, screen hung on it ----------------
  const wallX = -5.1, wallZ = 3.4, wallW = 3.4;
  const slatMats = ['#8e6b4a', '#84623f', '#977352'].map((c) => flatMat(c));
  for (let i = 0; i < 15; i++) {
    site.add(box(0.04, 0.14, wallW, slatMats[i % 3], wallX, 0.19 + i * 0.17, wallZ));
  }
  const fencePost = flatMat('#6f5136');
  for (const z of [wallZ - wallW / 2, wallZ, wallZ + wallW / 2]) site.add(box(0.12, 2.95, 0.12, fencePost, wallX - 0.08, 1.4, z));
  const fenceCorner = V(wallX - 0.08, 2.86, wallZ + wallW / 2);
  site.add(box(0.04, 1.42, 2.42, dark, wallX + 0.045, 1.78, wallZ));
  const screen = new THREE.MeshLambertMaterial({
    color: '#d6d8db', emissive: '#ffffff', emissiveMap: movieTexture(), emissiveIntensity: 0.12,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), screen);
  screenMesh.rotation.y = Math.PI / 2;
  screenMesh.position.set(wallX + 0.07, 1.78, wallZ);
  site.add(screenMesh);

  // --- round cedar soaking tub ---------------------------------------------------------------------
  const tub = new THREE.Group();
  const staves = new THREE.MeshLambertMaterial({
    color: '#ffffff', map: stripeTexture('#a86d40', '#8a5631', { repeat: [22, 1], lineWidth: 0.12 }),
    side: THREE.DoubleSide,
  });
  // open-topped so the water shows; the water disc hides the inside
  const tubBody = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.02, 0.95, 22, 1, true), staves);
  tubBody.position.y = 0.475;
  tubBody.castShadow = true;
  const band = flatMat('#2e2b2a');
  for (const y of [0.2, 0.78]) {
    const hoop = new THREE.Mesh(new THREE.CylinderGeometry(1.025, 1.025, 0.05, 22, 1, true), band);
    hoop.position.y = y;
    tub.add(hoop);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.05, 4, 22), flatMat('#8a5631'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.95;
  const water = new THREE.MeshLambertMaterial({ color: '#5aa9b5', emissive: '#5fe0ee', emissiveIntensity: 0.05 });
  const surface = new THREE.Mesh(new THREE.CircleGeometry(0.94, 22), water);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.86;
  const steam = wisps(4, { rise: 1.3, size: 0.8, opacity: 0.28 });
  steam.object.position.y = 0.95;
  tub.add(tubBody, rim, surface, steam.object);
  tub.position.set(-3.35, 0, 4.35);
  site.add(tub);
  site.add(box(0.46, 0.3, 0.34, flatMat('#b08a55'), -2.05, 0.15, 5.55));
  const towel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8), flatMat('#3f6ea8'));
  towel.rotation.z = Math.PI / 2;
  towel.position.set(-2.05, 0.38, 5.55);
  site.add(towel);

  // --- shade sail on a tall post, café lights --------------------------------------------------------
  const railY = cy + 1.02, railZ = 0.86;
  const postTop = V(3.65, 4.25, 5.85);
  const sailCorners = [V(-2.4, railY + 0.06, 0.95), V(2.6, railY + 0.06, 0.95), postTop.clone().setY(4.15), fenceCorner];
  site.add(shadeSail(...sailCorners, flatMat('#e3cda2', { side: THREE.DoubleSide })));
  site.add(beam(V(3.8, -0.3, 6.05), postTop, 0.09, flatMat('#5a3d28'), 6));
  const lights = [
    stringLights([V(-2.9, railY, railZ), V(-1, railY, railZ), V(1, railY, railZ), V(2.9, railY, railZ)], { sag: 0.12 }),
    stringLights([V(2.9, railY, railZ), postTop.clone().setY(3.95)], { sag: 0.35 }),
    stringLights([postTop.clone().setY(3.95), fenceCorner.clone().setY(2.8)], { sag: 0.5 }),
  ];
  for (const l of lights) site.add(l.object);

  // --- planters, lanterns, power pedestal, lamps, rocks ------------------------------------------------
  for (const [x, y, z, h] of [[2.55, top, 4.65, 0.7], [-2.0, top, 1.85, 0.55], [-4.5, 0, 1.35, 0.8], [3.3, 0, 1.6, 0.6]]) {
    const pot = planter(h, '#9a5b3c');
    pot.position.set(x, y, z);
    site.add(pot);
  }
  for (const [x, z] of [[-0.45, 5.75], [1.35, 5.75], [-2.4, 5.95], [-4.35, 5.55]]) {
    const l = lantern(lanternGlow);
    l.position.set(x, 0, z);
    site.add(l);
  }
  site.add(box(0.34, 1.15, 0.28, flatMat('#3b5e46'), 4.7, 0.575, -1.85));
  site.add(box(0.3, 0.42, 0.14, flatMat('#c9ccce'), 4.7, 0.62, -1.64));
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      V(4.7, 0.4, -1.58), V(4.35, 0.03, -1.4), V(3.7, 0.03, -1.15), V(3.3, 0.55, -0.95),
    ]), 16, 0.03, 5),
    dark,
  );
  site.add(cable);
  const lampHead = glowMat('#ffd79a', '#2a2522');
  site.add(beam(V(5.25, 0, -0.35), V(5.25, 1.45, -0.35), 0.035, dark, 6));
  site.add(box(0.16, 0.22, 0.16, lampHead, 5.25, 1.52, -0.35));
  for (const [x, z] of [[5.1, 2.4], [4.6, 6.4], [-0.9, 6.9], [-5.6, 6.1], [-5.9, 0.3]]) {
    site.add(box(0.08, 0.42, 0.08, dark, x, 0.21, z));
    site.add(box(0.1, 0.06, 0.1, lampHead, x, 0.44, z));
  }
  const rng = mulberry32(59);
  const stone = flatMat('#9d9285');
  const grass = flatMat('#8f9a52');
  for (let i = 0; i < 16; i++) {
    const a = rng() * Math.PI * 2, r = 6.6 + rng() * 2;
    const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r + 1.4;
    if (z > 5 && Math.abs(x - 0.5) < 2.2) continue; // keep the path to the steps clear
    if (i % 2) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rng() * 0.35, 0), stone);
      rock.position.set(x, 0.05, z);
      rock.rotation.set(rng() * 3, rng() * 3, 0);
      rock.castShadow = true;
      site.add(rock);
    } else {
      for (let k = 0; k < 5; k++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55 + rng() * 0.3, 3), grass);
        blade.position.set(x + (rng() - 0.5) * 0.3, 0.28, z + (rng() - 0.5) * 0.3);
        blade.rotation.set((rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6);
        site.add(blade);
      }
    }
  }

  let night = 0;
  const deckLight = new THREE.PointLight('#ffc27a', 0, 12, 2);
  deckLight.position.set(0.2, 2.3, 3.3);
  const screenLight = new THREE.PointLight('#9fc4ff', 0, 7, 2);
  screenLight.position.set(-4.3, 1.8, wallZ);
  site.add(deckLight, screenLight);

  return {
    id: 'airstream',
    object: placeOnSite(g, 'airstream'),
    anchor: V(0, 5.3, 1),
    view: { target: V(0.9, 1.8, 2.6), camera: V(-6.2, 4.2, 13.8) },
    hitBox: { size: [11.4, 4.8, 8.6], center: V(1.3, 2.2, 2.3) },
    trailer,
    reflectionProbe: V(0, cy, 0),
    setEnvMap(tex) {
      for (const m of [alu, aluSatin]) {
        m.envMap = tex;
        m.needsUpdate = true;
      }
    },
    update(p) {
      glass.emissiveIntensity = 0.04 + p.night ** 2 * 1.2;
      tail.emissiveIntensity = 0.25 + p.night * 1.2;
      for (const m of [lanternGlow, lampHead]) m.emissiveIntensity = p.night * 2.2;
      water.emissiveIntensity = 0.05 + p.night * 1.1;
      screen.emissiveIntensity = 0.12 + p.night * 1.05;
      deckLight.intensity = p.night * 10;
      screenLight.intensity = p.night * 3;
      for (const l of lights) l.setNight(p.night);
      night = p.night;
    },
    tick(t) {
      steam.tick(t, 0.35 + night * 0.65);
    },
  };
}
