// CityView: turns World state into an instanced, animated 3D city.
import * as THREE from 'three';
import { MAP, N, K, ZONES, SERVICES, svcId, hash01, clamp } from '../config.js';
import { createMaterials, ZONE_MODELS, serviceModel, carGeometry, treeGeometry, lampGeometry } from './models.js';
import { roadTexture, detailNoiseTexture, waterNormalTexture, radialSprite, smokeSprite, cursorTexture, contactShadowTexture } from './textures.js';

const HALF = MAP / 2;
const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const ROT = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export const tileWorld = (x, z) => [x - HALF + 0.5, z - HALF + 0.5];

class InstPool {
  constructor(parent, geo, mat, { cast = true, receive = true, color = false, cap = 64 } = {}) {
    Object.assign(this, { parent, geo, mat, cast, receive, color, cap: 0, n: 0, mesh: null });
    this.grow(cap);
  }
  grow(cap) {
    const old = this.mesh;
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.castShadow = this.cast; m.receiveShadow = this.receive; m.frustumCulled = false;
    m.renderOrder = this.order || 0;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (this.color) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    if (old) {
      m.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.cap * 16));
      if (this.color) m.instanceColor.array.set(old.instanceColor.array.subarray(0, this.cap * 3));
      this.parent.remove(old); old.dispose();
    }
    this.parent.add(m);
    this.mesh = m; this.cap = cap;
  }
  setOrder(o) { this.order = o; this.mesh.renderOrder = o; }
  begin() { this.n = 0; }
  push(matrix, color) {
    if (this.n >= this.cap) this.grow(this.cap * 2);
    this.mesh.setMatrixAt(this.n, matrix);
    if (color && this.color) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.color && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = this.n > 0;
  }
}

export class CityView {
  constructor(r3d, world) {
    this.r3d = r3d;
    this.w = world;
    this.root = new THREE.Group();
    r3d.scene.add(this.root);
    this.mats = createMaterials();
    this.time = 0;
    this.dirty = { roads: true, buildings: true, trees: true, services: true, overlay: true };
    this.anim = new Map();
    this.overlay = 'none';
    this.emitters = [];
    this.svcObjs = new Map();
    this.svcGeo = {};
    this.buildingPools = new Map();

    this.buildTerrain();
    this.buildWater();
    this.buildRoads();
    this.buildProps();
    this.buildCars();
    this.buildParticles();
    this.buildOverlay();
    this.buildCursor();
  }

  setWorld(world) {
    this.w = world;
    this.root.remove(this.terrain); this.terrain.geometry.dispose();
    this.buildTerrain();
    for (const o of this.svcObjs.values()) this.root.remove(o.obj);
    this.svcObjs.clear();
    this.cars.length = 0;
    this.anim.clear();
    Object.keys(this.dirty).forEach((k) => (this.dirty[k] = true));
  }

