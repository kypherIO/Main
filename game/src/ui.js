// HUD, tool palette, Mayor's Desk, inspect card, menus.
import { MAP, N, K, TOOLS, SERVICES, ZONE_INFO, OVERLAYS, svcId, clamp } from './config.js';

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
    const colors = { none: '#9aabc9', power: '#4ee39a', water: '#4aa8ff', lv: '#ffd23d', pollution: '#b07a3a', crime: '#ff4d7a' };
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

  toast(text, kind = '') {
    const box = $('#toasts');
    const t = h('div', { class: `toast glass ${kind}` }, text);
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, kind === 'milestone' ? 4200 : 2600);
  }

  // ---------------------------------------------------------- inspect
  showInspect(i) {
    const { world: w, sim } = this.g, el = $('#inspect');
    if (i == null || i < 0) { el.classList.add('hidden'); return; }
    const k = w.kind[i], L = w.level[i];
    let title = 'Open land', sub = w.terrain[i] ? 'Water' : (w.tree[i] ? 'Woodland' : 'Grassland'), color = '#6aa548', ic = 'park';
    const rows = [];
    const yes = (b) => b ? '<b class="ok">Yes</b>' : '<b class="no">No</b>';
    const meter = (v, c) => `<div class="meter"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div>`;
    if (k === K.ROAD) { title = 'Road'; sub = 'Upkeep $0.5/mo'; color = '#9aa3ad'; ic = 'road'; }
    else if (k === K.RES || k === K.COM || k === K.IND) {
      const zi = ZONE_INFO[k];
      title = zi.name; color = zi.color; ic = zi.key;
      sub = L ? ['', 'Low density', 'Medium density', 'High density'][L] : 'Zoned · awaiting development';
      if (k === K.RES) rows.push(['Residents', `<b>${zi.pop[L]}</b>`]); else rows.push(['Jobs', `<b>${zi.jobs[L]}</b>`]);
      rows.push(['Power', yes(w.power[i])], ['Water', yes(w.water[i])]);
      if (k === K.RES && L) rows.push(['Happy', `<b>${Math.round(sim.tileHappiness(i))}%</b>`]);
      rows.push(['Road', w.roadDist[i] <= 3 ? '<b class="ok">Near</b>' : '<b class="no">Far</b>']);
      const mx = sim.maxLevel(i);
      if (L < 3) rows.push(['Can reach', `<b class="${mx > L ? 'ok' : 'meh'}">L${mx}</b>`]);
    } else if (k === K.SERVICE) {
      const r = w.root[i], id = svcId(w.svc[r]), s = SERVICES[id];
      title = s.name; sub = s.desc; color = '#4fd1ff'; ic = id;
      rows.push(['Upkeep', `<b>$${s.upkeep}</b>`]);
      if (s.power) rows.push(['Output', `<b>${s.power} MW</b>`]);
      if (s.radius) rows.push(['Radius', `<b>${s.radius}</b>`]);
      rows.push(['Powered', yes(w.power[r])]);
    }
    const stats = rows.map(([a, b]) => `<div class="insp-stat"><span>${a}</span>${b}</div>`).join('');
    const fields = w.terrain[i] ? '' : `
      <div class="insp-stat"><span>Land value</span><b>${w.lv[i]}</b>${meter(w.lv[i], '#ffd23d')}</div>
      <div class="insp-stat"><span>Pollution</span><b>${w.pollution[i]}</b>${meter(w.pollution[i] * 1.5, '#c08a4a')}</div>
      <div class="insp-stat"><span>Crime</span><b>${w.crime[i]}</b>${meter(w.crime[i] * 2, '#ff4d7a')}</div>`;
    el.innerHTML = `<div class="insp-h"><div class="sw" style="background:${color}">${icon(ic)}</div><div><h3>${title}</h3><p>${sub}</p></div><button class="x" aria-label="Close">${icon('x')}</button></div>
      <div class="insp-grid">${stats}${fields}</div>`;
    el.querySelector('.x').onclick = () => { this.g.audio.click(); el.classList.add('hidden'); this.g.view.setCursor(0, 0, 1, true, false); };
    el.classList.remove('hidden');
  }

  // ---------------------------------------------------------- desk
  buildDesk() {
    const d = h('div', { class: 'desk' });
    d.innerHTML = `
      <div class="desk-head"><h2 data-f="name"></h2><span class="rank" data-f="rank"></span><span class="date" data-f="date"></span></div>
      <div class="tabs">${['overview', 'budget', 'map', 'advisors'].map((t) => `<button data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
      <div class="pane cols" data-pane="overview">
        <div class="panel"><h4>City</h4><div class="kgrid">
          <div class="kcell"><span>Population</span><b data-f="pop"></b></div>
          <div class="kcell"><span>Jobs</span><b data-f="jobs"></b></div>
          <div class="kcell"><span>Happiness</span><b data-f="happy"></b></div>
          <div class="kcell"><span>Treasury</span><b data-f="funds"></b></div>
          <div class="kcell"><span>Net / mo</span><b data-f="net"></b></div>
          <div class="kcell"><span>Power MW</span><b data-f="power"></b></div>
        </div></div>
        <div class="panel"><h4>Demand</h4>
          ${['r', 'c', 'i'].map((k) => `<div class="demand-row"><span>${{ r: 'Residential', c: 'Commercial', i: 'Industrial' }[k]}</span><div class="demand-track"><i data-d="${k}" style="background:var(--${k})"></i></div><b data-dv="${k}"></b></div>`).join('')}
        </div>
        <div class="panel"><h4>Population <span data-f="popTrend"></span></h4><canvas class="chart" data-chart="pop"></canvas></div>
        <div class="panel"><h4>Next milestone <span data-f="nextName"></span></h4><div data-f="nextText" style="font-size:12.5px;color:var(--muted)"></div><div class="progress"><i data-f="nextBar"></i></div></div>
      </div>
      <div class="pane cols hidden" data-pane="budget">
        <div class="panel"><h4>Tax rates</h4>
          ${['r', 'c', 'i'].map((k) => `<div class="slider-row"><span>${{ r: 'Residential', c: 'Commercial', i: 'Industrial' }[k]}</span><input type="range" min="0" max="20" step="1" data-tax="${k}"><b data-taxv="${k}"></b></div>`).join('')}
          <div style="font-size:12px;color:var(--muted)">Higher taxes slow growth and hurt happiness.</div>
        </div>
        <div class="panel"><h4>Last month</h4><div data-f="ledger"></div></div>
        <div class="panel"><h4>Treasury</h4><canvas class="chart" data-chart="funds"></canvas></div>
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
      </div>
      <div class="pane hidden" data-pane="advisors"><div data-f="advice" style="display:flex;flex-direction:column;gap:8px"></div></div>`;
    this.deskEl = d;
    d.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { this.g.audio.click(); this.tab = b.dataset.tab; this.renderDesk(true); }));
    d.querySelectorAll('[data-tax]').forEach((inp) => (inp.oninput = () => { this.g.world.tax[inp.dataset.tax] = +inp.value; this.g.sim.computeDemand(); this.renderDesk(true); }));
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

  deskVisible() { return !document.body.classList.contains('posture-folded') || this.deskOpen; }

  renderDesk(force = false) {
    const d = this.deskEl, { world: w, sim } = this.g, s = sim.stats;
    const f = (k) => d.querySelector(`[data-f="${k}"]`);
    d.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    d.querySelectorAll('[data-pane]').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== this.tab));
    f('name').textContent = w.name;
    f('rank').textContent = sim.milestone().name;
    f('date').textContent = w.dateString();
    if (this.tab === 'overview') {
      f('pop').textContent = fmt(s.pop); f('jobs').textContent = fmt(s.jobs); f('happy').textContent = s.happiness + '%';
      f('funds').textContent = money(w.funds);
      const net = (s.income || 0) - (s.expense || 0);
      f('net').innerHTML = `<span class="${net >= 0 ? 'ok' : 'no'}">${net >= 0 ? '+' : '−'}$${short(Math.abs(net))}</span>`;
      f('power').innerHTML = `<span class="${s.powerDemand > s.powerSupply ? 'no' : ''}">${s.powerDemand}/${s.powerSupply}</span>`;
      for (const k of ['r', 'c', 'i']) {
        const v = sim.demand[k], el = d.querySelector(`[data-d="${k}"]`);
        el.style.left = v >= 0 ? '50%' : 50 + v * 50 + '%';
        el.style.width = Math.abs(v) * 50 + '%';
        d.querySelector(`[data-dv="${k}"]`).textContent = (v > 0 ? '+' : '') + Math.round(v * 100);
      }
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
      const b = s.breakdown || { incR: 0, incC: 0, incI: 0, roads: 0, svc: {} };
      const rows = [['Residential tax', b.incR], ['Commercial tax', b.incC], ['Industrial tax', b.incI], ['Road upkeep', -b.roads]];
      for (const id in b.svc) rows.push([SERVICES[id].name, -b.svc[id]]);
      const net = (s.income || 0) - (s.expense || 0);
      f('ledger').innerHTML = rows.map(([a, v]) => `<div class="ledger"><span>${a}</span><span class="${v < 0 ? 'no' : 'ok'}">${money(v)}</span></div>`).join('') + `<div class="ledger total"><span>Net</span><span class="${net < 0 ? 'no' : 'ok'}">${money(net)}</span></div>`;
      this.chart(d.querySelector('[data-chart="funds"]'), w.history.map((x) => x.funds), '#4ee39a');
    } else if (this.tab === 'map') {
      this.drawMinimap();
      d.querySelectorAll('[data-tod] button').forEach((b) => b.classList.toggle('on', b.dataset.t === this.g.timeMode));
    } else if (this.tab === 'advisors') {
      const col = { bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--accent)', good: 'var(--good)' };
      const html = sim.advice.map((a) => `<div class="advice"><div class="lv" style="background:${col[a.lvl]}"></div><div><div class="who">${a.who}</div><p>${a.text}</p></div></div>`).join('');
      if (f('advice').innerHTML !== html) f('advice').innerHTML = html;
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
      }
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
    const st = this.g.settings;
    const seg = (key, opts) => `<div class="seg" data-set="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(st[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const c = this.modal(`<h2>Settings</h2><p>Tuned for foldable displays. Changes apply instantly.</p>
      <div class="field"><label>Graphics quality</label>${seg('quality', [['battery', 'Battery'], ['balanced', 'Balanced'], ['ultra', 'Ultra']])}</div>
      <div class="field"><label>Frame rate</label>${seg('fps', [[30, '30'], [60, '60'], [0, 'ProMotion']])}</div>
      <div class="field"><label>Layout</label>${seg('posture', [['auto', 'Auto'], ['folded', 'Folded'], ['unfolded', 'Unfolded'], ['book', 'Book'], ['tabletop', 'Tabletop']])}</div>
      <div class="field"><label>Sound</label>${seg('sound', [[true, 'On'], [false, 'Off']])}</div>
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
      <p><b style="color:var(--text)">Camera</b> — one finger pans (or draws with a build tool), pinch zooms, twist rotates. Mouse: right-drag to orbit, wheel to zoom, WASD/QE.</p>
      <p><b style="color:var(--text)">Unfold</b> your phone to open the Mayor's Desk beside the city: live stats, budget, minimap and advisors. Half-fold it into tabletop mode for a laptop-style layout.</p>
      <div class="btn-row"><button class="btn primary" data-close style="flex:1">Got it</button></div>`);
    c.querySelector('[data-close]').onclick = () => this.closeModal();
  }
}

function shortLabel(l) {
  return { 'Residential': 'Homes', 'Commercial': 'Shops', 'Industrial': 'Industry', 'Wind Turbine': 'Wind', 'Gas Power Plant': 'Gas Plant', 'Water Tower': 'Water', 'Police Station': 'Police', 'Fire Station': 'Fire', 'Solar Farm': 'Solar' }[l] || l;
}
