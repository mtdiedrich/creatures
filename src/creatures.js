import * as THREE from 'three';
import { N, S, GATE_IN, inGarden, inStrip, tileToWorld, worldToTile } from './grid.js';
import { saturationMaterial } from './art.js';
import { FLOWER_COLORS } from './plants.js';
import tuning from './tuning.json';

const CT = tuning.creatures;
const UP = new THREE.Vector3(0, 1, 0);

// ---------- Models ----------

function makeKit() {
  const sat = { value: 0 };
  const cache = new Map();
  const mat = (color, extra = {}) => {
    const k = color + JSON.stringify(extra);
    if (!cache.has(k)) cache.set(k, saturationMaterial({ color, roughness: 0.55, ...extra }, sat));
    return cache.get(k);
  };
  const mesh = (geo, color, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], extra) => {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.position.set(...pos); m.scale.set(...scale); m.rotation.set(...rot);
    m.castShadow = true;
    return m;
  };
  return { sat, mat, mesh };
}

function eye(kit, parent, x, y, z, r) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(kit.mesh(new THREE.SphereGeometry(r, 14, 10), 0xffffff));
  g.add(kit.mesh(new THREE.SphereGeometry(r * 0.62, 12, 8), 0x1d1b2b, [0, 0, r * 0.5]));
  g.add(kit.mesh(new THREE.SphereGeometry(r * 0.22, 8, 6), 0xffffff, [r * 0.22, r * 0.28, r * 0.95], [1, 1, 1], [0, 0, 0], { emissive: 0xffffff, emissiveIntensity: 0.6 }));
  parent.add(g);
  return g;
}

function buildPuffkin() {
  const kit = makeKit();
  const root = new THREE.Group();
  const body = new THREE.Group(); // hop/squash pivot at the feet
  root.add(body);
  const coral = 0xff7246, belly = 0xffe1a6, pink = 0xff9fb8, orange = 0xffa52e;
  body.add(kit.mesh(new THREE.SphereGeometry(0.3, 20, 16), coral, [0, 0.31, 0], [1, 0.93, 1.03]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.22, 16, 12), belly, [0, 0.27, 0.12], [1, 1, 0.75]));
  const eyes = [eye(kit, body, -0.11, 0.39, 0.235, 0.075), eye(kit, body, 0.11, 0.39, 0.235, 0.075)];
  body.add(kit.mesh(new THREE.SphereGeometry(0.035, 10, 8), 0x7a2b1c, [0, 0.33, 0.3], [1.2, 0.8, 1]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.05, 10, 8), pink, [-0.19, 0.31, 0.21], [1, 0.6, 0.4]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.05, 10, 8), pink, [0.19, 0.31, 0.21], [1, 0.6, 0.4]));
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.15 * s, 0.53, -0.02);
    ear.rotation.z = -0.35 * s;
    ear.add(kit.mesh(new THREE.ConeGeometry(0.085, 0.24, 12), coral, [0, 0.1, 0]));
    ear.add(kit.mesh(new THREE.ConeGeometry(0.05, 0.16, 10), pink, [0, 0.08, 0.035]));
    body.add(ear); ears.push(ear);
  }
  for (let i = 0; i < 3; i++) body.add(kit.mesh(new THREE.SphereGeometry(0.045, 8, 6), 0xffd23f, [(i - 1) * 0.045, 0.6 + (i === 1 ? 0.03 : 0), 0.05], [1, 1.4, 1], [0, 0, (1 - i) * 0.5]));
  const feet = [
    kit.mesh(new THREE.SphereGeometry(0.075, 10, 8), orange, [-0.12, 0.035, 0.08], [1, 0.5, 1.4]),
    kit.mesh(new THREE.SphereGeometry(0.075, 10, 8), orange, [0.12, 0.035, 0.08], [1, 0.5, 1.4]),
  ];
  feet.forEach((f) => root.add(f));
  const tail = kit.mesh(new THREE.SphereGeometry(0.1, 10, 8), belly, [0, 0.24, -0.29]);
  body.add(tail);
  return { root, body, eyes, ears, feet, tail, head: body, sat: kit.sat, kind: 'hopper', height: 0.65 };
}

