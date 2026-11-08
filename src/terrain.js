import * as THREE from 'three';
import { N, S, W, inGarden, tileToWorld, mulberry32 } from './grid.js';
import { paint, place, merge, windMaterial, PALETTE } from './art.js';
import tuning from './tuning.json';

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function tuftGeometry(rng) {
  const parts = [];
  for (let i = 0; i < 14; i++) {
    const h = 0.12 + rng() * 0.16;
    const blade = new THREE.ConeGeometry(0.035, h, 3, 1);
    blade.translate(0, h / 2, 0);
    const g = paint(blade, PALETTE.grassBase);
    // Gradient: darker base, bright tip.
    const pos = g.attributes.position, col = g.attributes.color;
    const base = new THREE.Color(PALETTE.grassBase), tip = new THREE.Color(PALETTE.grassTip);
    for (let v = 0; v < pos.count; v++) {
      const t = THREE.MathUtils.clamp(pos.getY(v) / h, 0, 1);
      tmpC.copy(base).lerp(tip, t);
      col.setXYZ(v, tmpC.r, tmpC.g, tmpC.b);
    }
    place(g, { x: (rng() - 0.5) * 0.8, z: (rng() - 0.5) * 0.8, rx: (rng() - 0.5) * 0.4, rz: (rng() - 0.5) * 0.4 });
    parts.push(g);
  }
  // A couple of tiny daisies for charm.
  for (let i = 0; i < 2; i++) {
    const x = (rng() - 0.5) * 0.7, z = (rng() - 0.5) * 0.7;
    parts.push(place(paint(new THREE.SphereGeometry(0.03, 6, 4), i ? 0xffffff : 0xfff27a), { x, y: 0.1, z, sy: 0.5 }));
  }
  return merge(parts);
}

function junkGeometries() {
  const v = [];
  // Variant 0: rusty crate, plank and a can.
  v.push(merge([
    place(paint(new THREE.BoxGeometry(0.42, 0.3, 0.36), 0xc0703a), { x: -0.12, y: 0.15, z: 0.05, ry: 0.4, rz: 0.06 }),
    place(paint(new THREE.BoxGeometry(0.44, 0.05, 0.38), 0x8e4e22), { x: -0.12, y: 0.31, z: 0.05, ry: 0.4, rz: 0.06 }),
    place(paint(new THREE.BoxGeometry(0.7, 0.05, 0.12), 0xb98a57), { x: 0.12, y: 0.05, z: -0.22, ry: -0.5, rz: 0.12 }),
    place(paint(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), 0x3fb7c4), { x: 0.24, y: 0.07, z: 0.22, rx: Math.PI / 2, ry: 0.8 }),
    place(paint(new THREE.CylinderGeometry(0.072, 0.072, 0.03, 10), 0xd8dde0), { x: 0.24, y: 0.07, z: 0.31, rx: Math.PI / 2, ry: 0.8 }),
  ]));
  // Variant 1: old tire, bottle and cans.
  v.push(merge([
    place(paint(new THREE.TorusGeometry(0.24, 0.1, 8, 16), 0x2c2c34), { x: -0.05, y: 0.1, z: 0, rx: Math.PI / 2 }),
    place(paint(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 12), 0x55555f), { x: -0.05, y: 0.06, z: 0 }),
    place(paint(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 8), 0x3fae5c), { x: 0.28, y: 0.06, z: 0.2, rz: Math.PI / 2, ry: 0.4 }),
    place(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), 0x3fae5c), { x: 0.42, y: 0.06, z: 0.27, rz: Math.PI / 2, ry: 0.4 }),
    place(paint(new THREE.CylinderGeometry(0.065, 0.065, 0.17, 10), 0xe94b5a), { x: 0.2, y: 0.085, z: -0.28 }),
  ]));
  // Variant 2: scrap pile with a pipe and paper.
  v.push(merge([
    place(paint(new THREE.DodecahedronGeometry(0.2, 0), 0x9aa3ad), { x: -0.1, y: 0.12, z: -0.05, sy: 0.7 }),
    place(paint(new THREE.DodecahedronGeometry(0.14, 0), 0xb87a45), { x: 0.15, y: 0.1, z: 0.12, sy: 0.8 }),
    place(paint(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), 0x6f7d8a), { x: 0.05, y: 0.06, z: -0.25, rz: Math.PI / 2, ry: 0.3 }),
    place(paint(new THREE.BoxGeometry(0.3, 0.02, 0.22), 0xefe6cf), { x: -0.22, y: 0.02, z: 0.25, ry: 0.7 }),
    place(paint(new THREE.BoxGeometry(0.16, 0.16, 0.16), 0xf2b134), { x: 0.28, y: 0.08, z: -0.05, ry: 0.5, rx: 0.2 }),
  ]));
  return v;
}

