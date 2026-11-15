// Petitions (quests), achievements, mayor approval and the city feed.
import { MAP, N, K, F, SERVICES, POLICIES, svcId, clamp } from './config.js';
import { AI } from './ai.js';

const near = (w, x, z, r, fn) => {
  for (let zz = z - r; zz <= z + r; zz++) for (let xx = x - r; xx <= x + r; xx++) {
    if (!w.inb(xx, zz) || (xx - x) ** 2 + (zz - z) ** 2 > r * r) continue;
    if (fn(w.idx(xx, zz))) return true;
  }
  return false;
};
const isSvc = (w, i, ids) => w.kind[i] === K.SERVICE && ids.includes(svcId(w.svc[w.root[i]]));

// find a developed residential tile matching a predicate (random sample)
function findRes(sim, pred) {
  const w = sim.w, c = [];
  for (let i = 0; i < N; i++) if (w.kind[i] === K.RES && w.level[i] && !(w.flags[i] & F.ABANDONED) && pred(i)) c.push(i);
  return c.length ? c[(sim.rng() * c.length) | 0] : -1;
}

const TYPES = {
  park: {
    make: (sim) => findRes(sim, (i) => { const [x, z] = sim.w.xz(i); return sim.w.lv[i] < 60 && !near(sim.w, x, z, 5, (j) => isSvc(sim.w, j, ['park', 'stadium'])); }),
    goal: 'Build a park within 5 tiles', text: 'Families in {d} want somewhere green for the kids to play.', reward: { appr: 5, cash: 0 },
    check: (sim, p) => near(sim.w, p.x, p.z, 5, (j) => isSvc(sim.w, j, ['park', 'stadium'])),
  },
  transit: {
    make: (sim) => findRes(sim, (i) => sim.w.commute[i] > 22 && sim.w.commute[i] < 255 && sim.w.cov.transit[i] < 30),
    goal: 'Bring transit within reach', text: 'Commuters in {d} are tired of sitting in traffic and want a bus line.', reward: { appr: 5, cash: 0 },
    check: (sim, p) => sim.w.cov.transit[sim.w.idx(p.x, p.z)] > 40,
  },
  safety: {
    make: (sim) => findRes(sim, (i) => sim.w.crime[i] > 24),
    goal: 'Cut crime here below 12', text: 'A string of break-ins has {d} on edge. Residents demand action.', reward: { appr: 6, cash: 0 },
    check: (sim, p) => sim.w.crime[sim.w.idx(p.x, p.z)] < 12,
  },
  school: {
    make: (sim) => sim.w.peakPop >= 300 ? findRes(sim, (i) => sim.w.cov.edu[i] < 25) : -1,
    goal: 'Provide schooling nearby', text: 'Parents in {d} are driving across town for school. They want one close by.', reward: { appr: 5, cash: 0 },
    check: (sim, p) => sim.w.cov.edu[sim.w.idx(p.x, p.z)] > 70,
  },
  health: {
    make: (sim) => findRes(sim, (i) => sim.w.cov.health[i] < 20 && sim.w.level[i] >= 2),
    goal: 'Healthcare coverage nearby', text: 'The nearest doctor is too far from {d}. Seniors are asking for a clinic.', reward: { appr: 5, cash: 0 },
    check: (sim, p) => sim.w.cov.health[sim.w.idx(p.x, p.z)] > 70,
  },
  clean: {
    make: (sim) => findRes(sim, (i) => sim.w.pollution[i] > 22),
    goal: 'Get pollution here under 8', text: 'A haze hangs over {d}. Residents want clean air.', reward: { appr: 6, cash: 0 },
    check: (sim, p) => sim.w.pollution[sim.w.idx(p.x, p.z)] < 8,
  },
  garbage: {
    make: (sim) => findRes(sim, (i) => sim.w.garbage[i] > 40),
    goal: 'Clear the garbage here', text: 'Bags are piling up on the curbs of {d}.', reward: { appr: 4, cash: 0 },
    check: (sim, p) => sim.w.garbage[sim.w.idx(p.x, p.z)] < 10,
  },
  traffic: {
    make: (sim) => { const w = sim.w, c = []; for (let i = 0; i < N; i++) if (w.kind[i] === K.ROAD && w.traffic[i] > 120) c.push(i); return c.length ? c[(sim.rng() * c.length) | 0] : -1; },
    goal: 'Bring this road under 85% congestion', text: 'Drivers say this stretch in {d} is a daily parking lot.', reward: { appr: 5, cash: 0 },
    check: (sim, p) => sim.w.traffic[sim.w.idx(p.x, p.z)] < 85,
  },
  jobs: {
    make: (sim) => sim.stats.unemployment > 0.08 && sim.stats.pop > 300 ? findRes(sim, () => true) : -1,
    goal: 'Get unemployment under 4%', text: 'Job seekers rallied outside City Hall demanding work.', reward: { appr: 7, cash: 0 },
    check: (sim) => sim.stats.unemployment < 0.04,
  },
  power: {
    make: (sim) => sim.stats.powerDemand > sim.stats.powerSupply ? findRes(sim, () => true) : -1,
    goal: 'End the brownouts', text: 'Rolling blackouts are hitting homes. Fix the grid!', reward: { appr: 6, cash: 0 },
    check: (sim) => sim.stats.powerSupply >= sim.stats.powerDemand,
  },
  investor: {
    make: (sim) => sim.w.peakPop >= 1500 ? findRes(sim, () => true) : -1,
    goal: 'Grow 2 more office towers', text: 'A tech firm will invest if {city} can offer more Class-A office space.', reward: { appr: 2, cash: 15000 },
    base: (sim) => { let n = 0; for (let i = 0; i < N; i++) if (sim.w.kind[i] === K.COM && sim.w.level[i] === 3) n++; return n; },
    check: (sim, p) => { let n = 0; for (let i = 0; i < N; i++) if (sim.w.kind[i] === K.COM && sim.w.level[i] === 3) n++; return n >= p.base + 2; },
  },
};

