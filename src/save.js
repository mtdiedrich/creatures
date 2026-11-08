// v0.3.1: one autosaved game per browser, in localStorage.
import { Plant } from './plants.js';
import { Creature } from './creatures.js';
import { N, S } from './grid.js';

export const GAME_VERSION = '0.3.1';
export const FORMAT = 1; // bump when the save shape changes; add a step to UPGRADES

const params = new URLSearchParams(location.search);
// Playtest tools never touch the player's garden.
const DEV = params.has('speed') || params.has('autoplay');
const KEY = DEV ? 'creatures.save.dev' : 'creatures.save';
const BACKUP_KEY = KEY + '.backup';
const SETTINGS_KEY = 'creatures.settings';

const TERRAIN = { grass: 'g', soil: 's', junk: 'j', rock: 'r' };
const TERRAIN_BACK = { g: 'grass', s: 'soil', j: 'junk', r: 'rock' };

// Upgrades from older formats: UPGRADES[n] turns a format-n save into format n+1.
const UPGRADES = {};

function storage() {
  try { return window.localStorage; } catch { return null; }
}

export function loadSettings() {
  try { return JSON.parse(storage()?.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(settings) {
  try { storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage full or blocked */ }
}

// Look at what's stored without loading it: { state: 'none' | 'ok' | 'newer' | 'damaged', data, summary }.
export function peekSave() {
  const raw = storage()?.getItem(KEY);
  if (!raw) return { state: 'none' };
  let data;
  try { data = JSON.parse(raw); } catch { data = null; }
  if (!data || typeof data !== 'object' || typeof data.format !== 'number' || !data.garden) {
    return { state: 'damaged', raw };
  }
  if (data.format > FORMAT) return { state: 'newer', data };
  return { state: 'ok', data, summary: { day: data.time?.day ?? 1, coins: data.economy?.coins ?? 0, version: data.version } };
}

export function backupDamaged(raw) {
  try { storage()?.setItem(BACKUP_KEY, raw); storage()?.removeItem(KEY); } catch { /* ignore */ }
}

export function deleteSave() {
  try { storage()?.removeItem(KEY); } catch { /* ignore */ }
}

export function writeSave(game) {
  const data = serialize(game);
  try {
    storage()?.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------- serialize ----------
function serialize(g) {
  const dc = g.dayCycle;
  const creatures = {};
  for (const [k, c] of Object.entries(g.creatures)) {
    if (!c) continue;
    creatures[k] = {
      stage: c.stage, x: +c.pos.x.toFixed(3), z: +c.pos.z.toFixed(3), yaw: +c.yaw.toFixed(3), inside: c.inside,
      name: c.customName, bornAt: c.bornAt ?? 0, lastEat: Number.isFinite(c.lastEat) ? c.lastEat : null,
      hunger: c.hunger, hungry: c.hungry, nights: c.nightsPresent, nightStart: c.presentAtNightStart,
      showers: c.showersSeen, income: c.incomeTimer,
    };
  }
  return {
    format: FORMAT,
    version: GAME_VERSION,
    savedAt: new Date().toISOString(),
    garden: {
      terrain: g.grid.tiles.map((t) => TERRAIN[t.type]).join(''),
      hits: g.grid.tiles.map((t) => (t.type === 'rock' ? t.hits : 0)).join(''),
    },
    plants: g.plants.map((p) => ({ type: p.type, x: p.tile.x, z: p.tile.z, stage: p.stage, progress: +p.progress.toFixed(4), wet: p.wet })),
    creatures,
    economy: { coins: g.coins, seeds: { ...g.seeds }, tool: g.tool, seedIndex: g.seedIndex, can: g.canCharges },
    journal: {
      page: g.ui.journalPage,
      species: Object.fromEntries(Object.entries(g.journal).map(([k, j]) => [k, { seen: j.seen, met: [...j.met], revealed: [...j.revealed], unread: j.unread }])),
    },
    time: { play: g.time, day: dc.day, dayTime: dc.dayTime, rainPlan: dc.rainPlan, raining: dc.raining, showerId: dc.showerId },
    progress: { tutorial: { ...g.tut } },
    camera: { x: g.cam.goalTarget.x, z: g.cam.goalTarget.z, yaw: g.cam.goalYaw, pitch: g.cam.goalPitch, dist: g.cam.goalDist },
  };
}

// ---------- load ----------
export function applySave(g, data) {
  let d = data;
  while (d.format < FORMAT) d = UPGRADES[d.format](d);

  // Garden
  const terrain = d.garden.terrain, hits = d.garden.hits;
  g.grid.tiles.forEach((t, i) => {
    t.type = TERRAIN_BACK[terrain[i]] ?? t.type;
    t.hits = t.type === 'rock' ? Number(hits[i]) || 1 : 0;
  });

  // Time first: plants and creatures read the weather and clock as they load.
  const dc = g.dayCycle, T = d.time ?? {};
  g.time = T.play ?? 0;
  dc.day = T.day ?? 1;
  dc.setTime(T.dayTime ?? dc.dayTime);
  dc.rainPlan = T.rainPlan ?? null;
  dc.raining = !!T.raining;
  dc.rainLevel = dc.raining ? 1 : 0;
  dc.showerId = T.showerId ?? 0;

  // Plants
  for (const p of d.plants ?? []) {
    const tile = g.grid.get(p.x, p.z);
    if (!tile || tile.plant || tile.object) continue;
    const plant = new Plant(g, p.type, tile);
    if (p.stage) plant.setStage(p.stage);
    plant.progress = p.progress ?? 0;
    if (p.wet) plant.setWet(true);
    plant.pop = 0;
    tile.plant = plant;
    g.plants.push(plant);
  }
  for (let z = -S; z < N + S; z++) for (let x = -S; x < N + S; x++) g.terrain.refresh(x, z);

  // Creatures: restored idle where they were; what they were doing isn't kept.
  for (const [k, s] of Object.entries(d.creatures ?? {})) {
    const c = new Creature(g, k);
    c.stage = s.stage;
    c.pos.set(s.x, 0, s.z);
    c.yaw = c.targetYaw = s.yaw ?? 0;
    c.inside = !!s.inside;
    c.customName = s.name ?? null;
    c.bornAt = s.bornAt ?? 0;
    c.lastEat = s.lastEat ?? -Infinity;
    c.hunger = s.hunger ?? 0;
    c.hungry = !!s.hungry;
    c.nightsPresent = s.nights ?? 0;
    c.presentAtNightStart = !!s.nightStart;
    c.showersSeen = s.showers ?? 0;
    c.incomeTimer = s.income ?? 0;
    c.model.sat.value = c.stage === 'resident' ? 1 : 0;
    c.behavior = 'idle';
    c.idleTimer = 0.5 + Math.random();
    g.creatures[k] = c;
  }

  // Economy
  const E = d.economy ?? {};
  g.coins = E.coins ?? g.coins;
  Object.assign(g.seeds, E.seeds ?? {});
  g.tool = E.tool ?? 0;
  g.seedIndex = E.seedIndex ?? 0;
  g.canCharges = E.can ?? g.canCharges;

  // Journal
  for (const [k, j] of Object.entries(d.journal?.species ?? {})) {
    const e = g.journal[k];
    if (!e) continue;
    e.seen = !!j.seen; e.met = new Set(j.met ?? []); e.revealed = new Set(j.revealed ?? []); e.unread = !!j.unread;
  }
  if (d.journal?.page && g.journal[d.journal.page]) g.ui.journalPage = d.journal.page;

  // Tutorial and camera
  Object.assign(g.tut, d.progress?.tutorial ?? {});
  const C = d.camera;
  if (C) {
    g.cam.goalTarget.set(C.x, 0, C.z); g.cam.target.copy(g.cam.goalTarget);
    g.cam.goalYaw = g.cam.yaw = C.yaw; g.cam.goalPitch = g.cam.pitch = C.pitch; g.cam.goalDist = g.cam.dist = C.dist;
    g.cam.apply();
  }
  dc.applyLighting();
}

