// Procedural 3D asset library. Every model faces +z (its "front" toward the road).
import * as THREE from 'three';
import { GeoBuilder, G } from './geo.js';
import { facadeTextures } from './textures.js';
import { FLOOR, mulberry32 } from '../config.js';

const Y0 = 0.014; // top of lot pad
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];

const RES_WALLS = ['#f3ead8', '#e4edf2', '#f4d6c2', '#dbe8d2', '#efe0b4', '#ddd5ea'];
const ROOFS = ['#a8483a', '#4b5664', '#6e4636', '#37604f', '#86634a'];
const BRICK = ['#a65a43', '#8f4c3b', '#b77457'];
const GLASS_TINT = ['#ffffff', '#d6efff', '#cfe8dc', '#f3e4cf'];
const IND_WALLS = ['#c9cdd1', '#9fb3c5', '#d4c8ae', '#b6c1ad'];
const NEON = ['#ff3d7f', '#38d9ff', '#ffd23d', '#7dff6a', '#b06bff', '#ff8a3d'];
const LAWN = '#6d9a4a', CONCRETE = '#a19f99', ASPHALT_LOT = '#55575b';

// ---------------------------------------------------------------- materials
export function createMaterials() {
  const fr = facadeTextures('res', 3), fo = facadeTextures('office', 5), fi = facadeTextures('ind', 9);
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  const wres = new THREE.MeshStandardMaterial({ vertexColors: true, map: fr.map, roughnessMap: fr.roughness, roughness: 1, emissiveMap: fr.emissive, emissive: 0xffffff, emissiveIntensity: 0 });
  const woff = new THREE.MeshStandardMaterial({ vertexColors: true, map: fo.map, roughnessMap: fo.roughness, roughness: 1, metalness: 0.5, emissiveMap: fo.emissive, emissive: 0xffffff, emissiveIntensity: 0, envMapIntensity: 1.4 });
  const wind = new THREE.MeshStandardMaterial({ vertexColors: true, map: fi.map, roughnessMap: fi.roughness, roughness: 1, metalness: 0.25, emissiveMap: fi.emissive, emissive: 0xffffff, emissiveIntensity: 0 });
  const neon = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
  const list = [plain, wres, woff, wind, neon];
  return {
    list, plain, wres, woff, wind, neon,
    setNight(f) {
      wres.emissiveIntensity = f * 1.7;
      woff.emissiveIntensity = f * 1.5;
      wind.emissiveIntensity = f * 1.3;
      neon.color.setScalar(0.85 + f * 2.6);
    },
  };
}

// ---------------------------------------------------------------- helpers
function lot(b, color, size = 1) { b.box(0, 0, 0, 0.98 * size, Y0, 0.98 * size, color); }
function bush(b, x, z, r, c = '#4f8a3a') { b.sphere(x, Y0, z, r, 6, c, 0.85); }
function smallTree(b, x, z, s = 1, c = '#5a9a40') {
  b.cyl(x, Y0, z, 0.02 * s, 0.1 * s, 5, '#6b4a33');
  b.sphere(x, Y0 + 0.07 * s, z, 0.1 * s, 7, c, 1.1);
}
function acUnits(b, R, y, w, d, n = 3) {
  for (let k = 0; k < n; k++) b.box((R() - 0.5) * w, y, (R() - 0.5) * d, 0.08, 0.05, 0.06, '#c7c9cb');
}
function parapet(b, x, y, z, w, d, c, t = 0.025, h = 0.04) {
  b.box(x, y, z + d / 2 - t / 2, w, h, t, c);
  b.box(x, y, z - d / 2 + t / 2, w, h, t, c);
  b.box(x + w / 2 - t / 2, y, z, t, h, d - 2 * t, c);
  b.box(x - w / 2 + t / 2, y, z, t, h, d - 2 * t, c);
}
function beacon(b, x, y, z) { b.cyl(x, y, z, 0.006, 0.18, 4, '#888'); b.sphere(x, y + 0.18, z, 0.022, 6, '#ff2a2a', 1, G.NEON); }