function buildGlimmer() {
  const kit = makeKit();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const blue = 0x3c63ff, light = 0x8fd8ff, deep = 0x2a3fb8, glow = 0xfff36b;
  body.add(kit.mesh(new THREE.CapsuleGeometry(0.17, 0.34, 6, 14), blue, [0, 0.46, 0], [1, 1, 1], [Math.PI / 2, 0, 0]));
  body.add(kit.mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 12), light, [0, 0.4, 0.01], [1, 0.9, 1], [Math.PI / 2, 0, 0]));
  for (const [x, z] of [[-0.08, -0.1], [0.07, 0.05], [0, -0.22], [-0.05, 0.16]]) body.add(kit.mesh(new THREE.SphereGeometry(0.04, 8, 6), light, [x, 0.62, z], [1, 0.4, 1]));
  // Legs pivot at the hip so they can swing.
  const legs = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.4, z);
    hip.add(kit.mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.36, 8), deep, [0, -0.18, 0]));
    hip.add(kit.mesh(new THREE.SphereGeometry(0.05, 8, 6), 0x1f2a6b, [0, -0.36, 0.015], [1, 0.6, 1.3]));
    root.add(hip); legs.push(hip);
  }
  body.add(kit.mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.26, 10), blue, [0, 0.62, 0.22], [1, 1, 1], [0.5, 0, 0]));
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0.3);
  body.add(head);
  head.add(kit.mesh(new THREE.SphereGeometry(0.15, 16, 12), blue, [0, 0, 0], [1, 0.95, 1.1]));
  head.add(kit.mesh(new THREE.SphereGeometry(0.085, 12, 10), light, [0, -0.04, 0.13], [1.1, 0.8, 1]));
  head.add(kit.mesh(new THREE.SphereGeometry(0.02, 8, 6), 0x1d1b2b, [0, -0.01, 0.21]));
  const eyes = [eye(kit, head, -0.08, 0.04, 0.1, 0.06), eye(kit, head, 0.08, 0.04, 0.1, 0.06)];
  const ears = [];
  for (const s of [-1, 1]) {
    const ant = new THREE.Group();
    ant.position.set(0.06 * s, 0.11, -0.02);
    ant.rotation.z = -0.3 * s; ant.rotation.x = -0.25;
    ant.add(kit.mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.24, 6), deep, [0, 0.12, 0]));
    ant.add(kit.mesh(new THREE.SphereGeometry(0.045, 10, 8), glow, [0, 0.26, 0], [1, 1, 1], [0, 0, 0], { emissive: glow, emissiveIntensity: 0.9 }));
    head.add(ant); ears.push(ant);
    head.add(kit.mesh(new THREE.SphereGeometry(0.07, 10, 8), deep, [0.15 * s, 0.02, -0.04], [0.4, 0.9, 0.7], [0, 0, 0.5 * s]));
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.5, -0.3);
  tail.add(kit.mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16, Math.PI * 1.4), blue, [0, 0.12, -0.05], [1, 1, 1], [0, Math.PI / 2, -0.6]));
  tail.add(kit.mesh(new THREE.SphereGeometry(0.05, 10, 8), glow, [0, 0.3, -0.06], [1, 1, 1], [0, 0, 0], { emissive: glow, emissiveIntensity: 0.9 }));
  body.add(tail);
  return { root, body, eyes, ears, legs, tail, head, sat: kit.sat, kind: 'walker', height: 1.0 };
}

