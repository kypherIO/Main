// HUD, tool palette, Mayor's Desk, inspect card, menus.
import { MAP, N, K, F, TOOLS, SERVICES, ZONE_INFO, OVERLAYS, POLICIES, DEPTS, ROADS, svcId, clamp } from './config.js';
import { ACHIEVEMENTS } from './events.js';
import { AI } from './ai.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const money = (n) => (n < 0 ? '-$' : '$') + fmt(Math.abs(n));
const short = (n) => Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.abs(n) >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : fmt(n);

// 24×24 stroke icons
const P = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  inspect: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  bulldoze: '<path d="M3 17h11l3-5h3v5"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="12" cy="18.5" r="1.8"/><path d="M5 17V9h6l2 4M3 12l-1 5"/>',
  road: '<path d="M8 3 5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',
  res: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  com: '<path d="M4 20V9l4-3v14M8 20V4h8v16M16 20V10h4v10"/><path d="M11 8h2M11 12h2M11 16h2"/>',
  ind: '<path d="M3 20V11l5 3V11l5 3V7h3v-3h3v16z"/><path d="M7 17h2M12 17h2"/>',
  wind: '<path d="M12 12v9M12 12 8 5M12 12l7-1M12 12l-6 5"/><circle cx="12" cy="12" r="1.4"/>',
  solar: '<path d="M3 15 6 7h12l3 8z"/><path d="M4.5 11h15M9 7l-1.5 8M15 7l1.5 8M12 15v5M9 20h6"/>',
  gas: '<path d="M5 20 7 9h4l2 11z"/><path d="M14 20V12h5v8"/><path d="M8 6c0-1.5 2-1.5 2-3M16 9c0-1.5 2-1.5 2-3"/>',
  tower: '<path d="M7 9a5 5 0 0 1 10 0c0 2.5-2.2 4-5 4s-5-1.5-5-4z"/><path d="M9 13 7 21M15 13l2 8M8 17h8"/>',
  police: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m12 8 1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2 9.5 15.6l.6-2.8L8 10.9l2.8-.3z"/>',
  fire: '<path d="M12 21c4 0 6.5-2.6 6.5-6.2C18.5 10 14 8 13.5 3c-3 2-4 5-3.5 7.5C8.5 9.5 8 8 8 7c-2 2-2.5 4.5-2.5 7.8C5.5 18.4 8 21 12 21z"/>',
  school: '<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6"/>',
  hospital: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  park: '<path d="M12 21v-6"/><path d="M12 15c-4 0-6-2.5-6-5.5S8.5 3 12 3s6 3 6 6.5S16 15 12 15z"/><path d="M8 21h8"/>',
  stadium: '<ellipse cx="12" cy="12" rx="9" ry="6"/><ellipse cx="12" cy="12" rx="4.5" ry="2.6"/><path d="M3 12v3c0 3.3 4 6 9 6s9-2.7 9-6v-3"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2 2.8.8 2.8 2.1-1.2 2-2.8 2c-1.2 0-2.2-.5-2.7-1.3M12 6.5v11"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2c3 .2 5.5 2.6 5.5 5.8"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14c1.8 2.2 5.2 2.2 7 0M9 9.5h.01M15 9.5h.01"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="m7 15 4-4 3 3 5-6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  ff: '<path d="M4 5v14l8-7zM12 5v14l8-7z"/>',
  fff: '<path d="M2 6v12l6-6zM8.5 6v12l6-6zM15 6v12l6-6z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  load: '<path d="M4 15v5h16v-5M12 4v11M7 10l5 5 5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  rotl: '<path d="M4 12a8 8 0 1 0 3-6.3"/><path d="M4 4v4h4"/>',
  rotr: '<path d="M20 12a8 8 0 1 1-3-6.3"/><path d="M20 4v4h-4"/>',
  avenue: '<path d="M6 3 3 21M18 3l3 18M10 4v16M14 4v16"/>',
  landfill: '<path d="M3 19h18"/><path d="M4 19c1-5 4-8 8-8s7 3 8 8"/><path d="M9 11l1-4 3 1M15 13l2-2"/>',
  recycling: '<path d="M7 19H4l3-5M17 19h3l-3-5M12 4l-2 4h4z"/><path d="M7 14l3-6M17 14l-3-6M8 19h8"/>',
  clinic: '<path d="M4 20V9l8-5 8 5v11z"/><path d="M12 10v6M9 13h6"/>',
  university: '<path d="M3 9h18L12 4z"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
  bus: '<rect x="5" y="3" width="14" height="15" rx="2"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="14.5" r=".8"/><circle cx="15.5" cy="14.5" r=".8"/>',
  metro: '<path d="M4 20 8 6l4 8 4-8 4 14"/>',
  policy: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4v4h-4z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
};
export const icon = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;

export class UI {
  constructor(game) {
    this.g = game;
    this.tool = 'inspect';
    this.tab = 'overview';
    this.deskOpen = false;
    this._last = {};
    document.querySelectorAll('[data-icon]').forEach((e) => (e.innerHTML = icon(e.dataset.icon)));
    $('#btn-menu').innerHTML = icon('menu');
    $('#fab-layers').innerHTML = icon('layers');
    $('#fab-desk').innerHTML = icon('chart');
    this.buildTools();
    this.buildSpeed();
    this.buildLayers();
    this.buildDesk();
    $('#btn-menu').onclick = () => { this.g.audio.click(); this.openMenu(); };
    $('#fab-layers').onclick = () => { this.g.audio.click(); $('#layers').classList.toggle('hidden'); };
    $('#fab-desk').onclick = () => { this.g.audio.click(); this.toggleSheet(); };
    $('#sheet').addEventListener('click', (e) => { if (e.target.classList.contains('sheet-grab')) this.toggleSheet(false); });
    $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') this.closeModal(); });
    this.feedSeen = 0;
  }

  // ---------------------------------------------------------- petitions
  showPetition(p) {
    const el = $('#petition');
    if (!p) { el.classList.add('hidden'); return; }
    el.innerHTML = `<div class="pet-h">${icon('policy')}<span>Petition · ${p.district}</span></div>
      <p>${p.text}</p>
      <div class="pet-goal"><b>Goal:</b> ${p.goal} within ${p.months} months · reward ${p.reward.cash ? '$' + p.reward.cash.toLocaleString() + ' + ' : ''}approval +${p.reward.appr}</div>
      <div class="btn-row"><button class="btn primary sm" data-a="yes">Accept</button><button class="btn sm" data-a="show">${icon('pin', 'style="width:14px;height:14px;display:inline;vertical-align:-2px"')} Show</button><button class="btn sm" data-a="no">Decline</button></div>`;
    el.classList.remove('hidden');
    el.querySelector('[data-a=yes]').onclick = () => { this.g.audio.select(); this.g.sim.events.accept(); el.classList.add('hidden'); this.toast('Petition accepted — see Goals'); this.renderDesk(true); };
    el.querySelector('[data-a=no]').onclick = () => { this.g.audio.click(); this.g.sim.events.decline(); el.classList.add('hidden'); };
    el.querySelector('[data-a=show]').onclick = () => { this.g.audio.click(); this.g.focusTile(p.x, p.z); };
  }

