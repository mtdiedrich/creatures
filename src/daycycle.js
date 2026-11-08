import * as THREE from 'three';
import tuning from './tuning.json';
import { HALF } from './grid.js';

// v0.3: real-time day cycle, lighting, stars, fireflies and rain.
const T = tuning.time;
const DAY = T.dayLength;
const P = T.phases; // seconds per phase
const DUSK_AT = P.day, NIGHT_AT = P.day + P.dusk, DAWN_AT = NIGHT_AT + P.night;

// Lighting keyframes over one day (seconds). The last entry wraps to the first.
const KEYS = [
  { t: 0, sun: 2.2, sunC: 0xffdcb0, hemi: 1.1, sky: 0x6cc0ff, hor: 0xffe7c9, fog: 0xcfe6f2, exp: 1.0, elev: 0.3, stars: 0 },
  { t: DUSK_AT * 0.33, sun: 2.7, sunC: 0xfff0d0, hemi: 1.25, sky: 0x4fb6ff, hor: 0xd8f3ff, fog: 0xaee3ff, exp: 1.05, elev: 1.0, stars: 0 },
  { t: DUSK_AT * 0.8, sun: 2.5, sunC: 0xfff0d0, hemi: 1.2, sky: 0x55b4ff, hor: 0xdff2ff, fog: 0xb4e2ff, exp: 1.05, elev: 0.65, stars: 0 },
  { t: DUSK_AT, sun: 2.0, sunC: 0xffc890, hemi: 1.0, sky: 0x6aa8e8, hor: 0xffd6a8, fog: 0xf0d2b0, exp: 1.0, elev: 0.3, stars: 0 },
  { t: DUSK_AT + P.dusk * 0.5, sun: 1.3, sunC: 0xff8a5a, hemi: 0.75, sky: 0x4a5fb0, hor: 0xff9a6a, fog: 0xd89a8a, exp: 0.97, elev: 0.1, stars: 0.3 },
  { t: NIGHT_AT, sun: 0.5, sunC: 0x8fa6ff, hemi: 0.3, sky: 0x0b1433, hor: 0x22306a, fog: 0x16204a, exp: 0.85, elev: 0.7, stars: 1 },
  { t: DAWN_AT, sun: 0.5, sunC: 0x8fa6ff, hemi: 0.3, sky: 0x0b1433, hor: 0x22306a, fog: 0x16204a, exp: 0.85, elev: 0.7, stars: 1 },
  { t: DAWN_AT + P.dawn * 0.5, sun: 1.2, sunC: 0xffa090, hemi: 0.8, sky: 0x6a7fd0, hor: 0xffb3a0, fog: 0xe0b4b0, exp: 1.0, elev: 0.12, stars: 0.3 },
  { t: DAY, sun: 2.2, sunC: 0xffdcb0, hemi: 1.1, sky: 0x6cc0ff, hor: 0xffe7c9, fog: 0xcfe6f2, exp: 1.0, elev: 0.3, stars: 0 },
];
const RAIN_SKY = new THREE.Color(0x7d8b9c), RAIN_HOR = new THREE.Color(0xaeb7c2), RAIN_FOG = new THREE.Color(0x96a2ae);
const NIGHT_RAIN_SKY = new THREE.Color(0x141a2a), NIGHT_RAIN_FOG = new THREE.Color(0x1a2233);

const ca = new THREE.Color(), cb = new THREE.Color();
const lerpColor = (a, b, k, out) => out.copy(ca.set(a)).lerp(cb.set(b), k);

export class DayCycle {
  constructor(game) {
    this.game = game;
    this.dayTime = T.startTime;
    this.day = 1;
    this.phase = this.phaseAt(this.dayTime);
    this.raining = false;
    this.rainLevel = 0; // 0..1 visual fade
    this.rainPlan = null; // { start, end } within the current day
    this.showerId = 0;
    this.planRain();
    this.cur = {
      sunC: new THREE.Color(), sky: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(),
    };
    this.buildStars();
    this.buildFireflies();
    this.buildRain();
    this.buildLantern();
    this.applyLighting();
  }

  phaseAt(t) { return t < DUSK_AT ? 'day' : t < NIGHT_AT ? 'dusk' : t < DAWN_AT ? 'night' : 'dawn'; }
  get isNight() { return this.phase === 'night'; }

  // 0 in full day, 1 in full night, smooth through dusk and dawn.
  get nightFactor() {
    const t = this.dayTime;
    if (t < DUSK_AT) return 0;
    if (t < NIGHT_AT) return (t - DUSK_AT) / P.dusk;
    if (t < DAWN_AT) return 1;
    return 1 - (t - DAWN_AT) / P.dawn;
  }