  // ------------------------------------------------------------ terrain
  buildTerrain() {
    const w = this.w, R = MAP * 2, V = R + 1;
    // distance from land for water tiles (depth)
    const landDist = new Uint8Array(N).fill(9), q = [];
    for (let i = 0; i < N; i++) if (!w.terrain[i]) { landDist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % MAP, z = (i / MAP) | 0, d = landDist[i];
      if (d >= 6) continue;
      for (const [ox, oz] of DIRV) { const nx = x + ox, nz = z + oz; if (nx < 0 || nz < 0 || nx >= MAP || nz >= MAP) continue; const j = nz * MAP + nx; if (landDist[j] > d + 1) { landDist[j] = d + 1; q.push(j); } }
    }
    const tileAt = (x, z) => (x < 0 || z < 0 || x >= MAP || z >= MAP) ? -1 : z * MAP + x;
    const pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), uv = new Float32Array(V * V * 2);
    const grassA = new THREE.Color('#5f9c42'), grassB = new THREE.Color('#79ae4e'), grassC = new THREE.Color('#4c8738');
    const sand = new THREE.Color('#e3cf9a'), wetSand = new THREE.Color('#b8a273'), deep = new THREE.Color('#1f4f5f'), shallow = new THREE.Color('#5aa59a');
    for (let gz = 0; gz < V; gz++) for (let gx = 0; gx < V; gx++) {
      // tiles touching this vertex
      const tx = [], tz = [];
      if (gx % 2) tx.push((gx - 1) / 2); else tx.push(gx / 2 - 1, gx / 2);
      if (gz % 2) tz.push((gz - 1) / 2); else tz.push(gz / 2 - 1, gz / 2);
      let land = false, shore = false, minLD = 9, forest = 0;
      for (const a of tx) for (const b of tz) {
        const i = tileAt(a, b);
        if (i >= 0 && !w.terrain[i]) { land = true; if (w.waterDist[i] <= 1) shore = true; if (w.tree[i]) forest++; }
        minLD = Math.min(minLD, i >= 0 ? landDist[i] : 9);
      }
      const o = gz * V + gx;
      let y = 0;
      const n = hash01(gx, gz), n2 = hash01(gx >> 2, gz >> 2);
      if (land) {
        if (shore) _c.copy(sand).lerp(grassA, 0.15 * n);
        else { _c.copy(grassA).lerp(n2 > 0.5 ? grassB : grassC, Math.abs(n2 - 0.5) * 1.6).lerp(grassB, n * 0.2); if (forest) _c.lerp(grassC, 0.45); }
      } else {
        y = -0.32 - Math.min(minLD, 5) * 0.1;
        _c.copy(minLD <= 1 ? wetSand : shallow).lerp(deep, clamp((minLD - 1) / 4, 0, 1));
      }
      pos[o * 3] = gx * 0.5 - HALF; pos[o * 3 + 1] = y; pos[o * 3 + 2] = gz * 0.5 - HALF;
      col[o * 3] = _c.r; col[o * 3 + 1] = _c.g; col[o * 3 + 2] = _c.b;
      uv[o * 2] = gx / 2; uv[o * 2 + 1] = gz / 2;
    }
    const idx = [];
    for (let gz = 0; gz < R; gz++) for (let gx = 0; gx < R; gx++) {
      const a = gz * V + gx, b = a + 1, c = a + V, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    if (!this.terrainMat) {
      const detail = detailNoiseTexture();
      this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95 });
    }
    this.terrain = new THREE.Mesh(geo, this.terrainMat);
    this.terrain.receiveShadow = true;
    this.root.add(this.terrain);
  }

  buildWater() {
    const seabed = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1d4a58', roughness: 1 }));
    seabed.position.y = -0.84;
    this.root.add(seabed);
    const nrm = waterNormalTexture();
    nrm.repeat.set(220, 220);
    this.waterNormal = nrm;
    const mat = new THREE.MeshStandardMaterial({ color: '#1a7a94', roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.8, normalMap: nrm, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.1 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), mat);
    this.water.position.y = -0.1;
    this.water.receiveShadow = true;
    this.root.add(this.water);
  }

  // ------------------------------------------------------------ roads
  buildRoads() {
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.roadPools = [];
    for (let m = 0; m < 16; m++) {
      const mat = new THREE.MeshStandardMaterial({ map: roadTexture(m), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      this.roadPools.push(new InstPool(this.root, plane, mat, { cast: false, receive: true, cap: 64 }));
    }
    const lampGeo = lampGeometry();
    this.lamps = new InstPool(this.root, lampGeo, this.mats.list, { cast: true, receive: false, cap: 64 });
    const poolMat = new THREE.MeshBasicMaterial({ map: radialSprite('rgba(255,200,120,1)', 'rgba(255,200,120,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, color: '#ffcf8a' });
    this.pools = new InstPool(this.root, new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), poolMat, { cast: false, receive: false, cap: 64 });
    this.poolMat = poolMat;
  }

  roadMask(x, z) {
    const w = this.w;
    let m = 0;
    DIRV.forEach(([ox, oz], d) => { const nx = x + ox, nz = z + oz; if (w.inb(nx, nz) && w.kind[w.idx(nx, nz)] === K.ROAD) m |= 1 << d; });
    return m;
  }

  rebuildRoads() {
    const w = this.w;
    this.roadPools.forEach((p) => p.begin());
    this.lamps.begin(); this.pools.begin();
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.ROAD) continue;
      const x = i % MAP, z = (i / MAP) | 0, [wx, wz] = tileWorld(x, z);
      const mask = this.roadMask(x, z);
      _m.makeTranslation(wx, 0.016, wz);
      this.roadPools[mask].push(_m);
      if ((x + z) % 2 === 0 && (mask === 5 || mask === 10)) {
        if (mask === 5) { _e.set(0, -Math.PI / 2, 0); _p.set(wx + 0.41, 0.016, wz); }
        else { _e.set(0, 0, 0); _p.set(wx, 0.016, wz - 0.41); }
        _m.compose(_p, _q.setFromEuler(_e), _s.set(1, 1, 1));
        this.lamps.push(_m);
        _m.makeTranslation(mask === 5 ? wx + 0.15 : wx, 0.03, mask === 5 ? wz : wz - 0.15);
        this.pools.push(_m);
      }
    }
    this.roadPools.forEach((p) => p.end());
    this.lamps.end(); this.pools.end();
  }

  // ------------------------------------------------------------ buildings
  poolFor(kind, level, variant) {
    const key = kind * 100 + level * 10 + variant;
    let p = this.buildingPools.get(key);
    if (!p) {
      const model = ZONE_MODELS[kind][level](variant);
      p = new InstPool(this.root, model.geo, this.mats.list, { color: true, cap: 32 });
      p.emitters = model.emitters || [];
      this.buildingPools.set(key, p);
    }
    return p;
  }

  rebuildBuildings() {
    const w = this.w, now = this.time;
    for (const p of this.buildingPools.values()) p.begin();
    this.ao.begin();
    this.emitters = [];
    let animating = false;
    for (let i = 0; i < N; i++) {
      const k = w.kind[i], L = w.level[i];
      if (!(k === K.RES || k === K.COM || k === K.IND) || !L) continue;
      const x = i % MAP, z = (i / MAP) | 0, [wx, wz] = tileWorld(x, z);
      const pool = this.poolFor(k, L, w.variant[i] & 3);
      let sy = 1;
      const t0 = this.anim.get(i);
      if (t0 !== undefined) {
        const t = (now - t0) / 0.8;
        if (t >= 1) this.anim.delete(i); else { sy = easeOutBack(Math.max(0.02, t)); animating = true; }
      }
      _q.setFromAxisAngle(UP, ROT[w.rot[i]]);
      _m.compose(_p.set(wx, 0, wz), _q, _s.set(1, sy, 1));
      const h = hash01(i, 3);
      _c.setHSL(h, 0.25, 0.85 + h * 0.1);
      _c.lerp(new THREE.Color(1, 1, 1), 0.55);
      pool.push(_m, _c);
      const as = L === 1 ? 1.12 : 1.22;
      _m.compose(_p.set(wx, 0.02, wz), _q.identity(), _s.set(as, 1, as));
      this.ao.push(_m);
      for (const e of pool.emitters) {
        _p.set(e[0], e[1] * sy, e[2]).applyQuaternion(_q);
        this.emitters.push({ x: wx + _p.x, y: _p.y, z: wz + _p.z, steam: false, rate: 0.6 });
      }
    }
    for (const p of this.buildingPools.values()) p.end();
    for (const [i, o] of this.svcObjs) {
      const sz = SERVICES[o.id].size * 1.1;
      _m.compose(_p.set(o.obj.position.x, 0.02, o.obj.position.z), _q.identity(), _s.set(sz, 1, sz));
      this.ao.push(_m);
    }
    this.ao.end();
    this.dirty.buildings = animating;
    for (const s of this.svcObjs.values()) for (const e of s.emitters) this.emitters.push(e);
  }

  // ------------------------------------------------------------ services
  syncServices() {
    const w = this.w, seen = new Set();
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.SERVICE || w.root[i] !== i) continue;
      const id = svcId(w.svc[i]);
      seen.add(i);
      const ex = this.svcObjs.get(i);
      if (ex && ex.id === id) continue;
      if (ex) this.root.remove(ex.obj);
      if (!this.svcGeo[id]) this.svcGeo[id] = serviceModel(id);
      const model = this.svcGeo[id], s = SERVICES[id];
      const obj = new THREE.Group();
      const mesh = new THREE.Mesh(model.geo, this.mats.list);
      mesh.castShadow = mesh.receiveShadow = true;
      obj.add(mesh);
      const x = i % MAP, z = (i / MAP) | 0, [wx, wz] = tileWorld(x, z), off = (s.size - 1) / 2;
      obj.position.set(wx + off, 0, wz + off);
      obj.rotation.y = ROT[w.rot[i]];
      let blades = null;
      if (model.blades) {
        blades = new THREE.Mesh(model.blades.geo, this.mats.list);
        blades.position.set(...model.blades.pos); blades.castShadow = true;
        blades.rotation.z = hash01(i) * 6;
        obj.add(blades);
      }
      obj.updateMatrixWorld(true);
      const emitters = (model.emitters || []).map((e) => { const v = new THREE.Vector3(e[0], e[1], e[2]).applyMatrix4(obj.matrixWorld); return { x: v.x, y: v.y, z: v.z, steam: !!e[3], rate: e[3] ? 2.2 : 1 }; });
      this.root.add(obj);
      this.svcObjs.set(i, { id, obj, blades, emitters });
      this.spawnDust(wx + off, wz + off, s.size);
      obj.scale.set(1, 0.01, 1);
      this.anim.set(-1 - i, this.time);
    }
    for (const [i, o] of this.svcObjs) if (!seen.has(i)) { this.root.remove(o.obj); this.svcObjs.delete(i); }
    this.dirty.services = false;
    this.dirty.buildings = true; // refresh emitter list
  }

  // ------------------------------------------------------------ trees
  buildProps() {
    const aoMat = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, color: '#000000', opacity: 0.55, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.ao = new InstPool(this.root, new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoMat, { cast: false, receive: false, cap: 256 });
    this.ao.setOrder(1);
    this.treePools = [null, new InstPool(this.root, treeGeometry(1), this.mats.list, { color: true, cap: 512 }), new InstPool(this.root, treeGeometry(2), this.mats.list, { color: true, cap: 512 })];
  }
  rebuildTrees() {
    const w = this.w;
    this.treePools[1].begin(); this.treePools[2].begin();
    for (let i = 0; i < N; i++) {
      const t = w.tree[i];
      if (!t || w.terrain[i] || (w.kind[i] !== K.EMPTY && !(ZONES.includes(w.kind[i]) && w.level[i] === 0))) continue;
      const x = i % MAP, z = (i / MAP) | 0, [wx, wz] = tileWorld(x, z);
      const n = 1 + Math.floor(hash01(i, 11) * 3);
      for (let k = 0; k < n; k++) {
        const ox = (hash01(i, 20 + k) - 0.5) * 0.7, oz = (hash01(i, 40 + k) - 0.5) * 0.7, s = 0.75 + hash01(i, 60 + k) * 0.6;
        const type = k === 0 ? t : (hash01(i, 80 + k) < 0.5 ? 1 : 2);
        _q.setFromAxisAngle(UP, hash01(i, 90 + k) * 6.28);
        _m.compose(_p.set(wx + ox, 0, wz + oz), _q, _s.set(s, s * (0.9 + hash01(i, 99 + k) * 0.3), s));
        _c.setHSL(0.22 + hash01(i, 70 + k) * 0.1, 0.35, 0.82); _c.lerp(new THREE.Color(1, 1, 1), 0.4);
        this.treePools[type].push(_m, _c);
      }
    }
    this.treePools[1].end(); this.treePools[2].end();
    this.dirty.trees = false;
  }

  // ------------------------------------------------------------ cars
  buildCars() {
    this.carPool = new InstPool(this.root, carGeometry(), this.mats.list, { color: true, cap: 128, receive: false });
    this.carColors = ['#d63c3c', '#f2f2f2', '#2b2f36', '#3b6fd6', '#e8b93a', '#8a9aa8', '#2e8a5a', '#c7c7c7', '#7a3fb0'].map((c) => new THREE.Color(c));
    this.cars = [];
    this.carTarget = 0;
  }

  spawnCar() {
    const w = this.w;
    for (let tries = 0; tries < 20; tries++) {
      const i = (Math.random() * N) | 0;
      if (w.kind[i] !== K.ROAD) continue;
      const x = i % MAP, z = (i / MAP) | 0, mask = this.roadMask(x, z);
      const dirs = [0, 1, 2, 3].filter((d) => mask & (1 << d));
      if (!dirs.length) return;
      const out = dirs[(Math.random() * dirs.length) | 0];
      this.cars.push({ x, z, inD: out, outD: out, t: Math.random(), v: 0.6 + Math.random() * 0.5, c: this.carColors[(Math.random() * this.carColors.length) | 0] });
      return;
    }
  }

  updateCars(dt, speed) {
    const w = this.w;
    while (this.cars.length < this.carTarget) { const n = this.cars.length; this.spawnCar(); if (this.cars.length === n) break; }
    if (this.cars.length > this.carTarget) this.cars.length = this.carTarget;
    const move = speed > 0 ? dt * Math.sqrt(speed) : 0;
    this.carPool.begin();
    for (let k = this.cars.length - 1; k >= 0; k--) {
      const c = this.cars[k];
      c.t += c.v * move;
      while (c.t >= 1) {
        c.t -= 1;
        const nx = c.x + DIRV[c.outD][0], nz = c.z + DIRV[c.outD][1];
        if (!w.inb(nx, nz) || w.kind[w.idx(nx, nz)] !== K.ROAD) { c.dead = true; break; }
        c.x = nx; c.z = nz; c.inD = c.outD;
        const mask = this.roadMask(nx, nz), back = (c.inD + 2) % 4;
        let opts = [0, 1, 2, 3].filter((d) => (mask & (1 << d)) && d !== back);
        if (!opts.length) opts = [back];
        // prefer straight
        c.outD = opts.includes(c.inD) && Math.random() < 0.6 ? c.inD : opts[(Math.random() * opts.length) | 0];
      }
      if (c.dead || w.kind[w.idx(c.x, c.z)] !== K.ROAD) { this.cars.splice(k, 1); continue; }
      const [cx, cz] = tileWorld(c.x, c.z);
      const ex = cx - DIRV[c.inD][0] * 0.5, ez = cz - DIRV[c.inD][1] * 0.5;
      const xx = cx + DIRV[c.outD][0] * 0.5, xz = cz + DIRV[c.outD][1] * 0.5;
      const t = c.t, u = 1 - t;
      let px = u * u * ex + 2 * u * t * cx + t * t * xx, pz = u * u * ez + 2 * u * t * cz + t * t * xz;
      let tx = 2 * u * (cx - ex) + 2 * t * (xx - cx), tz = 2 * u * (cz - ez) + 2 * t * (xz - cz);
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      px += -tz * 0.13; pz += tx * 0.13;
      _q.setFromAxisAngle(UP, Math.atan2(tx, tz));
      _m.compose(_p.set(px, 0.018, pz), _q, _s.set(1, 1, 1));
      this.carPool.push(_m, c.c);
    }
    this.carPool.end();
  }

  // ------------------------------------------------------------ particles
  buildParticles() {
    const MAX = 700;
    this.pMax = MAX;
    this.parts = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('pcolor', new THREE.BufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: smokeSprite() }, scale: { value: 500 } },
      vertexShader: `attribute float size; attribute vec4 pcolor; uniform float scale; varying vec4 vC;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size*scale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a*t.a); }`,
      transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.pMat);
    this.points.frustumCulled = false;
    this.root.add(this.points);
    this.emitAcc = 0;
  }

  spawnDust(x, z, size = 1) {
    for (let k = 0; k < 10 * size; k++) {
      if (this.parts.length >= this.pMax) return;
      this.parts.push({ x: x + (Math.random() - 0.5) * size, y: 0.05, z: z + (Math.random() - 0.5) * size, vx: (Math.random() - 0.5) * 0.6, vy: 0.3 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.6, life: 0, max: 0.9 + Math.random() * 0.5, s0: 0.25, s1: 0.8 * size, r: 0.82, g: 0.74, b: 0.6, a: 0.55 });
    }
  }

  updateParticles(dt, speed) {
    // emit
    if (speed > 0 && this.emitters.length) {
      this.emitAcc += dt * Math.min(80, this.emitters.length * 1.6);
      while (this.emitAcc > 1 && this.parts.length < this.pMax) {
        this.emitAcc -= 1;
        const e = this.emitters[(Math.random() * this.emitters.length) | 0];
        const steam = e.steam;
        this.parts.push({ x: e.x, y: e.y, z: e.z, vx: 0.12 + Math.random() * 0.08, vy: steam ? 0.55 : 0.4, vz: 0.05 + (Math.random() - 0.5) * 0.06, life: 0, max: steam ? 3.5 : 4.5, s0: steam ? 0.5 : 0.18, s1: steam ? 2.2 : 1.1, r: steam ? 0.97 : 0.55, g: steam ? 0.97 : 0.54, b: steam ? 0.98 : 0.52, a: steam ? 0.6 : 0.45 });
      }
      if (this.emitAcc > 1) this.emitAcc = 0;
    }
    const pos = this.points.geometry.attributes.position.array, col = this.points.geometry.attributes.pcolor.array, siz = this.points.geometry.attributes.size.array;
    const night = this.r3d.night, light = 1 - night * 0.7;
    let n = 0;
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const p = this.parts[k];
      p.life += dt;
      if (p.life >= p.max) { this.parts[k] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 0.995;
      const f = p.life / p.max;
      pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
      col[n * 4] = p.r * light; col[n * 4 + 1] = p.g * light; col[n * 4 + 2] = p.b * light; col[n * 4 + 3] = p.a * Math.min(1, f * 6) * (1 - f);
      siz[n] = p.s0 + (p.s1 - p.s0) * f;
      n++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = g.attributes.pcolor.needsUpdate = g.attributes.size.needsUpdate = true;
    const r = this.r3d;
    this.pMat.uniforms.scale.value = (r.size.h * r.dpr()) / (2 * Math.tan((r.camera.fov * Math.PI) / 360));
  }

  // ------------------------------------------------------------ overlay
  buildOverlay() {
    this.ovData = new Uint8Array(MAP * MAP * 4);
    this.ovTex = new THREE.DataTexture(this.ovData, MAP, MAP, THREE.RGBAFormat);
    this.ovTex.magFilter = THREE.LinearFilter; this.ovTex.minFilter = THREE.LinearFilter;
    this.ovTex.colorSpace = THREE.SRGBColorSpace;
    this.ovMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.ovTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    this.ovMesh.position.y = 0.06; this.ovMesh.renderOrder = 2; this.ovMesh.visible = false;
    this.root.add(this.ovMesh);
  }

  setOverlay(mode) { this.overlay = mode; this.dirty.overlay = true; }

  rebuildOverlay() {
    const w = this.w, d = this.ovData, mode = this.overlay;
    this.ovMesh.visible = mode !== 'none';
    this.dirty.overlay = false;
    if (mode === 'none') return;
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const i = z * MAP + x, o = ((MAP - 1 - z) * MAP + x) * 4;
      let r = 0, g = 0, b = 0, a = 0;
      const dev = w.kind[i] !== K.EMPTY;
      if (!w.terrain[i]) {
        if (mode === 'power') { if (dev && w.kind[i] !== K.ROAD) { if (w.power[i]) { r = 60; g = 230; b = 120; } else { r = 255; g = 60; b = 60; } a = 200; } }
        else if (mode === 'water') { if (w.water[i]) { r = 60; g = 160; b = 255; a = 170; } else if (dev && w.kind[i] !== K.ROAD) { r = 255; g = 120; b = 60; a = 150; } }
        else if (mode === 'lv') { const v = w.lv[i] / 100; r = 255 * (1 - v) + 40 * v; g = 80 + 175 * v; b = 60; a = 160; }
        else if (mode === 'pollution') { const v = w.pollution[i] / 60; r = 150; g = 90; b = 40; a = clamp(v, 0, 1) * 230; }
        else if (mode === 'crime') { const v = w.crime[i] / 50; r = 255; g = 40; b = 90; a = clamp(v, 0, 1) * 230; }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a;
    }
    this.ovTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ cursor & preview
  buildCursor() {
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: cursorTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
    this.cursor.position.y = 0.08; this.cursor.renderOrder = 3; this.cursor.visible = false;
    this.root.add(this.cursor);
    const pm = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, color: '#ffffff' });
    this.preview = new InstPool(this.root, new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), pm, { cast: false, receive: false, color: true, cap: 256 });
    this.preview.setOrder(3);
    this.ghost = null;
  }

  setCursor(x, z, size, valid, visible = true) {
    this.cursor.visible = visible;
    if (!visible) return;
    const [wx, wz] = tileWorld(x, z), off = (size - 1) / 2;
    this.cursor.position.set(wx + off, 0.08, wz + off);
    this.cursor.scale.set(size, 1, size);
    this.cursor.material.color.set(valid ? '#ffffff' : '#ff5a5a');
  }

  setPreview(tiles, color = '#ffffff') {
    this.preview.begin();
    for (const [x, z, col] of tiles) {
      _c.set(col || color);
      const [wx, wz] = tileWorld(x, z);
      _m.makeTranslation(wx, 0.07, wz);
      this.preview.push(_m, _c);
    }
    this.preview.end();
  }

  setGhost(id, x, z, valid) {
    if (this.ghost && this.ghost.id !== id) { this.root.remove(this.ghost.obj); this.ghost = null; }
    if (!id) return;
    if (!this.ghost) {
      if (!this.svcGeo[id]) this.svcGeo[id] = serviceModel(id);
      const mat = new THREE.MeshStandardMaterial({ color: '#9fe0ff', transparent: true, opacity: 0.55, emissive: '#2a6c8a', depthWrite: false });
      const obj = new THREE.Mesh(this.svcGeo[id].geo, mat);
      this.root.add(obj);
      this.ghost = { id, obj, mat };
    }
    const s = SERVICES[id], [wx, wz] = tileWorld(x, z), off = (s.size - 1) / 2;
    this.ghost.obj.position.set(wx + off, 0, wz + off);
    this.ghost.mat.color.set(valid ? '#9fe0ff' : '#ff8080');
    this.ghost.mat.emissive.set(valid ? '#2a6c8a' : '#8a2a2a');
  }

  // ------------------------------------------------------------ events
  onTiles(list) {
    this.dirty.roads = this.dirty.buildings = this.dirty.trees = this.dirty.services = this.dirty.overlay = true;
  }
  onGrow(i, up) {
    const x = i % MAP, z = (i / MAP) | 0, [wx, wz] = tileWorld(x, z);
    if (up) this.anim.set(i, this.time);
    this.spawnDust(wx, wz, 1);
    this.dirty.buildings = true; this.dirty.trees = true;
  }

  // ------------------------------------------------------------ per frame
  update(dt, speed, stats) {
    this.time += dt;
    const night = this.r3d.night;
    this.mats.setNight(night);
    if (this.dirty.services) this.syncServices();
    if (this.dirty.roads) { this.rebuildRoads(); this.dirty.roads = false; }
    if (this.dirty.buildings) this.rebuildBuildings();
    if (this.dirty.trees) this.rebuildTrees();
    if (this.dirty.overlay) this.rebuildOverlay();
    // service construction pop-in + turbines
    for (const [i, o] of this.svcObjs) {
      const t0 = this.anim.get(-1 - i);
      if (t0 !== undefined) {
        const t = (this.time - t0) / 0.8;
        if (t >= 1) { o.obj.scale.set(1, 1, 1); this.anim.delete(-1 - i); } else o.obj.scale.set(1, easeOutBack(Math.max(0.02, t)), 1);
      }
      if (o.blades) o.blades.rotation.z += dt * (1.2 + (speed > 0 ? 0.6 : 0));
    }
    this.poolMat.opacity = night * 0.9;
    this.pools.mesh.visible = night > 0.02 && this.pools.n > 0;
    this.waterNormal.offset.x = (this.time * 0.004) % 1;
    this.waterNormal.offset.y = (this.time * 0.0025) % 1;
    const roads = stats.roads || 0;
    this.carTarget = Math.min(260, Math.floor(roads * 0.5), Math.floor(stats.pop / 16 + stats.jobs / 24) + Math.min(6, roads >> 3));
    this.updateCars(dt, speed);
    this.updateParticles(dt, speed);
    if (this.cursor.visible) this.cursor.material.opacity = 0.75 + Math.sin(this.time * 6) * 0.25;
  }
}

function easeOutBack(t) { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