export const ACHIEVEMENTS = [
  { id: 'founder', name: 'Groundbreaking', desc: 'Reach 100 residents.', check: (s) => s.pop >= 100 },
  { id: 'pop1k', name: 'Thousand Strong', desc: 'Reach 1,000 residents.', check: (s) => s.pop >= 1000 },
  { id: 'pop5k', name: 'Big City', desc: 'Reach 5,000 residents.', check: (s) => s.pop >= 5000 },
  { id: 'pop15k', name: 'Metropolis', desc: 'Reach 15,000 residents.', check: (s) => s.pop >= 15000 },
  { id: 'skyline', name: 'Skyline', desc: 'Grow a high-density office tower.', check: (s, sim) => { for (let i = 0; i < N; i++) if (sim.w.kind[i] === K.COM && sim.w.level[i] === 3) return true; return false; } },
  { id: 'green', name: 'Green Grid', desc: 'Power 1,500+ residents with zero gas plants.', check: (s, sim) => { if (s.pop < 1500 || s.powerSupply < s.powerDemand) return false; for (let i = 0; i < N; i++) if (sim.w.kind[i] === K.SERVICE && svcId(sim.w.svc[i]) === 'gas') return false; return true; } },
  { id: 'fullemp', name: 'Full Employment', desc: 'Unemployment under 3% with 1,000+ residents.', check: (s) => s.pop >= 1000 && s.unemployment < 0.03 },
  { id: 'flow', name: 'Free Flowing', desc: 'Congestion under 50% with 3,000+ residents.', check: (s) => s.pop >= 3000 && s.congestion < 50 },
  { id: 'firefighter', name: 'Heroes in Helmets', desc: 'Put out 10 fires.', check: (s, sim) => sim.w.counters.firesOut >= 10 },
  { id: 'books', name: 'Balanced Books', desc: '12 months in a row without a deficit.', check: (s, sim) => sim.w.counters.surplusMonths >= 12 },
  { id: 'beloved', name: 'Beloved Mayor', desc: 'Approval of 80%+ with 1,000+ residents.', check: (s, sim) => s.pop >= 1000 && sim.w.approval >= 80 },
  { id: 'scholar', name: 'City of Scholars', desc: 'Education 70%+ with 2,000+ residents.', check: (s) => s.pop >= 2000 && s.education >= 70 },
  { id: 'civic', name: 'Civic Hero', desc: 'Complete 5 petitions.', check: (s, sim) => sim.w.counters.petitionsDone >= 5 },
  { id: 'tourist', name: 'Tourist Magnet', desc: 'Attract 1,500 tourists a month.', check: (s) => s.tourists >= 1500 },
];