// ---------------------------------------------------------------- residential
function resL1(v) {
  const b = new GeoBuilder(), R = mulberry32(100 + v);
  const wall = pick(RES_WALLS, v * 2), roof = pick(ROOFS, v);
  lot(b, LAWN);
  b.box(-0.06, Y0, 0.34, 0.12, 0.004, 0.3, '#d4ccbb'); // path
  if (v === 0) {
    b.box(0, Y0, -0.06, 0.56, 0.3, 0.44, wall, { side: G.WRES, vOff: 0.03 });
    b.gable(0, Y0 + 0.3, -0.06, 0.64, 0.22, 0.52, roof, false, wall);
    b.box(0.17, Y0 + 0.34, -0.16, 0.07, 0.22, 0.07, '#7b5546');
    b.box(-0.06, Y0, 0.165, 0.11, 0.19, 0.02, '#5a3a2a');
    b.box(0.32, Y0, 0.22, 0.2, 0.004, 0.5, '#9b9a95'); // driveway
  } else if (v === 1) {
    b.box(-0.08, Y0, -0.08, 0.5, 0.3, 0.4, wall, { side: G.WRES, vOff: 0.03 });
    b.gable(-0.08, Y0 + 0.3, -0.08, 0.56, 0.2, 0.46, roof, false, wall);
    b.box(0.26, Y0, 0.05, 0.26, 0.24, 0.42, wall);
    b.gable(0.26, Y0 + 0.24, 0.05, 0.3, 0.14, 0.46, roof, true, wall);
    b.box(0.26, Y0, 0.265, 0.2, 0.17, 0.012, '#e9e6df'); // garage door
    b.box(-0.06, Y0, 0.125, 0.1, 0.19, 0.02, '#3d5a7a');
  } else if (v === 2) {
    // modern two-storey
    b.box(-0.04, Y0, -0.06, 0.6, FLOOR * 2, 0.42, '#f1f1ee', { side: G.WRES });
    b.box(0.18, Y0 + FLOOR, 0.06, 0.32, FLOOR, 0.36, '#9b7454'); // timber box upstairs
    b.box(0.18, Y0 + FLOOR + 0.03, 0.245, 0.26, 0.15, 0.012, '#ffffff', { side: G.WOFF });
    b.box(-0.14, Y0, 0.155, 0.28, 0.18, 0.012, '#ffffff', { side: G.WOFF });
    parapet(b, -0.04, Y0 + FLOOR * 2, -0.06, 0.6, 0.42, '#d9d9d6');
    b.box(-0.3, Y0, 0.3, 0.26, 0.012, 0.22, '#4fb3d9'); // pool
    b.box(-0.3, Y0, 0.3, 0.3, 0.008, 0.26, '#e8e2d4');
  } else {
    // cottage with porch
    b.box(0, Y0, -0.08, 0.5, 0.28, 0.42, wall, { side: G.WRES, vOff: 0.03 });
    b.gable(0, Y0 + 0.28, -0.08, 0.5, 0.2, 0.5, roof, true, wall);
    b.box(0, Y0, 0.19, 0.5, 0.02, 0.14, '#b89a7a');
    b.box(0, Y0 + 0.2, 0.19, 0.54, 0.02, 0.16, roof);
    for (const px of [-0.22, 0, 0.22]) b.box(px, Y0, 0.25, 0.02, 0.2, 0.02, '#f4f4f0');
    for (let k = -4; k <= 4; k++) b.box(k * 0.11, Y0, 0.46, 0.015, 0.06, 0.015, '#f7f7f2'); // picket fence
    b.box(0, Y0 + 0.04, 0.46, 0.95, 0.012, 0.01, '#f7f7f2');
  }
  for (let k = 0; k < 3; k++) bush(b, -0.38 + R() * 0.15, -0.38 + R() * 0.7, 0.05 + R() * 0.03);
  smallTree(b, 0.36, -0.34, 1 + R() * 0.4);
  return { geo: b.build() };
}

function resL2(v) {
  const b = new GeoBuilder(), R = mulberry32(200 + v);
  const wall = v === 1 ? pick(BRICK, v) : pick(RES_WALLS, v + 3);
  const floors = [3, 4, 3, 5][v], h = floors * FLOOR;
  lot(b, v === 2 ? LAWN : CONCRETE);
  if (v === 2) {
    // stepped pair of blocks
    b.box(-0.18, Y0, -0.05, 0.46, h, 0.66, wall, { side: G.WRES, top: '#8b8f93' });
    b.box(0.24, Y0, 0.02, 0.4, h - FLOOR, 0.6, pick(RES_WALLS, v + 1), { side: G.WRES, top: '#8b8f93' });
    parapet(b, -0.18, Y0 + h, -0.05, 0.46, 0.66, '#e0ddd5');
    parapet(b, 0.24, Y0 + h - FLOOR, 0.02, 0.4, 0.6, '#e0ddd5');
    acUnits(b, R, Y0 + h, 0.3, 0.4);
  } else {
    b.box(0, Y0, -0.04, 0.82, h, 0.68, wall, { side: G.WRES, top: '#8b8f93' });
    parapet(b, 0, Y0 + h, -0.04, 0.82, 0.68, v === 1 ? '#d8cfc2' : '#e6e2da');
    // balconies
    for (let f = 1; f < floors; f++) {
      for (const bx of [-0.22, 0.22]) {
        b.box(bx, Y0 + f * FLOOR - 0.01, 0.335, 0.3, 0.018, 0.09, '#ebebeb');
        b.box(bx, Y0 + f * FLOOR + 0.008, 0.378, 0.3, 0.06, 0.008, '#a9c4d4', { side: G.WOFF });
      }
    }
    b.box(0, Y0 + 0.19, 0.34, 0.26, 0.02, 0.12, '#3c3f44'); // entrance canopy
    b.box(0, Y0, 0.302, 0.14, 0.18, 0.02, '#ffffff', { side: G.WOFF });
    acUnits(b, R, Y0 + h, 0.6, 0.5, 4);
    b.cyl(0.25, Y0 + h, -0.2, 0.07, 0.16, 8, '#8a6f55');
    b.box(-0.22, Y0 + h, -0.18, 0.18, 0.12, 0.16, '#bdbab3');
  }
  bush(b, -0.4, 0.42, 0.05); bush(b, 0.4, 0.42, 0.05);
  return { geo: b.build() };
}

