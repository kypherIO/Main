// City simulation. Interlocking systems:
//  networks  → roads, power grid (with brownouts), water coverage
//  traffic   → every household routes a commute to the nearest job over the
//              road graph; loads become congestion, commute time and pollution
//  workforce → education splits workers into low/high skill; jobs have skill
//              needs; unemployment and vacancies feed demand and happiness
//  fields    → land value, pollution, crime, health, education, garbage
//  life      → growth, decline, abandonment, fires, rubble
//  economy   → taxes by wealth, department budgets, policies, loans, tourism
import {
  MAP, N, K, F, ZONES, ZONE_INFO, SERVICES, POLICIES, ROADS, svcIndex, svcId, COST,
  MILESTONES, DAYS_PER_MONTH, hash01, clamp,
} from './config.js';
import { Events } from './events.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const isZone = (k) => k === K.RES || k === K.COM || k === K.IND;

export class Sim {
  constructor(world, hooks = {}) {
    this.w = world;
    this.hooks = hooks; // onTiles, onToast(text, kind, at), onMonth, onGrow(i, up), onFire(i, state)
    this.netDirty = true;
    this.fieldsDirty = true;
    this.demand = { r: 1, c: 0.6, i: 0.8 };
    this.stats = {
      pop: 0, comJobs: 0, indJobs: 0, jobs: 0, workers: 0, happiness: 60, powerSupply: 0, powerDemand: 0,
      income: 0, expense: 0, unpowered: 0, unwatered: 0, avgPollution: 0, avgCrime: 0, roads: 0,
      unemployment: 0, unreachable: 0, highJobs: 0, lowJobs: 0, highWorkers: 0, lowWorkers: 0, highVac: 0, lowVac: 0,
      education: 0, congestion: 0, jammed: 0, avgCommute: 0, trips: 0, transitRiders: 0, garbageProd: 0, garbageCap: 0,
      avgGarbage: 0, burning: 0, abandoned: 0, health: 0, tourists: 0, debt: 0, factors: [],
    };
    this.advice = [];
    this.slice = 0;
    this.rng = Math.random;
    this.events = new Events(this);
    this.recount();
  }

  has(pol) { return this.w.policies.includes(pol); }
  deptMul(dept) { return dept ? this.w.budget[dept] / 100 : 1; }

  // ======================================================== actions
  canAfford(cost) { return this.w.funds >= cost; }
  spend(cost) { this.w.funds -= cost; }

