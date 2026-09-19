// The 3D ranch: renderer, lighting, time of day, camera moves and picking.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { PALETTES } from './data.js';
import {
  SITES, ENTRANCE, TRUCK, GROVES, inViewCorridor, heightAt, meadowRadius, alongDrive, smoothstep, lerp, clamp,
  createTerrain, createSky, createRidges, RIDGE_HAZE,
} from './world.js';
import {
  createForest, createLookout, createStars, createFireflies, createClouds, createAurora, createFireworks,
} from './nature.js';
import { createAFrame } from './models.js';
import { createAirstream } from './airstream.js';
import { createTruck, createFence, createSitePosts, createBathhouse, createSiteRing } from './props.js';
import { V, GLOW_LAYER } from './kit.js';
import { createWeather } from './weather.js';
import { createWildlife } from './wildlife.js';

const COLOR_KEYS = ['skyTop', 'skyMid', 'horizon', 'fog', 'ridge', 'sun', 'hemiSky', 'hemiGround'];
const NUM_KEYS = ['sunI', 'hemiI', 'disc', 'stars', 'night'];

function sunDirection(el, az) {
  const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
}

function toState(p) {
  const colors = {}, nums = {};
  for (const k of COLOR_KEYS) colors[k] = new THREE.Color(p[k]);
  for (const k of NUM_KEYS) nums[k] = p[k];
  return { colors, nums, dir: sunDirection(p.el, p.az) };
}

function cloneState(s) {
  const colors = {};
  for (const k of COLOR_KEYS) colors[k] = s.colors[k].clone();
  return { colors, nums: { ...s.nums }, dir: s.dir.clone() };
}

function blendInto(out, a, b, t) {
  for (const k of COLOR_KEYS) out.colors[k].copy(a.colors[k]).lerp(b.colors[k], t);
  for (const k of NUM_KEYS) out.nums[k] = lerp(a.nums[k], b.nums[k], t);
  out.dir.copy(a.dir).lerp(b.dir, t);
  if (out.dir.lengthSq() < 1e-4) out.dir.set(0, 1, 0);
  out.dir.normalize();
}

// Taller screens get a taller field of view so both stays stay in frame.
const fovFor = (aspect) => (aspect >= 1.3 ? 46
  : aspect >= 1 ? lerp(56, 46, (aspect - 1) / 0.3)
  : lerp(74, 56, clamp((aspect - 0.45) / 0.55, 0, 1)));

// How far the camera may swing around a stay, relative to its framing, and pull back from it
const DEFAULT_ORBIT = [-1, 1];
const OVERVIEW_ORBIT = [-1.25, 1.25];
const FOCUS_DISTANCE = [8, 30];

// The entrance sign: the ranch's name hung over the drive this far in from the road, its lower
// edge this high. It's the page's own lettering (see .entrance-sign): SIGN_PX of it is shown
// SIGN_WIDTH across, and narrow screens stack it.
const SIGN_AT = 15, SIGN_CLEAR = 4.4, SIGN_WIDTH = 12.5, SIGN_PX = 1200;
const INTRO_SECONDS = 10.5;

const easeInOutCubic = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

/** How high the camera must stay above the ground to clear the trees there. */
function cameraClearance(x, z) {
  if (inViewCorridor(x, z)) return 2;
  let trees = smoothstep(26, 44, meadowRadius(x, z));
  for (const [gx, gz, gr] of GROVES) trees = Math.max(trees, 1 - smoothstep(gr - 4, gr + 4, Math.hypot(x - gx, z - gz)));
  for (const s of Object.values(SITES)) {
    if (Math.hypot(x - s.x, z - s.z) < s.pad) trees = 0; // pads are cleared of forest
  }
  return 2 + 11 * trees;
}

