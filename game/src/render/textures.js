// Procedurally painted textures — no external image assets needed.
import * as THREE from 'three';
import { mulberry32 } from '../config.js';

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Window façade: texture covers 8 window columns × 8 floors.
// style: 'res' punched windows, 'office' curtain wall, 'ind' high strip windows
export function facadeTextures(style, seed = 1) {
  const S = 512, cols = 8, rows = 8, cw = S / cols, rh = S / rows;
  const rnd = mulberry32(seed);
  const base = canvas(S), em = canvas(S), rough = canvas(S);
  const b = base.getContext('2d'), e = em.getContext('2d'), r = rough.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  if (style === 'office') {
    b.fillStyle = '#5d7088'; b.fillRect(0, 0, S, S);
    r.fillStyle = '#222'; r.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const g = b.createLinearGradient(0, y * rh, 0, (y + 1) * rh);
      const tint = 140 + rnd() * 40;
      g.addColorStop(0, `rgb(${tint * 0.55},${tint * 0.72},${tint})`);
      g.addColorStop(1, `rgb(${tint * 0.35},${tint * 0.48},${tint * 0.7})`);
      b.fillStyle = g; b.fillRect(x * cw + 2, y * rh + 6, cw - 4, rh - 8);
      if (rnd() < 0.42) {
        const warm = rnd() < 0.7;
        e.fillStyle = warm ? `rgba(255,${210 + rnd() * 30},${150 + rnd() * 40},${0.6 + rnd() * 0.4})` : `rgba(190,225,255,${0.6 + rnd() * 0.4})`;
        e.fillRect(x * cw + 2, y * rh + 6, cw - 4, rh - 8);
      }
    }
    // mullions/spandrels
    b.fillStyle = '#c9d3dc';
    for (let y = 0; y < rows; y++) b.fillRect(0, y * rh, S, 6);
    for (let x = 0; x < cols; x++) b.fillRect(x * cw, 0, 2, S);
    r.fillStyle = '#bbb';
    for (let y = 0; y < rows; y++) r.fillRect(0, y * rh, S, 6);
  } else if (style === 'ind') {
    b.fillStyle = '#ffffff'; b.fillRect(0, 0, S, S);
    r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, S, S);
    // corrugation
    for (let x = 0; x < S; x += 8) { b.fillStyle = 'rgba(0,0,0,0.07)'; b.fillRect(x, 0, 3, S); }
    for (let y = 0; y < rows; y += 2) for (let x = 0; x < cols; x++) {
      if (rnd() < 0.25) continue;
      b.fillStyle = '#3d4a57'; b.fillRect(x * cw + 6, y * rh + 14, cw - 12, rh * 0.45);
      r.fillStyle = '#333'; r.fillRect(x * cw + 6, y * rh + 14, cw - 12, rh * 0.45);
      if (rnd() < 0.5) { e.fillStyle = `rgba(255,236,190,${0.5 + rnd() * 0.5})`; e.fillRect(x * cw + 6, y * rh + 14, cw - 12, rh * 0.45); }
    }
  } else {
    b.fillStyle = '#ffffff'; b.fillRect(0, 0, S, S);
    r.fillStyle = '#e6e6e6'; r.fillRect(0, 0, S, S);
    // subtle plaster noise
    for (let k = 0; k < 2500; k++) { b.fillStyle = `rgba(0,0,0,${rnd() * 0.04})`; b.fillRect(rnd() * S, rnd() * S, 2, 2); }
    for (let y = 0; y < rows; y++) {
      b.fillStyle = 'rgba(0,0,0,0.08)'; b.fillRect(0, y * rh + rh - 4, S, 4); // floor line
      for (let x = 0; x < cols; x++) {
        const wx = x * cw + cw * 0.22, wy = y * rh + rh * 0.2, ww = cw * 0.56, wh = rh * 0.56;
        b.fillStyle = 'rgba(0,0,0,0.25)'; b.fillRect(wx - 3, wy - 3, ww + 6, wh + 8); // frame shadow
        const g = b.createLinearGradient(wx, wy, wx + ww, wy + wh);
        g.addColorStop(0, '#506a82'); g.addColorStop(1, '#22313f');
        b.fillStyle = g; b.fillRect(wx, wy, ww, wh);
        b.fillStyle = 'rgba(255,255,255,0.18)'; b.fillRect(wx, wy, ww * 0.35, wh);
        b.fillStyle = '#f2f2f2'; b.fillRect(wx - 3, wy + wh + 2, ww + 6, 4); // sill
        r.fillStyle = '#2a2a2a'; r.fillRect(wx, wy, ww, wh);
        if (rnd() < 0.5) {
          const c = rnd() < 0.8 ? `rgba(255,${190 + rnd() * 40},${110 + rnd() * 50},1)` : 'rgba(160,200,255,1)';
          e.fillStyle = c; e.fillRect(wx, wy, ww, wh);
          // curtain split
          e.fillStyle = 'rgba(0,0,0,0.35)'; e.fillRect(wx + ww * (0.3 + rnd() * 0.4), wy, 2, wh);
        }
      }
    }
  }
  return { map: tex(base), emissive: tex(em), roughness: tex(rough, { srgb: false }) };
}