function resL3(v) {
  const b = new GeoBuilder(), R = mulberry32(300 + v);
  const floors = 13 + v * 3, h = floors * FLOOR;
  const wall = pick(['#f1efe9', '#e6edf3', '#efe6dc', '#dfe7e1'], v);
  lot(b, CONCRETE);
  b.box(0, Y0, 0, 0.92, FLOOR * 2, 0.92, '#ffffff', { side: G.WOFF, top: '#7f8a84' }); // podium retail
  b.box(0, Y0 + FLOOR * 2, 0.0, 0.94, 0.03, 0.94, '#e2e2de');
  const base = Y0 + FLOOR * 2 + 0.03;
  if (v === 0) {
    b.box(0, base, -0.04, 0.64, h, 0.5, wall, { side: G.WRES, top: '#6f7479' });
    for (const fx of [-0.32, 0.32]) b.box(fx, base, 0.21, 0.04, h, 0.04, '#c6a77d');
    b.box(0, base + h, -0.04, 0.4, 0.2, 0.3, '#d0d0cc');
    beacon(b, 0.1, base + h + 0.2, -0.04);
  } else if (v === 1) {
    const th = h * 0.85;
    for (const tx of [-0.2, 0.2]) {
      b.box(tx, base, 0, 0.34, tx < 0 ? h : th, 0.38, wall, { side: G.WRES, top: '#6f7479' });
    }
    b.box(0, base + th * 0.6, 0, 0.12, FLOOR * 1.5, 0.22, '#ffffff', { side: G.WOFF }); // skybridge
    beacon(b, -0.2, base + h, 0);
  } else if (v === 2) {
    b.lathe(0, base, 0, [[0.32, 0], [0.32, h]], 16, wall, G.WRES, { capTop: true, capColor: '#6f7479' });
    for (let f = 2; f < floors; f += 2) b.lathe(0, base + f * FLOOR - 0.012, 0, [[0.345, 0], [0.345, 0.02]], 16, '#f4f4f4', G.PLAIN, { capTop: true, capColor: '#f4f4f4' });
    b.cyl(0, base + h, 0, 0.18, 0.18, 12, '#d6d6d2');
    beacon(b, 0, base + h + 0.18, 0);
  } else {
    const t1 = Math.round(floors * 0.5), t2 = Math.round(floors * 0.3), t3 = floors - t1 - t2;
    b.box(0, base, 0, 0.7, t1 * FLOOR, 0.6, wall, { side: G.WRES, top: '#7d8a80' });
    b.box(0, base + t1 * FLOOR, -0.03, 0.56, t2 * FLOOR, 0.48, wall, { side: G.WRES, top: '#7d8a80', vOff: 0 });
    b.box(0, base + (t1 + t2) * FLOOR, -0.05, 0.42, t3 * FLOOR, 0.36, wall, { side: G.WRES, top: '#6f7479' });
    // roof gardens
    b.translate(0, base + t1 * FLOOR - Y0, 0);
    for (const [bx, bz] of [[-0.31, 0.2], [0.31, 0.2], [-0.31, -0.22], [0.31, -0.22]]) bush(b, bx, bz, 0.035);
    b.pop();
    beacon(b, 0, base + h, -0.05);
  }
  return { geo: b.build() };
}

// ---------------------------------------------------------------- commercial
function comL1(v) {
  const b = new GeoBuilder(), R = mulberry32(400 + v);
  const wall = pick(['#e9dfcf', '#d4dde4', '#f0d9c4', '#e5e5e5'], v), aw = pick(['#d9453b', '#2f7fbf', '#2c9a6a', '#e0a020'], v);
  const neon = pick(NEON, v + 1);
  lot(b, ASPHALT_LOT);
  for (let k = -3; k <= 3; k++) b.box(k * 0.12, Y0, 0.37, 0.012, 0.002, 0.16, '#e8e8e8'); // parking lines
  if (v === 3) {
    // gas station canopy + kiosk
    b.box(0, Y0, -0.26, 0.5, 0.26, 0.32, wall, { side: G.WOFF });
    b.box(0, Y0 + 0.36, 0.14, 0.78, 0.05, 0.44, '#f3f3f3');
    b.box(0, Y0 + 0.36, 0.14, 0.8, 0.02, 0.46, neon, { side: G.NEON });
    for (const px of [-0.3, 0.3]) for (const pz of [-0.02, 0.3]) b.box(px, Y0, pz, 0.03, 0.36, 0.03, '#d6d6d6');
    for (const px of [-0.12, 0.12]) b.box(px, Y0, 0.14, 0.06, 0.13, 0.1, '#c23b32');
    b.box(0.38, Y0, -0.4, 0.03, 0.5, 0.03, '#777');
    b.box(0.38, Y0 + 0.5, -0.4, 0.16, 0.1, 0.02, neon, { side: G.NEON });
  } else {
    const w = 0.84, d = 0.54, hh = v === 1 ? 0.42 : 0.34;
    b.box(0, Y0, -0.14, w, hh, d, wall, { top: '#7a7d80' });
    b.box(0, Y0, 0.135, w - 0.08, 0.25, 0.02, '#ffffff', { side: G.WOFF });
    parapet(b, 0, Y0 + hh, -0.14, w, d, '#cfcac0', 0.02, 0.05);
    b.translate(0, Y0 + 0.28, 0.2).rotateX(0.45);
    b.box(0, 0, 0, w - 0.06, 0.012, 0.15, aw);
    b.pop().pop();
    // rooftop sign
    b.box(0, Y0 + hh, -0.02, 0.52, 0.14, 0.025, '#2a2a2e');
    b.box(0, Y0 + hh + 0.025, -0.006, 0.46, 0.09, 0.006, neon, { side: G.NEON, topGroup: G.NEON });
    acUnits(b, R, Y0 + hh, 0.5, 0.2, 2);
    if (v === 2) for (const ux of [-0.28, 0.28]) { b.cyl(ux, Y0, 0.36, 0.008, 0.16, 4, '#888'); b.cone(ux, Y0 + 0.13, 0.36, 0.12, 0.06, 8, aw); }
  }
  return { geo: b.build() };
}

