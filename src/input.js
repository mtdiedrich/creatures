// Input layer: maps platform inputs (mouse + keyboard, touch) to the spec's named actions.
// The game never sees buttons, only actions. UI text uses glyph() to show the current platform's prompt.

const KEYS = {
  back: ['Escape'],
  shop: ['KeyB'],
  journal: ['KeyJ'],
  nextTool: ['KeyX'],
  prevTool: ['KeyZ'],
  orbitLeft: ['KeyQ'],
  orbitRight: ['KeyE'],
  zoomIn: ['KeyR'],
  zoomOut: ['KeyF'],
  panUp: ['KeyW', 'ArrowUp'], panDown: ['KeyS', 'ArrowDown'], panLeft: ['KeyA', 'ArrowLeft'], panRight: ['KeyD', 'ArrowRight'],
};

const mouseSvg = (side) => `<svg viewBox="0 0 16 22" class="g-mouse"><rect x="1" y="1" width="14" height="20" rx="7" fill="#fff" stroke="#3b2a1a" stroke-width="1.6"/><line x1="8" y1="1.5" x2="8" y2="9" stroke="#3b2a1a" stroke-width="1.4"/><line x1="1.5" y1="9" x2="14.5" y2="9" stroke="#3b2a1a" stroke-width="1.4"/>${
  side === 'left' ? '<path d="M8 1.6 A6.4 6.4 0 0 0 1.6 8 V8.4 H8 Z" fill="#ff8a3d"/>' :
  side === 'right' ? '<path d="M8 1.6 A6.4 6.4 0 0 1 14.4 8 V8.4 H8 Z" fill="#ff8a3d"/>' :
  side === 'middle' ? '<rect x="6.5" y="3" width="3" height="5" rx="1.5" fill="#ff8a3d"/>' :
  '<rect x="6.5" y="3" width="3" height="5" rx="1.5" fill="#ff8a3d"/><path d="M8 11 l-2 3 h4 z M8 19 l-2 -3 h4 z" fill="#3b2a1a"/>'}</svg>`;
const key = (k) => `<span class="g-key">${k}</span>`;
const touch = (t) => `<span class="g-touch">${t}</span>`;

const GLYPHS = {
  mouse: {
    use: mouseSvg('left'),
    context: mouseSvg('right'),
    orbit: key('Q') + key('E'),
    zoom: mouseSvg('wheel'),
    back: key('Esc'),
    shop: key('B'),
    journal: key('J'),
    flip: key('Z') + key('X'),
    tool: key('1') + key('2') + key('3'),
    tool1: key('1'), tool2: key('2'), tool3: key('3'), tool0: key('0'),
    seed: mouseSvg('wheel'),
    pan: key('W') + key('A') + key('S') + key('D'),
    move: '',
  },
  touch: {
    use: touch('Tap'),
    context: touch('Hold'),
    orbit: touch('Twist'),
    zoom: touch('Pinch'),
    back: touch('✕'),
    shop: touch('Shop'),
    journal: touch('Journal'),
    flip: touch('◀ ▶'),
    tool: touch('Tap tool'),
    tool1: '', tool2: '', tool3: '', tool0: '',
    pan: touch('Drag'),
    seed: touch('Tap ◀ ▶'),
    move: '',
  },
};