  // Clock text: day 06:00–18:00, dusk 18–20, night 20–04, dawn 04–06.
  clock() {
    const t = this.dayTime;
    let h;
    if (t < DUSK_AT) h = 6 + (t / P.day) * 12;
    else if (t < NIGHT_AT) h = 18 + ((t - DUSK_AT) / P.dusk) * 2;
    else if (t < DAWN_AT) h = 20 + ((t - NIGHT_AT) / P.night) * 8;
    else h = 4 + ((t - DAWN_AT) / P.dawn) * 2;
    h %= 24;
    const hh = Math.floor(h), mm = Math.floor(((h - hh) * 60) / 10) * 10;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  planRain() {
    const R = T.rain;
    if (Math.random() < R.chancePerDay) {
      const len = R.minLength + Math.random() * (R.maxLength - R.minLength);
      const start = Math.random() * (DAY - len);
      this.rainPlan = { start, end: start + len };
    } else this.rainPlan = null;
  }

  // Dev aid: start a shower now.
  forceRain(len = (T.rain.minLength + T.rain.maxLength) / 2) {
    this.rainPlan = { start: this.dayTime, end: Math.min(DAY - 0.01, this.dayTime + len) };
  }
  setTime(t) { this.dayTime = ((t % DAY) + DAY) % DAY; this.phase = this.phaseAt(this.dayTime); }

  // Simulation step (game time, paused in full-screen menus).
  update(dt) {
    const g = this.game;
    this.dayTime += dt;
    if (this.dayTime >= DAY) {
      this.dayTime -= DAY;
      this.day++;
      this.planRain();
    }
    const phase = this.phaseAt(this.dayTime);
    if (phase !== this.phase) {
      const prev = this.phase;
      this.phase = phase;
      if (phase === 'night') g.onNightStart();
      if (prev === 'night') g.onNightEnd();
      if (phase === 'dusk') g.ui.tip('The sun is setting', 'weather');
      if (phase === 'dawn') g.ui.tip('Dawn is breaking', 'weather');
    }
    const p = this.rainPlan;
    const shouldRain = !!p && this.dayTime >= p.start && this.dayTime < p.end;
    if (shouldRain !== this.raining) {
      this.raining = shouldRain;
      if (shouldRain) { this.showerId++; g.onRainStart(); }
      else g.onRainEnd();
    }
  }

  // Visual step (real time; keeps animating while paused so menus don't freeze the backdrop mid-frame).
  render(raw) {
    this.rainLevel += ((this.raining ? 1 : 0) - this.rainLevel) * Math.min(1, raw * 0.6);
    this.applyLighting();
    this.animateStars(raw);
    this.animateFireflies(raw);
    this.animateRain(raw);
    this.game.audio.setAmbience(this.nightFactor, this.rainLevel);
  }

  applyLighting() {
    const g = this.game, t = this.dayTime;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = THREE.MathUtils.smoothstep(t, a.t, b.t);
    const L = (key) => a[key] + (b[key] - a[key]) * k;
    const c = this.cur, r = this.rainLevel, n = this.nightFactor;
    lerpColor(a.sunC, b.sunC, k, c.sunC);
    lerpColor(a.sky, b.sky, k, c.sky).lerp(n > 0.5 ? NIGHT_RAIN_SKY : RAIN_SKY, r * 0.75);
    lerpColor(a.hor, b.hor, k, c.hor).lerp(n > 0.5 ? NIGHT_RAIN_FOG : RAIN_HOR, r * 0.75);
    lerpColor(a.fog, b.fog, k, c.fog).lerp(n > 0.5 ? NIGHT_RAIN_FOG : RAIN_FOG, r * 0.8);

    g.sun.color.copy(c.sunC);
    g.sun.intensity = L('sun') * (1 - 0.65 * r);
    g.hemi.intensity = L('hemi') * (1 - 0.3 * r);
    g.hemi.color.copy(c.sky).lerp(cb.set(0xffffff), 0.55);
    g.hemi.groundColor.set(0x6fae4a).lerp(cb.set(0x1c2a44), n * 0.85);
    g.skyUniforms.top.value.copy(c.sky);
    g.skyUniforms.bottom.value.copy(c.hor);
    g.scene.fog.color.copy(c.fog);
    g.scene.fog.near = 45 - 22 * r;
    g.scene.fog.far = 120 - 50 * r;
    g.renderer.toneMappingExposure = L('exp') * (1 - 0.12 * r);
    // Sun (or moon at night) sweeps across the sky.
    const az = (t / DAY) * Math.PI * 2 + 0.6;
    const el = Math.max(0.08, L('elev'));
    g.sun.position.set(Math.cos(az) * Math.cos(el) * 40, Math.sin(el) * 40, Math.sin(az) * Math.cos(el) * 40);
    this.starMat.opacity = L('stars') * (1 - r);
    this.lantern.intensity = 10 * n;
    this.lanternGlow.material.emissiveIntensity = 0.2 + 2.2 * n;
  }

  buildStars() {
    const n = 700, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2, v = 0.12 + Math.random() * 0.88;
      const r = 280;
      pos[i * 3] = Math.cos(u) * Math.sqrt(1 - v * v) * r;
      pos[i * 3 + 1] = v * r;
      pos[i * 3 + 2] = Math.sin(u) * Math.sqrt(1 - v * v) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(geo, this.starMat);
    this.game.scene.add(this.stars);
  }
  animateStars(raw) { this.stars.rotation.y += raw * 0.003; }

  buildFireflies() {
    const n = 40;
    this.ffSeeds = Array.from({ length: n }, () => ({ x: (Math.random() - 0.5) * (HALF * 2 + 2), z: (Math.random() - 0.5) * (HALF * 2 + 2), y: 0.4 + Math.random() * 1.4, p: Math.random() * 10, s: 0.3 + Math.random() * 0.6 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    this.ffMat = new THREE.PointsMaterial({ color: 0xfff27a, size: 7, sizeAttenuation: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.fireflies = new THREE.Points(geo, this.ffMat);
    this.fireflies.frustumCulled = false;
    this.game.scene.add(this.fireflies);
    this.ffTime = 0;
  }
  animateFireflies(raw) {
    this.ffTime += raw;
    const t = this.ffTime, pos = this.fireflies.geometry.attributes.position;
    this.ffSeeds.forEach((f, i) => {
      pos.setXYZ(i, f.x + Math.sin(t * f.s + f.p) * 1.2, f.y + Math.sin(t * f.s * 1.7 + f.p) * 0.3, f.z + Math.cos(t * f.s * 0.8 + f.p) * 1.2);
    });
    pos.needsUpdate = true;
    this.ffMat.opacity = Math.max(0, this.nightFactor - this.rainLevel) * (0.6 + Math.sin(t * 3) * 0.3);
  }

  buildRain() {
    const n = 2200;
    const pos = new Float32Array(n * 6);
    this.drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.drops[i * 3] = (Math.random() - 0.5) * 30;
      this.drops[i * 3 + 1] = Math.random() * 14;
      this.drops[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(geo, this.rainMat);
    this.rain.frustumCulled = false;
    this.game.scene.add(this.rain);
  }
  animateRain(raw) {
    const r = this.rainLevel;
    this.rain.visible = r > 0.01;
    this.rainMat.opacity = 0.7 * r;
    if (!this.rain.visible) return;
    const c = this.game.cam.target, d = this.drops, pos = this.rain.geometry.attributes.position.array;
    const n = d.length / 3, fall = 15 * raw, wind = 2.2 * raw;
    for (let i = 0; i < n; i++) {
      d[i * 3 + 1] -= fall; d[i * 3] += wind;
      if (d[i * 3 + 1] < 0) { d[i * 3 + 1] += 14; d[i * 3] = (Math.random() - 0.5) * 30; d[i * 3 + 2] = (Math.random() - 0.5) * 30; }
      const x = c.x + d[i * 3], y = d[i * 3 + 1], z = c.z + d[i * 3 + 2];
      pos[i * 6] = x; pos[i * 6 + 1] = y; pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - 0.08; pos[i * 6 + 4] = y + 0.55; pos[i * 6 + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  // A small lantern on the well roof that lights up at night.
  buildLantern() {
    const w = tuning.map.well;
    const x = w.x - HALF + 0.5, z = w.z - HALF + 0.5;
    this.lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb43a, emissiveIntensity: 0.2 }));
    this.lanternGlow.position.set(x + 0.42, 0.95, z);
    this.game.scene.add(this.lanternGlow);
    this.lantern = new THREE.PointLight(0xffc46b, 0, 9, 1.6);
    this.lantern.position.set(x + 0.42, 1.0, z);
    this.game.scene.add(this.lantern);
  }
}

export const PHASE_LABEL = { day: 'Day', dusk: 'Dusk', night: 'Night', dawn: 'Dawn' };