export class Events {
  constructor(sim) { this.sim = sim; this.facts = []; }
  get w() { return this.sim.w; }

  fact(f) { this.facts.push(f); if (this.facts.length > 12) this.facts.shift(); }

  ctx() {
    const s = this.sim.stats, w = this.w;
    return { city: w.name, stats: { pop: s.pop.toLocaleString(), unemp: Math.round(s.unemployment * 100), cong: s.congestion, commute: s.avgCommute, happiness: s.happiness } };
  }

  post(item) {
    const w = this.w;
    item.d = w.day; item.date = w.dateString();
    w.news.push(item);
    if (w.news.length > 60) w.news.shift();
    this.sim.hooks.onFeed?.(item);
  }

  async headlineFor(f) {
    const ctx = this.ctx();
    const vars = { ...f };
    if (f.type === 'policy') vars.policy = POLICIES[f.id].name;
    if (f.type === 'built') vars.building = SERVICES[f.id].name;
    const h = await AI.headline(vars, ctx);
    this.post({ kind: 'news', title: h.title, body: h.body, ai: !!h.ai });
  }

  async chirp() {
    const sim = this.sim, w = this.w;
    const i = findRes(sim, () => true);
    if (i < 0) return;
    const [x, z] = w.xz(i), s = sim.stats;
    let mood = 'love';
    if (w.commute[i] === 255) mood = 'noRoute';
    else if (!w.power[i]) mood = 'power';
    else if (!w.water[i]) mood = 'water';
    else if (w.garbage[i] > 45) mood = 'garbage';
    else if (w.crime[i] > 25) mood = 'crime';
    else if (w.pollution[i] > 25) mood = 'pollution';
    else if (w.commute[i] > 26) mood = 'commute';
    else if (s.unemployment > 0.1) mood = 'jobs';
    else if (w.tax.r > 13) mood = 'taxes';
    const c = await AI.chirp({ mood, district: w.district(x, z), city: w.name, m: w.commute[i], happiness: w.happy[i] });
    this.post({ kind: 'chirp', who: c.who, body: c.text, ai: !!c.ai, at: i });
  }

  // ---------------- approval
  updateApproval() {
    const w = this.w, s = this.sim.stats;
    w.approvalMods = w.approvalMods.filter((m) => --m.left > 0);
    const mods = w.approvalMods.reduce((a, m) => a + m.v * (m.left / 12), 0);
    const target = clamp(s.happiness * 0.65 + (100 - s.unemployment * 300 - Math.max(0, s.congestion - 60) * 0.3 - (s.income < s.expense ? 8 : 0) - s.burning * 3) * 0.35 + mods, 0, 100);
    w.approval = clamp(w.approval * 0.7 + target * 0.3, 0, 100);
  }

  // ---------------- petitions
  checkPetitions() {
    const w = this.w, sim = this.sim, P = w.petitions;
    for (const p of [...P.active]) {
      const T = TYPES[p.type];
      if (T.check(sim, p)) {
        P.active = P.active.filter((x) => x !== p);
        w.counters.petitionsDone++;
        sim.addApproval(p.reward.appr, p.goal);
        if (p.reward.cash) w.funds += p.reward.cash;
        sim.hooks.onToast?.(`✅ Petition complete: ${p.goal}${p.reward.cash ? ` · +$${p.reward.cash.toLocaleString()}` : ''}`, 'milestone');
        this.fact({ type: 'petitionDone', district: p.district, title: p.goal });
      } else if (w.day > p.deadline) {
        P.active = P.active.filter((x) => x !== p);
        w.counters.petitionsFailed++;
        sim.addApproval(-p.reward.appr * 0.8, 'Broken promise');
        sim.hooks.onToast?.(`❌ Petition failed: ${p.goal}`, 'bad');
        this.fact({ type: 'petitionFailed', district: p.district, title: p.goal });
      }
    }
    if (P.offer && w.day > P.offer.expires) { P.offer = null; this.sim.hooks.onPetition?.(null); }
    if (!P.offer && P.active.length < 3 && w.day >= P.nextDay && sim.stats.pop >= 60) this.offerPetition();
  }

