// Dev-only autoplay bot for stability runs (v0.2.1). Load with ?autoplay&speed=20, then in the console:
//   await autoplay.run(60)   // 60 minutes of game time; resolves with a report
// The bot plays the whole loop through the real game API: digs, plants, waters, buys seeds, refills the can,
// and pokes the journal, shop, context menu, naming and creature focus so those paths run too.
import tuning from '../tuning.json';

const SEEDS = ['grass', 'red', 'blue', 'yellow'];
const TOOL = { shovel: 0, can: 1, seed: 2 };
const TARGET = { grass: 24, red: 6, blue: 3, yellow: 4 };

export function createAutoplay(game) {
  const errors = [];
  addEventListener('error', (e) => errors.push(String(e.message || e)));
  addEventListener('unhandledrejection', (e) => errors.push('rejection: ' + String(e.reason)));
  const origError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origError.apply(console, a); };

  const g = game;
  const timeline = [];
  const seenStages = new Set();

  const freeSoil = () => g.grid.tiles.filter((t) => t.type === 'soil' && !t.plant && !t.object);
  const center = (t) => Math.hypot(t.x - 8, t.z - 8);
  const neighbours = (t) => {
    const out = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) { const n = g.grid.get(t.x + dx, t.z + dz); if (n) out.push(n); }
    return out;
  };
  const use = (tool, tile) => { g.tool = tool; g.useTool({ kind: tile.plant ? 'plant' : 'tile', plant: tile.plant, tile }); };
  const planted = (type) => g.plants.filter((p) => p.type === type).length;

  function plant(type, preferNear) {
    if (g.seeds[type] <= 0) {
      const price = tuning.plants[type].price;
      if (g.coins < price) return false;
      g.buy(type, 1);
    }
    let spots = freeSoil();
    if (!spots.length) return false;
    if (preferNear) {
      const near = spots.filter((t) => neighbours(t).some((n) => n.plant && n.plant.type === preferNear));
      if (near.length) spots = near;
    }
    spots.sort((a, b) => center(a) - center(b));
    g.seedIndex = SEEDS.indexOf(type);
    use(TOOL.seed, spots[0]);
    return true;
  }

  function tick() {
    // Can and watering.
    if (g.canCharges === 0) g.refillCan();
    for (const p of g.plants) if (p.canWater() && g.canCharges > 0) g.waterPlant(p);
    // Keep some soil free by clearing junk/rock near the middle.
    if (freeSoil().length < 4) {
      const rough = g.grid.tiles.filter((t) => (t.type === 'junk' || t.type === 'rock') && !t.object).sort((a, b) => center(a) - center(b));
      if (rough[0]) use(TOOL.shovel, rough[0]);
    }
    // Grass.
    if (g.grid.countGrass() + planted('grass') < TARGET.grass) {
      if (g.seeds.grass <= 0) g.buy('grass', 5);
      plant('grass');
    }
    // Flowers, cheapest needs first; blue goes next to red so Bumblet can appear.
    if (planted('red') < TARGET.red) plant('red');
    else if (planted('blue') < TARGET.blue) plant('blue', 'red');
    else if (planted('yellow') < TARGET.yellow) plant('yellow');
  }

  // Exercise UI paths now and then.
  function pokeUI(i) {
    const creatures = Object.values(g.creatures).filter(Boolean);
    switch (i % 5) {
      case 0: g.openJournal(); g.ui.flipJournal(1); g.ui.flipJournal(-1); g.back(); break;
      case 1: g.openShop(); g.back(); break;
      case 2: if (creatures[0]) { g.cam.follow = creatures[0]; g.focus = { kind: 'creature', creature: creatures[0] }; } break;
      case 3: g.back(); g.cam.pan(0.5, 0.5); break;
      case 4: if (creatures[0] && !creatures[0].customName) { g.ui.openName(creatures[0]); document.querySelector('.name-input').value = 'Bot'; document.querySelector('.modal .ok').click(); } break;
    }
  }

  function record() {
    for (const [k, c] of Object.entries(g.creatures)) {
      if (!c) continue;
      const id = k + ':' + c.stage;
      if (!seenStages.has(id)) { seenStages.add(id); timeline.push(`${(g.time / 60).toFixed(1)} min  ${tuning.species[k].name} ${c.stage}`); }
    }
  }

  async function run(minutes = 60) {
    if (!g.started) { document.querySelector('.play')?.click(); }
    // Drive the loop ourselves at a fixed step so the run doesn't depend on the tab being visible.
    g.clock.getDelta = () => 0.05;
    const end = g.time + minutes * 60;
    const t0 = performance.now();
    let frames = 0, lastTick = -1, lastPoke = 0, slowest = 0;
    while (g.time < end) {
      const f0 = performance.now();
      g.frame();
      slowest = Math.max(slowest, performance.now() - f0);
      frames++;
      const sec = Math.floor(g.time);
      if (sec !== lastTick) { lastTick = sec; try { tick(); } catch (e) { errors.push('bot: ' + e.message); } }
      if (g.time - lastPoke > 45) { lastPoke = g.time; try { pokeUI(Math.floor(g.time / 45)); } catch (e) { errors.push('ui: ' + e.message); } }
      record();
      if (frames % 50 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return {
      gameMinutes: +(g.time / 60).toFixed(1),
      realSeconds: +((performance.now() - t0) / 1000).toFixed(1),
      frames,
      slowestFrameMs: +slowest.toFixed(1),
      coins: g.coins,
      grass: g.grid.countGrass(),
      plants: Object.fromEntries(SEEDS.map((s) => [s, planted(s)])),
      journal: Object.fromEntries(Object.entries(g.journal).map(([k, j]) => [k, { met: [...j.met], revealed: [...j.revealed] }])),
      timeline,
      errors,
    };
  }

  return { run, errors };
}
