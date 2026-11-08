import * as THREE from 'three';
import { N, HALF, GATE_IN, tileToWorld, mulberry32 } from './grid.js';
import { paint, place, merge, PALETTE } from './art.js';
import tuning from './tuning.json';

const vc = (extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, ...extra });

function shadowed(m) { m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; }

export class Props {
  constructor(scene) {
    this.scene = scene;
    this.buildGround();
    this.buildFence();
    this.buildWell();
    this.buildSign();
    this.buildScenery();
    this.gateOpen = 0;
    this.gateTarget = 0;
  }

  buildGround() {
    const g = new THREE.CircleGeometry(90, 48).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: PALETTE.outside, roughness: 1 }));
    m.position.y = -0.2; // below the tile tops so dug soil never z-fights with it
    m.receiveShadow = true;
    this.scene.add(m);
  }

  buildFence() {
    const parts = [];
    const wood = 0xc98b4f, woodDark = 0xa86d38, cap = 0xf2c46b;
    const edge = HALF; // fence runs along the garden boundary
    const gateX = GATE_IN.x - HALF + 0.5; // world x of the gate centre
    const post = (x, z) => {
      parts.push(place(paint(new THREE.BoxGeometry(0.14, 0.75, 0.14), woodDark), { x, y: 0.37, z }));
      parts.push(place(paint(new THREE.ConeGeometry(0.11, 0.14, 4), cap), { x, y: 0.82, z, ry: Math.PI / 4 }));
    };
    const rail = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ang = Math.atan2(z2 - z1, x2 - x1);
      for (const y of [0.28, 0.56]) parts.push(place(paint(new THREE.BoxGeometry(len, 0.08, 0.05), wood), { x: (x1 + x2) / 2, y, z: (z1 + z2) / 2, ry: -ang }));
    };
    const sides = [
      [[-edge, -edge], [edge, -edge]],
      [[edge, -edge], [edge, edge]],
      [[edge, edge], [-edge, edge]],
      [[-edge, edge], [-edge, -edge]],
    ];
    for (const [[x1, z1], [x2, z2]] of sides) {
      const steps = N;
      for (let i = 0; i < steps; i++) {
        const ax = x1 + ((x2 - x1) * i) / steps, az = z1 + ((z2 - z1) * i) / steps;
        const bx = x1 + ((x2 - x1) * (i + 1)) / steps, bz = z1 + ((z2 - z1) * (i + 1)) / steps;
        post(ax, az);
        // Leave the gap for the gate on the south side.
        const isGate = z1 === edge && z2 === edge && Math.abs((ax + bx) / 2 - gateX) < 0.9;
        if (isGate) continue;
        rail(ax, az, bx, bz);
      }
    }
    const fence = new THREE.Mesh(merge(parts), vc());
    this.scene.add(shadowed(fence));

    // Gate: arch plus a door that swings open when a creature passes.
    const gx = gateX, gz = edge;
    const arch = new THREE.Mesh(merge([
      place(paint(new THREE.BoxGeometry(0.18, 1.5, 0.18), woodDark), { x: gx - 0.55, y: 0.75, z: gz }),
      place(paint(new THREE.BoxGeometry(0.18, 1.5, 0.18), woodDark), { x: gx + 0.55, y: 0.75, z: gz }),
      place(paint(new THREE.BoxGeometry(1.4, 0.16, 0.24), wood), { x: gx, y: 1.5, z: gz }),
      place(paint(new THREE.ConeGeometry(0.18, 0.2, 4), cap), { x: gx - 0.55, y: 1.68, z: gz, ry: Math.PI / 4 }),
      place(paint(new THREE.ConeGeometry(0.18, 0.2, 4), cap), { x: gx + 0.55, y: 1.68, z: gz, ry: Math.PI / 4 }),
      // little vines
      place(paint(new THREE.SphereGeometry(0.1, 6, 5), 0x4fbf3a), { x: gx - 0.5, y: 1.2, z: gz + 0.08 }),
      place(paint(new THREE.SphereGeometry(0.08, 6, 5), 0xff7eb6), { x: gx - 0.45, y: 1.32, z: gz + 0.12 }),
      place(paint(new THREE.SphereGeometry(0.1, 6, 5), 0x4fbf3a), { x: gx + 0.52, y: 0.95, z: gz + 0.08 }),
    ]), vc());
    this.scene.add(shadowed(arch));
    const doorParts = [];
    for (let i = 0; i < 4; i++) doorParts.push(place(paint(new THREE.BoxGeometry(0.16, 0.7, 0.05), i % 2 ? wood : 0xd59a5d), { x: 0.12 + i * 0.22, y: 0.42 }));
    doorParts.push(place(paint(new THREE.BoxGeometry(0.9, 0.08, 0.06), woodDark), { x: 0.45, y: 0.3 }));
    doorParts.push(place(paint(new THREE.BoxGeometry(0.9, 0.08, 0.06), woodDark), { x: 0.45, y: 0.6 }));
    this.door = shadowed(new THREE.Mesh(merge(doorParts), vc()));
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(gx - 0.46, 0, gz);
    this.doorPivot.add(this.door);
    this.scene.add(this.doorPivot);
    this.gateWorld = new THREE.Vector3(gx, 0, gz);
  }

  buildWell() {
    const p = tuning.map.well;
    const c = tileToWorld(p.x, p.z);
    const parts = [];
    const rng = mulberry32(3);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      for (let row = 0; row < 2; row++) {
        const aa = a + row * 0.22;
        parts.push(place(paint(new THREE.BoxGeometry(0.2, 0.17, 0.12), [0xb9b4a8, 0xa39e92, 0xcac4b6][Math.floor(rng() * 3)]),
          { x: Math.cos(aa) * 0.36, y: 0.09 + row * 0.17, z: Math.sin(aa) * 0.36, ry: -aa + Math.PI / 2 }));
      }
    }
    parts.push(place(paint(new THREE.BoxGeometry(0.08, 1.05, 0.08), 0x9b6232), { x: -0.38, y: 0.6 }));
    parts.push(place(paint(new THREE.BoxGeometry(0.08, 1.05, 0.08), 0x9b6232), { x: 0.38, y: 0.6 }));
    parts.push(place(paint(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), 0x7a4a24), { y: 0.88, rz: Math.PI / 2 }));
    parts.push(place(paint(new THREE.ConeGeometry(0.66, 0.42, 4), 0xe2574c), { y: 1.28, ry: Math.PI / 4, sz: 0.75 }));
    parts.push(place(paint(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 10), 0x7f8b96), { x: 0.12, y: 0.62 }));
    parts.push(place(paint(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 4), 0xeeeeee), { x: 0.12, y: 0.76 }));
    const well = new THREE.Mesh(merge(parts), vc());
    well.position.copy(c);
    this.scene.add(shadowed(well));
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3fb4ff, roughness: 0.1, metalness: 0.1, emissive: 0x0b3b66 }));
    water.position.set(c.x, 0.26, c.z);
    this.scene.add(water);
    this.wellWater = water;
  }

  buildSign() {
    const p = tuning.map.sign;
    const c = tileToWorld(p.x, p.z);
    const g = new THREE.Group();
    const post = new THREE.Mesh(merge([
      place(paint(new THREE.BoxGeometry(0.1, 1.0, 0.1), 0x9b6232), { y: 0.5 }),
      place(paint(new THREE.BoxGeometry(0.9, 0.55, 0.08), 0xd9a066), { y: 1.05 }),
      place(paint(new THREE.BoxGeometry(0.98, 0.07, 0.1), 0x9b6232), { y: 1.35 }),
      place(paint(new THREE.SphereGeometry(0.1, 8, 6), 0xff4f6d), { x: 0.42, y: 1.42 }),
      place(paint(new THREE.SphereGeometry(0.08, 8, 6), 0x4f8dff), { x: 0.3, y: 1.45 }),
      place(paint(new THREE.SphereGeometry(0.07, 8, 6), 0x5fcf3c), { x: 0.52, y: 1.4 }),
    ]), vc());
    g.add(post);
    // Painted board face
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 150;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(0, 0, 256, 150);
    ctx.fillStyle = '#e2574c'; ctx.fillRect(0, 0, 256, 18); ctx.fillRect(0, 132, 256, 18);
    ctx.fillStyle = '#5a3415'; ctx.font = 'bold 64px Fredoka, Trebuchet MS, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('SEEDS', 128, 98);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.46), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    face.position.set(0, 1.05, 0.045);
    g.add(face);
    this.signFace = face;
    this.signTex = tex; this.signCanvas = cv;
    g.position.copy(c);
    g.rotation.y = -0.35;
    this.scene.add(shadowed(g));
    // Redraw once the web font is ready.
    document.fonts?.ready.then(() => {
      ctx.fillStyle = '#fff4dc'; ctx.fillRect(0, 18, 256, 114);
      ctx.fillStyle = '#5a3415'; ctx.font = '600 64px Fredoka, Trebuchet MS, sans-serif';
      ctx.fillText('SEEDS', 128, 98);
      tex.needsUpdate = true;
    });
  }

  buildScenery() {
    const rng = mulberry32(42);
    const parts = [];
    const trunkC = 0x8a5a33;
    const leafC = [0x3fb24a, 0x4fc455, 0x2f9e45, 0x63cf4f];
    const blossom = [0xff9ec7, 0xfff1a8, 0xffffff];
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2;
      const r = HALF + 5 + rng() * 26;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      // Leave the view behind the gate a bit more open.
      const s = 0.8 + rng() * 1.1;
      if (rng() < 0.7) {
        parts.push(place(paint(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.4 * s, 7), trunkC), { x, y: 0.7 * s, z }));
        const lc = leafC[Math.floor(rng() * leafC.length)];
        parts.push(place(paint(new THREE.IcosahedronGeometry(1.0 * s, 0), lc), { x, y: 1.9 * s, z, ry: rng() * 3 }));
        parts.push(place(paint(new THREE.IcosahedronGeometry(0.7 * s, 0), lc), { x: x + 0.5 * s, y: 1.5 * s, z: z + 0.3 * s, ry: rng() * 3 }));
        if (rng() < 0.4) for (let k = 0; k < 4; k++)
          parts.push(place(paint(new THREE.SphereGeometry(0.12 * s, 6, 5), blossom[Math.floor(rng() * 3)]),
            { x: x + (rng() - 0.5) * 1.6 * s, y: 1.9 * s + (rng() - 0.3) * 0.9 * s, z: z + (rng() - 0.5) * 1.6 * s }));
      } else {
        parts.push(place(paint(new THREE.IcosahedronGeometry(0.6 * s, 0), leafC[Math.floor(rng() * 4)]), { x, y: 0.35 * s, z, sy: 0.7 }));
        if (rng() < 0.6) parts.push(place(paint(new THREE.SphereGeometry(0.1, 6, 5), blossom[Math.floor(rng() * 3)]), { x: x + 0.2, y: 0.7 * s, z }));
      }
    }
    // Rolling hills on the horizon.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng() * 0.2;
      const r = 60 + rng() * 15;
      parts.push(place(paint(new THREE.SphereGeometry(14 + rng() * 10, 12, 8), i % 2 ? 0x74cf55 : 0x86d963),
        { x: Math.cos(a) * r, y: -6, z: Math.sin(a) * r, sy: 0.55 }));
    }
    const mesh = new THREE.Mesh(merge(parts), vc());
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  update(dt, creaturePositions) {
    let near = false;
    for (const p of creaturePositions) if (p.distanceTo(this.gateWorld) < 1.8) near = true;
    this.gateTarget = near ? 1 : 0;
    this.gateOpen += (this.gateTarget - this.gateOpen) * Math.min(1, dt * 5);
    this.doorPivot.rotation.y = this.gateOpen * 1.6;
    this.wellWater.position.y = 0.26 + Math.sin(performance.now() * 0.002) * 0.005;
  }
}