// Road tile for a connection mask: bits N=1,E=2,S=4,W=8
export function roadTexture(mask) {
  const S = 256, c = canvas(S), g = c.getContext('2d');
  const rnd = mulberry32(mask * 31 + 7);
  const sw = 46; // sidewalk width
  // sidewalk base
  g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, S, S);
  for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
  // paving joints
  g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
  for (let k = 0; k <= S; k += 23) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, S); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(S, k); g.stroke(); }
  const N = mask & 1, E = mask & 2, So = mask & 4, W = mask & 8;
  const a0 = sw, a1 = S - sw;
  const asphalt = () => {
    const gr = g.createLinearGradient(0, 0, S, S); gr.addColorStop(0, '#3a3d42'); gr.addColorStop(1, '#33363b'); return gr;
  };
  // curb shadow
  g.fillStyle = 'rgba(0,0,0,0.35)';
  const rect = (x, y, w, h, pad = 0) => g.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  const shapes = [[a0, a0, a1 - a0, a1 - a0]];
  if (N) shapes.push([a0, 0, a1 - a0, a0]);
  if (So) shapes.push([a0, a1, a1 - a0, S - a1]);
  if (E) shapes.push([a1, a0, S - a1, a1 - a0]);
  if (W) shapes.push([0, a0, a0, a1 - a0]);
  for (const s of shapes) rect(...s, 3);
  g.fillStyle = '#d8d5cc';
  for (const s of shapes) rect(...s, 2);
  g.fillStyle = asphalt();
  if (mask === 0) { g.beginPath(); g.arc(S / 2, S / 2, (a1 - a0) / 2 + 6, 0, Math.PI * 2); g.fill(); }
  else for (const s of shapes) rect(...s);
  // asphalt grain + patches
  for (let k = 0; k < 1600; k++) { const v = rnd(); g.fillStyle = v < 0.5 ? `rgba(255,255,255,${rnd() * 0.05})` : `rgba(0,0,0,${rnd() * 0.12})`; const x = a0 + rnd() * (a1 - a0), y = a0 + rnd() * (a1 - a0); g.fillRect(x, y, 2, 2); }
  const count = (N ? 1 : 0) + (E ? 1 : 0) + (So ? 1 : 0) + (W ? 1 : 0);
  const mid = S / 2;
  g.lineCap = 'butt';
  if (count <= 2) {
    // centre dashed line(s)
    g.strokeStyle = '#f2c94c'; g.lineWidth = 4; g.setLineDash([18, 14]);
    const seg = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    if (N && So) seg(mid, 0, mid, S);
    else if (E && W) seg(0, mid, S, mid);
    else {
      if (N) seg(mid, 0, mid, mid); if (So) seg(mid, mid, mid, S);
      if (E) seg(mid, mid, S, mid); if (W) seg(0, mid, mid, mid);
    }
    g.setLineDash([]);
  } else {
    // intersection: crosswalks + stop lines
    g.fillStyle = '#ecebe6';
    const zebra = (horizontal, pos) => {
      for (let k = a0 + 8; k < a1 - 8; k += 16) {
        if (horizontal) g.fillRect(k, pos, 9, 22); else g.fillRect(pos, k, 22, 9);
      }
    };
    if (N) zebra(true, a0 - 24);
    if (So) zebra(true, a1 + 2);
    if (W) zebra(false, a0 - 24);
    if (E) zebra(false, a1 + 2);
  }
  // manhole
  g.fillStyle = 'rgba(20,20,20,0.6)'; g.beginPath(); g.arc(mid + 30, mid - 26, 7, 0, Math.PI * 2); g.fill();
  const t = tex(c, { repeat: false });
  return t;
}