function buildBumblet() {
  const kit = makeKit();
  const root = new THREE.Group();
  const body = new THREE.Group(); // hover pivot
  root.add(body);
  const yellow = 0xffc21a, black = 0x2b2233, fuzz = 0xffe17a, pink = 0xff9fb8;
  const core = new THREE.Group();
  core.position.set(0, 0.55, -0.04);
  body.add(core);
  core.add(kit.mesh(new THREE.SphereGeometry(0.22, 18, 14), yellow, [0, 0, 0], [1, 0.95, 1.2]));
  // Stripes sit on the body surface: ring radius follows the ellipsoid's cross-section at that depth.
  for (const z of [-0.02, -0.13]) {
    const r = 0.22 * Math.sqrt(1 - (z / 0.264) ** 2);
    core.add(kit.mesh(new THREE.TorusGeometry(r - 0.006, 0.034, 8, 28), black, [0, 0, z], [1, 0.95, 1]));
  }
  core.add(kit.mesh(new THREE.ConeGeometry(0.05, 0.08, 10), black, [0, 0, -0.28], [1, 1, 1], [-Math.PI / 2, 0, 0]));
  core.add(kit.mesh(new THREE.SphereGeometry(0.1, 10, 8), fuzz, [0, 0.12, 0.1], [1.4, 0.6, 1]));
  const head = new THREE.Group();
  head.position.set(0, 0.6, 0.2);
  body.add(head);
  head.add(kit.mesh(new THREE.SphereGeometry(0.15, 16, 12), 0xffb02e));
  head.add(kit.mesh(new THREE.SphereGeometry(0.04, 8, 6), pink, [-0.1, -0.04, 0.1], [1, 0.6, 0.4]));
  head.add(kit.mesh(new THREE.SphereGeometry(0.04, 8, 6), pink, [0.1, -0.04, 0.1], [1, 0.6, 0.4]));
  head.add(kit.mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 12, Math.PI), 0x7a2b1c, [0, -0.05, 0.14], [1, 1, 1], [0, 0, Math.PI]));
  const eyes = [eye(kit, head, -0.065, 0.03, 0.11, 0.055), eye(kit, head, 0.065, 0.03, 0.11, 0.055)];
  const ears = [];
  for (const s of [-1, 1]) {
    const ant = new THREE.Group();
    ant.position.set(0.05 * s, 0.12, 0.02);
    ant.rotation.z = -0.35 * s; ant.rotation.x = 0.3;
    ant.add(kit.mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.18, 6), black, [0, 0.09, 0]));
    ant.add(kit.mesh(new THREE.SphereGeometry(0.035, 8, 6), black, [0, 0.19, 0]));
    head.add(ant); ears.push(ant);
  }
  // Wings hinge at the back; flapped every frame.
  const wings = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(0.08 * s, 0.74, -0.02);
    hinge.add(kit.mesh(new THREE.SphereGeometry(1, 14, 8), 0xdff4ff, [0.17 * s, 0.02, -0.05], [0.18, 0.02, 0.11], [0, 0.3 * s, 0],
      { transparent: true, opacity: 0.6, roughness: 0.1, emissive: 0x9fd8ff, emissiveIntensity: 0.25 }));
    body.add(hinge); wings.push(hinge);
  }
  const legs = [];
  for (const [x, z] of [[-0.08, 0.06], [0.08, 0.06], [-0.07, -0.08], [0.07, -0.08]]) {
    legs.push(kit.mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.14, 5), black, [x, 0.38, z]));
  }
  legs.forEach((l) => body.add(l));
  // Soft ground shadow blob so the hover reads.
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  blob.position.y = 0.02;
  root.add(blob);
  return { root, body, eyes, ears, wings, legs, head, blob, sat: kit.sat, kind: 'flyer', height: 0.9 };
}

function buildMoonmoth() {
  const kit = makeKit();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const fluff = 0xf3ecff, lilac = 0xb9a3ff, deep = 0x6b55d9, glow = 0x9ff3ff;
  body.add(kit.mesh(new THREE.SphereGeometry(0.17, 16, 12), fluff, [0, 0.58, -0.06], [1, 1, 1.35]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.13, 14, 10), lilac, [0, 0.52, -0.24], [1, 0.9, 1.2]));
  // Fluffy collar ruff
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    body.add(kit.mesh(new THREE.SphereGeometry(0.06, 8, 6), 0xffffff, [Math.cos(a) * 0.13, 0.66 + Math.sin(a) * 0.08, 0.08]));
  }
  const head = new THREE.Group();
  head.position.set(0, 0.66, 0.17);
  body.add(head);
  head.add(kit.mesh(new THREE.SphereGeometry(0.13, 16, 12), fluff));
  const eyes = [];
  for (const s of [-1, 1]) {
    // Big glossy dark moth eyes with a highlight.
    const g = new THREE.Group();
    g.position.set(0.065 * s, 0.02, 0.09);
    g.add(kit.mesh(new THREE.SphereGeometry(0.058, 12, 10), 0x2a2140, [0, 0, 0], [1, 1.1, 0.8], [0, 0, 0], { roughness: 0.2 }));
    g.add(kit.mesh(new THREE.SphereGeometry(0.016, 8, 6), 0xffffff, [0.015, 0.025, 0.045], [1, 1, 1], [0, 0, 0], { emissive: 0xffffff, emissiveIntensity: 0.8 }));
    head.add(g); eyes.push(g);
  }
  head.add(kit.mesh(new THREE.SphereGeometry(0.03, 8, 6), 0xff9fd0, [-0.08, -0.05, 0.08], [1, 0.6, 0.4]));
  head.add(kit.mesh(new THREE.SphereGeometry(0.03, 8, 6), 0xff9fd0, [0.08, -0.05, 0.08], [1, 0.6, 0.4]));
  const ears = [];
  for (const s of [-1, 1]) {
    // Feathery antennae: a stalk with little side fronds.
    const ant = new THREE.Group();
    ant.position.set(0.05 * s, 0.1, 0.03);
    ant.rotation.z = -0.5 * s; ant.rotation.x = 0.2;
    ant.add(kit.mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.22, 5), deep, [0, 0.11, 0]));
    for (let k = 0; k < 4; k++) ant.add(kit.mesh(new THREE.SphereGeometry(1, 6, 4), lilac, [0.02 * -s, 0.06 + k * 0.045, 0], [0.035, 0.012, 0.012], [0, 0, 0.6 * s]));
    head.add(ant); ears.push(ant);
  }
  // Two pairs of broad wings with glowing eye-spots. Index parity sets the flap direction per side.
  const wings = [];
  const wingMat = { roughness: 0.6, transparent: true, opacity: 0.95 };
  for (const [s, big] of [[-1, 1], [1, 1], [-1, 0], [1, 0]]) {
    const hinge = new THREE.Group();
    hinge.position.set(0.1 * s, 0.68, big ? 0.0 : -0.17);
    const w = big ? [0.3, 0.025, 0.2] : [0.22, 0.022, 0.15];
    hinge.add(kit.mesh(new THREE.SphereGeometry(1, 16, 8), lilac, [w[0] * 0.9 * s, 0, big ? 0.04 : -0.04], w, [0, (big ? 0.35 : -0.35) * s, 0], wingMat));
    hinge.add(kit.mesh(new THREE.SphereGeometry(1, 12, 6), deep, [w[0] * 0.95 * s, 0.012, big ? 0.04 : -0.04], [w[0] * 0.55, 0.02, w[2] * 0.55], [0, (big ? 0.35 : -0.35) * s, 0]));
    hinge.add(kit.mesh(new THREE.SphereGeometry(0.045, 10, 8), glow, [w[0] * 1.1 * s, 0.02, big ? 0.05 : -0.05], [1, 0.3, 1], [0, 0, 0], { emissive: glow, emissiveIntensity: 1.2 }));
    body.add(hinge); wings.push(hinge);
  }
  const legs = [];
  for (const [x, z] of [[-0.06, 0.05], [0.06, 0.05], [-0.06, -0.08], [0.06, -0.08]]) legs.push(kit.mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.16, 5), deep, [x, 0.42, z]));
  legs.forEach((l) => body.add(l));
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.26, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  blob.position.y = 0.02;
  root.add(blob);
  return { root, body, eyes, ears, wings, legs, head, blob, sat: kit.sat, kind: 'flyer', height: 0.95, wingSpeed: 9, wingAmp: 0.45 };
}