function comL2(v) {
  const b = new GeoBuilder(), R = mulberry32(500 + v);
  const floors = [6, 7, 8, 9][v], h = floors * FLOOR, tint = pick(GLASS_TINT, v), neon = pick(NEON, v + 2);
  lot(b, CONCRETE);
  if (v === 2) {
    // mixed use: shops + brick upper floors
    b.box(0, Y0, 0, 0.84, FLOOR, 0.8, '#ffffff', { side: G.WOFF });
    b.box(0, Y0 + FLOOR, 0, 0.84, h - FLOOR, 0.8, pick(BRICK, v), { side: G.WRES, top: '#6d6f72' });
    parapet(b, 0, Y0 + h, 0, 0.84, 0.8, '#d4c9b8');
    b.box(0, Y0 + FLOOR - 0.02, 0.42, 0.84, 0.03, 0.06, '#2f2f33');
  } else if (v === 1) {
    b.box(-0.12, Y0, -0.08, 0.58, h, 0.62, tint, { side: G.WOFF, top: '#5f6266' });
    b.box(0.22, Y0, 0.12, 0.46, h * 0.7, 0.56, tint, { side: G.WOFF, top: '#5f6266' });
    parapet(b, 0.22, Y0 + h * 0.7, 0.12, 0.46, 0.56, '#c7cdd3');
    acUnits(b, R, Y0 + h, 0.4, 0.4, 3);
  } else {
    b.box(0, Y0, 0, 0.8, h, 0.8, tint, { side: G.WOFF, top: '#5f6266' });
    for (const fx of [-0.4, 0, 0.4]) b.box(fx, Y0, 0.4, 0.03, h, 0.03, '#d6dbe0');
    for (const fz of [-0.4, 0, 0.4]) b.box(0.4, Y0, fz, 0.03, h, 0.03, '#d6dbe0');
    parapet(b, 0, Y0 + h, 0, 0.8, 0.8, '#d6dbe0', 0.03, 0.06);
    b.box(0, Y0 + h, -0.1, 0.36, 0.16, 0.3, '#b9bcbf');
    if (v === 3) { // hotel vertical neon
      b.box(0.43, Y0 + FLOOR * 2, 0.32, 0.04, h - FLOOR * 3, 0.1, '#1d1d22');
      b.box(0.452, Y0 + FLOOR * 2 + 0.03, 0.32, 0.006, h - FLOOR * 3 - 0.06, 0.08, neon, { side: G.NEON });
    }
  }
  // rooftop logo
  b.box(0, Y0 + h + 0.02, 0.3, 0.4, 0.1, 0.02, neon, { side: G.NEON, topGroup: G.NEON });
  b.box(0, Y0, 0.42, 0.3, 0.2, 0.04, '#ffffff', { side: G.WOFF }); // lobby
  return { geo: b.build() };
}

