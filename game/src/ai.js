// Generative text layer.
//
// Inside the native iOS shell (ios/), messages go to Apple's on-device
// Foundation Models framework through a WKScriptMessageHandler named
// "skyfoldAI" and come back via window.__skyfoldAI(id, json). In a plain
// browser (or when the on-device model is unavailable) a procedural grammar
// writes the text, so gameplay never depends on the model.
import { mulberry32 } from './config.js';

const bridge = () => window.webkit?.messageHandlers?.skyfoldAI;
let seq = 0;
const pending = new Map();
window.__skyfoldAI = (id, result) => {
  const res = pending.get(id);
  if (!res) return;
  pending.delete(id);
  try { res(typeof result === 'string' ? JSON.parse(result) : result); } catch { res(null); }
};

function ask(kind, payload, timeout = 9000) {
  const b = bridge();
  if (!b || !AI.info.available) return Promise.resolve(null);
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    try { b.postMessage({ id, kind, payload }); } catch { pending.delete(id); resolve(null); return; }
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(null); } }, timeout);
  });
}

let rnd = mulberry32(Date.now() & 0xffffffff);
const pick = (a) => a[(rnd() * a.length) | 0];
const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

const FIRST = ['Maya', 'Leo', 'Ava', 'Noah', 'Iris', 'Kai', 'Zoe', 'Omar', 'Lena', 'Theo', 'Ruby', 'Jun', 'Nina', 'Eli', 'Sana', 'Marco', 'Priya', 'Owen', 'Mei', 'Diego'];
const LAST = ['Park', 'Rivera', 'Chen', 'Okafor', 'Novak', 'Haas', 'Silva', 'Tanaka', 'Moreau', 'Kim', 'Patel', 'Byrne', 'Costa', 'Ibrahim', 'Lund'];

const H = {
  fire: [['Blaze rips through {district}', 'Crews raced to contain the fire as neighbours watched from the street.'], ['Firefighters battle flames in {district}', 'Officials urge residents to check their smoke detectors.'], ['Smoke over {district} as fire breaks out', 'The cause is under investigation.']],
  milestone: [['{city} officially becomes a {name}', 'Population tops {pop}. The council toasted the milestone at City Hall.'], ['Welcome to the big leagues: {city} is a {name}', 'Planners say new civic buildings are now within reach.']],
  policyOn: [['Council passes {policy}', 'The mayor says the ordinance takes effect immediately.'], ['{policy} becomes law', 'Supporters cheered; critics worry about the cost.']],
  policyOff: [['{policy} repealed', 'The council voted to end the ordinance.'], ['City scraps {policy}', 'The mayor cited changing priorities.']],
  built: [['New {building} opens in {district}', 'Locals turned out for the ribbon cutting.'], ['{district} gets a {building}', 'Residents say it was long overdue.']],
  tower: [['New tower rises over {district}', 'The skyline keeps climbing.'], ['Cranes crown {district} with a high-rise', 'Developers call it a vote of confidence in {city}.']],
  loan: [['City borrows {amount} to fund growth', 'Repayments will run for ten years.']],
  petitionDone: [['Promise kept in {district}', '“{title}” is done, and residents noticed.'], ['{district} celebrates as City Hall delivers', 'Approval of the mayor ticks up.']],
  petitionFailed: [['Frustration in {district} over broken promise', 'Residents say “{title}” never happened.']],
  achievement: [['{city} earns “{name}” recognition', '{desc}']],
  traffic: [['Gridlock grips {city}', 'Average congestion hit {cong}% this month.'], ['Commuters fume as jams spread', 'The average commute is now {commute} minutes.']],
  jobs: [['Job seekers outnumber openings', 'Unemployment stands at {unemp}%.']],
  boom: [['{city} keeps growing', 'Population reached {pop} this month.'], ['Moving trucks everywhere in {city}', '{pop} people now call it home.']],
  quiet: [['A calm month in {city}', 'Nothing much to report — and the mayor is fine with that.'], ['Sunny skies over {city}', 'Parks were busy and the buses ran on time.']],
};