  buildRoads(tiles, cls = 0) {
    const w = this.w, todo = [];
    let cost = 0;
    for (const [x, z] of tiles) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.terrain[i] || w.kind[i] === K.SERVICE) continue;
      if (w.kind[i] === K.ROAD) {
        if (cls === 1 && w.level[i] === 0) { todo.push([i, 'up']); cost += COST.upgrade; }
        continue;
      }
      if (isZone(w.kind[i]) && w.level[i] > 0) continue;
      todo.push([i, 'new']); cost += ROADS[cls].cost;
    }
    if (!todo.length) return { ok: false, msg: cls ? 'Drag over streets to upgrade them, or open land' : 'Nothing to build here' };
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    const changed = [];
    for (const [i] of todo) {
      w.kind[i] = K.ROAD; w.level[i] = cls; w.tree[i] = 0; w.root[i] = i; w.flags[i] = 0; w.garbage[i] = 0;
      changed.push(i);
    }
    this.spend(cost);
    this.afterChange(changed);
    return { ok: true, cost, count: changed.length };
  }

  zone(rect, kind) {
    const w = this.w, list = [];
    for (let z = rect.z0; z <= rect.z1; z++) for (let x = rect.x0; x <= rect.x1; x++) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.terrain[i] || (w.flags[i] & F.RUBBLE)) continue;
      if (w.kind[i] === K.EMPTY || (isZone(w.kind[i]) && w.kind[i] !== kind && w.level[i] === 0)) list.push(i);
    }
    if (!list.length) return { ok: false, msg: 'No free land to zone' };
    const cost = list.length * COST.zone;
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    for (const i of list) { w.kind[i] = kind; w.level[i] = 0; w.root[i] = i; w.distress[i] = 0; }
    this.spend(cost);
    this.afterChange(list);
    return { ok: true, cost, count: list.length };
  }

  canPlaceService(x, z, id) {
    const w = this.w, s = SERVICES[id];
    if (w.peakPop < s.unlock) return { ok: false, msg: `Unlocks at ${s.unlock.toLocaleString()} population` };
    for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) {
      const tx = x + ox, tz = z + oz;
      if (!w.inb(tx, tz)) return { ok: false, msg: 'Out of bounds' };
      const i = w.idx(tx, tz);
      if (w.terrain[i]) return { ok: false, msg: 'Cannot build on water' };
      if (w.flags[i] & F.RUBBLE) return { ok: false, msg: 'Clear the rubble first' };
      if (w.kind[i] !== K.EMPTY && !(isZone(w.kind[i]) && w.level[i] === 0)) return { ok: false, msg: 'Space is occupied' };
    }
    if (!this.canAfford(s.cost)) return { ok: false, msg: 'Not enough funds' };
    return { ok: true };
  }

  placeService(x, z, id) {
    const chk = this.canPlaceService(x, z, id);
    if (!chk.ok) return chk;
    const w = this.w, s = SERVICES[id], r = w.idx(x, z), changed = [];
    for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) {
      const i = w.idx(x + ox, z + oz);
      w.kind[i] = K.SERVICE; w.svc[i] = svcIndex(id); w.root[i] = r; w.tree[i] = 0; w.level[i] = 1; w.flags[i] = 0;
      changed.push(i);
    }
    w.rot[r] = this.faceRoad(x, z, s.size);
    this.spend(s.cost);
    this.events.fact({ type: 'built', id, district: w.district(x, z) });
    this.afterChange(changed);
    return { ok: true, cost: s.cost };
  }

  bulldoze(rect) {
    const w = this.w, roots = new Set(), trees = [], rubble = [];
    for (let z = rect.z0; z <= rect.z1; z++) for (let x = rect.x0; x <= rect.x1; x++) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.flags[i] & F.RUBBLE) rubble.push(i);
      else if (w.kind[i] !== K.EMPTY) roots.add(w.kind[i] === K.SERVICE ? w.root[i] : i);
      else if (w.tree[i]) trees.push(i);
    }
    const n = roots.size + trees.length + rubble.length;
    if (!n) return { ok: false, msg: 'Nothing to bulldoze' };
    const cost = n * COST.bulldoze;
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    const changed = [...trees, ...rubble];
    for (const i of trees) w.tree[i] = 0;
    for (const i of rubble) { w.flags[i] = 0; w.fireT[i] = 0; }
    for (const r of roots) {
      if (w.kind[r] === K.SERVICE) {
        const s = SERVICES[svcId(w.svc[r])], [rx, rz] = w.xz(r);
        for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) {
          const i = w.idx(rx + ox, rz + oz);
          this.clearTile(i); changed.push(i);
        }
      } else { this.clearTile(r); changed.push(r); }
    }
    this.spend(cost);
    this.afterChange(changed);
    return { ok: true, cost, count: n };
  }

  clearTile(i) {
    const w = this.w;
    w.kind[i] = K.EMPTY; w.level[i] = 0; w.svc[i] = 0; w.root[i] = -1; w.variant[i] = 0;
    w.flags[i] = 0; w.fireT[i] = 0; w.distress[i] = 0; w.garbage[i] = 0;
  }

  afterChange(changed) {
    this.netDirty = true; this.fieldsDirty = true;
    this.recount();
    this.hooks.onTiles?.(changed);
  }

  faceRoad(x, z, size = 1) {
    const w = this.w;
    for (const d of [2, 1, 3, 0]) {
      for (let k = 0; k < size; k++) {
        let tx, tz;
        if (d === 0) { tx = x + k; tz = z - 1; }
        if (d === 2) { tx = x + k; tz = z + size; }
        if (d === 1) { tx = x + size; tz = z + k; }
        if (d === 3) { tx = x - 1; tz = z + k; }
        if (w.inb(tx, tz) && w.kind[w.idx(tx, tz)] === K.ROAD) return d;
      }
    }
    return 2;
  }

  setPolicy(id, on) {
    const w = this.w, has = this.has(id);
    if (on && !has) w.policies.push(id);
    if (!on && has) w.policies = w.policies.filter((p) => p !== id);
    this.events.fact({ type: 'policy', id, on });
    this.fieldsDirty = true; this.netDirty = true;
    this.computeDemand();
  }

  takeLoan(amount) {
    const w = this.w;
    if (w.loans.length >= 3) return { ok: false, msg: 'The bank won’t lend more than 3 loans' };
    const months = 120, r = 0.055 / 12;
    const payment = Math.round((amount * r) / (1 - Math.pow(1 + r, -months)));
    w.loans.push({ amount, payment, left: months });
    w.funds += amount;
    this.events.fact({ type: 'loan', amount });
    return { ok: true, payment };
  }

  repayLoan(k) {
    const w = this.w, L = w.loans[k];
    if (!L) return { ok: false };
    const r = 0.055 / 12, balance = Math.round(L.payment * (1 - Math.pow(1 + r, -L.left)) / r);
    if (w.funds < balance) return { ok: false, msg: `Need $${balance.toLocaleString()} to repay` };
    w.funds -= balance; w.loans.splice(k, 1);
    return { ok: true, balance };
  }

  // ======================================================== networks
  tileDemand(i) {
    const w = this.w, k = w.kind[i];
    if (w.flags[i] & (F.ABANDONED | F.RUBBLE)) return 0;
    if (isZone(k)) return ZONE_INFO[k].power[w.level[i]];
    if (k === K.SERVICE && w.root[i] === i) { const s = SERVICES[svcId(w.svc[i])]; return s.power ? 0 : 2 * s.size; }
    return 0;
  }

  computeNetworks() {
    const w = this.w;
    // road distance + nearest road (multi-source BFS)
    const rd = w.roadDist, nr = w.nearestRoad;
    rd.fill(9); nr.fill(-1);
    let q = [];
    for (let i = 0; i < N; i++) if (w.kind[i] === K.ROAD) { rd[i] = 0; nr[i] = i; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = rd[i]; if (d >= 4) continue;
      const x = i % MAP, z = (i / MAP) | 0;
      for (const [ox, oz] of DIRS) {
        const nx = x + ox, nz = z + oz; if (!w.inb(nx, nz)) continue;
        const j = nz * MAP + nx;
        if (rd[j] > d + 1) { rd[j] = d + 1; nr[j] = nr[i]; q.push(j); }
      }
    }
    // power grid
    w.power.fill(0);
    const comp = new Int32Array(N).fill(-1);
    let supplyTotal = 0, demandTotal = 0;
    for (let i = 0; i < N; i++) demandTotal += this.tileDemand(i);
    const rooftop = this.has('rooftop');
    let cid = 0;
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.SERVICE || w.root[i] !== i || comp[i] >= 0) continue;
      if (!SERVICES[svcId(w.svc[i])].power) continue;
      q = [i]; comp[i] = cid;
      let supply = 0, demand = 0;
      for (let h = 0; h < q.length; h++) {
        const t = q[h];
        if (w.kind[t] === K.SERVICE && w.root[t] === t) { const ss = SERVICES[svcId(w.svc[t])]; if (ss.power) supply += ss.power; }
        if (rooftop && w.kind[t] === K.RES && w.level[t] && w.level[t] < 3) supply += 0.5;
        demand += this.tileDemand(t);
        const x = t % MAP, z = (t / MAP) | 0;
        for (const [ox, oz] of DIRS) {
          const nx = x + ox, nz = z + oz; if (!w.inb(nx, nz)) continue;
          const j = nz * MAP + nx;
          if (comp[j] < 0 && w.kind[j] !== K.EMPTY) { comp[j] = cid; q.push(j); }
        }
      }
      const ratio = demand <= supply ? 1 : supply / demand;
      for (const t of q) w.power[t] = (ratio >= 1 || hash01(t, 7) < ratio) ? 1 : 0;
      supplyTotal += supply;
      cid++;
    }
    // water
    w.water.fill(0);
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.SERVICE || w.root[i] !== i || svcId(w.svc[i]) !== 'tower' || !w.power[i]) continue;
      const R = SERVICES.tower.waterRadius, [x0, z0] = w.xz(i);
      for (let z = z0 - R; z <= z0 + R; z++) for (let x = x0 - R; x <= x0 + R; x++) {
        if (!w.inb(x, z) || (x - x0) ** 2 + (z - z0) ** 2 > R * R) continue;
        w.water[w.idx(x, z)] = 1;
      }
    }
    this.stats.powerSupply = Math.round(supplyTotal);
    this.stats.powerDemand = demandTotal;
    this.netDirty = false;
  }

  // ======================================================== traffic & commutes
  computeTraffic() {
    const w = this.w, s = this.stats;
    const INF = 65535, dist = new Uint16Array(N).fill(INF), next = new Int32Array(N).fill(-1), load = new Float32Array(N);
    const q = [];
    // sources: access roads of job sites
    for (let i = 0; i < N; i++) {
      const k = w.kind[i];
      if ((k === K.COM || k === K.IND) && w.level[i] && !(w.flags[i] & F.ABANDONED) && w.roadDist[i] <= 3) {
        const r = w.nearestRoad[i];
        if (r >= 0 && dist[r] !== 0) { dist[r] = 0; q.push(r); }
      }
    }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % MAP, z = (i / MAP) | 0, d = dist[i] + 1;
      for (const [ox, oz] of DIRS) {
        const nx = x + ox, nz = z + oz; if (!w.inb(nx, nz)) continue;
        const j = nz * MAP + nx;
        if (w.kind[j] === K.ROAD && dist[j] > d) { dist[j] = d; next[j] = i; q.push(j); }
      }
    }
    const transitBoost = (this.has('freebus') ? 1.5 : 1) * this.deptMul('transit');
    let trips = 0, riders = 0, commuteSum = 0, commuteN = 0;
    const paths = [];
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.RES || !w.level[i] || (w.flags[i] & F.ABANDONED)) { if (w.kind[i] === K.RES) w.commute[i] = 0; continue; }
      const r = w.nearestRoad[i];
      if (r < 0 || w.roadDist[i] > 3 || dist[r] === INF) { w.commute[i] = 255; continue; }
      const workers = ZONE_INFO[K.RES].pop[w.level[i]] * 0.55;
      const share = clamp((w.cov.transit[i] / 255) * transitBoost, 0, 0.8);
      const t = workers * (1 - share);
      riders += workers * share; trips += t;
      let c = r, n = 0;
      while (c >= 0 && n < 300) { load[c] += t; if (dist[c] === 0) break; c = next[c]; n++; }
      paths.push([i, r]);
    }
    // shoppers & deliveries
    for (let i = 0; i < N; i++) {
      const k = w.kind[i];
      if ((k === K.COM || k === K.IND) && w.level[i] && w.nearestRoad[i] >= 0) load[w.nearestRoad[i]] += ZONE_INFO[k].jobs[w.level[i]] * (k === K.COM ? 0.35 : 0.2);
    }
    let cong = 0, congW = 0, jammed = 0;
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.ROAD) { w.traffic[i] = 0; continue; }
      const pct = (load[i] / ROADS[w.level[i]].cap) * 100;
      w.traffic[i] = clamp(Math.round(pct), 0, 255);
      if (pct > 100) jammed++;
      cong += Math.min(pct, 250) * load[i]; congW += load[i];
    }
    for (const [i, r] of paths) {
      let c = r, n = 0, sum = 0;
      while (c >= 0 && n < 300) { sum += Math.min(250, w.traffic[c]); if (dist[c] === 0) break; c = next[c]; n++; }
      const len = n + 1, avg = sum / len;
      const minutes = w.roadDist[i] * 2 + len * (1 + Math.max(0, avg - 60) / 60) * 1.4 + 4;
      w.commute[i] = clamp(Math.round(minutes), 1, 254);
      commuteSum += w.commute[i]; commuteN++;
    }
    s.trips = Math.round(trips); s.transitRiders = Math.round(riders);
    s.congestion = congW ? Math.round(cong / congW) : 0;
    s.jammed = jammed;
    s.avgCommute = commuteN ? Math.round(commuteSum / commuteN) : 0;
  }

  // ======================================================== fields
  computeFields() {
    const w = this.w;
    for (const k in w.cov) w.cov[k].fill(0);
    const pol = new Float32Array(N), parkAdd = new Float32Array(N), uniCov = new Uint8Array(N);
    const services = [];
    for (let i = 0; i < N; i++) if (w.kind[i] === K.SERVICE && w.root[i] === i && !(w.flags[i] & F.RUBBLE)) services.push(i);
    const radial = (i, size, R, fn) => {
      const [x0, z0] = w.xz(i), c = (size - 1) / 2;
      const r2 = R * R, zs = Math.max(0, Math.floor(z0 + c - R)), ze = Math.min(MAP - 1, Math.ceil(z0 + c + R));
      const xs = Math.max(0, Math.floor(x0 + c - R)), xe = Math.min(MAP - 1, Math.ceil(x0 + c + R));
      for (let z = zs; z <= ze; z++) {
        const dz = z - z0 - c, dz2 = dz * dz;
        if (dz2 > r2) continue;
        for (let x = xs; x <= xe; x++) {
          const dx = x - x0 - c, d2 = dx * dx + dz2;
          if (d2 <= r2) fn(z * MAP + x, 1 - Math.sqrt(d2) / R);
        }
      }
    };
    let garbageCap = 0;
    for (const i of services) {
      const id = svcId(w.svc[i]), s = SERVICES[id];
      const powered = w.power[i] || s.power;
      const mul = this.deptMul(s.dept) * (powered ? 1 : 0.35);
      const R = s.radius ? s.radius * Math.sqrt(Math.max(0.3, mul)) : 0;
      const put = (arr, strength) => radial(i, s.size, R, (j, f) => { arr[j] = Math.max(arr[j], Math.round(255 * clamp(f * 1.4 * strength, 0, 1))); });
      if (s.dept === 'police') put(w.cov.police, mul);
      if (s.dept === 'fire') put(w.cov.fire, mul);
      if (s.dept === 'health') put(w.cov.health, (s.strength || 1) * mul);
      if (s.dept === 'edu') { if (s.uni) put(uniCov, mul); else put(w.cov.edu, mul); }
      if (s.transit) radial(i, s.size, R, (j, f) => { w.cov.transit[j] = Math.max(w.cov.transit[j], Math.round(255 * s.transit * Math.min(1, f * 1.6) * mul)); });
      if (s.garbage) { garbageCap += s.garbage; radial(i, s.size, s.radius, (j) => { w.cov.garbage[j] = 1; }); }
      if (s.lv) radial(i, s.size, s.lvRadius, (j, f) => { parkAdd[j] += s.lv * f; });
      if (s.pollution) radial(i, s.size, 8, (j, f) => { pol[j] += s.pollution * f; });
      if (id === 'park') radial(i, 1, 3, (j, f) => { pol[j] -= 12 * f; });
    }
    // education: schools + university
    for (let i = 0; i < N; i++) w.cov.edu[i] = Math.min(255, w.cov.edu[i] * 0.75 + uniCov[i] * 0.6);
    for (let i = 0; i < N; i++) {
      if (w.kind[i] === K.IND && w.level[i] > 0 && !(w.flags[i] & F.ABANDONED)) {
        const p = ZONE_INFO[K.IND].pollution[w.level[i]];
        radial(i, 1, 6, (j, f) => { pol[j] += p * f * 0.55; });
      }
      if (w.kind[i] === K.ROAD && w.traffic[i] > 40) { const p = Math.min(30, (w.traffic[i] - 40) * 0.12); radial(i, 1, 2, (j, f) => { pol[j] += p * f; }); }
      if (w.flags[i] & F.BURNING) radial(i, 1, 4, (j, f) => { pol[j] += 30 * f; });
    }
    // garbage production vs. capacity
    const recycle = this.has('recycle') ? 0.65 : 1;
    let prod = 0;
    for (let i = 0; i < N; i++) if (isZone(w.kind[i]) && w.level[i] && !(w.flags[i] & F.ABANDONED)) prod += ZONE_INFO[w.kind[i]].garbage[w.level[i]] * 10 * recycle;
    const ratio = prod ? Math.min(1, garbageCap / prod) : 1;
    this.stats.garbageProd = Math.round(prod); this.stats.garbageCap = garbageCap;
    let gSum = 0, gN = 0;
    for (let i = 0; i < N; i++) {
      if (!isZone(w.kind[i]) || !w.level[i]) { if (w.kind[i] !== K.SERVICE) w.garbage[i] = 0; continue; }
      const make = (w.flags[i] & F.ABANDONED) ? 0 : ZONE_INFO[w.kind[i]].garbage[w.level[i]] * recycle * (this.stats.pop > 250 ? 1 : 0.25);
      const g = w.cov.garbage[i] ? w.garbage[i] + make - 9 * ratio : w.garbage[i] + make;
      w.garbage[i] = clamp(Math.round(g), 0, 100);
      gSum += w.garbage[i]; gN++;
    }
    this.stats.avgGarbage = gN ? gSum / gN : 0;

    // summed-area tables → O(1) neighbourhood sums
    const S = MAP + 1, satTree = new Int32Array(S * S), satDens = new Int32Array(S * S), satAband = new Int32Array(S * S), satInd = new Int32Array(S * S);
    for (let z = 0; z < MAP; z++) for (let x = 0; x < MAP; x++) {
      const i = z * MAP + x, k = w.kind[i], L = w.level[i], o = (z + 1) * S + (x + 1);
      const up = o - S, left = o - 1, diag = o - S - 1;
      satTree[o] = (w.tree[i] ? 1 : 0) + satTree[up] + satTree[left] - satTree[diag];
      satDens[o] = ((k === K.RES || k === K.COM) && L ? L : 0) + satDens[up] + satDens[left] - satDens[diag];
      satAband[o] = (w.flags[i] & F.ABANDONED ? 1 : 0) + satAband[up] + satAband[left] - satAband[diag];
      satInd[o] = (k === K.IND && L ? 1 : 0) + satInd[up] + satInd[left] - satInd[diag];
    }
    const boxSum = (t, x, z, r) => {
      const x0 = Math.max(0, x - r), z0 = Math.max(0, z - r), x1 = Math.min(MAP - 1, x + r) + 1, z1 = Math.min(MAP - 1, z + r) + 1;
      return t[z1 * S + x1] - t[z0 * S + x1] - t[z1 * S + x0] + t[z0 * S + x0];
    };
    const trafficPol = Math.min(10, this.stats.pop / 1500);
    const crimeMul = (this.has('watch') ? 0.8 : 1) * (this.has('curfew') ? 0.85 : 1);
    const unemp = this.stats.unemployment;
    let polSum = 0, crimeSum = 0, healthSum = 0, eduSum = 0, cnt = 0, resN = 0;
    for (let i = 0; i < N; i++) {
      const [x, z] = w.xz(i);
      const trees = boxSum(satTree, x, z, 2), dens = boxSum(satDens, x, z, 2), aband = boxSum(satAband, x, z, 2), nearInd = boxSum(satInd, x, z, 1);
      let traf = 0;
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, nz = z + oz; if (nx < 0 || nz < 0 || nx >= MAP || nz >= MAP) continue;
        const j = nz * MAP + nx;
        if (w.kind[j] === K.ROAD && w.traffic[j] > traf) traf = w.traffic[j];
      }
      let p = pol[i] - trees * 0.8 + (w.kind[i] === K.ROAD ? trafficPol : 0) + w.garbage[i] * 0.15;
      p = clamp(p, 0, 100); w.pollution[i] = p;
      const crime = clamp((dens * 1.15 - 10 + aband * 6 + unemp * 60 + w.garbage[i] * 0.1) * crimeMul - w.cov.police[i] * 0.22, 0, 100);
      w.crime[i] = crime;
      let lv = 40;
      if (w.waterDist[i] <= 4) lv += 18 * (1 - w.waterDist[i] / 5);
      lv += Math.min(8, trees);
      lv += Math.min(34, parkAdd[i]);
      lv += w.cov.police[i] * 0.035 + w.cov.edu[i] * 0.04 + w.cov.health[i] * 0.04 + w.cov.fire[i] * 0.025 + w.cov.transit[i] * 0.03;
      lv -= p * 0.6 + crime * 0.25 + nearInd * 4 + aband * 3 + Math.max(0, traf - 70) * 0.06 + w.garbage[i] * 0.2;
      if (this.has('highrise')) lv += 6;
      w.lv[i] = clamp(Math.round(lv), 0, 100);
      if (w.kind[i] === K.RES || w.kind[i] === K.COM) { polSum += p; crimeSum += crime; cnt++; }
      if (w.kind[i] === K.RES && w.level[i]) { healthSum += clamp(50 + w.cov.health[i] * 0.2 - p * 0.6, 0, 100); eduSum += w.cov.edu[i] / 2.55; resN++; }
    }
    this.stats.avgPollution = cnt ? polSum / cnt : 0;
    this.stats.avgCrime = cnt ? crimeSum / cnt : 0;
    this.stats.health = resN ? Math.round(healthSum / resN) : 50;
    this.stats.education = resN ? Math.round(eduSum / resN) : 0;
    this.fieldsDirty = false;
  }

  // ======================================================== happiness
  happinessFactors(i) {
    const w = this.w, s = this.stats, f = [];
    const add = (label, v) => { if (Math.abs(v) >= 0.5) f.push([label, Math.round(v)]); };
    add('Land value', (w.lv[i] - 45) * 0.35);
    if (!w.power[i]) add('No power', -25);
    if (!w.water[i]) add('No water', -12);
    add('Health', w.cov.health[i] * 0.05 - w.pollution[i] * 0.25);
    add('Safety', -w.crime[i] * 0.2);
    add('Education', w.cov.edu[i] * 0.03);
    const c = w.commute[i];
    if (c === 255) add('No route to work', -18); else add('Commute', -Math.max(0, c - 14) * 0.7);
    add('Garbage', -w.garbage[i] * 0.25);
    add('Jobs', -s.unemployment * 70);
    add('Taxes', -(w.tax.r - 9) * 3);
    if (this.has('highrise')) add('High-rise ban', 4);
    if (this.has('curfew')) add('Curfew', -3);
    return f;
  }
  tileHappiness(i) { return clamp(60 + this.happinessFactors(i).reduce((a, [, v]) => a + v, 0), 0, 100); }

  // ======================================================== counts & workforce
  recount() {
    const w = this.w, s = this.stats;
    let pop = 0, com = 0, ind = 0, roads = 0, unpowered = 0, unwatered = 0, happySum = 0, burning = 0, abandoned = 0;
    let lowW = 0, highW = 0, unreach = 0, lowJ = 0, highJ = 0;
    const fac = {};
    const sampleFactors = (w.day % 30) < 1 || !s.factors.length;
    for (let i = 0; i < N; i++) {
      const k = w.kind[i], L = w.level[i], fl = w.flags[i];
      if (fl & F.BURNING) burning++;
      if (k === K.ROAD) roads++;
      if (!isZone(k)) continue;
      if (fl & F.ABANDONED) { abandoned++; continue; }
      if (!w.power[i] && w.roadDist[i] <= 3 && !(fl & F.RUBBLE)) unpowered++;
      if (L >= 1 && !w.water[i]) unwatered++;
      if (!L) continue;
      if (k === K.RES) {
        const p = ZONE_INFO[k].pop[L]; pop += p;
        const h = this.tileHappiness(i); w.happy[i] = h; happySum += h * p;
        if (sampleFactors) for (const [lab, v] of this.happinessFactors(i)) fac[lab] = (fac[lab] || 0) + v * p;
        const workers = p * 0.55, e = w.cov.edu[i] / 255;
        if (w.commute[i] === 255) unreach += workers;
        else { highW += workers * e; lowW += workers * (1 - e); }
      } else {
        const zi = ZONE_INFO[k], j = zi.jobs[L];
        if (k === K.COM) com += j; else ind += j;
        if (!w.power[i]) continue;
        highJ += j * zi.high[L]; lowJ += j * (1 - zi.high[L]);
      }
    }
    // service jobs (low skill)
    const workers = pop * 0.55;
    const empHigh = Math.min(highW, highJ);
    const empLow = Math.min(lowJ, lowW + (highW - empHigh));
    const employed = empHigh + empLow;
    Object.assign(s, {
      pop, comJobs: com, indJobs: ind, jobs: com + ind, workers: Math.round(workers), roads, unpowered, unwatered, burning, abandoned,
      lowWorkers: Math.round(lowW), highWorkers: Math.round(highW), lowJobs: Math.round(lowJ), highJobs: Math.round(highJ), unreachable: Math.round(unreach),
      unemployment: workers > 20 ? clamp((workers - employed) / workers, 0, 1) : 0,
      highVac: highJ > 5 ? clamp((highJ - empHigh) / highJ, 0, 1) : 0,
      lowVac: lowJ > 5 ? clamp((lowJ - empLow) / lowJ, 0, 1) : 0,
    });
    s.happiness = pop ? Math.round(happySum / pop) : 60;
    if (sampleFactors && pop) s.factors = Object.entries(fac).map(([k, v]) => [k, Math.round(v / pop)]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (pop > w.peakPop) {
      const before = this.milestone(w.peakPop);
      w.peakPop = pop;
      const after = this.milestone(pop);
      if (after.name !== before.name) { this.hooks.onToast?.(`${w.name} is now a ${after.name}! New buildings unlocked.`, 'milestone'); this.events.fact({ type: 'milestone', name: after.name, pop }); }
    }
  }

  milestone(pop = this.w.peakPop) { let m = MILESTONES[0]; for (const x of MILESTONES) if (pop >= x.pop) m = x; return m; }
  nextMilestone() { return MILESTONES.find((m) => m.pop > this.w.peakPop) || null; }

  computeDemand() {
    const s = this.stats, t = this.w.tax;
    const avail = s.lowJobs * (1 - s.lowVac) + s.highJobs * (1 - s.highVac);
    let r = (s.jobs + 50 - s.workers) / Math.max(50, s.workers * 0.4);
    r -= s.unemployment * 2.5;
    let c = (s.pop * 0.22 + 20 - s.comJobs) / Math.max(20, s.comJobs * 0.5);
    let i = (s.pop * 0.33 + 30 - s.indJobs) / Math.max(30, s.indJobs * 0.5);
    // businesses can't hire → they stop expanding
    if (s.jobs > 60) { c -= s.lowVac * 0.9; i -= s.lowVac * 0.9; }
    r += (s.happiness - 55) / 90 - (t.r - 9) * 0.07 - Math.max(0, s.avgCommute - 25) * 0.02;
    c -= (t.c - 9) * 0.07; i -= (t.i - 9) * 0.07;
    if (this.has('tourism')) c += 0.2;
    if (this.has('taxbreak')) i += 0.3;
    if (this.has('curfew')) c -= 0.1;
    c += Math.min(0.3, s.tourists / 4000);
    this.demand = { r: clamp(r, -1, 1), c: clamp(c, -1, 1), i: clamp(i, -1, 1) };
    this.stats.employedEst = Math.round(avail);
  }

  maxLevel(i) {
    const w = this.w, k = w.kind[i], lv = w.lv[i], pop = w.peakPop, s = this.stats;
    if (!w.water[i]) return 1;
    const ban = this.has('highrise') ? 2 : 3;
    if (k === K.IND) {
      if (pop >= 1500 && w.cov.edu[i] > 40 && s.highVac < 0.5) return Math.min(3, ban + 1);
      return pop >= 250 ? 2 : 1;
    }
    if (k === K.COM) {
      if (lv >= 58 && pop >= 1200 && (s.highVac < 0.5 || s.highJobs < 50)) return ban;
      return lv >= 34 ? 2 : 1;
    }
    if (lv >= 60 && pop >= 1200 && w.cov.edu[i] > 20) return ban;
    if (lv >= 36) return 2;
    return 1;
  }

  growTile(i) {
    const w = this.w, k = w.kind[i], s = this.stats, fl = w.flags[i];
    if (fl & (F.RUBBLE | F.BURNING)) return;
    const L = w.level[i], r = this.rng();
    // distress → abandonment
    if (L) {
      const bad = !w.power[i] || w.garbage[i] > 80 ||
        (k === K.RES && (w.happy[i] < 18 || w.commute[i] === 255)) ||
        (k !== K.RES && s.jobs > 100 && s.lowVac > 0.65);
      w.distress[i] = clamp(w.distress[i] + (bad ? 6 : -6), 0, 100);
      if (!(fl & F.ABANDONED) && w.distress[i] > 70) { w.flags[i] |= F.ABANDONED; this.hooks.onGrow?.(i, false); this.netDirty = true; return; }
      if ((fl & F.ABANDONED)) {
        if (w.distress[i] < 15) { w.flags[i] &= ~F.ABANDONED; this.hooks.onGrow?.(i, true); this.netDirty = true; }
        return;
      }
    }
    const dkey = k === K.RES ? 'r' : k === K.COM ? 'c' : 'i';
    const d = this.demand[dkey];
    const connected = w.roadDist[i] <= 3 && w.power[i];
    if (!connected) { if (L > 0 && r < 0.1) this.setLevel(i, L - 1); return; }
    const maxL = this.maxLevel(i);
    if (L < maxL && d > 0 && r < 0.08 + d * 0.35) return this.setLevel(i, L + 1);
    if (L > maxL && r < 0.08) return this.setLevel(i, L - 1);
    if (d < -0.35 && L > 0 && r < -d * 0.04) return this.setLevel(i, L - 1);
  }

  setLevel(i, L) {
    const w = this.w, up = L > w.level[i];
    w.level[i] = L;
    if (up) {
      w.variant[i] = (this.rng() * 4) | 0;
      const [x, z] = w.xz(i);
      w.rot[i] = this.faceRoad(x, z);
      w.tree[i] = 0;
      if (L === 3 && w.kind[i] !== K.IND) this.events.fact({ type: 'tower', kind: w.kind[i], district: w.district(x, z) });
    }
    this.netDirty = true;
    this.hooks.onGrow?.(i, up);
  }

  // ======================================================== fire
  fireStep() {
    const w = this.w, s = this.stats;
    const changed = [];
    // ignition (checked on this day's slice)
    if (w.disasters && s.pop > 150) {
      const smoke = this.has('smoke') ? 0.55 : 1;
      for (let i = this.slice; i < N; i += 6) {
        const k = w.kind[i];
        if (!(isZone(k) && w.level[i]) && !(k === K.SERVICE && w.root[i] === i)) continue;
        if (w.flags[i] & (F.BURNING | F.RUBBLE)) continue;
        const L = w.level[i] || 1;
        const risk = 0.00016 * L * (k === K.IND ? 2.2 : 1) * (w.flags[i] & F.ABANDONED ? 3 : 1) * smoke * (1 - (w.cov.fire[i] / 255) * 0.85);
        if (this.rng() < risk) this.ignite(i);
      }
    }
    // burning tiles
    for (let i = 0; i < N; i++) {
      if (!(w.flags[i] & F.BURNING)) continue;
      w.fireT[i]++;
      const cov = w.cov.fire[i] / 255;
      if (this.rng() < 0.015 + cov * 0.3) { // extinguished
        w.flags[i] &= ~F.BURNING; w.fireT[i] = 0; w.counters.firesOut++;
        this.hooks.onFire?.(i, 'out'); changed.push(i); continue;
      }
      if (this.rng() < 0.05 * (1 - cov * 0.8)) {
        const [x, z] = w.xz(i), [ox, oz] = DIRS[(this.rng() * 4) | 0], j = w.idx(clamp(x + ox, 0, MAP - 1), clamp(z + oz, 0, MAP - 1));
        if (((isZone(w.kind[j]) && w.level[j]) || w.kind[j] === K.SERVICE) && !(w.flags[j] & (F.BURNING | F.RUBBLE))) this.ignite(w.kind[j] === K.SERVICE ? w.root[j] : j, true);
      }
      if (w.fireT[i] > 20) { this.burnDown(i); changed.push(i); }
    }
    if (changed.length) this.afterChange(changed);
  }

  ignite(i, spread = false) {
    const w = this.w;
    w.flags[i] |= F.BURNING; w.fireT[i] = 0;
    const [x, z] = w.xz(i);
    if (!spread) {
      this.hooks.onToast?.(`🔥 Fire in ${w.district(x, z)}!`, 'bad', i);
      this.events.fact({ type: 'fire', district: w.district(x, z) });
    }
    this.hooks.onFire?.(i, 'start');
    this.fieldsDirty = true;
  }

  burnDown(i) {
    const w = this.w;
    w.counters.firesLost++;
    if (w.kind[i] === K.SERVICE) {
      const s = SERVICES[svcId(w.svc[i])], [rx, rz] = w.xz(i);
      for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) { const j = w.idx(rx + ox, rz + oz); this.clearTile(j); w.flags[j] = F.RUBBLE; }
    } else {
      w.level[i] = 0; w.flags[i] = F.RUBBLE; w.fireT[i] = 0; w.distress[i] = 0;
    }
    this.hooks.onFire?.(i, 'lost');
    this.addApproval(-1.5, 'Building lost to fire');
  }

  addApproval(v, why) { this.w.approvalMods.push({ v, why, left: 12 }); }

  // ======================================================== tick
  step() {
    const w = this.w;
    if (this.netDirty) this.computeNetworks();
    if (this.fieldsDirty) { this.computeTraffic(); this.computeFields(); }
    w.day++;
    // stagger heavy passes on different days so no single tick stacks them
    const phase = w.day % 10;
    if (phase === 3) this.computeTraffic(); else if (phase === 7) this.computeFields();
    const changed = [];
    for (let i = this.slice; i < N; i += 6) {
      if (isZone(w.kind[i])) {
        const L = w.level[i], f = w.flags[i]; this.growTile(i);
        if (w.level[i] !== L || w.flags[i] !== f) changed.push(i);
      }
    }
    this.fireStep();
    this.slice = (this.slice + 1) % 6;
    if (changed.length) { this.recount(); this.hooks.onTiles?.(changed); }
    if (w.day % 5 === 0) { this.recount(); this.computeDemand(); }
    if (w.day % DAYS_PER_MONTH === 0) this.monthly();
  }

  tourism() {
    const w = this.w;
    let t = 0;
    for (let i = 0; i < N; i++) {
      if (w.kind[i] === K.SERVICE && w.root[i] === i) { const s = SERVICES[svcId(w.svc[i])]; if (s.tourism) t += s.tourism; if (svcId(w.svc[i]) === 'park' && w.waterDist[i] <= 2) t += 40; }
      if (w.kind[i] === K.COM && w.level[i] === 3 && w.waterDist[i] <= 3) t += 25;
    }
    return Math.round(t * (this.has('tourism') ? 1.8 : 1) * (0.4 + this.stats.happiness / 100));
  }

  monthly() {
    const w = this.w, s = this.stats;
    if (this.netDirty) this.computeNetworks();
    this.recount(); this.computeDemand();
    s.tourists = this.tourism();
    // income — residents pay more in high land value areas
    let wealth = 0;
    for (let i = 0; i < N; i++) if (w.kind[i] === K.RES && w.level[i] && !(w.flags[i] & F.ABANDONED)) wealth += ZONE_INFO[K.RES].pop[w.level[i]] * (0.6 + w.lv[i] / 100);
    const incR = wealth * w.tax.r * 0.05;
    const incC = s.comJobs * w.tax.c * 0.06 * (this.has('curfew') ? 0.88 : 1);
    const incI = s.indJobs * w.tax.i * 0.06 * (this.has('taxbreak') ? 0.7 : 1);
    const fares = this.has('freebus') ? 0 : s.transitRiders * 0.25;
    const tourism = s.tourists * 0.6;
    // expenses
    let roadsUp = 0;
    for (let i = 0; i < N; i++) if (w.kind[i] === K.ROAD) roadsUp += ROADS[w.level[i]].upkeep;
    const svcUpkeep = {};
    let upkeep = roadsUp;
    for (let i = 0; i < N; i++) if (w.kind[i] === K.SERVICE && w.root[i] === i) {
      const id = svcId(w.svc[i]), sv = SERVICES[id], c = sv.upkeep * this.deptMul(sv.dept);
      svcUpkeep[id] = (svcUpkeep[id] || 0) + c; upkeep += c;
    }
    let policyCost = 0;
    for (const p of w.policies) policyCost += POLICIES[p].flat + POLICIES[p].perCap * s.pop;
    let loanPay = 0;
    for (const L of w.loans) { loanPay += L.payment; L.left--; }
    w.loans = w.loans.filter((L) => L.left > 0);
    upkeep += policyCost + loanPay;
    s.income = Math.round(incR + incC + incI + fares + tourism);
    s.expense = Math.round(upkeep);
    s.debt = w.loans.reduce((a, L) => a + L.payment * L.left, 0);
    s.breakdown = { incR: Math.round(incR), incC: Math.round(incC), incI: Math.round(incI), fares: Math.round(fares), tourism: Math.round(tourism), roads: Math.round(roadsUp), svc: svcUpkeep, policies: Math.round(policyCost), loans: loanPay };
    w.funds += s.income - s.expense;
    if (s.income >= s.expense) w.counters.surplusMonths++; else w.counters.surplusMonths = 0;
    w.history.push({ d: w.day, pop: s.pop, funds: Math.round(w.funds), happy: s.happiness, jobs: s.jobs, appr: Math.round(w.approval), unemp: Math.round(s.unemployment * 100), cong: s.congestion });
    if (w.history.length > 240) w.history.shift();
    this.events.monthly();
    this.buildAdvice();
    this.hooks.onMonth?.();
  }

  buildAdvice() {
    const s = this.stats, d = this.demand, w = this.w, a = [];
    if (s.burning) a.push({ lvl: 'bad', who: 'Fire Dept.', text: `${s.burning} building${s.burning > 1 ? 's are' : ' is'} on fire! Fire stations nearby put them out.` });
    if (s.powerDemand > s.powerSupply) a.push({ lvl: 'bad', who: 'Utilities', text: `Power shortfall: ${s.powerDemand} MW needed, ${s.powerSupply} MW supplied. Build more generation.` });
    if (s.unpowered > 0) a.push({ lvl: 'bad', who: 'Utilities', text: `${s.unpowered} zoned lots have no power. Connect them to a plant through roads or buildings.` });
    if (s.unwatered > 4) a.push({ lvl: 'warn', who: 'Utilities', text: `${s.unwatered} buildings lack water and can't grow past low density. Place powered water towers.` });
    if (s.avgGarbage > 25) a.push({ lvl: 'warn', who: 'Sanitation', text: s.garbageCap < s.garbageProd ? `Garbage is piling up: ${s.garbageProd} t produced vs ${s.garbageCap} t capacity. Build a landfill or recycling center.` : 'Some neighbourhoods are outside garbage collection range.' });
    if (s.jammed > 3) a.push({ lvl: 'warn', who: 'Transport', text: `${s.jammed} road segments are gridlocked (avg congestion ${s.congestion}%). Upgrade to avenues, add alternate routes or bus stops.` });
    if (s.avgCommute > 28) a.push({ lvl: 'warn', who: 'Transport', text: `Average commute is ${s.avgCommute} min. Zone jobs closer to homes or add transit.` });
    if (s.unreachable > 20) a.push({ lvl: 'bad', who: 'Transport', text: `${s.unreachable} workers have no road route to any job.` });
    if (s.unemployment > 0.1) a.push({ lvl: 'warn', who: 'Economy', text: `Unemployment is ${Math.round(s.unemployment * 100)}%. Zone commercial and industry${s.highWorkers > s.highJobs ? ' — educated workers want offices' : ''}.` });
    if (s.highVac > 0.4 && s.highJobs > 50) a.push({ lvl: 'warn', who: 'Education', text: `${Math.round(s.highVac * 100)}% of skilled jobs are unfilled. Build schools and a university.` });
    if (s.lowVac > 0.4 && s.jobs > 80) a.push({ lvl: 'info', who: 'Economy', text: 'Businesses can’t find workers. Zone more housing.' });
    if (d.r > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Strong housing demand. Zone more residential near jobs.' });
    if (d.c > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Shops want customers. Zone commercial along busy roads.' });
    if (d.i > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Industry is looking for land. Zone industrial away from homes.' });
    if (s.avgPollution > 22) a.push({ lvl: 'warn', who: 'Environment', text: 'Pollution is hurting land value. Add parks, trees and clean power.' });
    if (s.avgCrime > 18) a.push({ lvl: 'warn', who: 'Safety', text: 'Crime is rising in dense areas. Build police stations or fund the department.' });
    if (s.abandoned > 3) a.push({ lvl: 'warn', who: 'Housing', text: `${s.abandoned} buildings are abandoned. Fix power, jobs, garbage or happiness in those areas.` });
    if (s.health < 40 && s.pop > 300) a.push({ lvl: 'warn', who: 'Health', text: 'Public health is poor. Build clinics and reduce pollution.' });
    if (w.funds < 2000) a.push({ lvl: 'bad', who: 'Finance', text: 'Treasury is nearly empty. Raise taxes, cut budgets or take a loan.' });
    if (s.income < s.expense && s.pop > 0) a.push({ lvl: 'warn', who: 'Finance', text: `Running a deficit of $${(s.expense - s.income).toLocaleString()}/mo.` });
    if (s.happiness < 40 && s.pop > 100) a.push({ lvl: 'warn', who: 'Citizens', text: 'Citizens are unhappy. Check the happiness breakdown on the Overview tab.' });
    if (!a.length) a.push({ lvl: 'good', who: 'Mayor’s office', text: 'All systems nominal. The city is thriving.' });
    this.advice = a;
  }

  refreshAll() { this.computeNetworks(); this.computeTraffic(); this.computeFields(); this.computeNetworks(); this.recount(); this.computeDemand(); this.buildAdvice(); }
}
