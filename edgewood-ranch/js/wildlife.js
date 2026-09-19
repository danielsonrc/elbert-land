// The ranch's regulars: mule deer, wild turkeys and cottontails graze and wander their patch of
// meadow, and like the real ones they don't wait around when you come close: get near and they
// freeze, then they're off, drifting back once the coast is clear. Small flocks of birds cross by
// day, and around the Fourth of July a bald eagle circles overhead.
import * as THREE from 'three';
import { SITES, BATH, PRIVACY_STAND, TRUCK, heightAt, meadowRadius, mulberry32 } from './world.js';
import { V, box, beam, flatMat } from './kit.js';

const rng = mulberry32(42);
const between = (a, b) => a + rng() * (b - a);

/** A leg that swings from the hip: returns the pivot. */
function leg(parent, x, y, z, length, width, color, hoof) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.add(box(width, length, width * 1.15, color, 0, -length / 2, 0));
  if (hoof) pivot.add(box(width * 1.1, 0.06, width * 1.4, hoof, 0, -length + 0.02, 0.01));
  parent.add(pivot);
  return pivot;
}

/** A mule deer facing +z; `buck` adds antlers. About 1 m at the shoulder. */
function deerModel({ buck = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const coat = flatMat('#8b6e55'), light = flatMat('#c2ab8f'), white = flatMat('#ece6da');
  const dark = flatMat('#2c2622'), hoofMat = flatMat('#3a302a');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), coat);
  body.scale.set(0.21, 0.26, 0.6);
  body.position.y = 1.02;
  body.castShadow = true;
  const rump = box(0.3, 0.26, 0.08, white, 0, 1.04, -0.57);
  const tail = box(0.07, 0.16, 0.05, white, 0, 1.06, -0.63);
  tail.add(box(0.07, 0.05, 0.05, dark, 0, -0.08, 0));
  g.add(body, rump, tail, box(0.3, 0.12, 0.7, light, 0, 0.86, 0.05));
  // neck and head hang from a pivot at the shoulders, so the head can drop to graze
  const neck = new THREE.Group();
  neck.position.set(0, 1.14, 0.44);
  const neckMesh = box(0.15, 0.52, 0.17, coat, 0, 0.24, 0.05);
  neckMesh.rotation.x = 0.42;
  const head = new THREE.Group();
  head.position.set(0, 0.47, 0.19);
  head.add(box(0.17, 0.18, 0.3, coat, 0, 0, 0.08), box(0.12, 0.12, 0.14, dark, 0, -0.03, 0.27));
  for (const s of [-1, 1]) {
    const ear = box(0.05, 0.2, 0.12, light, s * 0.13, 0.12, -0.04);
    ear.rotation.set(-0.2, 0, s * -0.9);
    head.add(ear);
  }
  if (buck) {
    const antler = flatMat('#d9ccb3');
    for (const s of [-1, 1]) {
      head.add(beam(V(s * 0.05, 0.08, -0.02), V(s * 0.2, 0.36, 0.02), 0.02, antler, 4));
      head.add(beam(V(s * 0.15, 0.27, 0.01), V(s * 0.16, 0.44, 0.12), 0.016, antler, 4));
      head.add(beam(V(s * 0.2, 0.36, 0.02), V(s * 0.3, 0.46, -0.08), 0.016, antler, 4));
    }
  }
  neck.add(neckMesh, head);
  g.add(neck);
  const legs = [];
  for (const [x, z] of [[-0.11, 0.42], [0.11, 0.42], [-0.11, -0.42], [0.11, -0.42]]) legs.push(leg(g, x, 0.88, z, 0.86, 0.07, coat, hoofMat));
  g.scale.setScalar(scale);
  g.traverse((o) => { o.castShadow = true; });
  return { group: g, legs, neck, graze: 1.75 };
}