function comL3(v) {
  const b = new GeoBuilder(), R = mulberry32(600 + v);
  const floors = 19 + v * 3, h = floors * FLOOR, tint = pick(GLASS_TINT, v + 1), neon = pick(NEON, v);
  lot(b, CONCRETE);
  b.box(0, Y0, 0, 0.94, FLOOR * 2, 0.94, '#ffffff', { side: G.WOFF, top: '#4f5458' });
  const base = Y0 + FLOOR * 2;
  if (v === 0) {
    const t = [0.5, 0.3, 0.2].map((f) => Math.round(f * floors));
    let y = base; const ws = [0.74, 0.6, 0.46];
    t.forEach((n, k) => { b.box(0, y, 0, ws[k], n * FLOOR, ws[k], tint, { side: G.WOFF, top: '#56595d' }); b.box(0, y + n * FLOOR, 0, ws[k] + 0.03, 0.03, ws[k] + 0.03, '#d8dde2'); y += n * FLOOR + 0.03; });
    b.cyl(0, y, 0, 0.05, 0.25, 6, '#c7ccd1', G.PLAIN, true, 0.02);
    b.cyl(0, y + 0.25, 0, 0.012, 0.5, 4, '#aaa');
    b.sphere(0, y + 0.74, 0, 0.025, 6, '#ff2a2a', 1, G.NEON);
  } else if (v === 1) {
    b.lathe(0, base, 0, [[0.36, 0], [0.36, h], [0.28, h + 0.1]], 20, tint, G.WOFF, { capTop: true, capColor: '#56595d' });
    b.lathe(0, base + h + 0.1, 0, [[0.2, 0], [0.2, 0.06]], 20, neon, G.NEON, { capTop: true, capColor: '#333' });
    beacon(b, 0, base + h + 0.16, 0);
  } else if (v === 2) {
    const steps = 6; let y = base;
    for (let k = 0; k < steps; k++) {
      const n = Math.round(floors / steps), w = 0.78 - k * 0.07;
      b.box(0, y, 0, w, n * FLOOR, w, tint, { side: G.WOFF, top: '#56595d' });
      y += n * FLOOR;
    }
    b.box(0, y, 0, 0.3, 0.04, 0.3, neon, { side: G.NEON, topGroup: G.NEON });
    b.cyl(0, y + 0.04, 0, 0.02, 0.9, 5, '#d0d0d0', G.PLAIN, true, 0.004);
    b.sphere(0, y + 0.9, 0, 0.02, 6, '#ff2a2a', 1, G.NEON);
  } else {
    for (const tx of [-0.22, 0.22]) {
      const hh = tx < 0 ? h : h * 0.9;
      b.box(tx, base, 0, 0.36, hh, 0.5, tint, { side: G.WOFF, top: '#56595d' });
      b.box(tx, base + hh, 0, 0.3, 0.06, 0.44, neon, { side: G.NEON, topGroup: G.NEON });
      beacon(b, tx, base + hh + 0.06, 0);
    }
  }
  return { geo: b.build() };
}

// ---------------------------------------------------------------- industrial
function stack(b, x, z, r, h, emitters) {
  b.cyl(x, Y0, z, r, h, 10, '#d8d8d8', G.PLAIN, true, r * 0.8);
  for (let k = 1; k < 4; k++) b.cyl(x, Y0 + h * (k / 4) - 0.03, z, r * (1 - k * 0.05) + 0.004, 0.05, 10, '#c0392b', G.PLAIN, false);
  emitters.push([x, Y0 + h + 0.02, z]);
}

function indL1(v) {
  const b = new GeoBuilder(), R = mulberry32(700 + v), wall = pick(IND_WALLS, v);
  lot(b, '#8c8a84');
  const w = 0.86, d = 0.66, hh = 0.34;
  b.box(0, Y0, -0.08, w, hh, d, wall, { side: G.WIND, top: '#8f969c' });
  // sawtooth roof
  const n = 4;
  for (let k = 0; k < n; k++) {
    const z = -0.08 - d / 2 + (k + 0.5) * (d / n);
    b.gable(0, Y0 + hh, z, w - 0.02, 0.07, d / n, k % 2 ? '#80878d' : '#737a80');
    b.box(0, Y0 + hh, z - d / n / 2 + 0.006, w - 0.02, 0.07, 0.012, '#c9d3da');
  }
  for (const dx of [-0.25, 0.05, 0.3]) b.box(dx, Y0, 0.255, 0.16, 0.2, 0.01, '#55606b'); // loading doors
  b.box(0, Y0 + 0.22, 0.29, 0.86, 0.02, 0.08, '#666');
  // pallets / crates
  for (let k = 0; k < 4; k++) b.box(-0.36 + R() * 0.7, Y0, 0.36 + R() * 0.08, 0.07, 0.06, 0.07, pick(['#b8864f', '#2f6aa8', '#c0392b'], k));
  if (v % 2) b.cyl(0.36, Y0, -0.38, 0.07, 0.22, 10, '#e0e0e0');
  return { geo: b.build(), emitters: [] };
}

function indL2(v) {
  const b = new GeoBuilder(), R = mulberry32(800 + v), wall = pick(IND_WALLS, v + 1), em = [];
  lot(b, '#86847e');
  b.box(-0.1, Y0, -0.05, 0.64, 0.5, 0.7, wall, { side: G.WIND, top: '#7a8086' });
  b.gable(-0.1, Y0 + 0.5, -0.05, 0.64, 0.12, 0.7, '#6d757c', true);
  b.box(0.3, Y0, 0.16, 0.24, 0.3, 0.34, pick(IND_WALLS, v + 2), { side: G.WIND });
  stack(b, 0.32, -0.28, 0.05, 0.95 + v * 0.1, em);
  if (v % 2 === 0) stack(b, 0.18, -0.36, 0.04, 0.75, em);
  for (const tz of [-0.32, -0.12]) { b.cyl(-0.34 + (v % 2) * 0.68, Y0, tz + 0.5, 0.08, 0.2, 12, '#e6e1d4', G.PLAIN, true); }
  b.box(0.07, Y0 + 0.38, -0.05, 0.4, 0.025, 0.025, '#9a9a9a'); // pipe rack
  b.box(0.35, Y0 + 0.24, 0.34, 0.12, 0.08, 0.01, pick(NEON, v + 3), { side: G.NEON });
  return { geo: b.build(), emitters: em };
}