function buildPuddlehop() {
  const kit = makeKit();
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const green = 0x2fd39a, belly = 0xdcffb8, dark = 0x1b9a73, leaf = 0x6fcf3a;
  body.add(kit.mesh(new THREE.SphereGeometry(0.28, 20, 14), green, [0, 0.24, 0], [1.1, 0.75, 1]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.2, 16, 12), belly, [0, 0.19, 0.12], [1.1, 0.75, 0.7]));
  // Spots
  for (const [x, z] of [[-0.14, -0.1], [0.12, -0.14], [0.02, -0.2]]) body.add(kit.mesh(new THREE.SphereGeometry(0.045, 8, 6), dark, [x, 0.4, z], [1, 0.35, 1]));
  // Eyes sit on top bumps; the bumps double as "ears" for the hop animation.
  const ears = [], eyes = [];
  for (const s of [-1, 1]) {
    const bump = new THREE.Group();
    bump.position.set(0.12 * s, 0.4, 0.1);
    bump.add(kit.mesh(new THREE.SphereGeometry(0.085, 12, 10), green));
    eyes.push(eye(kit, bump, 0, 0.02, 0.05, 0.065));
    body.add(bump); ears.push(bump);
  }
  // Wide smile and rosy cheeks
  body.add(kit.mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 20, Math.PI), 0x13523f, [0, 0.24, 0.27], [1, 0.7, 1], [0.15, 0, Math.PI]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.04, 8, 6), 0xff9fb8, [-0.2, 0.25, 0.2], [1, 0.6, 0.4]));
  body.add(kit.mesh(new THREE.SphereGeometry(0.04, 8, 6), 0xff9fb8, [0.2, 0.25, 0.2], [1, 0.6, 0.4]));
  // Leaf umbrella hat (animated like a tail)
  const hat = new THREE.Group();
  hat.position.set(0, 0.46, -0.06);
  hat.add(kit.mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 5), 0x3b8a2a, [0, 0.1, 0]));
  hat.add(kit.mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), leaf, [0, 0.2, 0], [0.22, 0.07, 0.17], [0.15, 0, 0.1]));
  hat.add(kit.mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.4, 4), 0x3b8a2a, [0, 0.215, 0], [1, 1, 1], [Math.PI / 2, 0, 0.1]));
  body.add(hat);
  const feet = [
    kit.mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, [-0.16, 0.03, 0.12], [1.3, 0.4, 1.4]),
    kit.mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, [0.16, 0.03, 0.12], [1.3, 0.4, 1.4]),
  ];
  feet.forEach((f) => root.add(f));
  return { root, body, eyes, ears, feet, tail: hat, head: body, sat: kit.sat, kind: 'hopper', height: 0.7 };
}