function rockGeometries() {
  return [
    merge([
      place(paint(new THREE.DodecahedronGeometry(0.34, 0), 0xa3a39b), { y: 0.18, sy: 0.75 }),
      place(paint(new THREE.DodecahedronGeometry(0.18, 0), 0x8d8b84), { x: 0.28, y: 0.1, z: 0.15, sy: 0.8 }),
      place(paint(new THREE.DodecahedronGeometry(0.12, 0), 0xb4b1a6), { x: -0.25, y: 0.07, z: -0.2 }),
    ]),
    merge([
      place(paint(new THREE.IcosahedronGeometry(0.3, 0), 0x9c9a92), { x: -0.06, y: 0.2, z: 0.04, sx: 1.1, sy: 0.9 }),
      place(paint(new THREE.IcosahedronGeometry(0.22, 0), 0xaeaba1), { x: 0.2, y: 0.14, z: -0.18, sy: 0.8 }),
      place(paint(new THREE.DodecahedronGeometry(0.1, 0), 0x86847d), { x: 0.22, y: 0.06, z: 0.25 }),
    ]),
  ];
}

export class TerrainView {
  constructor(scene, grid) {
    this.grid = grid;
    this.rng = mulberry32(99);

    const baseGeo = new THREE.BoxGeometry(0.985, 0.4, 0.985).translate(0, -0.2, 0);
    this.base = new THREE.InstancedMesh(baseGeo, new THREE.MeshStandardMaterial({ roughness: 0.95 }), W * W);
    this.base.receiveShadow = true;
    scene.add(this.base);

    const vertMat = { vertexColors: true, roughness: 0.85, flatShading: true };
    this.tufts = new THREE.InstancedMesh(tuftGeometry(mulberry32(5)), windMaterial({ vertexColors: true, roughness: 0.9 }), N * N);
    this.tufts.receiveShadow = true;
    scene.add(this.tufts);

    this.junk = junkGeometries().map((g) => {
      const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial(vertMat), N * N);
      m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    });
    this.rocks = rockGeometries().map((g) => {
      const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial(vertMat), N * N);
      m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    });

    // Per-tile hue jitter so the lawn doesn't look like a checkerboard.
    this.jitter = new Float32Array(W * W).map(() => this.rng());

    // Instances move as tiles change, so skip per-mesh culling bounds.
    for (const m of [this.base, this.tufts, ...this.junk, ...this.rocks]) m.frustumCulled = false;
    for (let z = -S; z < N + S; z++) for (let x = -S; x < N + S; x++) this.refresh(x, z);
  }

  baseIndex(x, z) { return (x + S) + (z + S) * W; }

  refresh(x, z) {
    const bi = this.baseIndex(x, z);
    const j = this.jitter[bi];
    tileToWorld(x, z, tmpV);
    if (!inGarden(x, z)) {
      tmpM.makeTranslation(tmpV.x, -0.02, tmpV.z);
      this.base.setMatrixAt(bi, tmpM);
      this.base.setColorAt(bi, tmpC.set(PALETTE.strip).offsetHSL(0, 0, (j - 0.5) * 0.04));
      this.base.instanceMatrix.needsUpdate = true;
      this.base.instanceColor.needsUpdate = true;
      return;
    }
    const t = this.grid.get(x, z);
    const ti = x + z * N;
    let y = 0, color;
    switch (t.type) {
      case 'grass': color = tmpC.set(PALETTE.grass[Math.floor(j * 4)]); break;
      case 'soil': y = -0.04; color = tmpC.set(t.wet ? PALETTE.soilWet : PALETTE.soil).offsetHSL(0, 0, (j - 0.5) * 0.04); break;
      case 'junk': y = -0.02; color = tmpC.set(PALETTE.junkBase).offsetHSL(0, 0, (j - 0.5) * 0.06); break;
      case 'rock': y = -0.02; color = tmpC.set(PALETTE.rockBase).offsetHSL(0, 0, (j - 0.5) * 0.06); break;
    }
    tmpM.makeTranslation(tmpV.x, y, tmpV.z);
    this.base.setMatrixAt(bi, tmpM);
    this.base.setColorAt(bi, color);
    this.base.instanceMatrix.needsUpdate = true;
    this.base.instanceColor.needsUpdate = true;

    tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.rot);
    // Grass tufts
    if (t.type === 'grass') {
      tmpM.compose(tmpV, tmpQ, tmpS.set(1, 0.85 + j * 0.3, 1));
      this.tufts.setMatrixAt(ti, tmpM);
    } else this.tufts.setMatrixAt(ti, ZERO);
    this.tufts.instanceMatrix.needsUpdate = true;
    // Junk
    this.junk.forEach((m, i) => {
      if (t.type === 'junk' && t.variant === i) { tmpM.compose(tmpV, tmpQ, tmpS.set(1, 1, 1)); m.setMatrixAt(ti, tmpM); }
      else m.setMatrixAt(ti, ZERO);
      m.instanceMatrix.needsUpdate = true;
    });
    // Rocks shrink as they take hits.
    const rv = t.variant % this.rocks.length;
    this.rocks.forEach((m, i) => {
      if (t.type === 'rock' && rv === i) {
        const s = 0.5 + 0.5 * (t.hits / tuning.tools.rockHits);
        tmpM.compose(tmpV, tmpQ, tmpS.set(s * 1.05, s, s * 1.05)); m.setMatrixAt(ti, tmpM);
      } else m.setMatrixAt(ti, ZERO);
      m.instanceMatrix.needsUpdate = true;
    });
  }
}
