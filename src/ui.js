import { ICONS } from './icons.js';
import { STAGE_LABEL, speciesPortrait } from './creatures.js';
import tuning from './tuning.json';

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
};
const TOOL_INFO = [
  { id: 'shovel', name: 'Shovel', icon: ICONS.shovel },
  { id: 'can', name: 'Watering can', icon: ICONS.can },
  { id: 'seed', name: 'Seed bag', icon: ICONS.seedbag },
];
const SEED_ORDER = ['grass', 'red', 'blue', 'yellow'];
const SPECIES = Object.keys(tuning.species);
const STAGES = [['appear', 'Appear'], ['visit', 'Visit'], ['resident', 'Resident']];
const TERRAIN_INFO = {
  grass: ['Grass', 'Open lawn. Counts toward grass-area needs.'],
  soil: ['Soil', 'Holds one plant.'],
  junk: ['Junk', 'Dig it out to make soil.'],
  rock: ['Rock', 'Takes a few hits to break into soil.'],
};

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.input = game.input;
    this.infoTimer = 0;
    this.build();
    this.input.onDeviceChange(() => this.refreshGlyphs());
    this.refreshGlyphs();
  }

  g(action) { return this.input.glyph(action); }

  build() {
    const r = this.root;

    // Floating text layer
    this.floatLayer = el('div', 'float-layer');
    r.appendChild(this.floatLayer);
    this.game.fx.floatLayer = this.floatLayer;

    // Top right: coins + shop
    this.topRight = el('div', 'top-right');
    this.coinBox = el('div', 'coin-box panel', `${ICONS.coin}<span class="coin-val">0</span>`);
    this.coinVal = this.coinBox.querySelector('.coin-val');
    this.shopBtn = el('button', 'shop-btn panel btn', `${ICONS.shop}<span>Seed shop</span><span class="glyph" data-g="shop"></span>`);
    this.shopBtn.onclick = () => this.game.openShop();
    this.journalBtn = el('button', 'journal-btn panel btn', `${ICONS.journal}<span>Journal</span><span class="glyph" data-g="journal"></span><span class="marker hidden"></span>`);
    this.journalBtn.onclick = () => this.game.openJournal();
    this.journalMarker = this.journalBtn.querySelector('.marker');
    this.muteBtn = el('button', 'mute-btn panel btn', ICONS.sound);
    this.muteBtn.onclick = () => this.game.toggleMute();
    this.topRight.append(this.coinBox, this.journalBtn, this.shopBtn, this.muteBtn);
    r.appendChild(this.topRight);

    // Tutorial
    this.tutorial = el('div', 'tutorial panel hidden');
    r.appendChild(this.tutorial);

    // Bottom HUD
    this.hud = el('div', 'hud');
    this.toolbar = el('div', 'toolbar panel');
    this.toolBtns = TOOL_INFO.map((t, i) => {
      const b = el('button', 'tool-slot btn', `<span class="slot-key glyph" data-g="tool${i + 1}"></span>${t.icon}<span class="tool-name">${t.name}</span>`);
      b.onclick = () => this.game.selectTool(i);
      this.toolbar.appendChild(b);
      return b;
    });

    this.seedBox = el('div', 'seed-box panel');
    this.seedPrev = el('button', 'arrow btn', '◀');
    this.seedNext = el('button', 'arrow btn', '▶');
    this.seedPrev.onclick = () => this.game.cycleSeed(-1);
    this.seedNext.onclick = () => this.game.cycleSeed(1);
    this.seedLabel = el('div', 'seed-label');
    this.seedGlyph = el('div', 'glyph seed-glyph');
    this.seedBox.append(this.seedPrev, this.seedLabel, this.seedNext, this.seedGlyph);

    this.canBox = el('div', 'can-box panel');
    this.canBox.innerHTML = `${ICONS.drop}<div class="pips"></div>`;
    this.pips = this.canBox.querySelector('.pips');
    for (let i = 0; i < tuning.tools.canCharges; i++) this.pips.appendChild(el('span', 'pip'));

    this.hud.append(this.canBox, this.toolbar, this.seedBox);
    r.appendChild(this.hud);

    // Info panel
    this.info = el('div', 'info panel hidden');
    r.appendChild(this.info);

    // Context menu
    this.ctx = el('div', 'ctx panel hidden');
    r.appendChild(this.ctx);

    // Banner
    this.bannerEl = el('div', 'banner hidden');
    r.appendChild(this.bannerEl);

    // Tip
    this.tipEl = el('div', 'tip hidden');
    r.appendChild(this.tipEl);

    // Shop
    this.shop = el('div', 'shop hidden');
    r.appendChild(this.shop);

    // Journal
    this.journal = el('div', 'journal hidden');
    r.appendChild(this.journal);
    this.journalPage = SPECIES[0];

    // Name modal
    this.nameModal = el('div', 'modal hidden');
    r.appendChild(this.nameModal);

    // Start screen
    this.start = el('div', 'start', `
      <div class="start-card">
        <div class="start-title">Creatures</div>
        <div class="start-sub">Clear the junk. Grow a garden. See who moves in.</div>
        <button class="btn big play">Play</button>
        <div class="start-ver">v0.1 vertical slice</div>
      </div>`);
    this.start.querySelector('.play').onclick = () => { this.start.classList.add('gone'); this.game.start(); };
    r.appendChild(this.start);

    // Touch-only back button (no hover/keys on touch).
    this.backBtn = el('button', 'back-btn panel btn', ICONS.close);
    this.backBtn.onclick = () => this.game.back();
    r.appendChild(this.backBtn);
  }

  refreshGlyphs() {
    this.root.querySelectorAll('[data-g]').forEach((n) => { n.innerHTML = this.g(n.dataset.g); });
    this.seedGlyph.innerHTML = this.g('seed');
    this.tutorialKey = null; // force tutorial redraw
    if (!this.shop.classList.contains('hidden')) this.renderShop();
    if (this.journalOpen) this.renderJournal();
  }

  // ---------- per-frame ----------
  update(dt) {
    const g = this.game;
    this.coinVal.textContent = g.coins;
    this.journalMarker.classList.toggle('hidden', !Object.values(g.journal).some((e) => e.unread));
    this.toolBtns.forEach((b, i) => b.classList.toggle('active', g.tool === i));
    const seed = SEED_ORDER[g.seedIndex];
    this.seedBox.classList.toggle('dim', g.tool !== 2);
    const count = g.seeds[seed];
    this.seedLabel.innerHTML = `${ICONS[seed]}<div><div class="seed-name">${tuning.plants[seed].name}</div><div class="seed-count ${count ? '' : 'empty'}">× ${count}</div></div>`;
    [...this.pips.children].forEach((p, i) => p.classList.toggle('full', i < g.canCharges));
    this.canBox.classList.toggle('dim', g.tool !== 1);
    this.canBox.classList.toggle('empty', g.canCharges === 0);

    this.infoTimer -= dt;
    if (this.infoTimer <= 0) { this.infoTimer = 0.2; this.renderInfo(); }
    this.renderTutorial();
  }

  // ---------- info panel ----------
  renderInfo() {
    const t = this.game.focus;
    if (!t) { this.info.classList.add('hidden'); return; }
    let html = '';
    if (t.kind === 'creature') {
      const c = t.creature;
      html = `<div class="info-title">${c.displayName}${c.customName ? ` <span class="sub">(${c.speciesName})</span>` : ''}</div>
              <div class="info-stage stage-${c.stage}">${STAGE_LABEL[c.stage]}</div>`;
      const next = c.stage === 'appear' ? 'visit' : c.stage === 'visit' ? 'resident' : null;
      if (next) {
        // v0.2: only requirements the journal has revealed are shown.
        const reqs = this.game.stageRequirements(c.key, next);
        const shown = reqs.filter((r) => r.revealed);
        html += `<div class="info-sub">To ${next === 'visit' ? 'visit' : 'move in'}:</div>`;
        html += shown.map((r) => `<div class="req ${r.have >= r.need ? 'met' : ''}"><span>${r.label}</span><b>${Math.min(r.have, r.need)}/${r.need}</b></div>`).join('');
        const hidden = reqs.length - shown.length;
        if (hidden) html += `<div class="req-hidden">${shown.length ? `+ ${hidden} more unknown` : 'Needs unknown'} · ${this.g('journal')} Journal</div>`;
      } else {
        html += `<div class="info-line">Lives here · earns ${c.cfg.incomePerMin} coins/min</div>`;
      }
      if (this.game.cam.follow === c) html += `<div class="info-follow">Following · ${this.g('pan')} or ${this.g('back')} to stop</div>`;
    } else if (t.kind === 'plant') {
      const p = t.plant;
      html = `<div class="info-title">${p.cfg.name}</div><div class="info-stage">${p.type === 'grass' ? 'Growing' : p.stageName}</div>`;
      if (p.type !== 'grass') html += `<div class="info-line">${p.wet ? '<span class="wet">Wet</span>' : '<span class="dry">Dry</span>'}</div>`;
      html += p.isAdult ? `<div class="info-line">Fully grown</div>` : `<div class="info-line">Next stage in <b>${fmtTime(p.timeLeft())}</b></div>`;
    } else if (t.kind === 'tile') {
      const tile = t.tile;
      if (tile.object === 'well') html = `<div class="info-title">Well</div><div class="info-line">Refills the watering can.</div>`;
      else if (tile.object === 'sign') html = `<div class="info-title">Seed shop</div><div class="info-line">Buy seeds here.</div>`;
      else {
        const [name, desc] = TERRAIN_INFO[tile.type];
        html = `<div class="info-title">${name}</div><div class="info-line">${desc}</div>`;
        if (tile.type === 'rock') html += `<div class="info-line">Hits left: <b>${tile.hits}</b></div>`;
      }
    } else if (t.kind === 'outside') {
      html = `<div class="info-title">Meadow</div><div class="info-line">Outside the fence.</div>`;
    }
    this.info.innerHTML = html;
    this.info.classList.remove('hidden');
  }

  // ---------- context menu ----------
  openContext(target, x, y) {
    const items = [];
    const g = this.game;
    if (target?.kind === 'plant') {
      items.push({ label: 'Water', disabled: !target.plant.canWater() || g.canCharges === 0, fn: () => g.waterPlant(target.plant) });
      items.push({ label: 'Remove', fn: () => g.removePlant(target.plant) });
    } else if (target?.kind === 'creature') {
      items.push({ label: 'Name it', fn: () => this.openName(target.creature) });
    } else if (target?.kind === 'tile' && target.tile.object === 'well') {
      items.push({ label: 'Refill can', fn: () => g.refillCan() });
    } else if (target?.kind === 'tile' && target.tile.object === 'sign') {
      items.push({ label: 'Open shop', fn: () => g.openShop() });
    }
    if (!items.length) { this.closeContext(); return false; }
    this.ctx.innerHTML = '';
    for (const it of items) {
      const b = el('button', 'ctx-item btn', it.label);
      b.disabled = !!it.disabled;
      b.onclick = () => { this.closeContext(); g.audio.play('menu'); it.fn(); };
      this.ctx.appendChild(b);
    }
    this.ctx.appendChild(el('div', 'ctx-hint', `${this.g('back')} close`));
    this.ctx.classList.remove('hidden');
    const w = 180, h = items.length * 44 + 30;
    this.ctx.style.left = Math.min(innerWidth - w - 8, x + 8) + 'px';
    this.ctx.style.top = Math.min(innerHeight - h - 8, y + 8) + 'px';
    this.game.audio.play('menu');
    return true;
  }
  closeContext() { this.ctx.classList.add('hidden'); }
  get contextOpen() { return !this.ctx.classList.contains('hidden'); }

  // ---------- shop ----------
  openShop() {
    this.closeContext();
    this.shop.classList.remove('hidden');
    this.renderShop();
  }
  closeShop() { this.shop.classList.add('hidden'); }
  get shopOpen() { return !this.shop.classList.contains('hidden'); }

  renderShop() {
    const g = this.game;
    const cards = SEED_ORDER.map((id) => {
      const p = tuning.plants[id];
      const can = (n) => g.coins >= p.price * n;
      return `<div class="shop-card ${can(1) ? '' : 'unaffordable'}">
        <div class="shop-icon">${ICONS[id]}</div>
        <div class="shop-name">${p.name}</div>
        <div class="shop-price">${p.price ? `${ICONS.coin}<span>${p.price}</span>` : '<span class="free">Free</span>'}</div>
        <div class="shop-owned">Owned: <b>${g.seeds[id]}</b></div>
        <div class="shop-buy">
          <button class="btn buy" data-id="${id}" data-n="1" ${can(1) ? '' : 'disabled'}>Buy ×1</button>
          <button class="btn buy" data-id="${id}" data-n="5" ${can(5) ? '' : 'disabled'}>Buy ×5${p.price ? ` <small>(${p.price * 5})</small>` : ''}</button>
        </div>
      </div>`;
    }).join('');
    this.shop.innerHTML = `<div class="shop-inner">
      <div class="shop-head"><div class="shop-title">${ICONS.shop} Seed Shop</div>
        <div class="coin-box panel">${ICONS.coin}<span>${g.coins}</span></div>
        <button class="btn close-shop">${ICONS.close}<span class="glyph">${this.g('back')}</span></button></div>
      <div class="shop-cards">${cards}</div>
    </div>`;
    this.shop.querySelector('.close-shop').onclick = () => this.game.back();
    this.shop.querySelectorAll('.buy').forEach((b) => { b.onclick = () => { g.buy(b.dataset.id, Number(b.dataset.n)); }; });
  }

  // ---------- journal ----------
  get journalOpen() { return !this.journal.classList.contains('hidden'); }

  openJournal() {
    this.closeContext();
    // Open on a page with new hints if there is one, else the last page viewed.
    const unread = SPECIES.find((k) => this.game.journal[k].unread);
    if (unread) this.journalPage = unread;
    this.journal.classList.remove('hidden');
    this.renderJournal();
  }
  closeJournal() { this.journal.classList.add('hidden'); }

  flipJournal(d) {
    const i = SPECIES.indexOf(this.journalPage);
    this.journalPage = SPECIES[(i + d + SPECIES.length) % SPECIES.length];
    this.game.audio.play('menu');
    this.renderJournal();
  }

  journalNotify(text) {
    this.journalBtn.classList.remove('ping'); void this.journalBtn.offsetWidth; this.journalBtn.classList.add('ping');
    this.tip(text, 'hint');
  }

  renderJournal() {
    const g = this.game;
    const key = this.journalPage;
    const j = g.journal[key];
    j.unread = false; // opening the page clears its marker
    const cfg = tuning.species[key];

    const list = SPECIES.map((k) => {
      const e = g.journal[k];
      const c = g.creatures[k];
      const stage = e.met.has('resident') ? 'Resident' : e.met.has('visit') ? 'Visiting' : e.seen ? 'Appeared' : 'Unknown';
      return `<button class="j-entry btn ${k === key ? 'active' : ''}" data-k="${k}">
        <img class="j-thumb ${e.seen ? '' : 'silhouette'}" src="${speciesPortrait(k)}" alt="" />
        <div class="j-entry-text"><div class="j-entry-name">${e.seen ? (c?.displayName ?? tuning.species[k].name) : '???'}</div><div class="j-entry-stage">${stage}</div></div>
        ${e.unread ? '<span class="marker"></span>' : ''}
      </button>`;
    }).join('');

    let page;
    if (!j.seen) {
      page = `<div class="j-page-head"><img class="j-portrait silhouette" src="${speciesPortrait(key)}" alt="" />
        <div><div class="j-title">???</div><div class="j-sub">Not yet seen</div></div></div>
        <div class="j-clue"><span>Clue</span>${cfg.clue}</div>`;
    } else {
      const c = g.creatures[key];
      const stages = STAGES.map(([stage, label]) => {
        const done = j.met.has(stage);
        const reqs = g.stageRequirements(key, stage);
        const rows = reqs.map((r) => r.revealed
          ? `<div class="req ${r.have >= r.need || done ? 'met' : ''}"><span>${r.label}</span><b>${done ? '✓' : `${Math.min(r.have, r.need)}/${r.need}`}</b></div>`
          : `<div class="req unknown"><span>???</span><b>?</b></div>`).join('');
        return `<div class="j-stage ${done ? 'done' : ''}"><div class="j-stage-head"><span class="j-check">${done ? ICONS.check : ''}</span>${label}</div>${rows}</div>`;
      }).join('');
      const food = j.met.has('visit') ? `<div class="j-food">Favorite food: <b>${tuning.plants[cfg.food].name}</b></div>` : '';
      const income = j.met.has('resident') ? `<div class="j-food">Earns <b>${cfg.incomePerMin} coins/min</b></div>` : '';
      page = `<div class="j-page-head"><img class="j-portrait" src="${speciesPortrait(key)}" alt="" />
        <div><div class="j-title">${c?.displayName ?? cfg.name}</div>${c?.customName ? `<div class="j-sub">${cfg.name}</div>` : ''}${food}${income}</div></div>
        <div class="j-stages">${stages}</div>
        <div class="j-clue"><span>Clue</span>${cfg.clue}</div>`;
    }

    this.journal.innerHTML = `<div class="journal-inner">
      <div class="shop-head"><div class="shop-title">${ICONS.journal} Journal</div>
        <div class="j-flip glyph">${this.g('flip')} turn page</div>
        <button class="btn close-shop">${ICONS.close}<span class="glyph">${this.g('back')}</span></button></div>
      <div class="j-body">
        <div class="j-list">${list}</div>
        <div class="j-page panel">${page}
          <div class="j-nav"><button class="btn j-prev">◀</button><span>${SPECIES.indexOf(key) + 1} / ${SPECIES.length}</span><button class="btn j-next">▶</button></div>
        </div>
      </div></div>`;
    this.journal.querySelector('.close-shop').onclick = () => g.back();
    this.journal.querySelector('.j-prev').onclick = () => this.flipJournal(-1);
    this.journal.querySelector('.j-next').onclick = () => this.flipJournal(1);
    this.journal.querySelectorAll('.j-entry').forEach((b) => { b.onclick = () => { this.journalPage = b.dataset.k; g.audio.play('menu'); this.renderJournal(); }; });
  }

  // ---------- naming ----------
  openName(creature) {
    this.nameModal.innerHTML = `<div class="modal-card panel">
      <div class="modal-title">Name your ${creature.speciesName}</div>
      <input class="name-input" maxlength="16" value="${creature.customName ?? ''}" placeholder="${creature.speciesName}" />
      <div class="modal-actions"><button class="btn cancel">Cancel</button><button class="btn ok">Save</button></div></div>`;
    this.nameModal.classList.remove('hidden');
    const input = this.nameModal.querySelector('input');
    const save = () => {
      const v = input.value.trim().replace(/[<>&"]/g, '');
      creature.customName = v || null;
      this.closeName();
      this.game.audio.play('menu');
    };
    this.nameModal.querySelector('.ok').onclick = save;
    this.nameModal.querySelector('.cancel').onclick = () => this.closeName();
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => input.focus(), 30);
  }
  closeName() { this.nameModal.classList.add('hidden'); document.activeElement?.blur(); }
  get nameOpen() { return !this.nameModal.classList.contains('hidden'); }

  // ---------- banner / tip ----------
  banner(text) {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.remove('hidden', 'show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.bannerEl.classList.add('hidden'), tuning.ui.bannerTime * 1000);
  }
  tip(text, kind = '') {
    this.tipEl.textContent = text;
    this.tipEl.className = 'tip ' + kind;
    this.tipEl.classList.remove('hidden');
    clearTimeout(this.tipT);
    this.tipT = setTimeout(() => this.tipEl.classList.add('hidden'), 1800);
  }

  // ---------- tutorial ----------
  renderTutorial() {
    const step = this.game.tutorialStep();
    const key = step ? step.id + this.input.device : 'done';
    if (key === this.tutorialKey) return;
    this.tutorialKey = key;
    if (!step) {
      this.tutorial.classList.add('fade');
      setTimeout(() => this.tutorial.classList.add('hidden'), 600);
      return;
    }
    this.tutorial.classList.remove('hidden', 'fade', 'pop');
    void this.tutorial.offsetWidth;
    this.tutorial.classList.add('pop');
    this.tutorial.innerHTML = `<div class="tut-count">${step.n} / 4</div><div class="tut-text">${step.text}</div><div class="tut-hint">${step.hint(this)}</div>`;
  }
}

export { SEED_ORDER };