// Per-species visuals: model builder, settle sparkle colour, focus-ring size.
export const SPECIES_ART = {
  A: { build: buildPuffkin, sparkle: 0xff9f45, ring: 0.8 },
  B: { build: buildGlimmer, sparkle: 0x6fb8ff, ring: 1.0 },
  C: { build: buildBumblet, sparkle: 0xffd23f, ring: 0.85 },
  D: { build: buildMoonmoth, sparkle: 0x9ff3ff, ring: 0.95 },
  E: { build: buildPuddlehop, sparkle: 0x7fffd0, ring: 0.85 },
};

// Full-colour portrait of a species for the journal, rendered once to a data URL.
let portraitRenderer = null;
const portraitCache = new Map();
export function speciesPortrait(key) {
  if (portraitCache.has(key)) return portraitCache.get(key);
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitRenderer.setSize(256, 256);
    portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const m = SPECIES_ART[key].build();
  m.sat.value = 1;
  m.root.rotation.y = 0.45;
  scene.add(m.root);
  const h = m.height;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0, h * 0.75, h * 2.6);
  cam.lookAt(0, h * 0.48, 0);
  portraitRenderer.render(scene, cam);
  const url = portraitRenderer.domElement.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

// Speech-bubble sprites for creature status (Zzz, hungry).
const bubbleCache = new Map();
function bubbleTexture(kind) {
  if (bubbleCache.has(kind)) return bubbleCache.get(kind);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  x.fillStyle = '#fff8ea'; x.strokeStyle = '#3b2a1a'; x.lineWidth = 6;
  x.beginPath(); x.arc(64, 56, 44, 0, Math.PI * 2); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(40, 92); x.lineTo(30, 120); x.lineTo(62, 98); x.fill(); x.stroke();
  x.beginPath(); x.arc(64, 56, 41, 0, Math.PI * 2); x.fill();
  if (kind === 'zzz') {
    x.fillStyle = '#5b6bd6'; x.font = 'bold 34px Fredoka, Trebuchet MS, sans-serif'; x.textAlign = 'center';
    x.fillText('z', 46, 72); x.font = 'bold 44px Fredoka, Trebuchet MS, sans-serif'; x.fillText('Z', 76, 58);
  } else {
    // A flower in the colour of the food it wants.
    const col = '#' + FLOWER_COLORS[kind.split('-')[1]].petal.toString(16).padStart(6, '0');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      x.fillStyle = col; x.beginPath(); x.ellipse(64 + Math.cos(a) * 16, 54 + Math.sin(a) * 16, 12, 8, a, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(64, 54, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e2574c'; x.font = 'bold 30px Fredoka, Trebuchet MS, sans-serif'; x.textAlign = 'center'; x.fillText('!', 98, 40);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  bubbleCache.set(kind, tex);
  return tex;
}

// ---------- Creature ----------

export class Creature {
  constructor(game, key) {
    this.game = game;
    this.key = key;
    this.cfg = tuning.species[key];
    this.customName = null;
    this.stage = 'appear';
    this.inside = false;
    this.model = SPECIES_ART[key].build();
    this.root = this.model.root;
    this.pos = this.root.position;
    this.yaw = 0;
    this.targetYaw = 0;
    this.waypoints = [];
    this.behavior = 'idle';
    this.idleTimer = 1;
    this.onArrive = null;
    this.lastEat = -Infinity; // game time of the last meal
    this.eatTimer = 0;
    this.eatPlant = null;
    this.settleTimer = 0;
    this.callTimer = 2 + Math.random() * 4;
    this.blinkTimer = 2;
    this.anim = 0;
    this.moveBlend = 0;
    this.incomeTimer = 0;
    // v0.3 state
    this.nightsPresent = 0;        // full nights spent here
    this.presentAtNightStart = false;
    this.showersSeen = 0;          // rain showers it was here for
    this.hunger = 0;               // game seconds since a resident last ate
    this.hungry = false;
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture('zzz'), transparent: true, depthWrite: false }));
    this.bubble.scale.set(0.55, 0.55, 1);
    this.bubble.visible = false;
    this.bubble.renderOrder = 12;
    this.root.add(this.bubble);
    game.scene.add(this.root);
  }

  get nocturnal() { return this.cfg.active === 'night'; }
  // Night creatures sleep through the day.
  get asleep() { return this.nocturnal && !this.game.dayCycle.isNight; }

  get displayName() { return this.customName || this.cfg.name; }
  get speciesName() { return this.cfg.name; }
  tile() { return worldToTile(this.pos.x, this.pos.z); }

  spawnOutside() {
    // Prefer the south strip so the player sees them near the gate.
    const candidates = [];
    for (let z = -S; z < N + S; z++) for (let x = -S; x < N + S; x++) if (inStrip(x, z)) candidates.push({ x, z });
    const south = candidates.filter((c) => c.z >= N && Math.abs(c.x - GATE_IN.x) < 9);
    const pool = Math.random() < 0.7 ? south : candidates;
    const t = pool[Math.floor(Math.random() * pool.length)];
    tileToWorld(t.x, t.z, this.pos);
    this.yaw = this.targetYaw = Math.random() * Math.PI * 2;
    this.behavior = 'idle';
    this.idleTimer = 1.5;
  }

  pathOpts() {
    if (this.stage === 'appear') return { inside: false, outside: true };
    if (!this.inside) return { inside: true, outside: true };
    return { inside: true, outside: false };
  }

  walkTo(tile, onArrive, standOffTarget = null) {
    const from = this.tile();
    const path = this.game.grid.findPath(from, tile, this.pathOpts());
    if (!path) return false;
    const pts = path.slice(1).map((p) => tileToWorld(p.x, p.z).add(new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)));
    if (standOffTarget) {
      // Stop just short of the plant so we face it while eating.
      const prev = pts.length > 1 ? pts[pts.length - 2] : this.pos.clone();
      const dir = new THREE.Vector3().subVectors(standOffTarget, prev).setY(0);
      if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
      dir.normalize();
      const stand = standOffTarget.clone().addScaledVector(dir, -0.38);
      if (pts.length) pts[pts.length - 1] = stand; else pts.push(stand);
    }
    this.waypoints = pts;
    this.behavior = 'walk';
    this.onArrive = onArrive;
    return true;
  }

  interrupt() {
    this.waypoints = [];
    this.onArrive = null;
    if (this.behavior !== 'settle') { this.behavior = 'idle'; this.idleTimer = 0.3; }
  }

  canEat() { return this.stage !== 'appear' && this.inside && !this.asleep && this.game.time - this.lastEat >= CT.eatCooldown; }

  findFood() {
    const here = this.pos;
    let best = null, bd = Infinity;
    for (const p of this.game.plants) {
      if (p.type !== this.cfg.food || !p.isAdult) continue;
      const d = p.group.position.distanceToSquared(here);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  decide() {
    if (this.asleep) { this.behavior = 'sleep'; return; }
    if (this.stage === 'appear') {
      // Wander the edge strip.
      for (let i = 0; i < 12; i++) {
        const t = this.tile();
        const x = t.x + Math.round((Math.random() - 0.5) * 12), z = t.z + Math.round((Math.random() - 0.5) * 12);
        if (inStrip(x, z) && this.walkTo({ x, z }, null)) return;
      }
      this.idleTimer = 1;
      return;
    }
    if (!this.inside) {
      if (this.walkTo(GATE_IN, () => { this.inside = true; this.behavior = 'idle'; this.idleTimer = 0.2; })) return;
      this.idleTimer = 1; return;
    }
    if (this.canEat()) {
      const food = this.findFood();
      if (food && this.walkTo(food.tile, () => this.startEat(food), food.group.position)) return;
    }
    // Wander the garden.
    const t = this.tile();
    for (let i = 0; i < 16; i++) {
      const x = t.x + Math.round((Math.random() - 0.5) * 10), z = t.z + Math.round((Math.random() - 0.5) * 10);
      if (this.game.grid.isWalkable(x, z) && (x !== t.x || z !== t.z)) {
        const path = this.game.grid.findPath(t, { x, z }, { inside: true, outside: false, strict: true });
        if (path && this.walkTo({ x, z }, null)) return;
      }
    }
    this.idleTimer = 1.5;
  }

  startEat(plant) {
    if (!plant.isAdult || !this.game.plants.includes(plant)) { this.behavior = 'idle'; this.idleTimer = 0.3; return; }
    this.behavior = 'eat';
    this.eatTimer = CT.eatTime;
    this.eatPlant = plant;
    const d = new THREE.Vector3().subVectors(plant.group.position, this.pos);
    this.targetYaw = Math.atan2(d.x, d.z);
    this.game.audio.play('munch');
  }

  finishEat() {
    const p = this.eatPlant;
    this.eatPlant = null;
    if (p && p.isAdult && this.game.plants.includes(p)) {
      p.eaten();
      this.lastEat = this.game.time;
      this.hunger = 0;
      this.hungry = false;
      this.game.fx.petals(p.group.position, FLOWER_COLORS[p.type].petal);
      this.game.onCreatureAte(this, p);
    }
    this.behavior = 'idle';
    this.idleTimer = 1.5 + Math.random() * 2;
  }

  beginVisit() {
    this.stage = 'visit';
    this.interrupt();
    this.idleTimer = 0.2;
  }

  beginResident() {
    this.stage = 'resident';
    this.waypoints = [];
    this.onArrive = null;
    this.behavior = 'settle';
    this.settleTimer = 0;
    this.incomeTimer = 0;
    this.hunger = 0;
    this.game.fx.sparkle(this.pos, SPECIES_ART[this.key].sparkle, 26);
    this.game.fx.sparkle(this.pos, 0xfff27a, 16);
  }

  update(dt) {
    const g = this.game;
    this.anim += dt;

    // Random calls while present.
    this.callTimer -= dt;
    if (this.callTimer <= 0 && !this.asleep) {
      this.callTimer = CT.callIntervalMin + Math.random() * (CT.callIntervalMax - CT.callIntervalMin);
      g.audio.call(this.key, this.pos);
    }

    if (this.stage === 'resident' && this.behavior !== 'settle') {
      // v0.3 hunger: a resident that goes a full in-game day without eating is Hungry and earns nothing.
      this.hunger += dt;
      if (!this.hungry && this.hunger >= CT.hungerLimit) {
        this.hungry = true;
        g.ui.tip(`${this.displayName} is hungry`, 'weather');
      }
      this.incomeTimer += dt;
      if (this.incomeTimer >= CT.incomeInterval) {
        this.incomeTimer -= CT.incomeInterval;
        if (!this.hungry) g.addCoins(this.cfg.incomePerMin, this.pos);
      }
    }

    let moving = false;
    switch (this.behavior) {
      case 'idle':
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) this.decide();
        break;
      case 'walk': {
        const wp = this.waypoints[0];
        if (!wp) {
          this.behavior = 'idle'; this.idleTimer = 1 + Math.random() * 3;
          const cb = this.onArrive; this.onArrive = null; if (cb) cb();
          break;
        }
        const d = new THREE.Vector3().subVectors(wp, this.pos).setY(0);
        const dist = d.length();
        const step = this.cfg.speed * dt;
        if (dist <= step) { this.pos.x = wp.x; this.pos.z = wp.z; this.waypoints.shift(); }
        else { d.multiplyScalar(1 / dist); this.pos.addScaledVector(d, step); this.targetYaw = Math.atan2(d.x, d.z); }
        moving = true;
        break;
      }
      case 'eat':
        this.eatTimer -= dt;
        if (Math.random() < dt * 2 && this.eatPlant) g.fx.petals(this.eatPlant.group.position, FLOWER_COLORS[this.eatPlant.type].petal);
        if (this.eatTimer <= 0) this.finishEat();
        break;
      case 'sleep':
        if (!this.asleep) { this.behavior = 'idle'; this.idleTimer = 0.5 + Math.random(); }
        break;
      case 'settle':
        this.settleTimer += dt;
        this.model.sat.value = Math.min(1, this.settleTimer / CT.colorFill);
        if (this.settleTimer >= CT.colorFill + 0.6) { this.behavior = 'idle'; this.idleTimer = 1; }
        break;
    }
    if (this.stage === 'resident' && this.behavior !== 'settle') this.model.sat.value = 1;

    // Smooth turning.
    let dy = this.targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * Math.min(1, dt * 8);
    this.root.rotation.y = this.yaw;

    this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 8);
    this.animate(dt, moving);

    // Status bubble: Zzz while asleep, a food bubble while hungry.
    const state = this.behavior === 'sleep' ? 'zzz' : this.hungry ? 'hungry-' + this.cfg.food : null;
    this.bubble.visible = !!state;
    if (state && this.bubbleState !== state) { this.bubble.material.map = bubbleTexture(state); this.bubbleState = state; }
    this.bubble.position.set(0.2, this.model.height + 0.3 + Math.sin(this.anim * 2) * 0.05, 0);
  }

  animate(dt, moving) {
    const m = this.model, t = this.anim;
    // Blink
    this.blinkTimer -= dt;
    const blink = this.blinkTimer < 0.12;
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 3;
    for (const e of m.eyes) e.scale.y = blink ? 0.15 : 1;

    const breathe = Math.sin(t * 2.4) * 0.025;
    m.body.rotation.set(0, 0, 0);
    m.body.position.set(0, 0, 0);
    m.body.scale.set(1, 1, 1);

    if (this.behavior === 'sleep') {
      for (const e of m.eyes) e.scale.y = 0.1;
      const br = Math.sin(t * 1.2) * 0.03;
      if (m.kind === 'flyer') {
        // Landed, wings folded.
        m.body.position.y = -0.3;
        m.body.rotation.x = 0.1;
        m.wings.forEach((w, i) => { w.rotation.z = (i % 2 ? -1 : 1) * -0.9; });
        m.blob.scale.setScalar(1.2);
      } else {
        m.body.scale.set(1 + br * 0.5, 0.92 + br, 1 + br * 0.5);
        m.body.position.y = -0.03;
      }
      return;
    }

    if (this.behavior === 'settle') {
      const p = Math.min(1, this.settleTimer / (CT.colorFill + 0.6));
      const jump = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      m.body.position.y = jump * 0.45;
      m.body.rotation.y = p * Math.PI * 2;
      if (m.kind === 'walker') m.legs.forEach((l) => { l.position.y = 0.4 + jump * 0.45; l.rotation.x = jump * 0.4; });
      if (m.feet) m.feet.forEach((f) => { f.position.y = 0.035 + jump * 0.45; });
      if (m.wings) m.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 40) * 0.6 * (i ? -1 : 1); });
      return;
    }

    if (m.kind === 'flyer') {
      // Hover with a gentle bob, wings buzzing; lean forward when flying, dip to the flower when eating.
      const eating = this.behavior === 'eat';
      m.body.position.y = Math.sin(t * 3) * 0.05 + (eating ? -0.14 : 0);
      m.body.rotation.x = moving ? 0.25 : eating ? 0.35 + Math.sin(t * 10) * 0.08 : Math.sin(t * 1.7) * 0.05;
      m.body.rotation.z = Math.sin(t * 2.1) * 0.06;
      m.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * (m.wingSpeed ?? 40) + (m.wingPhase ? i * Math.PI : 0)) * (m.wingAmp ?? 0.6) * (i % 2 ? -1 : 1); });
      m.ears.forEach((e, i) => { e.rotation.x = 0.3 + Math.sin(t * 5 + i) * 0.12; });
      m.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 4 + i) * 0.2; });
      m.blob.scale.setScalar(1 - m.body.position.y * 0.8);
      return;
    }

    if (m.kind === 'hopper') {
      if (moving) {
        const ph = t * 9;
        const hop = Math.abs(Math.sin(ph));
        m.body.position.y = hop * 0.14;
        const sq = 1 - (1 - hop) * 0.12;
        m.body.scale.set(1 + (1 - sq) * 0.6, sq + 0.04, 1 + (1 - sq) * 0.6);
        m.feet.forEach((f, i) => { f.position.y = 0.035 + hop * 0.08; f.position.z = 0.08 + Math.sin(ph + i * Math.PI) * 0.04; });
      } else {
        m.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5);
        m.feet.forEach((f) => { f.position.y = 0.035; f.position.z = 0.08; });
      }
      if (this.behavior === 'eat') {
        m.body.rotation.x = 0.35 + Math.abs(Math.sin(t * 10)) * 0.2;
        m.body.position.z = 0.04;
      }
      m.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 3 + i) * 0.08 + (moving ? -0.25 : 0); });
      m.tail.position.x = Math.sin(t * 6) * 0.02;
    } else {
      const ph = t * 7;
      m.legs.forEach((l, i) => {
        l.position.y = 0.4;
        const diag = (i === 0 || i === 3) ? 1 : -1;
        l.rotation.x = moving ? Math.sin(ph) * 0.6 * diag : 0;
      });
      m.body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.04 : breathe * 0.5;
      m.head.rotation.x = this.behavior === 'eat' ? 0.9 + Math.sin(t * 10) * 0.15 : Math.sin(t * 1.3) * 0.06;
      m.head.position.y = this.behavior === 'eat' ? 0.62 : 0.76;
      m.head.position.z = this.behavior === 'eat' ? 0.38 : 0.3;
      m.ears.forEach((e, i) => { e.rotation.x = -0.25 + Math.sin(t * 4 + i * 2) * 0.12; });
      m.tail.rotation.z = Math.sin(t * 3) * 0.2;
    }
  }

  // Requirements for the next stage, with live counts.
  nextRequirements() {
    const next = this.stage === 'appear' ? 'visit' : this.stage === 'visit' ? 'resident' : null;
    if (!next) return null;
    return this.game.requirementProgress(this.cfg[next]);
  }

  hitTest(ray) {
    const center = this.pos.clone().add(new THREE.Vector3(0, this.model.height * 0.5, 0));
    const r = this.model.height * 0.6;
    return ray.distanceSqToPoint(center) < r * r ? ray.origin.distanceTo(center) : null;
  }
}

export const STAGE_LABEL = { appear: 'Appeared', visit: 'Visiting', resident: 'Resident' };
