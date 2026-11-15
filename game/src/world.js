// World state: tile grids, terrain generation, persistence.
import { MAP, N, K, mulberry32, clamp } from './config.js';

function valueNoise(seed) {
  const rnd = mulberry32(seed);
  const P = 256, perm = new Uint8Array(P * 2), vals = new Float32Array(P);
  for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rnd(); }
  for (let i = P - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < P; i++) perm[i + P] = perm[i];
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 511]];
  const s = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x, y, oct = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { sum += n(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
}

export class World {
  constructor() {
    this.terrain = new Uint8Array(N);  // 0 land, 1 water
    this.kind = new Uint8Array(N);
    this.level = new Uint8Array(N);
    this.variant = new Uint8Array(N);
    this.rot = new Uint8Array(N);
    this.svc = new Uint8Array(N);      // service index (+1)
    this.root = new Int32Array(N).fill(-1);
    this.tree = new Uint8Array(N);     // 0 none, 1 pine, 2 broadleaf
    // derived fields (sim)
    this.power = new Uint8Array(N);
    this.water = new Uint8Array(N);
    this.roadDist = new Uint8Array(N);
    this.waterDist = new Uint8Array(N);
    this.lv = new Uint8Array(N);
    this.pollution = new Uint8Array(N);
    this.crime = new Uint8Array(N);
    this.cov = { police: new Uint8Array(N), fire: new Uint8Array(N), school: new Uint8Array(N), hospital: new Uint8Array(N) };

    this.name = 'New Harbor';
    this.seed = 1;
    this.funds = 50000;
    this.day = 0;
    this.tax = { r: 9, c: 9, i: 9 };
    this.peakPop = 0;
    this.history = [];
    this.version = 1;
  }

  idx(x, z) { return z * MAP + x; }
  inb(x, z) { return x >= 0 && z >= 0 && x < MAP && z < MAP; }
  xz(i) { return [i % MAP, (i / MAP) | 0]; }

  generate(seed, name) {
    this.seed = seed >>> 0;
    if (name) this.name = name;
    const rnd = mulberry32(this.seed ^ 0x9e3779b9);
    const noise = valueNoise(this.seed);
    const forest = valueNoise(this.seed + 17);
    const c = MAP / 2;
    // island heightfield
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const dx = (x + 0.5 - c) / c, dz = (z + 0.5 - c) / c;
      const r = Math.hypot(dx, dz) * 0.65 + Math.max(Math.abs(dx), Math.abs(dz)) * 0.35;
      const edge = 1 - smooth(0.62, 1.0, r);
      const h = noise(x / 15, z / 15, 4) * 0.6 + edge * 0.8 - 0.5;
      const i = this.idx(x, z);
      this.terrain[i] = (h > 0 && x > 1 && z > 1 && x < MAP - 2 && z < MAP - 2) ? 0 : 1;
    }
    // carve a river from an off-centre point to the coast
    const side = (rnd() * 4) | 0;
    let px = c + (rnd() < 0.5 ? -1 : 1) * (9 + rnd() * 4), pz = c + (rnd() - 0.5) * 10;
    const dir = [[1, 0], [0, 1], [-1, 0], [0, -1]][side];
    for (let s = 0; s < 80; s++) {
      const w = 1 + (s > 20 ? 1 : 0);
      for (let oz = -w + 1; oz < w; oz++) for (let ox = -w + 1; ox < w; ox++) {
        const x = Math.round(px + ox), z = Math.round(pz + oz);
        if (this.inb(x, z)) this.terrain[this.idx(x, z)] = 1;
      }
      px += dir[0] * 0.9 + (rnd() - 0.5) * 1.4;
      pz += dir[1] * 0.9 + (rnd() - 0.5) * 1.4;
      if (!this.inb(Math.round(px), Math.round(pz))) break;
    }
    // ensure a buildable heart
    for (let z = c - 5; z < c + 5; z++) for (let x = c - 5; x < c + 5; x++) this.terrain[this.idx(x, z)] = 0;
    // remove 1-tile specks of land/water
    for (let pass = 0; pass < 2; pass++) for (let z = 1; z < MAP - 1; z++) for (let x = 1; x < MAP - 1; x++) {
      const i = this.idx(x, z); let same = 0;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.terrain[this.idx(x + ox, z + oz)] === this.terrain[i]) same++;
      if (same <= 1) this.terrain[i] ^= 1;
    }
    this.computeWaterDist();
    // trees
    for (let i = 0; i < N; i++) {
      if (this.terrain[i]) continue;
      const [x, z] = this.xz(i);
      const f = forest(x / 9, z / 9, 3);
      const nearCentre = Math.abs(x - c) < 7 && Math.abs(z - c) < 7;
      if (!nearCentre && ((f > 0.56 && rnd() < 0.8) || rnd() < 0.04)) this.tree[i] = f > 0.62 || rnd() < 0.3 ? 1 : 2;
    }
    // starter main street
    for (let x = c - 9; x <= c + 9; x++) this.setRoad(x, c);
    for (let z = c - 6; z <= c + 6; z++) this.setRoad(c, z);
    this.funds = 50000; this.day = 0; this.peakPop = 0; this.history = [];
  }

  setRoad(x, z) {
    if (!this.inb(x, z)) return false;
    const i = this.idx(x, z);
    if (this.terrain[i] || this.kind[i] !== K.EMPTY) return false;
    this.kind[i] = K.ROAD; this.tree[i] = 0; this.root[i] = i;
    return true;
  }

  computeWaterDist() {
    const q = [];
    this.waterDist.fill(255);
    for (let i = 0; i < N; i++) if (this.terrain[i]) { this.waterDist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = this.waterDist[i];
      if (d >= 6) continue;
      const x = i % MAP, z = (i / MAP) | 0;
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, nz = z + oz;
        if (!this.inb(nx, nz)) continue;
        const j = this.idx(nx, nz);
        if (this.waterDist[j] > d + 1) { this.waterDist[j] = d + 1; q.push(j); }
      }
    }
  }

  // --- persistence ---
  serialize() {
    const enc = (a) => b64(new Uint8Array(a.buffer));
    return JSON.stringify({
      v: this.version, name: this.name, seed: this.seed, funds: this.funds, day: this.day,
      tax: this.tax, peakPop: this.peakPop, history: this.history.slice(-120),
      terrain: enc(this.terrain), kind: enc(this.kind), level: enc(this.level), variant: enc(this.variant),
      rot: enc(this.rot), svc: enc(this.svc), root: enc(this.root), tree: enc(this.tree),
    });
  }

  static deserialize(str) {
    const o = JSON.parse(str);
    const w = new World();
    const dec = (s, T) => { const u = unb64(s); return new T(u.buffer, u.byteOffset, u.byteLength / T.BYTES_PER_ELEMENT); };
    Object.assign(w, { name: o.name, seed: o.seed, funds: o.funds, day: o.day, tax: o.tax, peakPop: o.peakPop || 0, history: o.history || [] });
    w.terrain.set(dec(o.terrain, Uint8Array)); w.kind.set(dec(o.kind, Uint8Array)); w.level.set(dec(o.level, Uint8Array));
    w.variant.set(dec(o.variant, Uint8Array)); w.rot.set(dec(o.rot, Uint8Array)); w.svc.set(dec(o.svc, Uint8Array));
    w.root.set(dec(o.root, Int32Array)); w.tree.set(dec(o.tree, Uint8Array));
    w.computeWaterDist();
    return w;
  }

  dateString() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = Math.floor(this.day / 30);
    return `${months[m % 12]} ${2030 + Math.floor(m / 12)}`;
  }
}

function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