export class Input {
  constructor(canvas, handlers) {
    this.canvas = canvas;
    this.h = handlers;
    this.device = 'mouse';
    this.pointer = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
    this.keys = new Set();
    this.touches = new Map();
    this.drag = null;
    this.listeners = new Set();
    this.enabled = true;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMove(e));
    addEventListener('pointerup', (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; });
    document.addEventListener('pointerout', (e) => { if (!e.relatedTarget) this.pointer.inside = false; });
    canvas.addEventListener('pointerenter', () => { this.pointer.inside = true; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.setDevice('mouse'); this.h.wheel(e.deltaY); }, { passive: false });
    addEventListener('keydown', (e) => this.onKey(e, true));
    addEventListener('keyup', (e) => this.onKey(e, false));
    addEventListener('blur', () => this.keys.clear());
  }

  setDevice(d) {
    if (d === this.device) return;
    this.device = d;
    document.body.dataset.device = d;
    for (const fn of this.listeners) fn(d);
  }
  onDeviceChange(fn) { this.listeners.add(fn); }
  glyph(action) { return GLYPHS[this.device === 'touch' ? 'touch' : 'mouse'][action] || ''; }

  onKey(e, down) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (down && e.code === 'Escape') this.h.back();
      return;
    }
    if (down) this.setDevice('mouse');
    if (down) this.keys.add(e.code); else this.keys.delete(e.code);
    if (!down || e.repeat) return;
    const is = (a) => KEYS[a].includes(e.code);
    if (is('back')) this.h.back();
    else if (is('shop')) this.h.shop();
    else if (is('journal')) this.h.journal();
    else if (is('nextTool')) this.h.tool(1);
    else if (is('prevTool')) this.h.tool(-1);
    else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') this.h.selectTool(Number(e.code.slice(5)) - 1);
    else if (e.code === 'Digit0') this.h.putAway();
    else if (e.code === 'KeyM') this.h.mute();
    else return;
    e.preventDefault();
  }

  held(action) { return KEYS[action].some((k) => this.keys.has(k)); }

  onDown(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    if (e.pointerType === 'touch') {
      this.setDevice('touch');
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false });
      if (this.touches.size === 1) {
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => {
          const t = this.touches.get(e.pointerId);
          if (t && !t.moved && this.touches.size === 1) { t.held = true; this.h.context(t.x, t.y); }
        }, 500);
      } else clearTimeout(this.holdTimer);
      this.pinch = this.touches.size === 2 ? this.pinchState() : null;
      return;
    }
    this.setDevice('mouse');
    this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.inside = true;
    if (e.button === 0) { this.h.use(e.clientX, e.clientY); this.painting = { x: e.clientX, y: e.clientY }; }
    else if (e.button === 2) this.h.context(e.clientX, e.clientY);
    else if (e.button === 1) { e.preventDefault(); this.drag = { x: e.clientX, y: e.clientY }; }
  }

  pinchState() {
    const [a, b] = [...this.touches.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  onMove(e) {
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      t.x = e.clientX; t.y = e.clientY;
      if (Math.hypot(t.x - t.sx, t.y - t.sy) > 12) t.moved = true;
      if (this.touches.size === 1 && t.moved && !t.held) this.h.dragPan(dx, dy);
      else if (this.touches.size === 2 && this.pinch) {
        const p = this.pinchState();
        this.h.zoom(this.pinch.d / Math.max(1, p.d));
        let da = p.ang - this.pinch.ang; da = Math.atan2(Math.sin(da), Math.cos(da));
        this.h.orbit(-da, (p.cy - this.pinch.cy) * 0.004);
        this.pinch = p;
      }
      return;
    }
    this.pointer.x = e.clientX; this.pointer.y = e.clientY;
    if (e.target === this.canvas) this.pointer.inside = true;
    if (this.painting && (e.buttons & 1)) {
      // Click-and-drag: apply the tool along the path, sampled every few pixels so fast drags don't skip tiles.
      const p = this.painting;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      const steps = Math.max(1, Math.ceil(dist / 6));
      for (let i = 1; i <= steps; i++) this.h.paint(p.x + ((e.clientX - p.x) * i) / steps, p.y + ((e.clientY - p.y) * i) / steps);
      p.x = e.clientX; p.y = e.clientY;
    } else if (this.painting) this.painting = null;
    if (this.drag) {
      this.h.orbit(-(e.clientX - this.drag.x) * 0.006, (e.clientY - this.drag.y) * 0.004);
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    }
    this.h.move(e.clientX, e.clientY);
  }

  onUp(e) {
    if (e.pointerType === 'touch') {
      const t = this.touches.get(e.pointerId);
      this.touches.delete(e.pointerId);
      clearTimeout(this.holdTimer);
      if (t && !t.moved && !t.held && this.touches.size === 0 && !this.pinch) this.h.use(t.x, t.y);
      if (this.touches.size < 2) this.pinch = this.touches.size === 0 ? null : this.pinch;
      if (this.touches.size === 0) this.pinch = null;
      return;
    }
    if (e.button === 1) this.drag = null;
    if (e.button === 0) this.painting = null;
  }

  // Held-key camera actions, polled each frame.
  poll(dt, cam) {
    if (this.held('orbitLeft')) cam.orbit(-1.8 * dt);
    if (this.held('orbitRight')) cam.orbit(1.8 * dt);
    if (this.held('zoomIn')) cam.zoom(Math.exp(-1.5 * dt));
    if (this.held('zoomOut')) cam.zoom(Math.exp(1.5 * dt));
    const p = cam.dist * dt * 0.8;
    if (this.held('panUp')) cam.pan(0, p);
    if (this.held('panDown')) cam.pan(0, -p);
    if (this.held('panLeft')) cam.pan(-p, 0);
    if (this.held('panRight')) cam.pan(p, 0);
  }
}
