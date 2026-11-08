import * as THREE from 'three';
import { tileToWorld } from './grid.js';
import { paint, place, merge } from './art.js';
import tuning from './tuning.json';

const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, flatShading: false });
const wetPatchMat = new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.85 });
const dropMat = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.2, emissive: 0x1a5f8a, transparent: true, opacity: 0.9 });

export const FLOWER_COLORS = {
  red: { petal: 0xff3b4e, light: 0xff7a88, center: 0xffd23f, seed: 0xd88a3a },
  blue: { petal: 0x3d7bff, light: 0x7fb2ff, center: 0xffffff, seed: 0x9a7bd8 },
  yellow: { petal: 0xffc21a, light: 0xffe066, center: 0x7a4a1c, seed: 0x5a5a5a },
};

const GREEN = 0x3cbf3a, GREEN_D = 0x2a9a2d, LEAF = 0x55d24a;
const MOUND = 0x6b4426;

function leaf(len, color, opts) {
  return place(paint(new THREE.SphereGeometry(1, 8, 6), color), { sx: len * 0.45, sy: 0.03, sz: len, ...opts });
}

function mound() {
  return [place(paint(new THREE.SphereGeometry(0.22, 10, 6), MOUND), { y: -0.02, sy: 0.35 })];
}

const geoCache = new Map();
function stageGeometry(type, stage) {
  const key = type + stage;
  if (geoCache.has(key)) return geoCache.get(key);
  const parts = [];
  if (type === 'grass') {
    parts.push(...mound());
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(place(paint(new THREE.ConeGeometry(0.025, 0.22, 3).translate(0, 0.11, 0), i % 2 ? LEAF : GREEN), { x: Math.cos(a) * 0.08, z: Math.sin(a) * 0.08, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 }));
    }
  } else {
    const C = FLOWER_COLORS[type];
    const petal = C.petal, petalLight = C.light, center = C.center;
    if (stage === 0) {
      parts.push(...mound());
      parts.push(place(paint(new THREE.SphereGeometry(0.05, 8, 6), C.seed), { y: 0.06, sy: 0.7 }));
    } else if (stage === 1) {
      parts.push(...mound());
      parts.push(place(paint(new THREE.CylinderGeometry(0.018, 0.022, 0.18, 6), GREEN_D), { y: 0.09 }));
      parts.push(leaf(0.11, LEAF, { x: 0.06, y: 0.18, rz: -0.5, ry: Math.PI / 2 }));
      parts.push(leaf(0.11, LEAF, { x: -0.06, y: 0.18, rz: 0.5, ry: Math.PI / 2 }));
    } else if (stage === 2) {
      parts.push(...mound());
      parts.push(place(paint(new THREE.CylinderGeometry(0.02, 0.028, 0.42, 6), GREEN_D), { y: 0.21 }));
      parts.push(leaf(0.16, LEAF, { x: 0.09, y: 0.12, rz: -0.5, ry: Math.PI / 2 }));
      parts.push(leaf(0.15, GREEN, { x: -0.08, y: 0.2, rz: 0.5, ry: Math.PI / 2 + 0.6 }));
      parts.push(leaf(0.13, LEAF, { z: 0.08, y: 0.26, rx: 0.5 }));
      parts.push(place(paint(new THREE.SphereGeometry(0.075, 10, 8), petal), { y: 0.48, sy: 1.5 }));
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        parts.push(place(paint(new THREE.ConeGeometry(0.035, 0.12, 4), GREEN), { x: Math.cos(a) * 0.05, y: 0.45, z: Math.sin(a) * 0.05, rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5 }));
      }
    } else {
      parts.push(...mound());
      if (type === 'red') {
        parts.push(place(paint(new THREE.CylinderGeometry(0.022, 0.03, 0.55, 6), GREEN_D), { y: 0.27 }));
        parts.push(leaf(0.2, LEAF, { x: 0.11, y: 0.14, rz: -0.45, ry: Math.PI / 2 }));
        parts.push(leaf(0.18, GREEN, { x: -0.1, y: 0.24, rz: 0.45, ry: Math.PI / 2 + 0.6 }));
        parts.push(leaf(0.15, LEAF, { z: 0.09, y: 0.32, rx: 0.5 }));
        // Big daisy head tilted toward the viewer.
        const head = [];
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          head.push(place(paint(new THREE.SphereGeometry(1, 10, 6), i % 2 ? petal : petalLight), { x: Math.cos(a) * 0.12, z: Math.sin(a) * 0.12, sx: 0.1, sy: 0.025, sz: 0.055, ry: -a }));
        }
        head.push(place(paint(new THREE.SphereGeometry(0.065, 12, 8), center), { y: 0.015, sy: 0.6 }));
        for (const h of head) place(h, { rx: 0.5, y: 0.57, z: 0.03 });
        parts.push(...head);
      } else if (type === 'yellow') {
        // Sunflower: tall stem, broad leaves, a ring of narrow petals around a big seed head.
        parts.push(place(paint(new THREE.CylinderGeometry(0.026, 0.036, 0.78, 6), GREEN_D), { y: 0.39 }));
        parts.push(leaf(0.24, LEAF, { x: 0.13, y: 0.2, rz: -0.4, ry: Math.PI / 2 }));
        parts.push(leaf(0.22, GREEN, { x: -0.12, y: 0.34, rz: 0.4, ry: Math.PI / 2 + 0.4 }));
        parts.push(leaf(0.18, LEAF, { z: 0.1, y: 0.48, rx: 0.5 }));
        const head = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          head.push(place(paint(new THREE.SphereGeometry(1, 8, 5), i % 2 ? petal : petalLight), { x: Math.cos(a) * 0.15, z: Math.sin(a) * 0.15, sx: 0.09, sy: 0.02, sz: 0.03, ry: -a }));
        }
        head.push(place(paint(new THREE.SphereGeometry(0.1, 14, 8), center), { y: 0.015, sy: 0.4 }));
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          head.push(place(paint(new THREE.SphereGeometry(0.018, 6, 4), 0x3a2410), { x: Math.cos(a) * 0.05, y: 0.05, z: Math.sin(a) * 0.05 }));
        }
        for (const h of head) place(h, { rx: 0.7, y: 0.8, z: 0.05 });
        parts.push(...head);
      } else {
        // Blue bellflower: arching stem with three hanging bells.
        parts.push(place(paint(new THREE.CylinderGeometry(0.022, 0.03, 0.62, 6), GREEN_D), { y: 0.31 }));
        parts.push(leaf(0.22, LEAF, { x: 0.12, y: 0.12, rz: -0.4, ry: Math.PI / 2 }));
        parts.push(leaf(0.2, GREEN, { x: -0.11, y: 0.2, rz: 0.4, ry: Math.PI / 2 - 0.5 }));
        const bells = [[0, 0.66, 0, 1.1], [0.13, 0.5, 0.04, 0.9], [-0.12, 0.42, -0.03, 0.85]];
        for (const [bx, by, bz, s] of bells) {
          parts.push(place(paint(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), GREEN_D), { x: bx * 0.6, y: by + 0.06, z: bz, rz: bx * 3 }));
          parts.push(place(paint(new THREE.CylinderGeometry(0.03 * s, 0.085 * s, 0.13 * s, 10, 1, true), petal), { x: bx, y: by, z: bz }));
          parts.push(place(paint(new THREE.SphereGeometry(0.035 * s, 8, 6), petalLight), { x: bx, y: by + 0.06 * s, z: bz }));
          parts.push(place(paint(new THREE.SphereGeometry(0.018, 6, 4), center), { x: bx, y: by - 0.07 * s, z: bz }));
        }
      }
    }
  }
  const g = merge(parts);
  geoCache.set(key, g);
  return g;
}