export function detailNoiseTexture(size = 256, seed = 5) {
  const c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size), rnd = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = 200 + rnd() * 55;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // blades/specks
  for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${rnd() * 0.15})`; g.fillRect(rnd() * size, rnd() * size, 1, 3); }
  return tex(c);
}

export function waterNormalTexture(size = 256, seed = 11) {
  const rnd = mulberry32(seed);
  const h = new Float32Array(size * size);
  // sum of random sine waves (tileable)
  const waves = [];
  for (let k = 0; k < 14; k++) waves.push({ fx: ((rnd() * 8) | 0) + 1, fy: ((rnd() * 8) | 0) - 4, a: 0.3 + rnd(), p: rnd() * 6.28 });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const w of waves) v += Math.sin(((x * w.fx + y * w.fy) / size) * 6.2832 + w.p) * w.a / (w.fx + Math.abs(w.fy));
    h[y * size + x] = v;
  }
  const c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const nx = -hx * 4, ny = -hy * 4, nz = 1, l = Math.hypot(nx, ny, nz);
    const o = (y * size + x) * 4;
    img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

export function radialSprite(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = canvas(size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return tex(c, { repeat: false });
}

export function smokeSprite(size = 128, seed = 3) {
  const c = canvas(size), g = c.getContext('2d'), rnd = mulberry32(seed);
  for (let k = 0; k < 14; k++) {
    const x = size / 2 + (rnd() - 0.5) * size * 0.35, y = size / 2 + (rnd() - 0.5) * size * 0.35, r = size * (0.18 + rnd() * 0.18);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
  }
  return tex(c, { repeat: false });
}

export function cursorTexture() {
  const S = 128, c = canvas(S), g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 8;
  const L = 34;
  for (const [x, y, dx, dy] of [[6, 6, 1, 1], [S - 6, 6, -1, 1], [6, S - 6, 1, -1], [S - 6, S - 6, -1, -1]]) {
    g.beginPath(); g.moveTo(x, y + dy * L); g.lineTo(x, y); g.lineTo(x + dx * L, y); g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(6, 6, S - 12, S - 12);
  return tex(c, { repeat: false });
}

// Soft square contact shadow (fake ambient occlusion under buildings)
export function contactShadowTexture(size = 128) {
  const c = canvas(size), g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = Math.abs(x / (size - 1) - 0.5) * 2, v = Math.abs(y / (size - 1) - 0.5) * 2;
    const d = Math.pow(Math.pow(u, 6) + Math.pow(v, 6), 1 / 6);
    const a = Math.max(0, Math.min(1, (1 - d) / 0.28));
    const o = (y * size + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = Math.round(a * a * 255);
  }
  g.putImageData(img, 0, 0);
  return tex(c, { repeat: false });
}
