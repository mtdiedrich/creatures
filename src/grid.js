import * as THREE from 'three';
import tuning from './tuning.json';

export const N = tuning.map.size;
export const S = tuning.map.stripWidth;
export const W = N + 2 * S; // full width including the outside strip
export const HALF = N / 2;
// Gate sits in the middle of the south fence (high z). Inside tile and the strip tile just outside it.
export const GATE_IN = { x: Math.floor(N / 2), z: N - 1 };
export const GATE_OUT = { x: Math.floor(N / 2), z: N };

const JUNK_COST = 40; // creatures prefer to path around junk/rock, but never get stuck
const ROCK_COST = 60;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const inGarden = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
export const inBounds = (x, z) => x >= -S && z >= -S && x < N + S && z < N + S;
export const inStrip = (x, z) => inBounds(x, z) && !inGarden(x, z);

export function tileToWorld(x, z, out = new THREE.Vector3()) {
  return out.set(x - HALF + 0.5, 0, z - HALF + 0.5);
}
export function worldToTile(wx, wz) {
  return { x: Math.floor(wx + HALF), z: Math.floor(wz + HALF) };
}
const nodeIndex = (x, z) => (x + S) + (z + S) * W;

export class Grid {
  constructor() {
    this.tiles = [];
    for (let z = 0; z < N; z++) {
      for (let x = 0; x < N; x++) {
        this.tiles.push({ x, z, type: 'junk', hits: 0, plant: null, object: null, variant: 0, rot: 0 });
      }
    }
    this.generate();
  }

  get(x, z) {
    return inGarden(x, z) ? this.tiles[x + z * N] : null;
  }

  generate() {
    const m = tuning.map;
    const rng = mulberry32(m.seed);
    for (const t of this.tiles) {
      t.variant = Math.floor(rng() * 3);
      t.rot = rng() * Math.PI * 2;
    }
    // Mostly open ground, with patches of junk and a few rock clusters.
    const L = m.lawn;
    const nearStart = (t) =>
      t.x >= L.x - m.clearRadius && t.x < L.x + L.w + m.clearRadius &&
      t.z >= L.z - m.clearRadius && t.z < L.z + L.h + m.clearRadius;
    const clusters = (count, [rMin, rMax]) => {
      const out = [];
      for (let i = 0; i < count; i++) {
        // Keep cluster centres away from the starting lawn.
        let c;
        for (let tries = 0; tries < 20; tries++) {
          c = { x: rng() * N, z: rng() * N, r: rMin + rng() * (rMax - rMin) };
          if (Math.hypot(c.x - (L.x + L.w / 2), c.z - (L.z + L.h / 2)) > 4) break;
        }
        out.push(c);
      }
      return out;
    };
    const inCluster = (t, cs) => cs.some((c) => Math.hypot(t.x + 0.5 - c.x, t.z + 0.5 - c.z) < c.r && rng() < 0.85);
    const junk = clusters(m.junkClusters, m.junkClusterRadius);
    const rocks = clusters(m.rockClusters, m.rockClusterRadius);
    for (const t of this.tiles) {
      t.type = m.baseTerrain;
      if (nearStart(t)) continue;
      if (inCluster(t, rocks) || rng() < m.rockScatter) t.type = 'rock';
      else if (inCluster(t, junk) || rng() < m.junkScatter) t.type = 'junk';
    }
    // Starting lawn near the center.
    for (let z = L.z; z < L.z + L.h; z++) for (let x = L.x; x < L.x + L.w; x++) this.get(x, z).type = 'grass';
    // Trodden soil path from the lawn down to the gate so visitors can walk in.
    for (let z = L.z + L.h; z < N; z++) this.get(GATE_IN.x, z).type = 'soil';
    // Fixed objects.
    const well = this.get(m.well.x, m.well.z); well.type = 'soil'; well.object = 'well';
    const sign = this.get(m.sign.x, m.sign.z); sign.type = 'soil'; sign.object = 'sign';
    // Keep the tile next to the well and sign approachable.
    for (const t of this.tiles) if (t.type === 'rock') t.hits = tuning.tools.rockHits;
  }

  countGrass() {
    let n = 0;
    for (const t of this.tiles) if (t.type === 'grass') n++;
    return n;
  }

  // Cost of standing on a node, or Infinity if never passable.
  nodeCost(x, z, opts) {
    if (!inBounds(x, z)) return Infinity;
    if (!inGarden(x, z)) return opts.outside ? 1 : Infinity;
    if (!opts.inside) return Infinity;
    const t = this.get(x, z);
    if (t.object) return Infinity;
    if (t.type === 'junk') return opts.strict ? Infinity : JUNK_COST;
    if (t.type === 'rock') return opts.strict ? Infinity : ROCK_COST;
    return 1;
  }

  isWalkable(x, z) {
    const t = this.get(x, z);
    return !!t && !t.object && (t.type === 'grass' || t.type === 'soil');
  }

  canStep(ax, az, bx, bz) {
    const ia = inGarden(ax, az), ib = inGarden(bx, bz);
    if (ia === ib) return true;
    // Only the gate crosses the fence, and only straight through.
    if (ax !== bx) return false;
    const a = { x: ax, z: az }, b = { x: bx, z: bz };
    const isGate = (p) => p.x === GATE_IN.x && (p.z === GATE_IN.z || p.z === GATE_OUT.z);
    return isGate(a) && isGate(b);
  }

  // A* over the full grid (garden + strip). opts: {inside, outside, strict}
  findPath(from, to, opts = { inside: true, outside: false }) {
    const total = W * W;
    const g = new Float32Array(total).fill(Infinity);
    const f = new Float32Array(total).fill(Infinity);
    const came = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const start = nodeIndex(from.x, from.z), goal = nodeIndex(to.x, to.z);
    if (this.nodeCost(to.x, to.z, opts) === Infinity) return null;
    const h = (x, z) => Math.hypot(x - to.x, z - to.z);
    g[start] = 0; f[start] = h(from.x, from.z);
    const open = [start];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) {
        const path = [];
        let c = cur;
        while (c !== -1) { path.push({ x: (c % W) - S, z: Math.floor(c / W) - S }); c = came[c]; }
        return path.reverse();
      }
      closed[cur] = 1;
      const cx = (cur % W) - S, cz = Math.floor(cur / W) - S;
      for (const [dx, dz] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!inBounds(nx, nz)) continue;
        const ni = nodeIndex(nx, nz);
        if (closed[ni]) continue;
        const cost = this.nodeCost(nx, nz, opts);
        if (cost === Infinity) continue;
        if (!this.canStep(cx, cz, nx, nz)) continue;
        if (dx !== 0 && dz !== 0) {
          // No corner cutting, and no diagonal through the fence.
          if (this.nodeCost(cx + dx, cz, opts) > 1 || this.nodeCost(cx, cz + dz, opts) > 1) continue;
          if (!this.canStep(cx, cz, cx + dx, cz) || !this.canStep(cx, cz, cx, cz + dz)) continue;
        }
        const step = (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1) * cost;
        const ng = g[cur] + step;
        if (ng < g[ni]) {
          if (g[ni] === Infinity) open.push(ni);
          g[ni] = ng; f[ni] = ng + h(nx, nz); came[ni] = cur;
        }
      }
    }
    return null;
  }
}
