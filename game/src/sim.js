// City simulation: networks, fields, growth, demand, budget, advisors.
import {
  MAP, N, K, ZONES, ZONE_INFO, SERVICES, svcIndex, svcId, COST, ROAD_UPKEEP,
  MILESTONES, DAYS_PER_MONTH, hash01, clamp,
} from './config.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

export class Sim {
  constructor(world, hooks = {}) {
    this.w = world;
    this.hooks = hooks; // onTiles(indices[]), onToast(text, kind), onMonth(), onGrow(i, up)
    this.netDirty = true;
    this.fieldsDirty = true;
    this.demand = { r: 1, c: 0.6, i: 0.8 };
    this.stats = { pop: 0, comJobs: 0, indJobs: 0, jobs: 0, workers: 0, happiness: 60, powerSupply: 0, powerDemand: 0, income: 0, expense: 0, unpowered: 0, unwatered: 0, avgPollution: 0, avgCrime: 0, roads: 0 };
    this.advice = [];
    this.slice = 0;
    this.rng = Math.random;
    this.recount();
  }

  // ---------------- actions ----------------
  canAfford(cost) { return this.w.funds >= cost; }
  spend(cost) { this.w.funds -= cost; }

  buildRoads(tiles) {
    const w = this.w, changed = [];
    let cost = 0;
    for (const [x, z] of tiles) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.terrain[i] || w.kind[i] === K.ROAD) continue;
      // roads may replace empty zones but not buildings
      if (w.kind[i] === K.SERVICE || (ZONES.includes(w.kind[i]) && w.level[i] > 0)) continue;
      cost += COST.road;
    }
    if (!cost) return { ok: false, msg: 'Nothing to build here' };
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    for (const [x, z] of tiles) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.terrain[i] || w.kind[i] === K.ROAD || w.kind[i] === K.SERVICE) continue;
      if (ZONES.includes(w.kind[i]) && w.level[i] > 0) continue;
      w.kind[i] = K.ROAD; w.level[i] = 0; w.tree[i] = 0; w.root[i] = i;
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
      if (w.terrain[i]) continue;
      if (w.kind[i] === K.EMPTY || (ZONES.includes(w.kind[i]) && w.kind[i] !== kind && w.level[i] === 0)) list.push(i);
    }
    if (!list.length) return { ok: false, msg: 'No free land to zone' };
    const cost = list.length * COST.zone;
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    for (const i of list) { w.kind[i] = kind; w.level[i] = 0; w.root[i] = i; }
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
      if (w.kind[i] !== K.EMPTY && !(ZONES.includes(w.kind[i]) && w.level[i] === 0)) return { ok: false, msg: 'Space is occupied' };
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
      w.kind[i] = K.SERVICE; w.svc[i] = svcIndex(id); w.root[i] = r; w.tree[i] = 0; w.level[i] = 1;
      changed.push(i);
    }
    w.rot[r] = this.faceRoad(x, z, s.size);
    this.spend(s.cost);
    this.afterChange(changed);
    return { ok: true, cost: s.cost };
  }

  bulldoze(rect) {
    const w = this.w, roots = new Set(), trees = [];
    for (let z = rect.z0; z <= rect.z1; z++) for (let x = rect.x0; x <= rect.x1; x++) {
      if (!w.inb(x, z)) continue;
      const i = w.idx(x, z);
      if (w.kind[i] !== K.EMPTY) roots.add(w.kind[i] === K.SERVICE ? w.root[i] : i);
      else if (w.tree[i]) trees.push(i);
    }
    const n = roots.size + trees.length;
    if (!n) return { ok: false, msg: 'Nothing to bulldoze' };
    const cost = n * COST.bulldoze;
    if (!this.canAfford(cost)) return { ok: false, msg: 'Not enough funds' };
    const changed = [...trees];
    for (const i of trees) w.tree[i] = 0;
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
  }

  afterChange(changed) {
    this.netDirty = true; this.fieldsDirty = true;
    this.recount();
    this.hooks.onTiles?.(changed);
  }

  faceRoad(x, z, size = 1) {
    const w = this.w;
    // check each side of footprint for a road; prefer south (front)
    const order = [2, 1, 3, 0];
    for (const d of order) {
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

  // ---------------- networks ----------------
  tileDemand(i) {
    const w = this.w, k = w.kind[i];
    if (k === K.RES || k === K.COM || k === K.IND) return ZONE_INFO[k].power[w.level[i]];
    if (k === K.SERVICE && w.root[i] === i) { const s = SERVICES[svcId(w.svc[i])]; return s.power ? 0 : 2 * s.size; }
    return 0;
  }

  computeNetworks() {
    const w = this.w;
    // road distance
    const rd = w.roadDist; rd.fill(9);
    let q = [];
    for (let i = 0; i < N; i++) if (w.kind[i] === K.ROAD) { rd[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], d = rd[i]; if (d >= 4) continue;
      const x = i % MAP, z = (i / MAP) | 0;
      for (const [ox, oz] of DIRS) {
        const nx = x + ox, nz = z + oz; if (!w.inb(nx, nz)) continue;
        const j = nz * MAP + nx;
        if (rd[j] > d + 1) { rd[j] = d + 1; q.push(j); }
      }
    }
    // power: flood through any developed/zoned tile from plants
    w.power.fill(0);
    const comp = new Int32Array(N).fill(-1);
    let supplyTotal = 0, demandTotal = 0;
    for (let i = 0; i < N; i++) demandTotal += this.tileDemand(i);
    let cid = 0;
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.SERVICE || w.root[i] !== i || comp[i] >= 0) continue;
      const s = SERVICES[svcId(w.svc[i])];
      if (!s.power) continue;
      q = [i]; comp[i] = cid;
      let supply = 0, demand = 0;
      for (let h = 0; h < q.length; h++) {
        const t = q[h];
        if (w.kind[t] === K.SERVICE && w.root[t] === t) { const ss = SERVICES[svcId(w.svc[t])]; if (ss.power) supply += ss.power; }
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
    // water: powered towers cover a radius
    w.water.fill(0);
    for (let i = 0; i < N; i++) {
      if (w.kind[i] !== K.SERVICE || w.root[i] !== i || svcId(w.svc[i]) !== 'tower' || !w.power[i]) continue;
      const R = SERVICES.tower.waterRadius, [x0, z0] = w.xz(i);
      for (let z = z0 - R; z <= z0 + R; z++) for (let x = x0 - R; x <= x0 + R; x++) {
        if (!w.inb(x, z) || (x - x0) ** 2 + (z - z0) ** 2 > R * R) continue;
        w.water[w.idx(x, z)] = 1;
      }
    }
    this.stats.powerSupply = supplyTotal;
    this.stats.powerDemand = demandTotal;
    this.netDirty = false;
  }

  computeFields() {
    const w = this.w;
    for (const k in w.cov) w.cov[k].fill(0);
    const pol = new Float32Array(N), lvAdd = new Float32Array(N), parkAdd = new Float32Array(N);
    const services = [];
    for (let i = 0; i < N; i++) if (w.kind[i] === K.SERVICE && w.root[i] === i) services.push(i);
    const radial = (i, size, R, fn) => {
      const [x0, z0] = w.xz(i), c = (size - 1) / 2;
      for (let z = Math.floor(z0 + c - R); z <= Math.ceil(z0 + c + R); z++) for (let x = Math.floor(x0 + c - R); x <= Math.ceil(x0 + c + R); x++) {
        if (!w.inb(x, z)) continue;
        const d = Math.hypot(x - x0 - c, z - z0 - c);
        if (d <= R) fn(z * MAP + x, 1 - d / R);
      }
    };
    for (const i of services) {
      const id = svcId(w.svc[i]), s = SERVICES[id];
      if (w.cov[id] && s.radius) radial(i, s.size, s.radius, (j, f) => { w.cov[id][j] = Math.max(w.cov[id][j], Math.round(255 * Math.min(1, f * 1.4))); });
      if (s.lv) radial(i, s.size, s.lvRadius, (j, f) => { parkAdd[j] += s.lv * f; });
      if (s.pollution) radial(i, s.size, 8, (j, f) => { pol[j] += s.pollution * f; });
      if (id === 'park') radial(i, 1, 3, (j, f) => { pol[j] -= 12 * f; });
    }
    for (let i = 0; i < N; i++) {
      if (w.kind[i] === K.IND && w.level[i] > 0) {
        const p = ZONE_INFO[K.IND].pollution[w.level[i]];
        radial(i, 1, 6, (j, f) => { pol[j] += p * f * 0.55; });
      }
    }
    const trafficPol = Math.min(10, this.stats.pop / 1500);
    let polSum = 0, crimeSum = 0, cnt = 0;
    for (let i = 0; i < N; i++) {
      const [x, z] = w.xz(i);
      let trees = 0, dens = 0, nearInd = 0;
      for (let oz = -2; oz <= 2; oz++) for (let ox = -2; ox <= 2; ox++) {
        const nx = x + ox, nz = z + oz; if (!w.inb(nx, nz)) continue;
        const j = nz * MAP + nx;
        if (w.tree[j]) trees++;
        const k = w.kind[j];
        if ((k === K.RES || k === K.COM) && w.level[j]) dens += w.level[j];
        if (k === K.IND && w.level[j] && Math.abs(ox) <= 1 && Math.abs(oz) <= 1) nearInd++;
      }
      let p = pol[i] - trees * 0.8 + (w.kind[i] === K.ROAD ? trafficPol : 0);
      p = clamp(p, 0, 100); w.pollution[i] = p;
      const crime = clamp(dens * 1.15 - 10 - w.cov.police[i] * 0.22, 0, 100); w.crime[i] = crime;
      let lv = 32;
      if (w.waterDist[i] <= 4) lv += 18 * (1 - w.waterDist[i] / 5);
      lv += Math.min(8, trees);
      lv += Math.min(34, parkAdd[i]);
      lv += w.cov.police[i] * 0.035 + w.cov.school[i] * 0.05 + w.cov.hospital[i] * 0.04 + w.cov.fire[i] * 0.025;
      lv -= p * 0.6 + crime * 0.25 + nearInd * 4;
      w.lv[i] = clamp(Math.round(lv + lvAdd[i]), 0, 100);
      if (w.kind[i] === K.RES || w.kind[i] === K.COM) { polSum += p; crimeSum += crime; cnt++; }
    }
    this.stats.avgPollution = cnt ? polSum / cnt : 0;
    this.stats.avgCrime = cnt ? crimeSum / cnt : 0;
    this.fieldsDirty = false;
  }

  recount() {
    const w = this.w, s = this.stats;
    let pop = 0, com = 0, ind = 0, roads = 0, unpowered = 0, unwatered = 0, happySum = 0;
    for (let i = 0; i < N; i++) {
      const k = w.kind[i], L = w.level[i];
      if (k === K.ROAD) roads++;
      if (k === K.RES) { const p = ZONE_INFO[k].pop[L]; pop += p; if (L) happySum += this.tileHappiness(i) * p; }
      else if (k === K.COM) com += ZONE_INFO[k].jobs[L];
      else if (k === K.IND) ind += ZONE_INFO[k].jobs[L];
      if (ZONES.includes(k) && !w.power[i] && w.roadDist[i] <= 3) unpowered++;
      if (ZONES.includes(k) && L >= 1 && !w.water[i]) unwatered++;
    }
    Object.assign(s, { pop, comJobs: com, indJobs: ind, jobs: com + ind, workers: Math.round(pop * 0.55), roads, unpowered, unwatered });
    s.happiness = pop ? Math.round(happySum / pop) : 60;
    if (pop > w.peakPop) {
      const before = this.milestone(w.peakPop);
      w.peakPop = pop;
      const after = this.milestone(pop);
      if (after.name !== before.name) this.hooks.onToast?.(`${w.name} is now a ${after.name}! New buildings unlocked.`, 'milestone');
    }
  }

  milestone(pop = this.w.peakPop) { let m = MILESTONES[0]; for (const x of MILESTONES) if (pop >= x.pop) m = x; return m; }
  nextMilestone() { return MILESTONES.find((m) => m.pop > this.w.peakPop) || null; }

  tileHappiness(i) {
    const w = this.w;
    let h = 60 + (w.lv[i] - 45) * 0.45;
    if (!w.power[i]) h -= 28;
    if (!w.water[i]) h -= 12;
    h += w.cov.school[i] * 0.03 + w.cov.hospital[i] * 0.04 + w.cov.fire[i] * 0.02;
    h -= w.crime[i] * 0.2 + w.pollution[i] * 0.3;
    h -= (w.tax.r - 9) * 3;
    return clamp(h, 0, 100);
  }

  computeDemand() {
    const s = this.stats, t = this.w.tax;
    let r = (s.jobs + 50 - s.workers) / Math.max(50, s.workers * 0.4);
    let c = (s.pop * 0.22 + 20 - s.comJobs) / Math.max(20, s.comJobs * 0.5);
    let i = (s.pop * 0.33 + 30 - s.indJobs) / Math.max(30, s.indJobs * 0.5);
    r += (s.happiness - 55) / 90 - (t.r - 9) * 0.07;
    c -= (t.c - 9) * 0.07;
    i -= (t.i - 9) * 0.07;
    this.demand = { r: clamp(r, -1, 1), c: clamp(c, -1, 1), i: clamp(i, -1, 1) };
  }

  maxLevel(i) {
    const w = this.w, k = w.kind[i], lv = w.lv[i], pop = w.peakPop;
    if (!w.water[i]) return 1;
    if (k === K.IND) {
      if (pop >= 1500 && w.cov.school[i] > 40) return 3;
      return pop >= 250 ? 2 : 1;
    }
    if (lv >= 60 && pop >= 1200 && (k === K.COM || w.cov.school[i] > 20)) return 3;
    if (lv >= 34) return 2;
    return 1;
  }

  growTile(i) {
    const w = this.w, k = w.kind[i];
    const dkey = k === K.RES ? 'r' : k === K.COM ? 'c' : 'i';
    const d = this.demand[dkey], L = w.level[i], r = this.rng();
    const connected = w.roadDist[i] <= 3 && w.power[i];
    if (!connected) {
      if (L > 0 && r < 0.12) return this.setLevel(i, L - 1);
      return;
    }
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
    }
    this.netDirty = true;
    this.hooks.onGrow?.(i, up);
  }

  // one simulated day
  step() {
    const w = this.w;
    if (this.netDirty) this.computeNetworks();
    if (this.fieldsDirty) this.computeFields();
    w.day++;
    // growth: evaluate 1/6 of zone tiles per day
    const changed = [];
    for (let i = this.slice; i < N; i += 6) {
      const k = w.kind[i];
      if (k === K.RES || k === K.COM || k === K.IND) {
        const L = w.level[i]; this.growTile(i);
        if (w.level[i] !== L) changed.push(i);
      }
    }
    this.slice = (this.slice + 1) % 6;
    if (changed.length) { this.recount(); this.hooks.onTiles?.(changed); }
    if (w.day % 5 === 0) { this.recount(); this.computeDemand(); }
    if (w.day % 10 === 0) this.fieldsDirty = true;
    if (w.day % DAYS_PER_MONTH === 0) this.monthly();
  }

  monthly() {
    const w = this.w, s = this.stats;
    this.computeNetworks(); this.computeFields(); this.recount(); this.computeDemand();
    const incR = s.pop * w.tax.r * 0.05, incC = s.comJobs * w.tax.c * 0.06, incI = s.indJobs * w.tax.i * 0.06;
    let upkeep = s.roads * ROAD_UPKEEP;
    const svcUpkeep = {};
    for (let i = 0; i < N; i++) if (w.kind[i] === K.SERVICE && w.root[i] === i) {
      const id = svcId(w.svc[i]); svcUpkeep[id] = (svcUpkeep[id] || 0) + SERVICES[id].upkeep; upkeep += SERVICES[id].upkeep;
    }
    s.income = Math.round(incR + incC + incI);
    s.expense = Math.round(upkeep);
    s.breakdown = { incR: Math.round(incR), incC: Math.round(incC), incI: Math.round(incI), roads: Math.round(s.roads * ROAD_UPKEEP), svc: svcUpkeep };
    w.funds += s.income - s.expense;
    w.history.push({ d: w.day, pop: s.pop, funds: Math.round(w.funds), happy: s.happiness, jobs: s.jobs });
    if (w.history.length > 240) w.history.shift();
    this.buildAdvice();
    this.hooks.onMonth?.();
  }

  buildAdvice() {
    const s = this.stats, d = this.demand, w = this.w, a = [];
    if (s.powerDemand > s.powerSupply) a.push({ lvl: 'bad', who: 'Utilities', text: `Power shortfall: ${s.powerDemand} MW needed, ${s.powerSupply} MW supplied. Build more generation.` });
    if (s.unpowered > 0) a.push({ lvl: 'bad', who: 'Utilities', text: `${s.unpowered} zoned lots have no power. Connect them to a plant through roads or buildings.` });
    if (s.unwatered > 4) a.push({ lvl: 'warn', who: 'Utilities', text: `${s.unwatered} buildings lack water and can't grow past low density. Place powered water towers.` });
    if (d.r > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Strong housing demand. Zone more residential near jobs.' });
    if (d.c > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Shops want customers. Zone commercial along busy roads.' });
    if (d.i > 0.5) a.push({ lvl: 'info', who: 'Planning', text: 'Industry is looking for land. Zone industrial away from homes.' });
    if (s.avgPollution > 22) a.push({ lvl: 'warn', who: 'Environment', text: 'Pollution is hurting land value. Add parks, trees and clean power.' });
    if (s.avgCrime > 18) a.push({ lvl: 'warn', who: 'Safety', text: 'Crime is rising in dense areas. Build police stations.' });
    if (w.funds < 2000) a.push({ lvl: 'bad', who: 'Finance', text: 'Treasury is nearly empty. Raise taxes or cut services.' });
    if (s.income < s.expense && s.pop > 0) a.push({ lvl: 'warn', who: 'Finance', text: `Running a deficit of $${(s.expense - s.income).toLocaleString()}/mo.` });
    if (s.happiness < 40 && s.pop > 100) a.push({ lvl: 'warn', who: 'Citizens', text: 'Citizens are unhappy. Improve services, cut pollution or lower taxes.' });
    if (!a.length) a.push({ lvl: 'good', who: 'Mayor’s office', text: 'All systems nominal. The city is thriving.' });
    this.advice = a;
  }

  // full refresh after load
  refreshAll() { this.computeNetworks(); this.computeFields(); this.recount(); this.computeDemand(); this.buildAdvice(); }
}