function indL3(v) {
  const b = new GeoBuilder(), R = mulberry32(900 + v), em = [];
  lot(b, '#7f7d78');
  // tank farm
  for (let k = 0; k < 3; k++) {
    const x = -0.28 + k * 0.28, z = 0.25;
    b.cyl(x, Y0, z, 0.12, 0.24, 14, '#ece9e2', G.PLAIN, true);
    b.cyl(x, Y0 + 0.24, z, 0.12, 0.03, 14, '#d0ccc2', G.PLAIN, true, 0.08);
  }
  // process tower + frame
  b.box(-0.18, Y0, -0.2, 0.42, 0.62, 0.36, pick(IND_WALLS, v), { side: G.WIND, top: '#70767c' });
  b.cyl(0.2, Y0, -0.24, 0.07, 1.25, 10, '#bfc4c8', G.PLAIN, true);
  for (let k = 1; k <= 4; k++) b.cyl(0.2, Y0 + k * 0.25, -0.24, 0.085, 0.02, 10, '#e2b33c', G.PLAIN, true);
  stack(b, 0.36, -0.38, 0.045, 1.5 + v * 0.1, em);
  stack(b, -0.36, -0.38, 0.05, 1.2, em);
  // flare
  b.cyl(0.38, Y0, 0.0, 0.012, 0.95, 4, '#999');
  b.sphere(0.38, Y0 + 0.95, 0.0, 0.03, 6, '#ff9a2a', 1.3, G.NEON);
  for (let k = 0; k < 3; k++) b.box(0, Y0 + 0.12 + k * 0.17, -0.02, 0.8, 0.02, 0.02, '#8d8d8d');
  return { geo: b.build(), emitters: em };
}

export const ZONE_MODELS = { 2: [null, resL1, resL2, resL3], 3: [null, comL1, comL2, comL3], 4: [null, indL1, indL2, indL3] };

