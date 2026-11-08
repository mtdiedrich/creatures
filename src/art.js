import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Shared time uniform for wind sway etc.
export const globalUniforms = { uTime: { value: 0 } };

// Paint a geometry with a flat vertex color so several parts can be merged into one mesh.
export function paint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

export function place(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz)
  );
  geo.applyMatrix4(m);
  return geo;
}

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

// Material whose saturation can be animated: uSat 0 = grayscale, 1 = full color.
export function saturationMaterial(params, satUniform) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSat = satUniform;
    shader.fragmentShader = 'uniform float uSat;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
       gl_FragColor.rgb = mix(vec3(lum) * 0.95 + 0.03, gl_FragColor.rgb, uSat);`
    );
  };
  mat.customProgramCacheKey = () => 'sat';
  return mat;
}

// Gentle wind sway for instanced grass, keyed on instance position.
export function windMaterial(params, strength = 0.08) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
       #else
         vec4 ip = vec4(0.0);
       #endif
       float sway = sin(uTime * 1.7 + ip.x * 0.7 + ip.z * 0.4) * ${strength.toFixed(3)} * max(position.y, 0.0) * 4.0;
       transformed.x += sway;
       transformed.z += sway * 0.5;`
    );
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
  return mat;
}

export const PALETTE = {
  grass: [0x5fcf3c, 0x56c736, 0x66d644, 0x52c02f],
  grassTip: 0x9cf05a,
  grassBase: 0x2f9a26,
  soil: 0x8a5a33,
  soilWet: 0x5b3a20,
  junkBase: 0x8c7a5e,
  rockBase: 0x8f8a7c,
  strip: 0x7fd65a,
  outside: 0x6cc24a,
};