  // ---------------------------------------------------------- tools
  buildTools() {
    const nav = $('#tools');
    nav.innerHTML = '';
    let group = null;
    this.toolEls = {};
    for (const t of TOOLS) {
      if (t.group !== group) {
        if (group) nav.appendChild(h('div', { class: 'tool-sep' }));
        nav.appendChild(h('div', { class: 'tool-group-h' }, t.group));
        group = t.group;
      }
      const ic = t.service || t.id;
      const b = h('button', { class: 'tool', 'data-tool': t.id, 'aria-label': t.label, ...(t.zone ? { 'data-zone': t.id } : {}) },
        `${icon(ic)}<span class="lbl">${shortLabel(t.label)}</span>${t.cost ? `<span class="price">$${short(t.cost)}</span>` : ''}`);
      b.onclick = () => this.g.selectTool(t.id);
      nav.appendChild(b);
      this.toolEls[t.id] = b;
    }
    this.setTool('inspect');
  }

  setTool(id) {
    this.tool = id;
    for (const k in this.toolEls) this.toolEls[k].classList.toggle('on', k === id);
    const el = this.toolEls[id];
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  refreshLocks() {
    const peak = this.g.world.peakPop;
    for (const t of TOOLS) if (t.service) this.toolEls[t.id].classList.toggle('locked', peak < SERVICES[t.service].unlock);
  }

  buildSpeed() {
    const el = $('#speed');
    const ic = ['pause', 'play', 'ff', 'fff'];
    el.innerHTML = '';
    this.speedEls = ic.map((name, s) => {
      const b = h('button', { 'data-s': s, 'aria-label': ['Pause', 'Normal', 'Fast', 'Ultra'][s] }, icon(name));
      b.onclick = () => {
        this.g.audio.click();
        const compact = document.body.classList.contains('posture-folded') && document.body.classList.contains('orient-portrait');
        if (compact && s !== 0 && b.classList.contains('on')) this.g.setSpeed(s % 3 + 1); // cycle 1→2→3
        else this.g.setSpeed(s === 0 && this.g.speed === 0 ? (this.g.lastSpeed || 1) : s);
      };
      el.appendChild(b);
      return b;
    });
  }

  setSpeed(s) { this.speedEls.forEach((b, k) => b.classList.toggle('on', k === s)); }

  buildLayers() {
    const el = $('#layers');
    el.innerHTML = '';
    const colors = { none: '#9aabc9', traffic: '#ff7a3d', power: '#4ee39a', water: '#4aa8ff', lv: '#ffd23d', happy: '#7dff6a', edu: '#8a7bff', pollution: '#b07a3a', crime: '#ff4d7a', garbage: '#a07a3a' };
    this.layerEls = OVERLAYS.map((o) => {
      const b = h('button', { class: 'chip' }, `<span class="dot" style="background:${colors[o.id]}"></span>${o.label}`);
      b.onclick = () => { this.g.audio.click(); this.g.setOverlay(o.id); if (document.body.classList.contains('posture-folded')) el.classList.add('hidden'); };
      el.appendChild(b);
      return [o.id, b];
    });
  }

  setOverlay(id) {
    this.layerEls.forEach(([k, b]) => b.classList.toggle('on', k === id));
    $('#fab-layers').classList.toggle('on', id !== 'none');
    this.deskEl?.querySelectorAll('[data-ov]').forEach((b) => b.classList.toggle('on', b.dataset.ov === id));
  }

  // ---------------------------------------------------------- HUD
  updateHUD() {
    const { world: w, sim } = this.g, s = sim.stats;
    const set = (id, v) => { if (this._last[id] !== v) { this._last[id] = v; $(id).textContent = v; } };
    set('#city-name', w.name);
    set('#city-sub', `${w.dateString()} · ${sim.milestone().name}`);
    set('#k-funds', money(w.funds));
    set('#k-pop', short(s.pop));
    set('#k-happy', `${s.happiness}%`);
    set('#k-power', `${s.powerDemand}/${s.powerSupply}`);
    const net = (s.income || 0) - (s.expense || 0);
    const d = $('#k-delta');
    const dt = s.income || s.expense ? `${net >= 0 ? '+' : '−'}${short(Math.abs(net))}` : '';
    if (d.textContent !== dt) { d.textContent = dt; d.className = net >= 0 ? 'pos' : 'neg'; }
    const bars = $('#rci').querySelectorAll('.bar i');
    [sim.demand.r, sim.demand.c, sim.demand.i].forEach((v, k) => {
      const hh = Math.abs(v) * 50;
      bars[k].style.height = hh + '%';
      bars[k].style.bottom = v >= 0 ? '50%' : 50 - hh + '%';
      bars[k].style.opacity = v >= 0 ? 1 : 0.45;
    });
    this.refreshLocks();
    if (this.deskVisible()) this.renderDesk();
  }

  hint(html, onSkip) {
    const el = $('#hint');
    if (!html) { el.classList.add('hidden'); return; }
    el.innerHTML = `<span>${html}</span>${onSkip ? '<button class="skip">Skip</button>' : ''}`;
    el.classList.remove('hidden');
    if (onSkip) el.querySelector('.skip').onclick = onSkip;
  }

  toast(text, kind = '', at = null) {
    const box = $('#toasts');
    const t = h('div', { class: `toast glass ${kind}${at != null ? ' link' : ''}` }, text);
    if (at != null) { t.style.pointerEvents = 'auto'; t.onclick = () => { const [x, z] = this.g.world.xz(at); this.g.focusTile(x, z); }; }
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, kind === 'milestone' ? 4200 : at != null ? 4500 : 2600);
  }

