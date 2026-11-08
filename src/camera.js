import * as THREE from 'three';
import tuning from './tuning.json';

const C = tuning.camera;
const DEG = Math.PI / 180;
const LIMIT = tuning.map.size / 2 + 1;

// Third-person orbit camera: free 360° yaw, clamped pitch and zoom, edge-pan toward the cursor.
export class OrbitCamera {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 1.5);
    this.goalTarget = this.target.clone();
    this.yaw = 0;            // 0 = looking north from the gate side
    this.goalYaw = 0;
    this.pitch = C.startPitch * DEG;
    this.goalPitch = this.pitch;
    this.dist = C.startZoom;
    this.goalDist = this.dist;
    this.follow = null;
    this.apply();
  }

  orbit(dYaw, dPitch = 0) {
    this.goalYaw += dYaw;
    this.goalPitch = THREE.MathUtils.clamp(this.goalPitch + dPitch, C.pitchMin * DEG, C.pitchMax * DEG);
  }

  zoom(factor) {
    this.goalDist = THREE.MathUtils.clamp(this.goalDist * factor, C.zoomMin, C.zoomMax);
  }

  // Pan in screen space: dx right, dy up (in metres).
  pan(dx, dy) {
    this.follow = null; // moving the camera by hand stops following a creature
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.goalTarget.addScaledVector(right, dx).addScaledVector(fwd, dy);
    this.goalTarget.x = THREE.MathUtils.clamp(this.goalTarget.x, -LIMIT, LIMIT);
    this.goalTarget.z = THREE.MathUtils.clamp(this.goalTarget.z, -LIMIT, LIMIT);
  }

  edgePan(dt, px, py, active) {
    if (!active) return;
    const z = C.edgePanZone;
    let ex = 0, ey = 0;
    if (px < z) ex = -(1 - px / z);
    else if (px > innerWidth - z) ex = 1 - (innerWidth - px) / z;
    if (py < z) ey = 1 - py / z;
    else if (py > innerHeight - z) ey = -(1 - (innerHeight - py) / z);
    if (ex || ey) {
      const speed = C.edgePanSpeed * this.dist * dt;
      this.pan(ex * speed, ey * speed);
    }
  }

  update(dt) {
    if (this.follow) this.goalTarget.set(this.follow.pos.x, 0, this.follow.pos.z);
    const k = 1 - Math.exp(-dt * 10);
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    this.dist += (this.goalDist - this.dist) * k;
    this.target.lerp(this.goalTarget, k);
    this.apply();
  }

  apply() {
    const h = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * h
    );
    this.camera.lookAt(this.target);
  }
}