export function createRanchScene({
  canvas, markers = {}, sign: signEl = null, reducedMotion = false,
  onHover = () => {}, onSelect = () => {}, onHeading = () => {}, onReady = () => {}, onIntroEnd = () => {},
  onEasterEgg = () => {},
}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let prCap = 1.75; // lowered automatically if the GPU can't keep up
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#f0a266', 12, 520);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 3200);
  camera.layers.enable(GLOW_LAYER);

  const hemi = new THREE.HemisphereLight('#ffffff', '#000000', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 420 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.target.position.set(0, 0, 2);
  scene.add(hemi, sun, sun.target);

  const sky = createSky();
  const ridges = createRidges();
  scene.add(sky, ridges, createTerrain());

  const aframe = createAFrame();
  const airstream = createAirstream();
  const stays = { aframe, airstream };

  const anchors = {}, views = {};
  for (const s of Object.values(stays)) {
    s.object.updateMatrixWorld(true);
    anchors[s.id] = s.object.localToWorld(s.anchor.clone());
    const pos = s.object.localToWorld(s.view.camera.clone());
    const target = s.object.localToWorld(s.view.target.clone());
    views[s.id] = { pos, target, orbit: s.view.orbit ?? DEFAULT_ORBIT };
  }
  // no trees between a stay and anywhere the camera can orbit to while looking at it
  const sightlines = Object.values(views).map(({ pos, target, orbit }) => ({
    x: target.x, z: target.z, az: Math.atan2(pos.x - target.x, pos.z - target.z),
    from: orbit[0], to: orbit[1], reach: FOCUS_DISTANCE[1] + 2,
  }));
  const rings = {
    aframe: createSiteRing('aframe', 9, [1.4, 1.4]),
    airstream: createSiteRing('airstream', 8.3, [-0.8, 2.5]),
  };
  const weather = createWeather();
  const aurora = createAurora();
  const parts = [
    aurora, createFireworks(),
    createForest({ sightlines }), createLookout(), createStars(), createFireflies(), createClouds(), createWildlife(),
    aframe, airstream, createTruck(), createFence(), createSitePosts(), createBathhouse(),
    rings.aframe, rings.airstream,
  ];
  for (const p of parts) scene.add(p.object);
  scene.add(weather.object); // ticked on its own: it drives the sky, not the other way round

  // invisible, generous hit boxes make the stays easy to click
  const proxies = [];
  for (const stay of Object.values(stays)) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...stay.hitBox.size), new THREE.MeshBasicMaterial());
    m.position.copy(stay.hitBox.center);
    m.visible = false;
    m.userData.stay = stay.id;
    stay.object.add(m);
    proxies.push(m);
  }

  // An easter egg: look through the A-frame's telescope (click it) for the northern lights.
  const scopeHit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.9), new THREE.MeshBasicMaterial());
  scopeHit.position.y = 0.85;
  scopeHit.visible = false;
  aframe.telescope.add(scopeHit);

  // Mirror-polished aluminium: reflect the world as seen from inside the trailer.
  const probe = new THREE.CubeCamera(0.5, 3000, new THREE.WebGLCubeRenderTarget(256));
  airstream.object.updateMatrixWorld(true);
  probe.position.copy(airstream.object.localToWorld(airstream.reflectionProbe.clone()));
  probe.updateMatrixWorld(true);
  airstream.setEnvMap(probe.renderTarget.texture);
  let reflectionsDirty = true;
  function captureReflections() {
    reflectionsDirty = false;
    airstream.trailer.visible = false;
    const autoShadows = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    probe.update(renderer, scene);
    renderer.shadowMap.autoUpdate = autoShadows;
    airstream.trailer.visible = true;
    probe.renderTarget.texture.needsPMREMUpdate = true;
  }

  // --- time of day -------------------------------------------------------------
  const states = Object.fromEntries(Object.entries(PALETTES).map(([k, p]) => [k, toState(p)]));
  let current = cloneState(states.golden);
  let blend = null;
  const shown = cloneState(current); // `current` as the weather shows it
  let skyDirty = false;

  function applyState(s) {
    const { colors: c, nums: n } = s;
    const u = sky.material.uniforms;
    u.top.value.copy(c.skyTop);
    u.mid.value.copy(c.skyMid);
    u.horizon.value.copy(c.horizon);
    u.sunColor.value.copy(c.sun);
    u.sunDir.value.copy(s.dir);
    u.disc.value = n.disc;
    scene.fog.color.copy(c.fog);
    ridges.children.forEach((m, i) => {
      m.material.uniforms.cTop.value.copy(c.ridge).lerp(c.fog, RIDGE_HAZE[i]);
      m.material.uniforms.cBot.value.copy(c.ridge).lerp(c.fog, Math.min(1, RIDGE_HAZE[i] + 0.2));
    });
    sun.color.copy(c.sun);
    sun.intensity = n.sunI;
    sun.position.copy(sun.target.position).addScaledVector(s.dir, 200);
    hemi.color.copy(c.hemiSky);
    hemi.groundColor.copy(c.hemiGround);
    hemi.intensity = n.hemiI;
    renderer.setClearColor(c.fog);
    for (const p of parts) p.update?.(n, c);
  }

  function showSky() {
    applyState(weather.shade(current, shown));
    weather.fog(scene.fog);
    skyDirty = false;
  }

  function skyTo(to, instant, duration) {
    if (instant || reducedMotion) {
      current = cloneState(to);
      blend = null;
      showSky();
      reflectionsDirty = true;
    } else {
      blend = { from: cloneState(current), to, t: 0, duration };
    }
  }

  function setTimeOfDay(key, instant = false) {
    if (states[key]) skyTo(states[key], instant, 1.6);
  }

  /** Part way from one palette to another, as the live sky asks for. */
  function setTimeMix(from, to, t, instant = false) {
    if (!states[from] || !states[to]) return;
    const mix = cloneState(states[from]);
    blendInto(mix, states[from], states[to], t);
    skyTo(mix, instant, 3);
  }

  /** Roll in one of the weather presets (see weather.js); `instant` skips the easing. */
  function setWeather(kind, { instant = false } = {}) {
    weather.set(kind, { instant: instant || reducedMotion });
    skyDirty = true;
  }

  // --- the entrance sign ---------------------------------------------------------------
  // The browser draws the letters (so they stay sharp up close) and CSS 3D transforms hang them
  // over the drive, so the arrival drives right underneath. Shown only during the intro.
  let sign = null;
  if (signEl) {
    const layer = new CSS3DRenderer();
    layer.domElement.className = 'sign-layer';
    layer.domElement.hidden = true;
    canvas.after(layer.domElement);
    const at = alongDrive(SIGN_AT);
    const object = new CSS3DObject(signEl);
    object.position.set(at.x, 0, at.z);
    object.rotation.y = Math.atan2(-at.dx, -at.dz); // facing back down the drive
    object.scale.setScalar(SIGN_WIDTH / SIGN_PX);
    const signScene = new THREE.Scene();
    signScene.add(object);
    sign = { layer, object, signScene, facing: V(-at.dx, 0, -at.dz), ground: heightAt(at.x, at.z) };
  }

  // --- viewport & framing ------------------------------------------------------------
  const size = { w: 1, h: 1 };
  let viewAspect = 1;
  const inset = { right: 0, bottom: 0 };
  const insetGoal = { right: 0, bottom: 0 };

  function applyInset() {
    const { w, h } = size;
    const { right: r, bottom: b } = inset;
    if (r < 0.5 && b < 0.5) {
      camera.clearViewOffset();
      camera.aspect = w / h;
    } else {
      camera.aspect = (w + r) / (h + b);
      camera.setViewOffset(w + r, h + b, r, b, w, h);
    }
    camera.updateProjectionMatrix();
  }

  function resize() {
    size.w = Math.max(1, canvas.clientWidth);
    size.h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, prCap));
    renderer.setSize(size.w, size.h, false);
    sign?.layer.setSize(size.w, size.h);
    viewAspect = size.w / size.h;
    camera.fov = fovFor(viewAspect);
    applyInset();
  }
  new ResizeObserver(resize).observe(canvas);
  (function watchPixelRatio() {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      .addEventListener('change', () => { resize(); watchPixelRatio(); }, { once: true });
  })();
  resize();

  // --- camera --------------------------------------------------------------------
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.06, enablePan: false,
    rotateSpeed: 0.45, zoomSpeed: 0.7, minPolarAngle: 0.35, maxPolarAngle: 1.54,
  });

  const OVERVIEW = { pos: V(0, 8.2, 46), target: V(0, 8.4, -10) };
  const pullBack = () => (viewAspect >= 1.3 ? 1
    : viewAspect >= 1 ? 1.12
    : lerp(1.45, 1.12, clamp((viewAspect - 0.45) / 0.55, 0, 1)));
  const posePush = (pose) => ({
    pos: pose.target.clone().lerp(pose.pos, pullBack()),
    target: pose.target.clone(),
    orbit: pose.orbit ?? OVERVIEW_ORBIT,
  });
  const overviewPose = () => posePush(OVERVIEW);
  const focusPose = (id) => posePush(views[id]);

  let mode = 'overview';
  let selected = null, hovered = null, highlighted = null;
  let tween = null, intro = null;
  let idle = 0, swaySign = 1;

  function limitAround(pose) {
    const az = Math.atan2(pose.pos.x - pose.target.x, pose.pos.z - pose.target.z);
    controls.minAzimuthAngle = az + pose.orbit[0];
    controls.maxAzimuthAngle = az + pose.orbit[1];
  }

  function flyTo(pose, { duration = 1.9, arc = 4, distance = FOCUS_DISTANCE } = {}) {
    controls.enabled = false;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    tween = {
      p0: camera.position.clone(), t0: controls.target.clone(), pose, time: 0,
      duration: reducedMotion ? 0 : duration, arc, distance,
    };
  }

  function stepTween(dt) {
    tween.time += dt;
    const raw = tween.duration ? Math.min(1, tween.time / tween.duration) : 1;
    const k = easeInOutCubic(raw);
    camera.position.lerpVectors(tween.p0, tween.pose.pos, k);
    camera.position.y += Math.sin(Math.PI * k) * tween.arc;
    controls.target.lerpVectors(tween.t0, tween.pose.target, k);
    camera.lookAt(controls.target);
    if (raw >= 1) {
      const { pose, distance } = tween;
      tween = null;
      [controls.minDistance, controls.maxDistance] = distance;
      limitAround(pose);
      controls.enabled = true;
      controls.update();
    }
  }

  function focus(id) {
    if (!stays[id]) return;
    if (intro) intro = null;
    const from = mode;
    selected = id;
    mode = 'focus';
    flyTo(focusPose(id), { duration: from === 'focus' ? 2.3 : 2.0, arc: from === 'focus' ? 9 : 3 });
  }

  function overview() {
    if (intro) intro = null;
    selected = null;
    mode = 'overview';
    idle = 0;
    flyTo(overviewPose(), { duration: 1.8, arc: 3, distance: [22, 95] });
  }

  function playIntro() {
    const end = overviewPose();
    if (reducedMotion) {
      camera.position.copy(end.pos);
      controls.target.copy(end.target);
      overview();
      onIntroEnd();
      return;
    }
    mode = 'intro';
    controls.enabled = false;
    // Up the county road, a right turn in under the sign, up the drive past the old truck, then
    // off the drive and up for the view over the meadow. `look` holds where the camera looks as
    // it passes each point of `path`.
    const EYE = 2.6; // a pickup's cab
    const ground = (x, z, lift = EYE) => V(x, heightAt(x, z) + lift, z);
    const drive = (d, lift = EYE) => { const p = alongDrive(d); return ground(p.x, p.z, lift); };
    const E = ENTRANCE;
    const leave = drive(58, EYE + 1.2);
    const truck = V(TRUCK.x, TRUCK.y + 1.3, TRUCK.z);
    const stops = [
      [ground(E.x - 0.6, E.z + 24), ground(E.x - 0.2, E.z - 20, EYE + 1)],
      [ground(E.x - 0.4, E.z + 12), ground(E.x + 4, E.z - 7, EYE + 1)],
      [ground(E.x + 0.8, E.z + 3.6), drive(SIGN_AT, SIGN_CLEAR + 0.8)], // turning in, eyes on the sign
      [drive(5), drive(SIGN_AT + 3, SIGN_CLEAR + 0.3)],
      [drive(14), drive(30, EYE + 0.6)], // under it
      [drive(26), drive(42, EYE + 0.4)],
      [drive(38), drive(52, EYE).lerp(truck, 0.5)], // a glance at the truck going by
      [drive(50), drive(66, EYE + 0.6)],
      [leave.clone().lerp(end.pos, 0.45).setY(lerp(leave.y, end.pos.y, 0.7)), drive(74, 2).lerp(end.target, 0.55)],
      [end.pos, end.target],
    ];
    intro = {
      time: 0,
      duration: INTRO_SECONDS,
      path: new THREE.CatmullRomCurve3(stops.map(([at]) => at), false, 'centripetal'),
      look: new THREE.CatmullRomCurve3(stops.map(([, look]) => look), false, 'centripetal'),
      end,
    };
    if (sign) sign.layer.domElement.hidden = false;
  }

  function stepIntro(dt) {
    intro.time += dt;
    const raw = Math.min(1, intro.time / intro.duration);
    // even speed along the path; the look curve is sampled at the matching point
    const t = intro.path.getUtoTmapping(easeInOutSine(raw));
    camera.position.copy(intro.path.getPoint(t));
    const floor = heightAt(camera.position.x, camera.position.z) + 1.8;
    camera.position.y = Math.max(camera.position.y, floor);
    controls.target.copy(intro.look.getPoint(t));
    camera.lookAt(controls.target);
    if (raw >= 1) {
      intro = null;
      hideSign();
      mode = 'overview';
      [controls.minDistance, controls.maxDistance] = [22, 95];
      limitAround(overviewPose());
      controls.enabled = true;
      idle = 0;
      onIntroEnd();
    }
  }

  function skipIntro() {
    if (!intro) return;
    intro = null;
    hideSign();
    overview();
    onIntroEnd();
  }

  function hideSign() {
    if (sign) sign.layer.domElement.hidden = true;
  }

  /**
   * Fade the sign in once the camera has turned onto the drive's line (from the road, trees
   * would stand in front of it), and out as the camera passes under.
   */
  function updateSign() {
    const { object, facing } = sign;
    // the lettering is centred on the object: stand its lower edge SIGN_CLEAR above the drive
    object.position.y = sign.ground + SIGN_CLEAR + (object.element.offsetHeight * object.scale.y) / 2;
    tmp.subVectors(camera.position, object.position);
    const dist = tmp.length();
    const short = tmp.x * facing.x + tmp.z * facing.z; // how far short of the sign the camera still is
    const aside = Math.abs(tmp.x * facing.z - tmp.z * facing.x); // and how far off the drive's line
    camera.getWorldDirection(fwd);
    const facingIt = -tmp.dot(fwd) / dist;
    const show = smoothstep(0.55, 0.75, facingIt) * smoothstep(10, 6.5, aside)
      * (1 - smoothstep(48, 64, dist)) * smoothstep(0.4, 1.6, short);
    object.visible = show > 0.01;
    object.element.style.opacity = show.toFixed(3);
    sign.layer.render(sign.signScene, camera);
  }

  // --- picking ---------------------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDirty = false, pointerInside = false, down = null;

  function setPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerInside = true;
  }
  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(proxies, false)[0];
    return hit ? hit.object.userData.stay : null;
  }
  function setHovered(id) {
    if (id === hovered) return;
    hovered = id;
    canvas.classList.toggle('is-pointing', !!id);
    onHover(id);
  }

  canvas.addEventListener('pointermove', (e) => {
    setPointer(e);
    pointerDirty = true;
    idle = 0;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerInside = false;
    setHovered(null);
  });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    idle = 0;
    if (intro) skipIntro();
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick || tween) return;
    setPointer(e);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(scopeHit, false).length) return onEasterEgg('aurora');
    const id = pick();
    if (id) onSelect(id);
  });
  canvas.addEventListener('wheel', () => { idle = 0; if (intro) skipIntro(); }, { passive: true });
  controls.addEventListener('start', () => { idle = 0; });

  // --- frame loop ------------------------------------------------------------------
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  const clock = new THREE.Clock();
  let elapsed = 0, readySent = false, slow = 0;

  function updateMarkers() {
    for (const [id, el] of Object.entries(markers)) {
      tmp.copy(anchors[id]).project(camera);
      const onScreen = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
      const x = ((tmp.x + 1) / 2) * size.w;
      el.style.transform = `translate(${x}px, ${((1 - tmp.y) / 2) * size.h}px)`;
      // slide the label (not the pin) back inside the screen edges
      el.style.setProperty('--nudge', `${Math.round(clamp(x, 70, Math.max(70, size.w - 70)) - x)}px`);
      el.classList.toggle('is-offscreen', !onScreen);
      el.classList.toggle('is-hot', hovered === id || highlighted === id);
    }
  }

  showSky();
  camera.position.copy(OVERVIEW.pos);
  controls.target.copy(OVERVIEW.target);
  camera.lookAt(controls.target);

  let manualDt = null; // set by debug.advance() to step the loop deterministically
  let weatherSettle = 0;
  function frame() {
    const raw = manualDt ?? clock.getDelta();
    const dt = Math.min(raw, 0.05);
    elapsed += dt;
    idle += dt;

    // Step the resolution down on GPUs that can't hold ~36fps (after shader warm-up).
    if (manualDt === null && elapsed > 4 && raw < 0.25) {
      slow = raw > 1 / 36 ? slow + raw : Math.max(0, slow - raw);
      if (slow > 2.5 && prCap > 1) {
        prCap = Math.max(1, prCap - 0.25);
        slow = 0;
        resize();
      }
    }

    if (blend) {
      const before = blend.t;
      blend.t = Math.min(1, blend.t + dt / blend.duration);
      blendInto(current, blend.from, blend.to, easeInOutSine(blend.t));
      skyDirty = true;
      if ((before < 0.5 && blend.t >= 0.5) || blend.t >= 1) reflectionsDirty = true;
      if (blend.t >= 1) blend = null;
    }

    let insetChanged = false;
    for (const k of ['right', 'bottom']) {
      if (Math.abs(inset[k] - insetGoal[k]) > 0.5) {
        inset[k] = reducedMotion ? insetGoal[k] : lerp(inset[k], insetGoal[k], Math.min(1, dt * 5));
        insetChanged = true;
      } else if (inset[k] !== insetGoal[k]) {
        inset[k] = insetGoal[k];
        insetChanged = true;
      }
    }
    if (insetChanged) applyInset();

    if (intro) {
      stepIntro(dt);
    } else if (tween) {
      stepTween(dt);
    } else {
      const sway = mode === 'overview' && !reducedMotion && idle > 5;
      controls.autoRotate = sway;
      if (sway) {
        const az = controls.getAzimuthalAngle();
        // a slow look left and right that stays inside the tree-free corridor
        if (az > 0.15) swaySign = 1;
        else if (az < -0.15) swaySign = -1;
        controls.autoRotateSpeed = 0.1 * swaySign;
      }
      controls.update(dt);
      const p = camera.position;
      const floor = heightAt(p.x, p.z) + cameraClearance(p.x, p.z);
      if (p.y < floor) p.y = lerp(p.y, floor, Math.min(1, dt * 8));
    }

    if (pointerDirty && pointerInside && !intro && !tween) {
      pointerDirty = false;
      setHovered(pick());
    }

    // weather follows the camera; re-light the scene while it changes, and refresh the
    // Airstream's reflections once it settles
    if (weather.tick(dt, elapsed, camera)) {
      skyDirty = true;
      weatherSettle = 0.5;
    } else if (weatherSettle > 0 && (weatherSettle -= dt) <= 0) {
      reflectionsDirty = true;
    }
    if (skyDirty) showSky();

    sky.position.copy(camera.position);
    for (const id of Object.keys(rings)) {
      const hot = hovered === id || highlighted === id;
      rings[id].target = hot ? 1 : selected === id ? 0.55 : 0;
    }
    for (const p of parts) p.tick?.(elapsed, dt, camera);

    // the first capture waits a frame so the shadow maps exist
    if (reflectionsDirty && readySent) captureReflections();
    renderer.render(scene, camera);
    if (intro && sign) updateSign();
    updateMarkers();
    camera.getWorldDirection(tmp);
    onHeading((THREE.MathUtils.radToDeg(Math.atan2(tmp.x, -tmp.z)) + 360) % 360); // north is -z

    if (!readySent) {
      readySent = true;
      onReady();
    }
  }
  renderer.setAnimationLoop(frame);

  return {
    focus,
    overview,
    playIntro,
    skipIntro,
    setTimeOfDay,
    setTimeMix,
    setWeather,
    /** Northern lights on or off (they only show after dark). */
    setAurora(on) {
      aurora.set(on);
      weatherSettle = 5; // catch them in the Airstream's reflections once they're up
    },
    get aurora() { return aurora.on; },
    /** Dress the ranch for the holidays in `h`, e.g. { christmas: true } (see holidays.js). */
    setHolidays(h) {
      for (const p of parts) p.setHolidays?.(h);
      weatherSettle = 1; // lights near the Airstream belong in its reflections
    },
    setInset(right = 0, bottom = 0) {
      insetGoal.right = right;
      insetGoal.bottom = bottom;
    },
    setHighlight(id) { highlighted = id; },
    get mode() { return mode; },
    debug: {
      renderer, scene, camera, controls, OVERVIEW, views, weather,
      get pixelRatio() { return renderer.getPixelRatio(); },
      /** Run the frame loop for `seconds` of simulated time (for testing in hidden tabs). */
      advance(seconds, step = 1 / 30) {
        for (let t = 0; t < seconds; t += step) {
          manualDt = step;
          frame();
        }
        manualDt = null;
        clock.getDelta();
      },
    },
  };
}