const CHIRPS = {
  commute: ['{m} minutes to get to work AGAIN. {district} needs a bus stop 😩', 'Sat in traffic so long I finished a podcast series. Thanks {city}.', 'Whoever designed the roads in {district}: we need to talk.'],
  noRoute: ['There is literally no road from my place to any job. How is this legal?'],
  garbage: ['The trash in {district} hasn’t been picked up in weeks. 🗑️', 'Raccoons have formed a government on my street.'],
  crime: ['Second bike stolen this month in {district}. More police please.', 'Not feeling safe walking home in {district} lately.'],
  power: ['Power’s out in {district}. Again. Candles it is 🕯️'],
  water: ['No running water in {district}. Showering with bottled water is a vibe I guess.'],
  pollution: ['Can’t open my windows in {district} — the factory smell is brutal.'],
  jobs: ['Applied to 30 jobs in {city}. Zero callbacks. 😞'],
  taxes: ['Tax rate is getting wild. Considering moving out of {city}.'],
  love: ['Just moved to {district} and honestly? Love it here. 🌳', 'Sunset from {district} tonight was unreal. Proud to live in {city}.', 'Walked to the park, grabbed coffee, home in 10. {city} is getting it right.'],
};

export const AI = {
  info: { available: false, model: 'Procedural' },
  init() {
    const i = window.__skyfoldAIInfo;
    if (bridge() && i && i.available) this.info = { available: true, model: i.model || 'Apple Foundation Model' };
  },
  seed(s) { rnd = mulberry32(s); },

  async headline(fact, ctx) {
    const fb = this.templateHeadline(fact, ctx);
    const r = await ask('headline', { fact, city: ctx.city, stats: ctx.stats, fallback: fb });
    return r && r.title ? { title: String(r.title).slice(0, 90), body: String(r.body || '').slice(0, 220), ai: true } : fb;
  },

  templateHeadline(f, ctx) {
    const v = { ...ctx.stats, ...f, city: ctx.city };
    let key = f.type;
    if (f.type === 'policy') key = f.on ? 'policyOn' : 'policyOff';
    if (f.type === 'loan') v.amount = money(f.amount);
    const t = pick(H[key] || H.quiet);
    return { title: fill(t[0], v), body: fill(t[1], v) };
  },

  async chirp(ctx) {
    const fb = this.templateChirp(ctx);
    const r = await ask('chirp', { ...ctx, fallback: fb });
    return r && r.text ? { who: r.handle ? String(r.handle).slice(0, 24) : fb.who, text: String(r.text).slice(0, 200), ai: true } : fb;
  },

  templateChirp(ctx) {
    const who = '@' + pick(FIRST) + pick(LAST) + (rnd() < 0.5 ? (10 + ((rnd() * 89) | 0)) : '');
    return { who, text: fill(pick(CHIRPS[ctx.mood] || CHIRPS.love), ctx) };
  },

  async petition(p, ctx) {
    const r = await ask('petition', { type: p.type, district: p.district, goal: p.goal, city: ctx.city, fallback: p.text });
    return r && r.text ? String(r.text).slice(0, 240) : p.text;
  },

  async brief(state) {
    const fb = this.templateBrief(state);
    const r = await ask('brief', { ...state, fallback: fb }, 15000);
    return r && r.summary ? { summary: String(r.summary).slice(0, 400), priorities: (r.priorities || []).slice(0, 4).map(String), ai: true } : fb;
  },

  templateBrief(s) {
    const mood = s.happiness >= 70 ? 'in great spirits' : s.happiness >= 50 ? 'cautiously content' : 'restless';
    const money = s.net >= 0 ? `running a ${'$' + s.net.toLocaleString()} monthly surplus` : `bleeding ${'$' + (-s.net).toLocaleString()} a month`;
    return {
      summary: `${s.city} has ${s.pop.toLocaleString()} residents who are ${mood}. The treasury is ${money}, unemployment sits at ${s.unemployment}% and the average commute is ${s.commute} minutes.`,
      priorities: s.advice.slice(0, 3),
    };
  },
};
