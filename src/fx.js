import * as THREE from 'three';

// Small pooled particle system: dirt, splashes, sparkles, petals.
export class FX {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.parts = [];
    this.geo = new THREE.IcosahedronGeometry(1, 0);
    this.pool = [];
    this.floatLayer = null;
    this.floats = [];
  }

  spawn(pos, color, { count = 8, speed = 2, up = 2.5, size = 0.06, life = 0.8, gravity = 9, emissive = false, spread = 0.2 } = {}) {
    for (let i = 0; i < count; i++) {
      let m = this.pool.pop();
      if (!m) {
        m = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }));
        m.castShadow = false;
      }
      m.material.color.set(color);
      m.material.emissive.set(emissive ? color : 0x000000);
      m.material.emissiveIntensity = emissive ? 0.8 : 0;
      m.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + 0.05, pos.z + (Math.random() - 0.5) * spread);
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.6);
      m.userData = {
        v: new THREE.Vector3(Math.cos(a) * sp, up * (0.6 + Math.random() * 0.6), Math.sin(a) * sp),
        life, max: life, size: size * (0.6 + Math.random() * 0.8), gravity,
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
      };
      m.scale.setScalar(m.userData.size);
      this.scene.add(m);
      this.parts.push(m);
    }
  }

  dirt(pos, color = 0x8a5a33) { this.spawn(pos, color, { count: 12, speed: 1.8, up: 3, size: 0.07 }); }
  smash(pos) { this.spawn(pos, 0xb0ada3, { count: 10, speed: 2.4, up: 3.2, size: 0.08 }); this.dirt(pos, 0x9c7b52); }
  splash(pos) { this.spawn(pos, 0x7fd8ff, { count: 14, speed: 1.2, up: 2.2, size: 0.04, life: 0.6, emissive: true }); }
  sparkle(pos, color = 0xfff27a, count = 14) {
    this.spawn({ x: pos.x, y: pos.y + 0.4, z: pos.z }, color, { count, speed: 1.6, up: 2.2, size: 0.05, life: 1.1, gravity: 2, emissive: true, spread: 0.4 });
  }
  petals(pos, color) { this.spawn({ x: pos.x, y: pos.y + 0.3, z: pos.z }, color, { count: 4, speed: 0.8, up: 1.2, size: 0.04, life: 0.7, gravity: 4 }); }

  // Floating DOM text (coin gains etc.), anchored to a world point.
  floatText(worldPos, text, cls = '') {
    if (!this.floatLayer) return;
    const el = document.createElement('div');
    el.className = 'float-text ' + cls;
    el.textContent = text;
    this.floatLayer.appendChild(el);
    this.floats.push({ el, pos: worldPos.clone().add(new THREE.Vector3(0, 1.0, 0)), t: 0 });
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const m = this.parts[i], u = m.userData;
      u.life -= dt;
      if (u.life <= 0) {
        this.scene.remove(m); this.parts.splice(i, 1); this.pool.push(m); continue;
      }
      u.v.y -= u.gravity * dt;
      m.position.addScaledVector(u.v, dt);
      if (m.position.y < 0.02) { m.position.y = 0.02; u.v.multiplyScalar(0.5); u.v.y = Math.abs(u.v.y) * 0.3; }
      m.rotation.x += u.spin.x * dt; m.rotation.y += u.spin.y * dt;
      m.scale.setScalar(u.size * Math.min(1, u.life / (u.max * 0.4)));
    }
    const v = new THREE.Vector3();
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t > 1.6) { f.el.remove(); this.floats.splice(i, 1); continue; }
      v.copy(f.pos); v.y += f.t * 0.8;
      v.project(this.camera);
      const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
      f.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, (1.6 - f.t) * 2));
    }
  }
}