  async offerPetition() {
    const sim = this.sim, w = this.w, P = w.petitions;
    const keys = Object.keys(TYPES).sort(() => sim.rng() - 0.5);
    for (const type of keys) {
      if (P.active.some((p) => p.type === type)) continue;
      const T = TYPES[type], at = T.make(sim);
      if (at < 0) continue;
      const [x, z] = w.xz(at), d = w.district(x, z);
      const p = { type, x, z, district: d, goal: T.goal, text: T.text.replace('{d}', d).replace('{city}', w.name), reward: { ...T.reward }, months: 6, expires: w.day + 60 };
      if (T.base) p.base = T.base(sim);
      P.offer = p;
      P.nextDay = w.day + 90 + Math.round(sim.rng() * 90);
      p.text = await AI.petition(p, this.ctx());
      sim.hooks.onPetition?.(p);
      return;
    }
    P.nextDay = w.day + 60;
  }

  accept() {
    const w = this.w, P = w.petitions, p = P.offer;
    if (!p) return;
    p.deadline = w.day + p.months * 30;
    P.active.push(p); P.offer = null;
    this.post({ kind: 'petition', title: `Accepted: ${p.goal}`, body: p.text });
  }

  decline() {
    const P = this.w.petitions;
    if (!P.offer) return;
    this.sim.addApproval(-1.5, 'Ignored a petition');
    P.offer = null;
  }

  progress(p) {
    const w = this.w, i = w.idx(p.x, p.z), s = this.sim.stats;
    switch (p.type) {
      case 'safety': return `Crime ${w.crime[i]} → 12`;
      case 'clean': return `Pollution ${w.pollution[i]} → 8`;
      case 'garbage': return `Garbage ${w.garbage[i]} → 10`;
      case 'traffic': return `Congestion ${w.traffic[i]}% → 85%`;
      case 'jobs': return `Unemployment ${Math.round(s.unemployment * 100)}% → 4%`;
      case 'power': return `${s.powerSupply}/${s.powerDemand} MW`;
      case 'transit': return `Transit ${Math.round(w.cov.transit[i] / 2.55)}%`;
      case 'school': return `Education ${Math.round(w.cov.edu[i] / 2.55)}%`;
      case 'health': return `Health ${Math.round(w.cov.health[i] / 2.55)}%`;
      default: return '';
    }
  }

  // ---------------- achievements
  checkAchievements() {
    const w = this.w, s = this.sim.stats;
    for (const a of ACHIEVEMENTS) {
      if (w.achievements.includes(a.id) || !a.check(s, this.sim)) continue;
      w.achievements.push(a.id);
      this.sim.addApproval(2, a.name);
      this.sim.hooks.onToast?.(`🏆 ${a.name} — ${a.desc}`, 'milestone');
      this.fact({ type: 'achievement', name: a.name, desc: a.desc });
    }
  }

  monthly() {
    const s = this.sim.stats;
    this.updateApproval();
    this.checkPetitions();
    this.checkAchievements();
    // feed: up to 2 headlines + a citizen voice
    const facts = this.facts.splice(0);
    const pri = { fire: 5, milestone: 6, achievement: 5, petitionDone: 4, petitionFailed: 4, policy: 3, tower: 2, built: 1, loan: 3 };
    facts.sort((a, b) => (pri[b.type] || 0) - (pri[a.type] || 0));
    const chosen = facts.slice(0, 2);
    if (!chosen.length && this.w.day % 60 === 0) {
      if (s.congestion > 90) chosen.push({ type: 'traffic' });
      else if (s.unemployment > 0.1) chosen.push({ type: 'jobs' });
      else if (s.pop > 0) chosen.push({ type: this.sim.rng() < 0.6 ? 'boom' : 'quiet' });
    }
    for (const f of chosen) this.headlineFor(f);
    if (s.pop > 30 && this.sim.rng() < 0.75) this.chirp();
  }
}