/** A wild turkey facing +z, about 0.9 m tall. */
function turkeyModel() {
  const g = new THREE.Group();
  const bronze = flatMat('#3f3229'), wing = flatMat('#5b4535'), band = flatMat('#b89a70');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), bronze);
  body.scale.set(0.24, 0.23, 0.33);
  body.position.y = 0.56;
  body.castShadow = true;
  const tail = box(0.34, 0.05, 0.26, bronze, 0, 0.5, -0.36);
  tail.rotation.x = 0.55;
  tail.add(box(0.34, 0.052, 0.05, band, 0, 0, -0.12));
  g.add(body, tail);
  for (const s of [-1, 1]) g.add(box(0.05, 0.16, 0.38, wing, s * 0.21, 0.58, -0.02));
  const neck = new THREE.Group();
  neck.position.set(0, 0.64, 0.25);
  const neckMesh = box(0.06, 0.3, 0.06, flatMat('#7f93a8'), 0, 0.14, 0.03);
  neckMesh.rotation.x = 0.25;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), flatMat('#9db2c6'));
  head.position.set(0, 0.3, 0.08);
  const wattle = box(0.03, 0.08, 0.03, flatMat('#b3362b'), 0, 0.24, 0.12);
  const beak = box(0.025, 0.025, 0.06, flatMat('#cdb98e'), 0, 0.3, 0.15);
  neck.add(neckMesh, head, wattle, beak);
  g.add(neck);
  const shank = flatMat('#b18c69');
  const legs = [-0.08, 0.08].map((x) => leg(g, x, 0.4, 0.02, 0.4, 0.035, shank, shank));
  g.traverse((o) => { o.castShadow = true; });
  return { group: g, legs, neck, graze: 2.1 };
}

/** A cottontail facing +z; it hops with its whole body, so it needs no legs. */
function rabbitModel() {
  const g = new THREE.Group();
  const fur = flatMat('#8a7866'), inner = flatMat('#c9a79a'), white = flatMat('#f1ede6');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), fur);
  body.scale.set(0.11, 0.1, 0.16);
  body.position.set(0, 0.11, -0.02);
  const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), white);
  tail.position.set(0, 0.14, -0.17);
  g.add(body, tail);
  const neck = new THREE.Group();
  neck.position.set(0, 0.15, 0.09);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.065, 1), fur);
  head.scale.set(1, 0.95, 1.2);
  head.position.set(0, 0.04, 0.05);
  neck.add(head);
  for (const s of [-1, 1]) {
    const ear = box(0.026, 0.13, 0.045, fur, s * 0.026, 0.14, 0.02);
    ear.rotation.set(-0.3, 0, s * 0.18);
    ear.add(box(0.012, 0.1, 0.02, inner, 0, 0, 0.018));
    neck.add(ear);
  }
  g.add(neck);
  g.traverse((o) => { o.castShadow = true; });
  return { group: g, legs: [], neck, graze: 0.55 };
}

/** A small songbird facing +z, with wings that flap. */
function birdModel() {
  const g = new THREE.Group();
  const dark = flatMat('#2e2a2b');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), dark);
  body.scale.set(0.9, 0.8, 1.7);
  g.add(body);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.x = s * 0.04;
    pivot.add(box(0.26, 0.012, 0.09, dark, s * 0.13, 0, 0));
    g.add(pivot);
    return pivot;
  });
  return { group: g, wings };
}

/** A bald eagle facing +z, wings spread: dark body, white head and tail, yellow beak. */
function eagleModel() {
  const g = new THREE.Group();
  const brown = flatMat('#3a2a1c'), white = flatMat('#f3efe4'), gold = flatMat('#e2b53a');
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), brown);
  body.scale.set(0.85, 0.75, 2.1);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), white);
  head.position.set(0, 0.05, 0.5);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.15, 5), gold);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.03, 0.66);
  const tail = box(0.34, 0.03, 0.34, white, 0, 0, -0.56);
  g.add(body, head, beak, tail);
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.12, 0.03, 0.02);
    pivot.add(box(1.05, 0.035, 0.42, brown, s * 0.52, 0, 0));
    for (let f = 0; f < 4; f++) pivot.add(box(0.26, 0.02, 0.07, brown, s * 1.14, 0, 0.14 - f * 0.1)); // the "fingers"
    pivot.rotation.z = s * 0.1; // a shallow V
    g.add(pivot);
    return pivot;
  });
  g.traverse((o) => { o.castShadow = true; });
  return { group: g, wings };
}