  showInspect(i) {
    const { world: w, sim } = this.g, el = $('#inspect');
    if (i == null || i < 0) { el.classList.add('hidden'); return; }
    const k = w.kind[i], L = w.level[i], fl = w.flags[i];
    const [tx, tz] = w.xz(i), dist = w.district(tx, tz);
    let title = 'Open land', sub = w.terrain[i] ? 'Water' : (w.tree[i] ? 'Woodland' : 'Grassland'), color = '#6aa548', ic = 'park';
    const rows = [];
    let extra = '';
    const yes = (b) => b ? '<b class="ok">Yes</b>' : '<b class="no">No</b>';
    const meter = (v, c) => `<div class="meter"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div>`;
    if (fl & F.RUBBLE) { title = 'Rubble'; sub = 'Destroyed by fire — bulldoze to rebuild'; color = '#6b5f55'; ic = 'bulldoze'; }
    else if (k === K.ROAD) {
      const R = ROADS[L]; title = R.name; sub = `Upkeep $${R.upkeep}/mo · capacity ${R.cap}`; color = '#9aa3ad'; ic = L ? 'avenue' : 'road';
      const t = w.traffic[i];
      rows.push(['Traffic', `<b class="${t > 100 ? 'no' : t > 70 ? 'meh' : 'ok'}">${t}%</b>${meter(t / 1.5, t > 100 ? '#ff5d6c' : t > 70 ? '#ffc547' : '#4ee39a')}`]);
      if (!L && t > 80) extra = '<p class="tip">Tip: drag the Avenue tool over this street to nearly triple its capacity.</p>';
    } else if (k === K.RES || k === K.COM || k === K.IND) {
      const zi = ZONE_INFO[k];
      title = zi.name; color = zi.color; ic = zi.key;
      sub = fl & F.ABANDONED ? 'Abandoned' : fl & F.BURNING ? '🔥 On fire!' : L ? ['', 'Low density', 'Medium density', 'High density'][L] : 'Zoned · awaiting development';
      if (k === K.RES) rows.push(['Residents', `<b>${fl & F.ABANDONED ? 0 : zi.pop[L]}</b>`]); else rows.push(['Jobs', `<b>${fl & F.ABANDONED ? 0 : zi.jobs[L]}</b>`]);
      rows.push(['Power', yes(w.power[i])], ['Water', yes(w.water[i])]);
      if (k === K.RES && L) {
        rows.push(['Happy', `<b>${Math.round(sim.tileHappiness(i))}%</b>`]);
        const c = w.commute[i];
        rows.push(['Commute', c === 255 ? '<b class="no">No route</b>' : `<b class="${c > 28 ? 'no' : c > 18 ? 'meh' : 'ok'}">${c} min</b>`]);
        rows.push(['Educated', `<b>${Math.round(w.cov.edu[i] / 2.55)}%</b>`]);
      } else rows.push(['Road', w.roadDist[i] <= 3 ? '<b class="ok">Near</b>' : '<b class="no">Far</b>']);
      const mx = sim.maxLevel(i);
      if (L < 3 && !(fl & F.ABANDONED)) rows.push(['Can reach', `<b class="${mx > L ? 'ok' : 'meh'}">L${mx}</b>`]);
      if (w.garbage[i] > 10) rows.push(['Garbage', `<b class="${w.garbage[i] > 50 ? 'no' : 'meh'}">${w.garbage[i]}</b>`]);
      if (k === K.RES && L) {
        const f = sim.happinessFactors(i).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5);
        extra = `<div class="factors">${f.map(([lab, v]) => `<div class="fac"><span>${lab}</span><i class="${v >= 0 ? 'pos' : 'neg'}" style="width:${Math.min(50, Math.abs(v) * 2)}%"></i><b class="${v >= 0 ? 'ok' : 'no'}">${v > 0 ? '+' : ''}${v}</b></div>`).join('')}</div><div class="quote" data-quote>…</div>`;
      }
      if (L >= 1 && mx <= L && L < 3) {
        const why = !w.water[i] ? 'needs water' : k === K.IND ? 'needs educated workers & 1,500 pop' : w.lv[i] < 34 ? 'needs land value 34+' : 'needs land value 60, schooling & 1,200 pop';
        extra += `<p class="tip">To grow denser: ${why}.</p>`;
      }
    } else if (k === K.SERVICE) {
      const r = w.root[i], id = svcId(w.svc[r]), s = SERVICES[id];
      title = s.name; sub = (w.flags[r] & F.BURNING ? '🔥 On fire! ' : '') + s.desc; color = '#4fd1ff'; ic = id;
      rows.push(['Upkeep', `<b>$${Math.round(s.upkeep * (s.dept ? w.budget[s.dept] / 100 : 1))}</b>`]);
      if (s.power) rows.push(['Output', `<b>${s.power} MW</b>`]);
      if (s.radius) rows.push(['Radius', `<b>${s.radius}</b>`]);
      if (s.garbage) rows.push(['Capacity', `<b>${s.garbage} t</b>`]);
      if (s.dept) rows.push(['Funding', `<b>${w.budget[s.dept]}%</b>`]);
      rows.push(['Powered', yes(w.power[r])]);
    }
    const stats = rows.map(([a, b]) => `<div class="insp-stat"><span>${a}</span>${b}</div>`).join('');
    const fields = w.terrain[i] ? '' : `
      <div class="insp-stat"><span>Land value</span><b>${w.lv[i]}</b>${meter(w.lv[i], '#ffd23d')}</div>
      <div class="insp-stat"><span>Pollution</span><b>${w.pollution[i]}</b>${meter(w.pollution[i] * 1.5, '#c08a4a')}</div>
      <div class="insp-stat"><span>Crime</span><b>${w.crime[i]}</b>${meter(w.crime[i] * 2, '#ff4d7a')}</div>`;
    el.innerHTML = `<div class="insp-h"><div class="sw" style="background:${color}">${icon(ic)}</div><div><h3>${title}</h3><p>${dist} · ${sub}</p></div><button class="x" aria-label="Close">${icon('x')}</button></div>
      <div class="insp-grid">${stats}${fields}</div>${extra}`;
    el.querySelector('.x').onclick = () => { this.g.audio.click(); el.classList.add('hidden'); this.g.view.setCursor(0, 0, 1, true, false); };
    el.classList.remove('hidden');
    const q = el.querySelector('[data-quote]');
    if (q) {
      const tok = (this._qTok = (this._qTok || 0) + 1);
      const c = w.commute[i];
      let mood = 'love';
      if (c === 255) mood = 'noRoute'; else if (!w.power[i]) mood = 'power'; else if (!w.water[i]) mood = 'water'; else if (w.garbage[i] > 45) mood = 'garbage'; else if (w.crime[i] > 25) mood = 'crime'; else if (w.pollution[i] > 25) mood = 'pollution'; else if (c > 26) mood = 'commute'; else if (sim.stats.unemployment > 0.1) mood = 'jobs';
      AI.chirp({ mood, district: dist, city: w.name, m: c, happiness: w.happy[i] }).then((r) => { if (tok === this._qTok) q.innerHTML = `<b>${r.who}</b> “${r.text}”${r.ai ? ' <span class="ai">✦ AI</span>' : ''}`; });
    }
  }

  buildDesk() {
    const d = h('div', { class: 'desk' });
    const tabs = [['overview', 'Overview'], ['budget', 'Budget'], ['policy', 'Policy'], ['goals', 'Goals'], ['feed', 'Feed'], ['map', 'Map']];
    const zoneName = { r: 'Residential', c: 'Commercial', i: 'Industrial' };
    d.innerHTML = `
      <div class="desk-head"><h2 data-f="name"></h2><span class="rank" data-f="rank"></span><span class="date" data-f="date"></span></div>
      <div class="tabs">${tabs.map(([t, l]) => `<button data-tab="${t}">${l}<i class="dot hidden" data-dot="${t}"></i></button>`).join('')}</div>
      <div class="pane cols" data-pane="overview">
        <div class="panel"><h4>City <span data-f="approvalTxt"></span></h4><div class="kgrid">
          <div class="kcell"><span>Population</span><b data-f="pop"></b></div>
          <div class="kcell"><span>Happiness</span><b data-f="happy"></b></div>
          <div class="kcell"><span>Approval</span><b data-f="appr"></b></div>
          <div class="kcell"><span>Jobs</span><b data-f="jobs"></b></div>
          <div class="kcell"><span>Unemployed</span><b data-f="unemp"></b></div>
          <div class="kcell"><span>Educated</span><b data-f="edu"></b></div>
          <div class="kcell"><span>Treasury</span><b data-f="funds"></b></div>
          <div class="kcell"><span>Net / mo</span><b data-f="net"></b></div>
          <div class="kcell"><span>Power MW</span><b data-f="power"></b></div>
          <div class="kcell"><span>Commute</span><b data-f="commute"></b></div>
          <div class="kcell"><span>Congestion</span><b data-f="cong"></b></div>
          <div class="kcell"><span>Health</span><b data-f="health"></b></div>
        </div></div>
        <div class="panel"><h4>Demand</h4>
          ${['r', 'c', 'i'].map((k) => `<div class="demand-row"><span>${zoneName[k]}</span><div class="demand-track"><i data-d="${k}" style="background:var(--${k})"></i></div><b data-dv="${k}"></b></div>`).join('')}
          <h4 style="margin-top:12px">Workforce</h4><div data-f="workforce" class="wf"></div>
        </div>
        <div class="panel"><h4>What citizens feel</h4><div data-f="factors" class="factors"></div></div>
        <div class="panel"><h4>Population <span data-f="popTrend"></span></h4><canvas class="chart" data-chart="pop"></canvas></div>
        <div class="panel"><h4>Next milestone <span data-f="nextName"></span></h4><div data-f="nextText" style="font-size:12.5px;color:var(--muted)"></div><div class="progress"><i data-f="nextBar"></i></div></div>
      </div>
      <div class="pane cols hidden" data-pane="budget">
        <div class="panel"><h4>Tax rates</h4>
          ${['r', 'c', 'i'].map((k) => `<div class="slider-row"><span>${zoneName[k]}</span><input type="range" min="0" max="20" step="1" data-tax="${k}"><b data-taxv="${k}"></b></div>`).join('')}
          <div class="note">Higher taxes slow growth and hurt happiness. Wealthier (high land value) residents pay more.</div>
        </div>
        <div class="panel"><h4>Department funding</h4>
          ${Object.entries(DEPTS).map(([k, n]) => `<div class="slider-row"><span>${n}</span><input type="range" min="50" max="150" step="10" data-dept="${k}"><b data-deptv="${k}"></b></div>`).join('')}
          <div class="note">Funding scales coverage radius, effectiveness and upkeep.</div>
        </div>
        <div class="panel"><h4>Last month</h4><div data-f="ledger"></div></div>
        <div class="panel"><h4>Loans</h4><div data-f="loans"></div>
          <div class="btn-row" style="margin-top:8px"><button class="btn sm" data-loan="25000">Borrow $25k</button><button class="btn sm" data-loan="75000">Borrow $75k</button></div>
          <div class="note">10-year term at 5.5% APR.</div></div>
        <div class="panel"><h4>Treasury</h4><canvas class="chart" data-chart="funds"></canvas></div>
      </div>
      <div class="pane hidden" data-pane="policy">
        <div class="note" style="padding:0 2px">Ordinances shape your city. Costs are monthly and scale with population.</div>
        ${Object.entries(POLICIES).map(([k, p]) => `<button class="policy" data-pol="${k}"><div><b>${p.name}</b><span>${p.desc}</span></div><div class="pol-r"><em data-polcost="${k}"></em><i class="sw"></i></div></button>`).join('')}
      </div>
      <div class="pane hidden" data-pane="goals">
        <div class="panel"><h4>Active petitions <span data-f="petCount"></span></h4><div data-f="petitions"></div></div>
        <div class="panel"><h4>Achievements <span data-f="achCount"></span></h4><div data-f="achievements" class="ach-grid"></div></div>
      </div>
      <div class="pane hidden" data-pane="feed">
        <div class="panel brief"><h4>Advisor briefing <span class="ai-badge" data-f="aiModel"></span></h4><div data-f="brief" class="brief-body">Ask your chief advisor for a read on the city.</div>
          <div class="btn-row" style="margin-top:8px"><button class="btn sm primary" data-brief>${icon('spark', 'style="width:14px;height:14px;display:inline;vertical-align:-2px"')} Ask advisor</button></div></div>
        <div data-f="advice" style="display:flex;flex-direction:column;gap:8px"></div>
        <div class="panel"><h4>City feed</h4><div data-f="feed" class="feed"></div></div>
      </div>
      <div class="pane hidden" data-pane="map">
        <div class="minimap-wrap"><canvas width="256" height="256" data-minimap></canvas></div>
        <div class="panel"><h4>Layer</h4><div class="chips">${OVERLAYS.map((o) => `<button class="chip" data-ov="${o.id}">${o.label}</button>`).join('')}</div></div>
        <div class="panel"><h4>Camera &amp; time</h4>
          <div class="btn-row" style="margin-bottom:10px">
            <button class="btn sm" data-cam="rotl">${icon('rotl', 'style="width:16px;height:16px;display:inline"')}</button>
            <button class="btn sm" data-cam="rotr">${icon('rotr', 'style="width:16px;height:16px;display:inline"')}</button>
            <button class="btn sm" data-cam="home">Recenter</button>
            <button class="btn sm" data-cam="top">Overview</button>
          </div>
          <div class="seg" data-tod>${['auto', 'dawn', 'noon', 'dusk', 'night'].map((t) => `<button data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
        </div>
      </div>`;
    this.deskEl = d;
    d.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.g.audio.click(); this.tab = b.dataset.tab; if (this.tab === 'feed') this.feedSeen = this.g.world.news.length; this.renderDesk(true); }));
    d.querySelectorAll('[data-tax]').forEach((inp) => (inp.oninput = () => { this.g.world.tax[inp.dataset.tax] = +inp.value; this.g.sim.computeDemand(); this.renderDesk(true); }));
    d.querySelectorAll('[data-dept]').forEach((inp) => (inp.oninput = () => { this.g.world.budget[inp.dataset.dept] = +inp.value; this.g.sim.fieldsDirty = true; this.renderDesk(true); }));
    d.querySelectorAll('[data-pol]').forEach((b) => (b.onclick = () => { const id = b.dataset.pol, on = !this.g.world.policies.includes(id); this.g.sim.setPolicy(id, on); this.g.audio.select(); this.toast(`${POLICIES[id].name} ${on ? 'enacted' : 'repealed'}`); this.renderDesk(true); }));
    d.querySelectorAll('[data-loan]').forEach((b) => (b.onclick = () => { const r = this.g.sim.takeLoan(+b.dataset.loan); if (r.ok) { this.g.audio.cash(); this.toast(`Loan approved · $${r.payment.toLocaleString()}/mo for 10 years`); } else { this.g.audio.error(); this.toast(r.msg, 'bad'); } this.renderDesk(true); this.updateHUD(); }));
    d.querySelector('[data-brief]').onclick = () => this.askAdvisor();
    d.querySelectorAll('[data-ov]').forEach((b) => (b.onclick = () => { this.g.audio.click(); this.g.setOverlay(b.dataset.ov); }));
    d.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => { this.g.audio.click(); this.g.cameraAction(b.dataset.cam); }));
    d.querySelectorAll('[data-tod] button').forEach((b) => (b.onclick = () => { this.g.audio.click(); this.g.setTimeMode(b.dataset.t); this.renderDesk(true); }));
    const mm = d.querySelector('[data-minimap]');
    const nav = (e) => {
      const r = mm.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MAP - MAP / 2, z = ((e.clientY - r.top) / r.height) * MAP - MAP / 2;
      this.g.rig.flyTo(x, z);
    };
    mm.addEventListener('pointerdown', (e) => { mm.setPointerCapture(e.pointerId); nav(e); });
    mm.addEventListener('pointermove', (e) => { if (e.buttons) nav(e); });
    this.mmCanvas = mm;
  }

  async askAdvisor() {
    const { world: w, sim } = this.g, s = sim.stats, el = this.deskEl.querySelector('[data-f="brief"]');
    this.g.audio.select();
    el.innerHTML = '<span class="thinking">Thinking…</span>';
    const r = await AI.brief({ city: w.name, pop: s.pop, happiness: s.happiness, approval: Math.round(w.approval), unemployment: Math.round(s.unemployment * 100), commute: s.avgCommute, congestion: s.congestion, net: (s.income || 0) - (s.expense || 0), funds: Math.round(w.funds), pollution: Math.round(s.avgPollution), crime: Math.round(s.avgCrime), education: s.education, garbage: Math.round(s.avgGarbage), advice: sim.advice.map((a) => a.text) });
    el.innerHTML = `<p>${r.summary}</p>${r.priorities.length ? `<ol>${r.priorities.map((p) => `<li>${p}</li>`).join('')}</ol>` : ''}${r.ai ? '<span class="ai">✦ Generated on-device</span>' : ''}`;
  }

  deskVisible() { return !document.body.classList.contains('posture-folded') || this.deskOpen; }

  renderDesk(force = false) {
    const d = this.deskEl, { world: w, sim } = this.g, s = sim.stats;
    const f = (k) => d.querySelector(`[data-f="${k}"]`);
    const setH = (k, html) => { const e = f(k); if (e && e.innerHTML !== html) e.innerHTML = html; };
    d.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    d.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== this.tab));
    d.querySelector('[data-dot="goals"]').classList.toggle('hidden', !w.petitions.offer);
    d.querySelector('[data-dot="feed"]').classList.toggle('hidden', this.tab === 'feed' || w.news.length <= this.feedSeen);
    f('name').textContent = w.name;
    f('rank').textContent = sim.milestone().name;
    f('date').textContent = w.dateString();
    const cls = (bad, warn) => (bad ? 'no' : warn ? 'meh' : '');
    if (this.tab === 'overview') {
      const net = (s.income || 0) - (s.expense || 0), ap = Math.round(w.approval);
      setH('pop', fmt(s.pop)); setH('jobs', fmt(s.jobs)); setH('happy', s.happiness + '%');
      setH('appr', `<span class="${cls(ap < 35, ap < 55)}">${ap}%</span>`);
      setH('approvalTxt', ap >= 75 ? 'Beloved mayor' : ap >= 55 ? 'Solid support' : ap >= 35 ? 'Grumbling' : 'Recall rumours');
      setH('unemp', `<span class="${cls(s.unemployment > 0.12, s.unemployment > 0.06)}">${Math.round(s.unemployment * 100)}%</span>`);
      setH('edu', s.education + '%');
      setH('funds', money(w.funds));
      setH('net', `<span class="${net >= 0 ? 'ok' : 'no'}">${net >= 0 ? '+' : '−'}$${short(Math.abs(net))}</span>`);
      setH('power', `<span class="${cls(s.powerDemand > s.powerSupply)}">${s.powerDemand}/${s.powerSupply}</span>`);
      setH('commute', `<span class="${cls(s.avgCommute > 30, s.avgCommute > 20)}">${s.avgCommute}m</span>`);
      setH('cong', `<span class="${cls(s.congestion > 100, s.congestion > 70)}">${s.congestion}%</span>`);
      setH('health', `<span class="${cls(s.health < 35, s.health < 50)}">${s.health}%</span>`);
      for (const k of ['r', 'c', 'i']) {
        const v = sim.demand[k], el = d.querySelector(`[data-d="${k}"]`);
        el.style.left = v >= 0 ? '50%' : 50 + v * 50 + '%';
        el.style.width = Math.abs(v) * 50 + '%';
        d.querySelector(`[data-dv="${k}"]`).textContent = (v > 0 ? '+' : '') + Math.round(v * 100);
      }
      setH('workforce', `<div><span>Low-skill</span><b>${fmt(s.lowWorkers)}</b> workers · <b>${fmt(s.lowJobs)}</b> jobs</div><div><span>Skilled</span><b>${fmt(s.highWorkers)}</b> workers · <b>${fmt(s.highJobs)}</b> jobs${s.highVac > 0.3 ? ' <em class="no">short of grads</em>' : ''}</div>${s.unreachable ? `<div class="no">${fmt(s.unreachable)} can’t reach any job</div>` : ''}`);
      setH('factors', s.factors.length ? s.factors.slice(0, 7).map(([lab, v]) => `<div class="fac"><span>${lab}</span><i class="${v >= 0 ? 'pos' : 'neg'}" style="width:${Math.min(50, Math.abs(v) * 2.5)}%"></i><b class="${v >= 0 ? 'ok' : 'no'}">${v > 0 ? '+' : ''}${v}</b></div>`).join('') : '<div class="note">Appears once people move in.</div>');
      this.chart(d.querySelector('[data-chart="pop"]'), w.history.map((x) => x.pop), '#4fd1ff');
      const hist = w.history, prev = hist.length > 12 ? hist[hist.length - 13].pop : 0;
      f('popTrend').textContent = hist.length > 12 ? `${s.pop >= prev ? '▲' : '▼'} ${fmt(Math.abs(s.pop - prev))} / yr` : '';
      const nm = sim.nextMilestone(), cur = sim.milestone();
      if (nm) {
        f('nextName').textContent = nm.name;
        const unlocks = Object.values(SERVICES).filter((x) => x.unlock === nm.pop).map((x) => x.name);
        f('nextText').textContent = `Reach ${fmt(nm.pop)} residents${unlocks.length ? ' to unlock ' + unlocks.join(', ') : ''}.`;
        f('nextBar').style.width = clamp(((w.peakPop - cur.pop) / (nm.pop - cur.pop)) * 100, 0, 100) + '%';
      } else { f('nextName').textContent = 'Max'; f('nextText').textContent = 'Your city has reached legendary status.'; f('nextBar').style.width = '100%'; }
    } else if (this.tab === 'budget') {
      for (const k of ['r', 'c', 'i']) {
        const inp = d.querySelector(`[data-tax="${k}"]`);
        if (force || document.activeElement !== inp) inp.value = w.tax[k];
        d.querySelector(`[data-taxv="${k}"]`).textContent = w.tax[k] + '%';
      }
      for (const k in DEPTS) {
        const inp = d.querySelector(`[data-dept="${k}"]`);
        if (force || document.activeElement !== inp) inp.value = w.budget[k];
        d.querySelector(`[data-deptv="${k}"]`).textContent = w.budget[k] + '%';
      }
      const b = s.breakdown || { incR: 0, incC: 0, incI: 0, fares: 0, tourism: 0, roads: 0, svc: {}, policies: 0, loans: 0 };
      const rows = [['Residential tax', b.incR], ['Commercial tax', b.incC], ['Industrial tax', b.incI], ['Transit fares', b.fares], ['Tourism', b.tourism], ['Road upkeep', -b.roads]];
      for (const id in b.svc) rows.push([SERVICES[id].name, -Math.round(b.svc[id])]);
      if (b.policies) rows.push(['Policies', -b.policies]);
      if (b.loans) rows.push(['Loan payments', -b.loans]);
      const net = (s.income || 0) - (s.expense || 0);
      setH('ledger', rows.filter(([, v]) => v).map(([a, v]) => `<div class="ledger"><span>${a}</span><span class="${v < 0 ? 'no' : 'ok'}">${money(v)}</span></div>`).join('') + `<div class="ledger total"><span>Net</span><span class="${net < 0 ? 'no' : 'ok'}">${money(net)}</span></div>`);
      setH('loans', w.loans.length ? w.loans.map((L, k) => `<div class="ledger"><span>$${fmt(L.amount)} · ${L.left} mo left</span><span>$${fmt(L.payment)}/mo <button class="btn sm" data-repay="${k}">Repay</button></span></div>`).join('') : '<div class="note">No outstanding debt.</div>');
      d.querySelectorAll('[data-repay]').forEach((bt) => (bt.onclick = () => { const r = sim.repayLoan(+bt.dataset.repay); if (r.ok) this.toast(`Loan repaid · $${fmt(r.balance)}`); else this.toast(r.msg, 'bad'); this.renderDesk(true); }));
      this.chart(d.querySelector('[data-chart="funds"]'), w.history.map((x) => x.funds), '#4ee39a');
    } else if (this.tab === 'policy') {
      d.querySelectorAll('[data-pol]').forEach((b) => {
        const id = b.dataset.pol, p = POLICIES[id];
        b.classList.toggle('on', w.policies.includes(id));
        const c = Math.round(p.flat + p.perCap * s.pop);
        d.querySelector(`[data-polcost="${id}"]`).textContent = c ? `$${fmt(c)}/mo` : 'Free';
      });
    } else if (this.tab === 'goals') {
      const P = w.petitions;
      f('petCount').textContent = `${P.active.length}/3`;
      const offer = P.offer ? `<div class="petition-card offer"><div class="pc-h"><b>New: ${P.offer.goal}</b><span>${P.offer.district}</span></div><p>${P.offer.text}</p><div class="btn-row"><button class="btn sm primary" data-pet="yes">Accept</button><button class="btn sm" data-pet="no">Decline</button></div></div>` : '';
      const act = P.active.map((p, k) => {
        const mLeft = Math.max(0, Math.ceil((p.deadline - w.day) / 30));
        return `<div class="petition-card"><div class="pc-h"><b>${p.goal}</b><span>${p.district}</span></div><div class="pc-p">${sim.events.progress(p)}</div><div class="pc-f"><span class="${mLeft <= 1 ? 'no' : ''}">${mLeft} mo left</span><span>+${p.reward.appr} approval${p.reward.cash ? ` · $${fmt(p.reward.cash)}` : ''}</span><button class="btn sm" data-petgo="${k}">Show</button></div></div>`;
      }).join('');
      setH('petitions', offer + (act || (offer ? '' : '<div class="note">No active petitions. Citizens will bring requests as the city grows.</div>')));
      d.querySelector('[data-pet=yes]')?.addEventListener('click', () => { sim.events.accept(); this.showPetition(null); this.renderDesk(true); });
      d.querySelector('[data-pet=no]')?.addEventListener('click', () => { sim.events.decline(); this.showPetition(null); this.renderDesk(true); });
      d.querySelectorAll('[data-petgo]').forEach((bt) => (bt.onclick = () => { const p = P.active[+bt.dataset.petgo]; if (p) this.g.focusTile(p.x, p.z); }));
      f('achCount').textContent = `${w.achievements.length}/${ACHIEVEMENTS.length}`;
      setH('achievements', ACHIEVEMENTS.map((a) => { const got = w.achievements.includes(a.id); return `<div class="ach ${got ? 'got' : ''}">${icon('trophy')}<div><b>${a.name}</b><span>${a.desc}</span></div></div>`; }).join(''));
    } else if (this.tab === 'feed') {
      this.feedSeen = w.news.length;
      setH('aiModel', AI.info.available ? '✦ ' + AI.info.model : 'Procedural');
      const col = { bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--accent)', good: 'var(--good)' };
      setH('advice', sim.advice.slice(0, 5).map((a) => `<div class="advice"><div class="lv" style="background:${col[a.lvl]}"></div><div><div class="who">${a.who}</div><p>${a.text}</p></div></div>`).join(''));
      setH('feed', w.news.length ? w.news.slice().reverse().slice(0, 30).map((n) => n.kind === 'chirp'
        ? `<div class="post chirp"><div class="ph"><b>${n.who}</b><span>${n.date}</span></div><p>${n.body}</p>${n.ai ? '<span class="ai">✦</span>' : ''}</div>`
        : `<div class="post ${n.kind}"><div class="ph"><b>${n.title}</b><span>${n.date}</span></div><p>${n.body}</p>${n.ai ? '<span class="ai">✦</span>' : ''}</div>`).join('') : '<div class="note">News arrives monthly.</div>');
    } else if (this.tab === 'map') {
      this.drawMinimap();
      d.querySelectorAll('[data-tod] button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.g.timeMode));
    }
  }

  chart(cv, data, color) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    if (!r.width) return;
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    if (data.length < 2) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.font = `${12 * dpr}px system-ui`; c.fillText('Data appears after the first month', 8 * dpr, H / 2); return; }
    const pts = data.slice(-120), mn = Math.min(0, ...pts), mx = Math.max(1, ...pts);
    const X = (k) => (k / (pts.length - 1)) * (W - 4 * dpr) + 2 * dpr, Y = (v) => H - 6 * dpr - ((v - mn) / (mx - mn)) * (H - 14 * dpr);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
    c.beginPath(); c.moveTo(X(0), H); pts.forEach((v, k) => c.lineTo(X(k), Y(v))); c.lineTo(X(pts.length - 1), H); c.fillStyle = g; c.fill();
    c.beginPath(); pts.forEach((v, k) => (k ? c.lineTo(X(k), Y(v)) : c.moveTo(X(k), Y(v)))); c.strokeStyle = color; c.lineWidth = 2 * dpr; c.lineJoin = 'round'; c.stroke();
  }

  drawMinimap() {
    const cv = this.mmCanvas, c = cv.getContext('2d'), w = this.g.world, s = cv.width / MAP;
    const ov = this.g.view.overlay;
    const img = c.createImageData(MAP, MAP);
    const col = (i) => {
      if (w.terrain[i]) return [30, 96, 120];
      const k = w.kind[i], L = w.level[i];
      if (ov !== 'none') {
        if (ov === 'lv') { const v = w.lv[i] / 100; return [255 * (1 - v) + 40 * v, 80 + 175 * v, 60]; }
        if (ov === 'pollution') { const v = clamp(w.pollution[i] / 60, 0, 1); return [90 + 80 * v, 140 - 50 * v, 70 - 30 * v]; }
        if (ov === 'crime') { const v = clamp(w.crime[i] / 50, 0, 1); return [90 + 160 * v, 120 - 80 * v, 90]; }
        if (ov === 'power' && k !== K.EMPTY && k !== K.ROAD) return w.power[i] ? [60, 220, 120] : [240, 60, 60];
        if (ov === 'water') return w.water[i] ? [60, 150, 240] : [70, 110, 70];
        if (ov === 'traffic' && k === K.ROAD) { const v = clamp(w.traffic[i] / 130, 0, 1); return [60 + 195 * Math.min(1, v * 2), 220 - 180 * Math.max(0, v * 2 - 1), 70]; }
        if (ov === 'happy' && k === K.RES && L) { const v = w.happy[i] / 100; return [255 * (1 - v), 70 + 185 * v, 90]; }
        if (ov === 'edu') { const v = w.cov.edu[i] / 255; return [70 + 50 * v, 110 + 40 * v, 80 + 175 * v]; }
        if (ov === 'garbage') { const v = clamp(w.garbage[i] / 70, 0, 1); return [100 + 80 * v, 150 - 50 * v, 70]; }
      }
      if (w.flags[i] & 4) return [60, 50, 45];
      if (w.flags[i] & 2) return [255, 120, 30];
      if (k === K.ROAD) return [70, 74, 82];
      if (k === K.RES) return L ? [95 - L * 10, 208 - L * 20, 104 - L * 10] : [150, 210, 150];
      if (k === K.COM) return L ? [74 - L * 8, 168 - L * 15, 255 - L * 20] : [150, 190, 240];
      if (k === K.IND) return L ? [255 - L * 15, 197 - L * 20, 71] : [240, 220, 150];
      if (k === K.SERVICE) return [235, 235, 245];
      return w.tree[i] ? [62, 120, 60] : [104, 160, 76];
    };
    for (let i = 0; i < N; i++) { const [r, g, b] = col(i); img.data.set([r, g, b, 255], i * 4); }
    if (!this._mmTmp) { this._mmTmp = document.createElement('canvas'); this._mmTmp.width = this._mmTmp.height = MAP; }
    this._mmTmp.getContext('2d').putImageData(img, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(this._mmTmp, 0, 0, cv.width, cv.height);
    // camera footprint
    const rig = this.g.rig, cx = (rig.target.x + MAP / 2) * s, cz = (rig.target.z + MAP / 2) * s, rr = rig.dist * 0.45 * s;
    c.save(); c.translate(cx, cz); c.rotate(-rig.yaw);
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2; c.strokeRect(-rr, -rr * 0.7, rr * 2, rr * 1.4);
    c.restore();
  }

  toggleSheet(force) {
    const open = force ?? !this.deskOpen;
    this.deskOpen = open;
    $('#sheet').classList.toggle('hidden', !open);
    $('#fab-desk').classList.toggle('on', open);
    if (open) this.renderDesk(true);
  }

  // place desk according to posture
  mountDesk(posture) {
    if (posture === 'folded') { $('#sheet-body').appendChild(this.deskEl); }
    else { $('#desk-dock').appendChild(this.deskEl); this.toggleSheet(false); }
    requestAnimationFrame(() => this.renderDesk(true));
  }

  // ---------------------------------------------------------- modals
  modal(html) { $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); return $('#modal-card'); }
  closeModal() { $('#modal').classList.add('hidden'); }

  openMenu() {
    const c = this.modal(`<h2>${this.g.world.name}</h2><p>${this.g.world.dateString()} · ${this.g.sim.milestone().name}</p>
      <div class="menu-list">
        <button class="btn" data-a="resume">${icon('play')}Resume</button>
        <button class="btn" data-a="save">${icon('save')}Save city</button>
        <button class="btn" data-a="new">${icon('plus')}New city</button>
        <button class="btn" data-a="settings">${icon('gear')}Settings</button>
        <button class="btn" data-a="help">${icon('help')}How to play</button>
      </div>`);
    c.querySelector('[data-a=resume]').onclick = () => this.closeModal();
    c.querySelector('[data-a=save]').onclick = () => { this.g.save(true); this.closeModal(); };
    c.querySelector('[data-a=new]').onclick = () => this.openNewCity();
    c.querySelector('[data-a=settings]').onclick = () => this.openSettings();
    c.querySelector('[data-a=help]').onclick = () => this.openHelp();
  }

  openNewCity(fromTitle = false) {
    const names = ['New Harbor', 'Port Aurelia', 'Cedar Bay', 'Lumen Isle', 'Saltmarsh', 'Brightwater', 'Kestrel Point', 'Juniper Cove'];
    const c = this.modal(`<h2>Found a new city</h2><p>Every seed grows a different island.</p>
      <div class="field"><label>City name</label><input type="text" maxlength="24" value="${names[(Math.random() * names.length) | 0]}" data-name></div>
      <div class="field"><label>Island seed</label><input type="text" value="${(Math.random() * 1e6) | 0}" data-seed inputmode="numeric"></div>
      <div class="btn-row"><button class="btn primary" data-go style="flex:1">Found city</button><button class="btn" data-cancel>Cancel</button></div>
      ${fromTitle ? '' : '<p style="margin-top:12px;font-size:12px">Your current city will be replaced. Save it first if you want to keep it.</p>'}`);
    c.querySelector('[data-go]').onclick = () => {
      const name = c.querySelector('[data-name]').value.trim() || 'New Harbor';
      const seed = parseInt(c.querySelector('[data-seed]').value, 10) || (Math.random() * 1e6) | 0;
      this.closeModal();
      this.g.newCity(name, seed);
    };
    c.querySelector('[data-cancel]').onclick = () => this.closeModal();
  }

  openSettings() {
    const st = { ...this.g.settings, disasters: this.g.world.disasters };
    const seg = (key, opts) => `<div class="seg" data-set="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const c = this.modal(`<h2>Settings</h2><p>Tuned for foldable displays. Changes apply instantly.</p>
      <div class="field"><label>Graphics quality</label>${seg('quality', [['battery', 'Battery'], ['balanced', 'Balanced'], ['ultra', 'Ultra']])}</div>
      <div class="field"><label>Frame rate</label>${seg('fps', [[30, '30'], [60, '60'], [0, 'ProMotion']])}</div>
      <div class="field"><label>Layout</label>${seg('posture', [['auto', 'Auto'], ['folded', 'Folded'], ['unfolded', 'Unfolded'], ['book', 'Book'], ['tabletop', 'Tabletop']])}</div>
      <div class="field"><label>Sound</label>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
      <div class="field"><label>Disasters (fires)</label>${seg('disasters', [[true, 'On'], [false, 'Off']])}</div>
      <div class="field"><label>Generative text</label><div class="note">${AI.info.available ? `✦ ${AI.info.model} — running on-device.` : 'Procedural writer. Open Skyfold in the iOS app on Apple Intelligence hardware to use Apple’s on-device Foundation Model.'}</div></div>
      <div class="btn-row"><button class="btn primary" data-close style="flex:1">Done</button></div>`);
    c.querySelectorAll('[data-set]').forEach((g) => g.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      let v = b.dataset.v; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      this.g.applySetting(g.dataset.set, v);
      g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    })));
    c.querySelector('[data-close]').onclick = () => this.closeModal();
  }

  openHelp() {
    const c = this.modal(`<h2>How to play</h2>
      <p><b style="color:var(--text)">Build</b> — pick a tool, then drag on the map to draw roads or paint zones. Tap to place buildings (tap twice to confirm on touch).</p>
      <p><b style="color:var(--text)">Grow</b> — zones develop when they're near a road and have power. Water towers let them grow denser. Land value, schools and parks unlock towers.</p>
      <p><b style="color:var(--text)">Power</b> flows from plants through roads and buildings. Keep supply above demand.</p>
      <p><b style="color:var(--text)">Traffic</b> — every household drives to the nearest job. Jams lengthen commutes and lower happiness. Upgrade busy streets to Avenues and add Bus Stops or Metro.</p>
      <p><b style="color:var(--text)">Workforce</b> — schools and a university create skilled workers for offices and hi-tech industry. Watch unemployment and vacancies on the Overview tab.</p>
      <p><b style="color:var(--text)">Services</b> — garbage needs landfills, fires need fire stations, crime needs police. Tune department funding and ordinances in Budget and Policy.</p>
      <p><b style="color:var(--text)">Goals</b> — citizens petition you for changes. Deliver them to raise your approval rating.</p>
      <p><b style="color:var(--text)">Camera</b> — one finger pans (or draws with a build tool), pinch zooms, twist rotates. Mouse: right-drag to orbit, wheel to zoom, WASD/QE.</p>
      <p><b style="color:var(--text)">Unfold</b> your phone to open the Mayor's Desk beside the city: live stats, budget, minimap and advisors. Half-fold it into tabletop mode for a laptop-style layout.</p>
      <div class="btn-row"><button class="btn primary" data-close style="flex:1">Got it</button></div>`);
    c.querySelector('[data-close]').onclick = () => this.closeModal();
  }
}

function shortLabel(l) {
  return { 'Residential': 'Homes', 'Commercial': 'Shops', 'Industrial': 'Industry', 'Wind Turbine': 'Wind', 'Gas Power Plant': 'Gas Plant', 'Water Tower': 'Water', 'Police Station': 'Police', 'Fire Station': 'Fire', 'Solar Farm': 'Solar' }[l] || l;
}
