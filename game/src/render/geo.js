// GeoBuilder: tiny procedural mesh kit that emits one BufferGeometry with
// material groups. Façade UVs are computed in world units so windows line up
// with storeys across every building.
import * as THREE from 'three';
import { FLOOR } from '../config.js';

export const G = { PLAIN: 0, WRES: 1, WOFF: 2, WIND: 3, NEON: 4 };
const GROUPS = 5;
const WIN_U = 0.2 * 8;   // façade texture spans 8 windows of 0.2 units
const WIN_V = FLOOR * 8; // and 8 storeys

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();

export class GeoBuilder {
  constructor() {
    this.g = Array.from({ length: GROUPS }, () => ({ p: [], n: [], uv: [], c: [] }));
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this.stack = [];
  }

  push(m) { this.stack.push(this.m.clone()); this.m.multiply(m); this.nm.getNormalMatrix(this.m); return this; }
  pop() { this.m = this.stack.pop(); this.nm.getNormalMatrix(this.m); return this; }
  translate(x, y, z) { return this.push(new THREE.Matrix4().makeTranslation(x, y, z)); }
  rotateY(a) { return this.push(new THREE.Matrix4().makeRotationY(a)); }
  rotateX(a) { return this.push(new THREE.Matrix4().makeRotationX(a)); }
  rotateZ(a) { return this.push(new THREE.Matrix4().makeRotationZ(a)); }
  scale(x, y, z) { return this.push(new THREE.Matrix4().makeScale(x, y, z)); }

  vert(group, p, n, uv, color) {
    const G_ = this.g[group];
    _v.set(p[0], p[1], p[2]).applyMatrix4(this.m);
    _n.set(n[0], n[1], n[2]).applyMatrix3(this.nm).normalize();
    G_.p.push(_v.x, _v.y, _v.z); G_.n.push(_n.x, _n.y, _n.z); G_.uv.push(uv[0], uv[1]);
    _c.set(color); G_.c.push(_c.r, _c.g, _c.b);
  }

  // quad a,b,c,d counter-clockwise when seen from front
  quad(group, a, b, c, d, n, color, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    this.vert(group, a, n, uvs[0], color); this.vert(group, b, n, uvs[1], color); this.vert(group, c, n, uvs[2], color);
    this.vert(group, a, n, uvs[0], color); this.vert(group, c, n, uvs[2], color); this.vert(group, d, n, uvs[3], color);
  }

  tri(group, a, b, c, n, color) {
    this.vert(group, a, n, [0, 0], color); this.vert(group, b, n, [1, 0], color); this.vert(group, c, n, [0.5, 1], color);
  }