// ---------------------------------------------------------------- services
export function serviceModel(id) {
  const b = new GeoBuilder(), em = [];
  let blades = null, extra = {};
  if (id === 'wind') {
    lot(b, LAWN);
    b.cyl(0, Y0, 0, 0.12, 0.05, 8, '#cfcfcf');
    b.cyl(0, Y0, 0, 0.045, 2.2, 10, '#f4f4f4', G.PLAIN, true, 0.025);
    b.box(0, Y0 + 2.18, 0.02, 0.07, 0.07, 0.18, '#f0f0f0');
    b.sphere(0, Y0 + 2.27, 0.02, 0.012, 5, '#ff3030', 1, G.NEON);
    const bb = new GeoBuilder();
    bb.sphere(0, -0.03, 0, 0.035, 6, '#f6f6f6');
    for (let k = 0; k < 3; k++) { bb.rotateZ((k * Math.PI * 2) / 3); bb.box(0, 0.03, 0, 0.05, 0.85, 0.012, '#fafafa'); bb.box(0, 0.6, 0.007, 0.05, 0.14, 0.002, '#e74c3c'); bb.pop(); }
    blades = { geo: bb.build(), pos: [0, Y0 + 2.215, 0.12] };
  } else if (id === 'tower') {
    lot(b, CONCRETE);
    for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.box(lx, Y0, lz, 0.035, 0.85, 0.035, '#8b9299');
    b.box(0, Y0 + 0.45, 0, 0.4, 0.02, 0.02, '#8b9299'); b.box(0, Y0 + 0.45, 0, 0.02, 0.02, 0.4, '#8b9299');
    b.cyl(0, Y0, 0, 0.04, 0.85, 8, '#7d848b');
    b.lathe(0, Y0 + 0.8, 0, [[0.06, 0], [0.26, 0.1], [0.28, 0.3], [0.22, 0.42], [0.0001, 0.5]], 16, '#7fc6e8');
    b.lathe(0, Y0 + 1.0, 0, [[0.283, 0], [0.283, 0.05]], 16, '#ffffff', G.PLAIN);
  } else if (id === 'park') {
    lot(b, '#5f9a44');
    b.box(0, Y0, 0, 0.98, 0.004, 0.14, '#d9cfb6'); b.box(0, Y0, 0, 0.14, 0.004, 0.98, '#d9cfb6');
    b.cyl(0, Y0, 0, 0.16, 0.05, 16, '#cfc8b8');
    b.cyl(0, Y0 + 0.02, 0, 0.13, 0.035, 16, '#5fc2e6', G.PLAIN, true);
    b.cyl(0, Y0, 0, 0.025, 0.14, 8, '#d8d2c4');
    for (const [tx, tz, s] of [[-0.3, -0.3, 1.4], [0.32, -0.28, 1.1], [-0.28, 0.32, 1.2], [0.3, 0.3, 1.5]]) smallTree(b, tx, tz, s, pick(['#4f9a3c', '#6aa846', '#3f8a46'], Math.round(tx * 10)));
    for (const bx of [-0.2, 0.2]) b.box(bx, Y0, 0.12, 0.12, 0.03, 0.04, '#7b5a3c');
    for (let k = 0; k < 5; k++) bush(b, -0.42 + k * 0.21, -0.45, 0.035, '#c2507a');
  } else if (id === 'police') {
    lot(b, CONCRETE);
    b.box(0, Y0, -0.08, 0.8, FLOOR * 2, 0.6, '#e9edf2', { side: G.WRES, top: '#3f5b85' });
    parapet(b, 0, Y0 + FLOOR * 2, -0.08, 0.8, 0.6, '#3a5a8c', 0.03, 0.05);
    b.box(0, Y0 + FLOOR * 2 - 0.08, 0.225, 0.5, 0.06, 0.01, '#2d6cdf', { side: G.NEON });
    b.box(0, Y0, 0.23, 0.18, 0.18, 0.02, '#ffffff', { side: G.WOFF });
    carBody(b, -0.26, 0.38, '#f4f4f4', '#1b3d7a', true); carBody(b, 0.26, 0.38, '#f4f4f4', '#1b3d7a', true);
    b.cyl(0.4, Y0, 0.4, 0.008, 0.6, 4, '#ccc'); b.box(0.44, Y0 + 0.52, 0.4, 0.08, 0.05, 0.004, '#2d6cdf');
  } else if (id === 'fire') {
    lot(b, CONCRETE);
    b.box(-0.08, Y0, -0.06, 0.66, FLOOR * 1.7, 0.66, pick(BRICK, 0), { side: G.WRES, top: '#5b4038' });
    for (const gx of [-0.26, 0.06]) { b.box(gx, Y0, 0.275, 0.24, 0.26, 0.012, '#e8e6e0'); b.box(gx, Y0 + 0.26, 0.28, 0.26, 0.02, 0.014, '#f2f2f2'); }
    b.box(0.34, Y0, -0.24, 0.2, 0.9, 0.2, pick(BRICK, 1), { side: G.WRES });
    b.box(0.34, Y0 + 0.9, -0.24, 0.22, 0.03, 0.22, '#f2f2f2');
    b.sphere(0.34, Y0 + 0.93, -0.24, 0.03, 6, '#ff2a2a', 1, G.NEON);
    b.box(-0.26, Y0, 0.4, 0.14, 0.09, 0.24, '#d22f27'); // engine
  } else if (id === 'school') {
    lot(b, '#6f9e4f', 2);
    b.box(-0.45, Y0, -0.45, 0.9, FLOOR * 2, 0.7, pick(BRICK, 2), { side: G.WRES, top: '#556070' });
    b.box(0.45, Y0, -0.62, 0.9, FLOOR * 2, 0.4, pick(BRICK, 2), { side: G.WRES, top: '#556070' });
    b.gable(-0.45, Y0 + FLOOR * 2, -0.45, 0.94, 0.14, 0.74, '#556070');
    b.box(-0.45, Y0, -0.08, 0.22, 0.2, 0.04, '#ffffff', { side: G.WOFF });
    // sports field + track
    b.lathe(0.42, Y0, 0.42, [[0.48, 0], [0.48, 0.004]], 24, '#c0563f', G.PLAIN, { capTop: true, capColor: '#c0563f' });
    b.lathe(0.42, Y0 + 0.005, 0.42, [[0.36, 0], [0.36, 0.004]], 24, '#4f9a3c', G.PLAIN, { capTop: true, capColor: '#4f9a3c' });
    b.box(0.42, Y0 + 0.01, 0.42, 0.01, 0.002, 0.5, '#ffffff');
    b.cyl(-0.85, Y0, 0.2, 0.008, 0.7, 4, '#ccc'); b.box(-0.8, Y0 + 0.6, 0.2, 0.1, 0.07, 0.004, '#e74c3c');
    smallTree(b, -0.75, 0.75, 1.5); smallTree(b, -0.45, 0.8, 1.3);
  } else if (id === 'hospital') {
    lot(b, CONCRETE, 2);
    b.box(-0.25, Y0, -0.25, 0.8, FLOOR * 6, 0.8, '#f4f6f8', { side: G.WRES, top: '#9aa3ab' });
    b.box(0.45, Y0, -0.3, 0.7, FLOOR * 3, 1.0, '#eef1f4', { side: G.WRES, top: '#9aa3ab' });
    b.box(-0.25, Y0 + FLOOR * 6, -0.25, 0.3, 0.02, 0.1, '#ff2a2a', { topGroup: G.NEON, side: G.NEON });
    b.box(-0.25, Y0 + FLOOR * 6, -0.25, 0.1, 0.02, 0.3, '#ff2a2a', { topGroup: G.NEON, side: G.NEON });
    b.cyl(0.45, Y0 + FLOOR * 3, -0.3, 0.24, 0.02, 20, '#5d646b', G.PLAIN, true);
    b.box(0.45, Y0 + FLOOR * 3 + 0.02, -0.3, 0.03, 0.004, 0.16, '#ffffff');
    b.box(-0.25, Y0, 0.2, 0.4, 0.18, 0.1, '#ffffff', { side: G.WOFF });
    b.box(-0.25, Y0 + 0.18, 0.3, 0.5, 0.02, 0.3, '#d0d6dc');
    carBody(b, 0.1, 0.5, '#ffffff', '#e74c3c', true, 1.3);
    for (let k = 0; k < 4; k++) smallTree(b, -0.8 + k * 0.4, 0.82, 1.2);
  } else if (id === 'gas') {
    lot(b, '#8a8882', 2);
    const tower = (x, z) => {
      b.lathe(x, Y0, z, [[0.36, 0], [0.27, 0.45], [0.22, 0.85], [0.25, 1.1]], 20, '#d7d4cc');
      em.push([x, Y0 + 1.15, z, 1]);
    };
    tower(-0.45, -0.45); tower(0.4, -0.5);
    b.box(-0.2, Y0, 0.45, 1.2, 0.45, 0.6, '#b9c0c6', { side: G.WIND, top: '#7c848b' });
    stack(b, 0.75, 0.6, 0.06, 1.6, em);
    for (let k = 0; k < 4; k++) b.box(0.25 + k * 0.12, Y0, 0.0, 0.05, 0.28, 0.05, '#e2b33c');
  } else if (id === 'solar') {
    lot(b, '#8fa86c', 2);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) {
      b.translate(-0.45 + c * 0.9, Y0 + 0.12, -0.75 + r * 0.36).rotateX(-0.55);
      b.box(0, 0, 0, 0.8, 0.012, 0.26, '#1f3a66', { top: '#26508f' });
      b.pop().pop();
      b.box(-0.45 + c * 0.9, Y0, -0.75 + r * 0.36, 0.03, 0.12, 0.03, '#999');
    }
    b.box(0.85, Y0, 0.85, 0.18, 0.14, 0.18, '#d6d6d6');
  } else if (id === 'stadium') {
    lot(b, CONCRETE, 3);
    b.scale(1, 1, 0.78);
    b.lathe(0, Y0, 0, [[1.38, 0], [1.38, 0.55], [1.25, 0.62]], 40, '#e8ebee', G.WOFF, {});
    b.lathe(0, Y0, 0, [[1.25, 0.62], [0.95, 0.2]], 40, '#c84a4a');
    b.lathe(0, Y0, 0, [[0.95, 0.03], [0.95, 0.031]], 40, '#3f9a45', G.PLAIN, { capTop: true, capColor: '#3f9a45' });
    b.pop();
    b.box(0, Y0 + 0.035, 0, 1.0, 0.003, 0.01, '#ffffff');
    b.lathe(0, Y0 + 0.035, 0, [[0.16, 0], [0.16, 0.003]], 20, '#e8e8e8');
    for (const [mx, mz] of [[-1.3, -1.0], [1.3, -1.0], [-1.3, 1.0], [1.3, 1.0]]) {
      b.cyl(mx, Y0, mz, 0.02, 1.3, 5, '#a0a6ab');
      b.box(mx, Y0 + 1.3, mz, 0.26, 0.1, 0.04, '#fff6d8', { side: G.NEON });
    }
    extra.lightPool = true;
  }
  return { geo: b.build(), emitters: em, blades, ...extra };
}

