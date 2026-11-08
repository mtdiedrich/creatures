import * as THREE from 'three';
import tuning from './tuning.json';
import { Grid, N, inGarden, inBounds, tileToWorld, worldToTile } from './grid.js';
import { TerrainView } from './terrain.js';
import { Props } from './props.js';
import { Plant } from './plants.js';
import { Creature, SPECIES_ART } from './creatures.js';
import { OrbitCamera } from './camera.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { FX } from './fx.js';
import { UI, SEED_ORDER } from './ui.js';
import { globalUniforms } from './art.js';
import { ICONS } from './icons.js';

const CT = tuning.creatures;
// Order matches the number keys: 1 shovel, 2 watering can, 3 seed bag.
const TOOLS = ['shovel', 'can', 'seed'];
const SEED_TOOL = TOOLS.indexOf('seed');
const SPECIES = Object.keys(tuning.species);
const STAGES = ['appear', 'visit', 'resident'];
const params = new URLSearchParams(location.search);
const TIME_SCALE = Number(params.get('speed')) || 1; // dev aid for playtesting: ?speed=10

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xaee3ff, 45, 120);
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 400);
    this.buildSky();
    this.buildLights();

    this.grid = new Grid();
    this.terrain = new TerrainView(this.scene, this.grid);
    this.props = new Props(this.scene);
    this.fx = new FX(this.scene, this.camera);
    this.audio = new Audio();
    this.cam = new OrbitCamera(this.camera);

    // ---- state ----
    const E = tuning.economy;
    this.coins = E.startCoins;
    this.seeds = { ...E.startSeeds };
    this.tool = 0;
    this.seedIndex = 0;
    this.canCharges = tuning.tools.canCharges;
    this.plants = [];
    this.creatures = Object.fromEntries(SPECIES.map((k) => [k, null]));
    this.pendingSpawn = Object.fromEntries(SPECIES.map((k) => [k, null]));
    // Journal: one page per species, unlocked when it first appears. Requirements reveal as hints.
    this.journal = Object.fromEntries(SPECIES.map((k) => [k, { seen: false, met: new Set(), revealed: new Set(), unread: false }]));
    this.stageTimer = 0;
    this.time = 0;
    this.started = false;
    this.tut = { dig: false, grass: false, red: false, water: false };
    this.focus = null;
    this.hover = null;

    this.input = new Input(this.canvas, {
      move: () => {},
      use: (x, y) => this.onUse(x, y),
      context: (x, y) => this.onContext(x, y),
      back: () => this.back(),
      shop: () => (this.ui.shopOpen ? this.back() : this.openShop()),
      journal: () => (this.ui.journalOpen ? this.back() : this.openJournal()),
      tool: (d) => (this.ui.journalOpen ? this.ui.flipJournal(d) : this.cycleTool(d)),
      selectTool: (i) => this.selectTool(i),
      seed: (d) => this.cycleSeed(d),
      zoom: (f) => this.cam.zoom(f),
      wheel: (dy) => this.onWheel(dy),
      paint: (x, y) => this.onPaint(x, y),
      orbit: (dy, dp) => this.cam.orbit(dy, dp),
      dragPan: (dx, dy) => { const k = this.cam.dist / innerHeight * 1.2; this.cam.pan(-dx * k, dy * k); },
      mute: () => this.toggleMute(),
    });
    this.ui = new UI(this);

    if (TIME_SCALE !== 1) {
      const badge = document.createElement('div');
      badge.className = 'speed-badge';
      badge.textContent = `Fast-forward ×${TIME_SCALE}`;
      document.getElementById('ui').appendChild(badge);
    }

    this.buildCursor();
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    addEventListener('resize', () => this.resize());
    this.resize();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(300, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4fb6ff) }, bottom: { value: new THREE.Color(0xd8f3ff) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
    });
    this.scene.add(new THREE.Mesh(geo, mat));
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xcdeeff, 0x6fae4a, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
    sun.position.set(14, 24, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
  }

  buildCursor() {
    const ring = new THREE.RingGeometry(0.6, 0.71, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2);
    this.cursorMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false });
    this.cursor = new THREE.Mesh(ring, this.cursorMat);
    this.cursor.renderOrder = 10;
    this.cursor.visible = false;
    this.scene.add(this.cursor);
    const fill = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.cursorFill = new THREE.Mesh(fill, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, depthTest: false }));
    this.cursorFill.renderOrder = 9;
    this.cursor.add(this.cursorFill);
    this.followRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.62, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false })
    );
    this.followRing.renderOrder = 11;
    this.followRing.visible = false;
    this.scene.add(this.followRing);
    this.cursorLabel = document.createElement('div');
    this.cursorLabel.className = 'cursor-label hidden';
    document.getElementById('ui').appendChild(this.cursorLabel);
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  start() {
    this.audio.init();
    this.started = true;
    this.audio.play('menu');
  }

  get overlayOpen() { return this.ui.shopOpen || this.ui.journalOpen || this.ui.nameOpen || !this.started; }

  // ---------- picking ----------
  pick(x, y) {
    const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ray = this.raycaster.ray;
    let best = null, bd = Infinity;
    for (const c of Object.values(this.creatures)) {
      if (!c) continue;
      const d = c.hitTest(ray);
      if (d != null && d < bd) { bd = d; best = c; }
    }
    if (best) return { kind: 'creature', creature: best };
    const hit = ray.intersectPlane(this.groundPlane, new THREE.Vector3());
    if (!hit) return null;
    const t = worldToTile(hit.x, hit.z);
    if (inGarden(t.x, t.z)) {
      const tile = this.grid.get(t.x, t.z);
      if (tile.plant) return { kind: 'plant', plant: tile.plant, tile };
      return { kind: 'tile', tile };
    }
    if (inBounds(t.x, t.z)) return { kind: 'outside', x: t.x, z: t.z };
    return null;
  }

  // What would "Use tool" do on this target? Returns {ok, label}.
  preview(target) {
    if (!target) return null;
    const tool = TOOLS[this.tool];
    if (target.kind === 'creature' || target.kind === 'outside') return null;
    const tile = target.tile;
    if (tile.object === 'sign') return { ok: true, label: 'Open shop' };
    if (tile.object === 'well') return tool === 'can' ? { ok: true, label: 'Refill' } : { ok: false, label: '' };
    if (tool === 'shovel') {
      if (target.kind === 'plant') return { ok: true, label: 'Remove plant' };
      if (tile.type === 'soil') return { ok: false, label: '' };
      return { ok: true, label: tile.type === 'rock' ? `Break rock (${tile.hits})` : tile.type === 'junk' ? 'Clear junk' : 'Dig' };
    }
    if (tool === 'seed') {
      const s = SEED_ORDER[this.seedIndex];
      if (target.kind === 'plant' || tile.type !== 'soil') return { ok: false, label: tile.type !== 'soil' ? 'Dig soil first' : '' };
      return { ok: this.seeds[s] > 0, label: `Plant ${tuning.plants[s].name.toLowerCase()}` };
    }
    if (tool === 'can') {
      if (target.kind === 'plant') return { ok: target.plant.canWater() && this.canCharges > 0, label: 'Water' };
      return { ok: false, label: '' };
    }
    return null;
  }

  // ---------- actions ----------
  onUse(x, y) {
    if (this.overlayOpen) return;
    if (this.ui.contextOpen) { this.ui.closeContext(); return; }
    const t = this.pick(x, y);
    this.focus = t;
    this.ui.infoTimer = 0;
    this.paintState = null;
    if (!t) return;
    if (t.kind === 'creature') {
      // Clicking a creature focuses it: the camera follows it and the info panel stays on it.
      this.cam.follow = t.creature;
      this.cam.goalDist = Math.min(this.cam.goalDist, 12);
      this.audio.play('menu');
      return;
    }
    if (t.tile) this.paintState = { visited: new Set([t.tile.x + ',' + t.tile.z]), startType: t.kind === 'plant' ? 'plant' : t.tile.type };
    this.useTool(t);
  }

  // Click-and-drag: apply the held tool to each new tile the cursor crosses, quietly skipping tiles where it does nothing.
  onPaint(x, y) {
    const ps = this.paintState;
    if (!ps || this.overlayOpen) return;
    const t = this.pick(x, y);
    if (!t || !t.tile) return;
    const key = t.tile.x + ',' + t.tile.z;
    if (ps.visited.has(key)) return;
    ps.visited.add(key);
    const tile = t.tile;
    if (tile.object) return;
    const tool = TOOLS[this.tool];
    if (tool === 'seed') {
      if (tile.type === 'soil' && !tile.plant && this.seeds[SEED_ORDER[this.seedIndex]] > 0) this.useTool(t);
    } else if (tool === 'can') {
      if (tile.plant && tile.plant.canWater() && this.canCharges > 0) this.useTool(t);
    } else if (tool === 'shovel') {
      // Only dig tiles like the first one, so sweeping a junk patch never digs up the lawn.
      if (!tile.plant && ps.startType !== 'plant' && ps.startType !== 'soil' && tile.type === ps.startType) this.useTool(t);
    }
  }

  onWheel(dy) {
    if (this.overlayOpen) return;
    if (TOOLS[this.tool] === 'seed') {
      // Scrolling cycles seeds while the seed bag is held; accumulate so trackpads don't skip through.
      this.wheelAcc = (this.wheelAcc || 0) + dy;
      if (Math.abs(this.wheelAcc) >= 60) { this.cycleSeed(Math.sign(this.wheelAcc)); this.wheelAcc = 0; }
    } else this.cam.zoom(Math.exp(dy * 0.0012));
  }

  onContext(x, y) {
    if (this.overlayOpen) return;
    const t = this.pick(x, y);
    this.focus = t;
    this.ui.infoTimer = 0;
    if (!this.ui.openContext(t, x, y)) this.ui.closeContext();
  }

  back() {
    if (this.ui.nameOpen) this.ui.closeName();
    else if (this.ui.contextOpen) this.ui.closeContext();
    else if (this.ui.shopOpen) { this.ui.closeShop(); this.audio.play('menu'); }
    else if (this.ui.journalOpen) { this.ui.closeJournal(); this.audio.play('menu'); }
    else { this.focus = null; this.cam.follow = null; }
  }

  useTool(target) {
    if (target.kind === 'creature' || target.kind === 'outside') return;
    const tile = target.tile;
    const pos = tileToWorld(tile.x, tile.z);
    const tool = TOOLS[this.tool];
    if (tile.object === 'sign') { this.openShop(); return; }
    if (tile.object === 'well') {
      if (tool === 'can') this.refillCan();
      else this.nope(tool === 'seed' ? 'Dig soil first' : 'Use the watering can to refill');
      return;
    }
    if (tool === 'shovel') {
      if (tile.plant) { this.removePlant(tile.plant); return; }
      switch (tile.type) {
        case 'grass':
          tile.type = 'soil'; this.audio.play('dig'); this.fx.dirt(pos); break;
        case 'junk':
          tile.type = 'soil'; this.audio.play('smash'); this.fx.dirt(pos, 0x9c7b52); this.fx.spawn(pos, 0xc0703a, { count: 6 });
          this.tut.dig = true; break;
        case 'rock':
          tile.hits--;
          this.fx.smash(pos);
          if (tile.hits <= 0) { tile.type = 'soil'; this.audio.play('rockBreak'); }
          else this.audio.play('rock');
          break;
        case 'soil':
          this.nope('Nothing to dig here'); return;
      }
      this.terrain.refresh(tile.x, tile.z);
      return;
    }
    if (tool === 'seed') {
      if (tile.plant) { this.nope('Something is already growing here'); return; }
      if (tile.type !== 'soil') { this.nope('Dig soil first'); return; }
      const s = SEED_ORDER[this.seedIndex];
      if (this.seeds[s] <= 0) { this.nope(`No ${tuning.plants[s].name.toLowerCase()} seeds — visit the shop`); return; }
      this.seeds[s]--;
      const p = new Plant(this, s, tile);
      tile.plant = p;
      this.plants.push(p);
      this.audio.play('plant');
      this.fx.dirt(pos, 0x6b4426);
      if (s === 'grass') this.tut.grass = true;
      if (s === 'red') this.tut.red = true;
      this.focus = { kind: 'plant', plant: p, tile };
      return;
    }
    if (tool === 'can') {
      if (tile.plant) this.waterPlant(tile.plant);
      else this.nope('Water a plant');
    }
  }

  nope(text) { this.ui.tip(text); this.audio.play('nope'); }

  waterPlant(p) {
    if (p.type === 'grass') return this.nope('Grass needs no water');
    if (p.isAdult) return this.nope('Fully grown — no water needed');
    if (p.wet) return this.nope('Already wet');
    if (this.canCharges <= 0) return this.nope('The can is empty — refill it at the well');
    this.canCharges--;
    p.water();
    this.audio.play('water');
    this.fx.splash(p.group.position);
    if (p.type === 'red') this.tut.water = true;
  }

  removePlant(p) {
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
    p.tile.plant = null;
    p.dispose();
    this.terrain.refresh(p.tile.x, p.tile.z);
    this.audio.play('dig');
    this.fx.dirt(p.group.position);
    if (this.focus?.plant === p) this.focus = { kind: 'tile', tile: p.tile };
  }

  refillCan() {
    this.canCharges = tuning.tools.canCharges;
    this.audio.play('refill');
    this.fx.splash(this.props.wellWater.position);
    this.ui.tip('Watering can refilled');
  }

  growGrass(p) {
    const tile = p.tile;
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
    tile.plant = null;
    p.dispose();
    tile.type = 'grass';
    this.terrain.refresh(tile.x, tile.z);
    this.fx.sparkle(tileToWorld(tile.x, tile.z), 0x9cf05a, 6);
    this.audio.play('grow');
    if (this.focus?.plant === p) this.focus = { kind: 'tile', tile };
  }

  selectTool(i) {
    if (this.tool === i) return;
    this.tool = i;
    this.audio.play('menu');
  }
  cycleTool(d) { this.selectTool((this.tool + d + TOOLS.length) % TOOLS.length); }
  cycleSeed(d) {
    if (this.tool !== SEED_TOOL) this.tool = SEED_TOOL;
    this.seedIndex = (this.seedIndex + d + SEED_ORDER.length) % SEED_ORDER.length;
    this.audio.play('menu');
  }

  openShop() {
    if (!this.started) return;
    this.ui.closeJournal();
    this.ui.openShop();
    this.audio.play('menu');
  }

  buy(id, n) {
    const price = tuning.plants[id].price * n;
    if (this.coins < price) { this.audio.play('nope'); return; }
    this.coins -= price;
    this.seeds[id] += n;
    this.audio.play('buy');
    this.ui.renderShop();
  }

  addCoins(n, pos) {
    this.coins += n;
    this.audio.play('coin');
    if (pos) this.fx.floatText(pos, `+${n}`, 'coin');
    this.ui.coinBox.classList.remove('bump'); void this.ui.coinBox.offsetWidth; this.ui.coinBox.classList.add('bump');
    if (this.ui.shopOpen) this.ui.renderShop();
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.muteBtn.innerHTML = this.audio.muted ? ICONS.mute : ICONS.sound;
  }

  onCreatureAte() {}

  // ---------- species stages ----------
  adultFlowers() { return this.plants.filter((p) => p.isAdult); }

  // Live progress for a list of requirements: [{label, have, need}].
  requirementProgress(reqs) {
    return reqs.map((r) => {
      switch (r.kind) {
        case 'grass':
          return { label: 'Grass tiles', have: this.grid.countGrass(), need: r.count };
        case 'adult':
          return { label: `Adult ${tuning.plants[r.plant].name.toLowerCase()}s`, have: this.adultFlowers().filter((p) => p.type === r.plant).length, need: r.count };
        case 'adultAny':
          return { label: 'Adult flowers', have: this.adultFlowers().length, need: r.count };
        case 'colors':
          return { label: 'Flower colors (adult)', have: new Set(this.adultFlowers().map((p) => p.type)).size, need: r.count };
        case 'adjacent':
          return { label: r.plants.map((t) => tuning.plants[t].name.replace(' flower', '').toLowerCase()).join(' & ').replace(/^./, (c) => c.toUpperCase()) + ' flowers side by side', have: this.adjacentPairs(r.plants), need: r.count };
      }
      return { label: '?', have: 0, need: 1 };
    });
  }
  met(reqs) { return this.requirementProgress(reqs).every((r) => r.have >= r.need); }

  // Number of planted flowers of type a with a type-b flower on one of the 8 neighbouring tiles (any growth stage).
  adjacentPairs([a, b]) {
    let n = 0;
    for (const p of this.plants) {
      if (p.type !== a) continue;
      let found = false;
      for (let dz = -1; dz <= 1 && !found; dz++) for (let dx = -1; dx <= 1 && !found; dx++) {
        if (!dx && !dz) continue;
        const q = this.grid.get(p.tile.x + dx, p.tile.z + dz)?.plant;
        if (q && q.type === b) found = true;
      }
      if (found) n++;
    }
    return n;
  }

  // A stage's requirements with journal state: [{id, label, have, need, revealed}].
  stageRequirements(key, stage) {
    const j = this.journal[key];
    return this.requirementProgress(tuning.species[key][stage]).map((r, i) => {
      const id = `${stage}:${i}`;
      return { ...r, id, req: tuning.species[key][stage][i], revealed: j.met.has(stage) || j.revealed.has(id) };
    });
  }

  // Reveal hints for seen species once progress reaches the threshold, or the requirement is met.
  updateReveals() {
    const th = tuning.journal.hintThreshold;
    for (const key of SPECIES) {
      const j = this.journal[key];
      if (!j.seen) continue;
      let fresh = 0;
      for (const stage of STAGES) {
        if (j.met.has(stage)) continue;
        for (const r of this.stageRequirements(key, stage)) {
          if (!r.revealed && (r.have >= r.need * th || this.plantedEarly(r.req))) { j.revealed.add(r.id); fresh++; }
        }
      }
      if (fresh) this.markUnread(key, 'New hint');
    }
  }

  // v0.2.1: a flower requirement that needs only 1 adult can't reach 50% before it's met, so planting
  // one flower of that type (any stage) counts as halfway and reveals it.
  plantedEarly(req) {
    return req.kind === 'adult' && req.count === 1 && this.plants.some((p) => p.type === req.plant);
  }

  markUnread(key, what) {
    this.journal[key].unread = true;
    this.ui.journalNotify(`${what}: ${this.journalName(key)}`);
  }

  journalName(key) { return this.journal[key].seen ? (this.creatures[key]?.displayName ?? tuning.species[key].name) : '???'; }

  meetStage(key, stage) {
    const j = this.journal[key];
    j.met.add(stage);
    if (stage === 'appear' && !j.seen) { j.seen = true; this.markUnread(key, 'New journal page'); }
    if (this.ui.journalOpen) this.ui.renderJournal();
  }

  stageCheck() {
    for (const key of SPECIES) {
      const cfg = tuning.species[key];
      const c = this.creatures[key];
      if (!c) {
        if (this.pendingSpawn[key] == null && this.met(cfg.appear))
          this.pendingSpawn[key] = CT.spawnDelayMin + Math.random() * (CT.spawnDelayMax - CT.spawnDelayMin);
      } else if (c.stage === 'appear' && this.time - c.bornAt >= tuning.ui.bannerTime + 1 && this.met(cfg.visit)) {
        // Short dwell so the "appeared" banner and call land before the visit starts (still well under 10 s).
        c.beginVisit();
        this.meetStage(key, 'visit');
        this.ui.banner(`${c.displayName} is visiting!`);
        this.audio.play('sting-visit');
      } else if (c.stage === 'visit' && c.inside && c.behavior !== 'eat' && this.met(cfg.resident)) {
        c.beginResident();
        this.meetStage(key, 'resident');
        this.ui.banner(`${c.displayName} moved in!`);
        this.audio.play('sting-resident');
        this.addCoins(cfg.settleBonus, c.pos);
      }
    }
    this.updateReveals();
    if (this.ui.journalOpen) this.ui.renderJournal();
  }

  spawn(key) {
    const c = new Creature(this, key);
    c.spawnOutside();
    c.bornAt = this.time;
    this.creatures[key] = c;
    this.meetStage(key, 'appear');
    this.ui.banner(`${c.displayName} appeared!`);
    this.audio.play('sting-appear');
    setTimeout(() => this.audio.call(key, c.pos), 1100);
  }

  openJournal() {
    if (!this.started) return;
    this.ui.closeShop();
    this.ui.openJournal();
    this.audio.play('menu');
  }

  tutorialStep() {
    const T = this.tut;
    const g = (a) => this.input.glyph(a);
    if (!this.started) return null;
    if (!T.dig) return { id: 'dig', n: 1, text: 'Dig out junk with the shovel.', hint: () => `${g('tool1')} Shovel &nbsp; ${g('use')} Dig` };
    if (!T.grass) return { id: 'grass', n: 2, text: 'Plant grass seed on soil.', hint: () => `${g('tool3')} Seed bag &nbsp; ${g('seed')} Grass seed &nbsp; ${g('use')} Plant` };
    if (!T.red) return { id: 'red', n: 3, text: 'Plant a red flower.', hint: () => `${g('seed')} Red flower &nbsp; ${g('use')} Plant` };
    if (!T.water) return { id: 'water', n: 4, text: 'Water it.', hint: () => `${g('tool2')} Watering can &nbsp; ${g('use')} Water` };
    return null;
  }

  // ---------- loop ----------
  frame() {
    const raw = Math.min(0.1, this.clock.getDelta());
    const dt = raw * TIME_SCALE;
    globalUniforms.uTime.value += raw;

    if (this.started) {
      this.time += dt;
      for (const p of [...this.plants]) p.update(dt, this.time);

      for (const key of SPECIES) {
        if (this.pendingSpawn[key] != null && !this.creatures[key]) {
          this.pendingSpawn[key] -= dt;
          if (this.pendingSpawn[key] <= 0) this.spawn(key);
        }
      }
      this.stageTimer += dt;
      if (this.stageTimer >= CT.stageCheckInterval) { this.stageTimer = 0; this.stageCheck(); }
      for (const c of Object.values(this.creatures)) if (c) c.update(dt);
    } else {
      // Gentle idle orbit behind the title card.
      this.cam.orbit(raw * 0.05);
    }

    const ptr = this.input.pointer;
    const mouse = this.input.device === 'mouse';
    this.input.poll(raw, this.cam);
    this.cam.edgePan(raw, ptr.x, ptr.y, this.started && mouse && ptr.inside && !this.overlayOpen && !this.ui.contextOpen && !this.input.drag);
    this.cam.update(raw);
    this.audio.listenerPos = this.cam.target;

    this.props.update(raw, Object.values(this.creatures).filter(Boolean).map((c) => c.pos));
    this.fx.update(raw);
    this.updateCursor(mouse, ptr);
    this.ui.update(raw);
    this.renderer.render(this.scene, this.camera);
  }

  updateCursor(mouse, ptr) {
    let target = null;
    if (mouse && ptr.inside && this.started && !this.overlayOpen) {
      target = this.pick(ptr.x, ptr.y);
      if (!this.ui.contextOpen && !this.cam.follow) this.focus = target;
    } else if (!mouse) target = this.focus;
    // A followed creature keeps the info panel and gets a ring under it.
    const f = this.cam.follow;
    if (f && !this.ui.contextOpen) this.focus = { kind: 'creature', creature: f };
    this.followRing.visible = !!f;
    if (f) {
      this.followRing.position.set(f.pos.x, 0.04, f.pos.z);
      this.followRing.scale.setScalar(SPECIES_ART[f.key].ring * (1 + Math.sin(performance.now() * 0.005) * 0.06));
    }
    const lbl = this.cursorLabel;
    if (!target || target.kind === 'outside') { this.cursor.visible = false; lbl.classList.add('hidden'); return; }
    let pos, color = 0xffffff, scale = 1;
    if (target.kind === 'creature') {
      pos = target.creature.pos.clone();
      scale = SPECIES_ART[target.creature.key].ring;
      color = 0xfff27a;
    } else {
      pos = tileToWorld(target.tile.x, target.tile.z);
      const pv = this.preview(target);
      color = !pv ? 0xffffff : pv.ok ? 0x8dff6a : 0xff7a6a;
      if (mouse && pv && pv.label) {
        lbl.textContent = pv.label;
        lbl.classList.remove('hidden');
        lbl.classList.toggle('bad', !pv.ok);
        lbl.style.transform = `translate(${ptr.x + 18}px, ${ptr.y + 14}px)`;
      } else lbl.classList.add('hidden');
    }
    if (target.kind === 'creature') lbl.classList.add('hidden');
    this.cursor.visible = true;
    this.cursor.position.set(pos.x, 0.03, pos.z);
    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.03;
    this.cursor.scale.setScalar(scale * pulse);
    this.cursorMat.color.set(color);
    this.cursorFill.material.color.set(color);
  }
}

window.game = new Game();
// Dev only: ?autoplay loads a bot that plays the full loop for stability runs.
if (params.has('autoplay')) import('./dev/autoplay.js').then((m) => { window.autoplay = m.createAutoplay(window.game); });