let plantId = 0;

export class Plant {
  constructor(game, type, tile) {
    this.id = ++plantId;
    this.game = game;
    this.type = type;
    this.cfg = tuning.plants[type];
    this.tile = tile;
    this.stage = 0;
    this.progress = 0;
    this.wet = false;
    this.phase = Math.random() * Math.PI * 2;
    this.pop = 0;

    this.group = new THREE.Group();
    tileToWorld(tile.x, tile.z, this.group.position);
    this.group.position.x += (Math.random() - 0.5) * 0.08;
    this.group.position.z += (Math.random() - 0.5) * 0.08;
    this.group.rotation.y = Math.random() * Math.PI * 2;
    this.mesh = new THREE.Mesh(stageGeometry(type, 0), mat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.wetPatch = new THREE.Mesh(new THREE.CircleGeometry(0.4, 18).rotateX(-Math.PI / 2), wetPatchMat);
    this.wetPatch.position.y = -0.035;
    this.wetPatch.visible = false;
    this.group.add(this.wetPatch);
    this.drops = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), dropMat);
      d.position.set((Math.random() - 0.5) * 0.25, 0.08 + Math.random() * 0.2, (Math.random() - 0.5) * 0.25);
      d.scale.y = 1.3;
      this.drops.add(d);
    }
    this.drops.visible = false;
    this.group.add(this.drops);

    game.scene.add(this.group);
    this.setStage(0);
  }

  get isFlower() { return this.type !== 'grass'; }
  get isAdult() { return this.isFlower && this.stage === 3; }
  get stageName() { return this.type === 'grass' ? 'Seed' : this.cfg.stages[this.stage]; }

  rate() {
    if (this.type === 'grass') return 1 / this.cfg.growTime;
    return 1 / (this.wet || this.rainWatered ? this.cfg.wetTime : this.cfg.dryTime);
  }
  timeLeft() {
    if (this.isAdult) return 0;
    return (1 - this.progress) / this.rate();
  }

  setStage(s) {
    this.stage = s;
    this.progress = 0;
    this.setWet(false);
    this.mesh.geometry = stageGeometry(this.type, s);
    this.pop = 1;
  }

  setWet(w) {
    this.wet = w;
    this.wetPatch.visible = w;
    this.drops.visible = w && this.stage > 0;
    this.tile.wet = w;
    this.game.terrain.refresh(this.tile.x, this.tile.z);
  }

  // v0.3: during rain every plant counts as watered.
  get rainWatered() { return this.game.dayCycle.raining && !this.isAdult; }
  canWater() { return this.isFlower && !this.isAdult && !this.wet && !this.rainWatered; }

  water() { this.setWet(true); }

  eaten() {
    this.setStage(1);
  }

  update(dt, t) {
    if (!this.isAdult) {
      this.progress += dt * this.rate();
      if (this.progress >= 1) {
        if (this.type === 'grass') { this.game.growGrass(this); return; }
        this.setStage(this.stage + 1);
        if (this.isAdult) this.game.fx.sparkle(this.group.position, FLOWER_COLORS[this.type].petal, 10);
      }
    }
    // Grass seed blades grow continuously.
    if (this.type === 'grass') this.mesh.scale.setScalar(0.4 + 0.6 * this.progress);
    else {
      const b = Math.sin(this.pop * Math.PI) * this.pop; // quick squash-and-stretch pop on stage change
      this.mesh.scale.set(1 + b * 0.25, 1 + b * 0.1, 1 + b * 0.25);
    }
    if (this.pop > 0) this.pop = Math.max(0, this.pop - dt * 2.5);
    this.mesh.rotation.z = Math.sin(t * 1.4 + this.phase) * 0.04;
    this.mesh.rotation.x = Math.cos(t * 1.1 + this.phase) * 0.03;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.tile.wet = false;
  }
}