  // Axis-aligned box. (x,z) = centre, y = bottom.
  box(x, y, z, w, h, d, color, o = {}) {
    const side = o.side ?? G.PLAIN, topG = o.topGroup ?? G.PLAIN, top = o.top ?? color;
    const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h, z0 = z - d / 2, z1 = z + d / 2;
    const fv = (ya, yb) => [ya / WIN_V, yb / WIN_V];
    const [v0, v1] = fv(y0 + (o.vOff ?? 0), y1 + (o.vOff ?? 0));
    const uw = w / WIN_U, ud = d / WIN_U;
    const sc = o.sideColor ?? color;
    // +z (front)
    this.quad(side, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], sc, [[0, v0], [uw, v0], [uw, v1], [0, v1]]);
    // -z
    this.quad(side, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], sc, [[0, v0], [uw, v0], [uw, v1], [0, v1]]);
    // +x
    this.quad(side, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], sc, [[0, v0], [ud, v0], [ud, v1], [0, v1]]);
    // -x
    this.quad(side, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], sc, [[0, v0], [ud, v0], [ud, v1], [0, v1]]);
    // top
    if (!o.noTop) this.quad(topG, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top);
    if (o.bottom) this.quad(G.PLAIN, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], color);
    return this;
  }

  // Gable roof. Ridge runs along x (or z when alongZ).
  gable(x, y, z, w, h, d, color, alongZ = false, endColor) {
    if (alongZ) { this.translate(x, 0, z).rotateY(Math.PI / 2); this.gable(0, y, 0, d, h, w, color, false, endColor); this.pop().pop(); return this; }
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    const sl = Math.hypot(h, d / 2);
    const nf = [0, (d / 2) / sl, h / sl], nb = [0, (d / 2) / sl, -h / sl];
    this.quad(G.PLAIN, [x0, y, z1], [x1, y, z1], [x1, y1, z], [x0, y1, z], nf, color);
    this.quad(G.PLAIN, [x1, y, z0], [x0, y, z0], [x0, y1, z], [x1, y1, z], nb, color);
    const ec = endColor ?? color;
    this.tri(G.PLAIN, [x1, y, z1], [x1, y, z0], [x1, y1, z], [1, 0, 0], ec);
    this.tri(G.PLAIN, [x0, y, z0], [x0, y, z1], [x0, y1, z], [-1, 0, 0], ec);
    return this;
  }

  // Surface of revolution. profile: [[radius, y], ...] bottom→top
  lathe(x, y, z, profile, seg, color, group = G.PLAIN, o = {}) {
    const circ = [];
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; circ.push([Math.cos(a), Math.sin(a)]); }
    let vacc = 0;
    for (let k = 0; k < profile.length - 1; k++) {
      const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
      const dy = y1 - y0, dr = r1 - r0, len = Math.hypot(dy, dr) || 1;
      const ny = -dr / len, nr = dy / len;
      const v0 = (y + y0 + vacc * 0) / WIN_V, v1 = (y + y1) / WIN_V;
      for (let i = 0; i < seg; i++) {
        const [c0, s0] = circ[i], [c1, s1] = circ[i + 1];
        const u0 = (i / seg) * Math.PI * 2 * Math.max(r0, r1) / WIN_U, u1 = ((i + 1) / seg) * Math.PI * 2 * Math.max(r0, r1) / WIN_U;
        const n0 = o.flat ? [((c0 + c1) / 2) * nr, ny, ((s0 + s1) / 2) * nr] : [c0 * nr, ny, s0 * nr];
        const n1 = o.flat ? n0 : [c1 * nr, ny, s1 * nr];
        const a = [x + c0 * r0, y + y0, z + s0 * r0], b = [x + c1 * r0, y + y0, z + s1 * r0];
        const c = [x + c1 * r1, y + y1, z + s1 * r1], d = [x + c0 * r1, y + y1, z + s0 * r1];
        // winding: viewed from outside, a→d→c→b is CCW for this param; emit with per-vertex normals
        this.vert(group, a, n0, [u0, v0], color); this.vert(group, d, n0, [u0, v1], color); this.vert(group, c, n1, [u1, v1], color);
        this.vert(group, a, n0, [u0, v0], color); this.vert(group, c, n1, [u1, v1], color); this.vert(group, b, n1, [u1, v0], color);
      }
    }
    const last = profile[profile.length - 1];
    if (o.capTop && last[0] > 0) {
      const yc = y + last[1];
      for (let i = 0; i < seg; i++) {
        const [c0, s0] = circ[i], [c1, s1] = circ[i + 1];
        this.vert(o.capGroup ?? G.PLAIN, [x, yc, z], [0, 1, 0], [0.5, 0.5], o.capColor ?? color);
        this.vert(o.capGroup ?? G.PLAIN, [x + c1 * last[0], yc, z + s1 * last[0]], [0, 1, 0], [0, 0], o.capColor ?? color);
        this.vert(o.capGroup ?? G.PLAIN, [x + c0 * last[0], yc, z + s0 * last[0]], [0, 1, 0], [1, 0], o.capColor ?? color);
      }
    }
    return this;
  }

  cyl(x, y, z, r, h, seg, color, group = G.PLAIN, capTop = true, rTop = r) {
    return this.lathe(x, y, z, [[r, 0], [rTop, h]], seg, color, group, { capTop, flat: seg <= 6 });
  }

  cone(x, y, z, r, h, seg, color) { return this.lathe(x, y, z, [[r, 0], [0.0001, h]], seg, color, G.PLAIN, { flat: true }); }

  sphere(x, y, z, r, seg, color, squash = 1, group = G.PLAIN) {
    const prof = [];
    const rings = Math.max(3, Math.round(seg / 2));
    for (let i = 0; i <= rings; i++) { const a = -Math.PI / 2 + (i / rings) * Math.PI; prof.push([Math.max(0.0001, Math.cos(a) * r), (Math.sin(a) * r + r) * squash]); }
    return this.lathe(x, y, z, prof, seg, color, group, { flat: seg <= 7 });
  }

  build() {
    const geo = new THREE.BufferGeometry();
    const P = [], Nn = [], U = [], C = [];
    let start = 0;
    const groups = [];
    for (let k = 0; k < GROUPS; k++) {
      const g = this.g[k];
      const count = g.p.length / 3;
      if (!count) continue;
      P.push(...g.p); Nn.push(...g.n); U.push(...g.uv); C.push(...g.c);
      groups.push([start, count, k]);
      start += count;
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    for (const [s, c, m] of groups) geo.addGroup(s, c, m);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
}