// ---------------------------------------------------------------- props
function carBody(b, x, z, body, accent, siren = false, len = 1) {
  b.translate(x, Y0, z);
  b.box(0, 0.015, 0, 0.12, 0.05, 0.22 * len, body);
  b.box(0, 0.065, -0.01, 0.1, 0.04, 0.12, '#ffffff', { side: G.WOFF, top: accent });
  if (siren) b.box(0, 0.105, -0.01, 0.07, 0.015, 0.02, accent, { side: G.NEON, topGroup: G.NEON });
  b.pop();
}

export function carGeometry() {
  const b = new GeoBuilder();
  b.box(0, 0.02, 0, 0.13, 0.055, 0.28, '#ffffff');
  b.box(0, 0.075, -0.02, 0.11, 0.045, 0.14, '#ffffff', { side: G.WOFF, top: '#e6e6e6' });
  for (const wx of [-0.065, 0.065]) for (const wz of [-0.09, 0.09]) b.box(wx, 0.0, wz, 0.02, 0.04, 0.05, '#1a1a1a');
  for (const hx of [-0.04, 0.04]) {
    b.box(hx, 0.04, 0.141, 0.028, 0.016, 0.004, '#fff4d0', { side: G.NEON });
    b.box(hx, 0.04, -0.141, 0.028, 0.014, 0.004, '#ff2a1a', { side: G.NEON });
  }
  return b.build();
}

export function treeGeometry(type) {
  const b = new GeoBuilder();
  if (type === 1) {
    b.cyl(0, 0, 0, 0.03, 0.12, 5, '#5c4030');
    b.cone(0, 0.08, 0, 0.17, 0.28, 7, '#2f6b3c');
    b.cone(0, 0.22, 0, 0.13, 0.24, 7, '#357544');
    b.cone(0, 0.35, 0, 0.085, 0.2, 7, '#3d7f4b');
  } else {
    b.cyl(0, 0, 0, 0.028, 0.16, 5, '#6b4a33');
    b.sphere(0, 0.1, 0, 0.16, 7, '#4d8f38', 1.05);
    b.sphere(0.07, 0.2, 0.03, 0.1, 6, '#5a9c40', 1);
    b.sphere(-0.06, 0.18, -0.05, 0.09, 6, '#468a35', 1);
  }
  return b.build();
}

export function lampGeometry() {
  const b = new GeoBuilder();
  b.box(0, 0, 0, 0.018, 0.42, 0.018, '#4a4e54');
  b.box(0, 0.41, 0.05, 0.014, 0.014, 0.11, '#4a4e54');
  b.box(0, 0.395, 0.1, 0.04, 0.016, 0.06, '#ffe7b0', { side: G.NEON, topGroup: G.PLAIN });
  return b.build();
}