const KINDS = {
  // cover: how far they run before hiding (the trees, unless a number); away: seconds hidden
  deer: { walk: 0.55, run: 6.5, shy: 20, bound: 0.32, stride: 7, cover: 'trees', away: [35, 70] },
  turkey: { walk: 0.4, run: 4.4, shy: 12, bound: 0, stride: 16, cover: 'trees', away: [35, 70] },
  rabbit: { walk: 0.9, run: 5.2, shy: 8, bound: 0.18, stride: 11, cover: 14, away: [20, 40], hops: true },
};
const MODELS = { deer: deerModel, turkey: turkeyModel, rabbit: rabbitModel };

/** Somewhere an animal may stand: not on a stay's pad, in the bath house, the truck or a tree trunk. */
function open(x, z) {
  for (const s of Object.values(SITES)) if (Math.hypot(x - s.x, z - s.z) < s.pad * 0.75) return false;
  for (const [px, pz] of PRIVACY_STAND) if (Math.hypot(x - px, z - pz) < 1.4) return false;
  if (Math.hypot(x - TRUCK.x, z - TRUCK.z) < 4) return false;
  return Math.hypot(x - BATH.x, z - BATH.z) > BATH.pad + 1;
}

export function createWildlife() {
  const group = new THREE.Group();
  group.name = 'wildlife';
  const animals = [];
  const herds = [
    { kind: 'deer', home: V(-23, 0, 9), range: 5, members: [{ buck: true }, {}, { scale: 0.72 }] },
    { kind: 'turkey', home: V(2, 0, 11), range: 4.5, members: [{}, {}, {}, {}, {}] }, // inside the drive's loop
    // cottontails keep to themselves, one to a patch
    ...[[19, 1], [-7, -6], [3, 30], [-12, 20]].map(([x, z]) => ({ kind: 'rabbit', home: V(x, 0, z), range: 2.5, members: [{}] })),
  ];
  for (const herd of herds) {
    herd.animals = [];
    for (const opts of herd.members) {
      const model = MODELS[herd.kind](opts);
      const a = {
        ...KINDS[herd.kind], kind: herd.kind, herd, model,
        pos: V(herd.home.x + between(-2, 2), 0, herd.home.z + between(-2, 2)),
        heading: between(0, Math.PI * 2), target: null, state: 'graze', timer: between(1, 6),
        speed: 0, phase: between(0, 10), look: 0, zig: 0, veer: 0,
      };
      herd.animals.push(a);
      animals.push(a);
      group.add(model.group);
    }
  }

  function wanderTarget(a) {
    for (let i = 0; i < 12; i++) {
      const ang = between(0, Math.PI * 2), r = between(0.5, a.herd.range);
      const x = a.herd.home.x + Math.cos(ang) * r, z = a.herd.home.z + Math.sin(ang) * r;
      if (open(x, z)) return V(x, 0, z);
    }
    return a.herd.home.clone();
  }

  /** Away from the camera and all the way into the trees (or a short dash to cover), steering round the stays. */
  function hideout(a, cam) {
    const away = Math.atan2(a.pos.z - cam.z, a.pos.x - cam.x);
    if (typeof a.cover === 'number') {
      for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
        const x = a.pos.x + Math.cos(away + turn) * a.cover, z = a.pos.z + Math.sin(away + turn) * a.cover;
        if (open(x, z)) return V(x, 0, z);
      }
    }
    for (const turn of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6]) {
      const ang = away + turn;
      for (let d = 2; d <= 70; d += 2) {
        const x = a.pos.x + Math.cos(ang) * d, z = a.pos.z + Math.sin(ang) * d;
        if (!open(x, z)) break;
        if (meadowRadius(x, z) > 38) return V(x, 0, z);
      }
    }
    return V(a.pos.x + Math.cos(away) * 45, 0, a.pos.z + Math.sin(away) * 45);
  }

  function startle(herd, cam) {
    for (const a of herd.animals) {
      if (a.state === 'alert' || a.state === 'flee' || a.state === 'gone') continue;
      a.state = 'alert';
      a.timer = between(0.35, 0.9); // a beat of freezing, head up, before they bolt
      a.target = hideout(a, cam);
    }
  }

  // --- a flock of small birds now and then, crossing the meadow by day ------------------------------
  const flock = { birds: [], active: false, next: between(5, 12), t: 0, dir: V(), start: V(), speed: 11 };
  for (let i = 0; i < 7; i++) {
    const b = birdModel();
    b.group.visible = false;
    b.offset = V(between(-4, 4), between(-1.5, 1.5), between(-4, 4));
    b.ph = between(0, 6);
    group.add(b.group);
    flock.birds.push(b);
  }
  let fair = 1; // 0 at night or in rain and snow, when the birds stay put

  // --- the Fourth of July eagle, circling high over the meadow -------------------------------------
  const eagle = eagleModel();
  eagle.group.visible = false;
  group.add(eagle.group);
  const soar = { on: false, angle: 0, flap: 6 };

  const q = new THREE.Quaternion(), UP = V(0, 1, 0), FWD = V(0, 0, 1), tmp = V(0, 0, 0);
  return {
    object: group,
    update(p) { fair = (1 - p.night) * (1 - Math.max(p.rain ?? 0, p.snow ?? 0)); },
    setHolidays(h) { soar.on = Boolean(h.july4); },
    tick(t, dt, camera) {
      const cam = camera.position;

      if (!flock.active && (flock.next -= dt) <= 0 && fair > 0.5) {
        const ang = between(0, Math.PI * 2);
        flock.dir.set(Math.cos(ang), 0, Math.sin(ang));
        flock.start.set(0, between(14, 26), 8).addScaledVector(flock.dir, -110)
          .add(tmp.set(-flock.dir.z, 0, flock.dir.x).multiplyScalar(between(-25, 25)));
        flock.t = 0;
        flock.active = true;
      }
      if (flock.active) {
        flock.t += dt;
        const done = flock.t * flock.speed > 220;
        for (const b of flock.birds) {
          b.group.visible = !done;
          b.group.position.copy(flock.start).addScaledVector(flock.dir, flock.speed * flock.t).add(b.offset);
          b.group.position.y += Math.sin(t * 1.3 + b.ph) * 0.5;
          b.group.quaternion.setFromUnitVectors(FWD, flock.dir);
          const beat = Math.sin(t * 17 + b.ph) * 0.9 * (Math.sin(t * 0.8 + b.ph) > -0.4 ? 1 : 0.1); // flap, then glide
          b.wings[0].rotation.z = beat;
          b.wings[1].rotation.z = -beat;
        }
        if (done) { flock.active = false; flock.next = between(18, 45); }
      }

      eagle.group.visible = soar.on && fair > 0.4;
      if (eagle.group.visible) {
        soar.angle += dt * 0.12;
        const r = 22, cx = 0, cz = -14; // far enough back to stay in the meadow view all the way round
        eagle.group.position.set(cx + Math.cos(soar.angle) * r, 20 + Math.sin(t * 0.3) * 1.5, cz + Math.sin(soar.angle) * r);
        const heading = Math.atan2(-Math.sin(soar.angle), Math.cos(soar.angle)); // along the circle
        eagle.group.rotation.set(0, heading, 0);
        eagle.group.rotateZ(0.32); // banked into the turn (the centre is off its right wing)
        soar.flap -= dt;
        const flapping = soar.flap < 1.2;
        if (soar.flap <= 0) soar.flap = between(6, 11);
        const beat = flapping ? Math.sin(t * 7) * 0.45 : 0;
        eagle.wings[0].rotation.z = -0.1 - beat; // left wing: negative lifts the tip
        eagle.wings[1].rotation.z = 0.1 + beat;
      }

      for (const a of animals) {
        const near = Math.hypot(a.pos.x - cam.x, a.pos.z - cam.z);
        if (near < a.shy && ['graze', 'look', 'walk', 'return'].includes(a.state)) startle(a.herd, cam);
        a.timer -= dt;
        let goal = 0, headUp = 1;
        switch (a.state) {
          case 'graze':
            headUp = 0;
            if (a.timer <= 0) { a.state = 'look'; a.timer = between(1, 3); }
            break;
          case 'look':
            if (a.timer <= 0) {
              if (rng() < 0.55) { a.state = 'walk'; a.target = wanderTarget(a); } else { a.state = 'graze'; a.timer = between(3, 8); }
            }
            break;
          case 'walk':
          case 'return':
            goal = a.state === 'walk' ? a.walk : a.walk * 1.5;
            if (Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < 0.4) { a.state = 'graze'; a.timer = between(4, 9); goal = 0; }
            break;
          case 'alert':
            if (a.timer <= 0) a.state = 'flee';
            break;
          case 'flee':
            goal = a.run;
            if (Math.hypot(a.target.x - a.pos.x, a.target.z - a.pos.z) < 1) {
              a.state = 'gone';
              a.timer = between(...a.away);
              a.model.group.visible = false;
            }
            break;
          case 'gone':
            // come back only once the camera has left their patch
            if (a.timer <= 0 && Math.hypot(a.herd.home.x - cam.x, a.herd.home.z - cam.z) > a.shy * 1.6) {
              a.state = 'return';
              a.target = wanderTarget(a);
              a.model.group.visible = true;
            }
            break;
        }
        if (a.state === 'gone') continue;
        // turn toward the target, then move
        a.speed += (goal - a.speed) * Math.min(1, dt * (goal > a.speed ? 3 : 5));
        if (a.target && a.speed > 0.02) {
          // a fleeing rabbit jinks from side to side
          if (a.hops && a.state === 'flee' && (a.zig -= dt) <= 0) { a.zig = 0.3; a.veer = between(-0.8, 0.8); }
          if (a.state !== 'flee') a.veer = 0;
          const want = Math.atan2(a.target.x - a.pos.x, a.target.z - a.pos.z) + a.veer;
          let d = want - a.heading;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          a.heading += Math.max(-1, Math.min(1, d)) * Math.min(1, dt * (a.state === 'flee' ? 6 : 2.5));
          a.pos.x += Math.sin(a.heading) * a.speed * dt;
          a.pos.z += Math.cos(a.heading) * a.speed * dt;
        }
        // gait: legs swing with speed; fleeing deer bound on all fours
        a.phase += dt * a.speed * a.stride * 0.35;
        const swing = Math.min(0.7, a.speed * 0.5);
        a.model.legs.forEach((l, i) => { l.rotation.x = Math.sin(a.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * swing; });
        const bouncing = a.hops ? a.speed > 0.05 : a.state === 'flee'; // rabbits hop everywhere; deer bound when fleeing
        const bound = bouncing ? Math.abs(Math.sin(a.phase * 0.5)) * a.bound : 0;
        a.look += ((headUp ? 0 : a.model.graze) - a.look) * Math.min(1, dt * 3);
        const peck = a.kind === 'turkey' && !headUp ? Math.max(0, Math.sin(t * 7 + a.phase)) * 0.25 : 0;
        a.model.neck.rotation.x = a.look + peck;
        const g = a.model.group;
        g.position.set(a.pos.x, heightAt(a.pos.x, a.pos.z) + bound, a.pos.z);
        g.quaternion.copy(q.setFromAxisAngle(UP, a.heading));
      }
    },
  };
}
