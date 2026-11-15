// Skyfold — entry point and game controller.
import { MAP, N, K, TOOLS, SERVICES, SPEEDS, SIM_DAY_SECONDS, COST, ZONES, clamp } from './config.js';
import { World } from './world.js';
import { Sim } from './sim.js';
import { Renderer3D, QUALITY } from './render/renderer.js';
import { CityView } from './render/cityview.js';
import { CameraRig, Input } from './input.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { readPosture, watchPosture } from './posture.js';
import { AI } from './ai.js';

const SAVE_KEY = 'skyfold.city.v1';
const SET_KEY = 'skyfold.settings.v1';
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};
const TOD = { dawn: 0.265, noon: 0.5, dusk: 0.765, night: 0.03 };
// Native haptics in the iOS shell; vibration fallback elsewhere.
const haptic = (kind = 'light') => {
  const h = window.webkit?.messageHandlers?.skyfoldHaptics;
  if (h) h.postMessage(kind); else navigator.vibrate?.(kind === 'heavy' ? 20 : 8);
};

class Game {
  constructor() {
    this.settings = Object.assign({ quality: 'balanced', fps: 0, posture: 'auto', sound: true }, JSON.parse(store.get(SET_KEY) || '{}'));
    if (params.get('posture')) this.settings.posture = params.get('posture');
    if (params.get('q') && QUALITY[params.get('q')]) this.settings.quality = params.get('q');

    AI.init();
    this.r3d = new Renderer3D(document.getElementById('gl'));
    this.r3d.applyQuality(this.settings.quality);
    this.r3d.fpsCap = this.settings.fps;
    this.audio = new Audio();
    this.audio.setMuted(!this.settings.sound);

    this.playing = false;
    this.speed = 0; this.lastSpeed = 1;
    this.timeMode = params.get('tod') ? 'fixed' : 'auto';
    this.tod = params.get('tod') ? parseFloat(params.get('tod')) : 0.34;
    this.acc = 0;
    this.toolId = 'inspect';
    this.drag = null;
    this.ghostAt = null;

    const saved = store.get(SAVE_KEY);
    this.hasSave = !!saved;
    let world = null;
    if (saved) { try { world = World.deserialize(saved); } catch (e) { console.warn('save corrupt', e); } }
    if (!world) { world = new World(); world.generate(20261115, 'Skyfold Bay'); this.demo = true; }
    this.world = world;
    this.sim = this.makeSim(world);
    if (this.demo) buildDemoCity(world, this.sim);
    this.sim.refreshAll();

    this.view = new CityView(this.r3d, world);
    this.rig = new CameraRig(this.r3d.camera);
    this.input = new Input(document.getElementById('gl'), this.rig, this.inputHandlers());
    this.ui = new UI(this);
    this.ui.setSpeed(0);
    this.ui.setOverlay('none');

    this.posture = null;
    this.applyPosture();
    watchPosture(() => this.applyPosture());
    new ResizeObserver(() => this.resize()).observe(document.getElementById('view'));
    this.resize();

    document.addEventListener('visibilitychange', () => { if (document.hidden && this.playing) this.save(); });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { once: false, passive: true });

    this.titleScreen();
    this.last = performance.now();
    this.hudT = 0; this.saveT = 0; this.frameAcc = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  makeSim(world) {
    return new Sim(world, {
      onTiles: (list) => { this.view?.onTiles(list); },
      onGrow: (i, up) => this.view?.onGrow(i, up),
      onToast: (t, kind, at) => { if (!this.playing) return; this.ui?.toast(t, kind, at); if (kind === 'milestone') { this.audio.milestone(); haptic('success'); } else if (kind === 'bad' && at != null) { this.audio.error(); haptic('heavy'); } },
      onFire: (i, state) => { this.view?.onFire(i, state); },
      onPetition: (p) => { if (this.playing) { this.ui?.showPetition(p); if (p) this.audio.select(); } },
      onFeed: () => { if (this.playing && this.ui?.deskVisible()) this.ui.renderDesk(); },
      onMonth: () => {
        if (!this.playing) return;
        this.view.dirty.overlay = true;
        if (this.sim.stats.income > this.sim.stats.expense) this.audio.cash();
        this.audio.setCityLevel(this.sim.stats.pop);
        this.ui.updateHUD();
      },
    });
  }

  // -------------------------------------------------------------- screens
  titleScreen() {
    document.body.classList.add('title-mode');
    this.rig.target.set(0, 0, 0); this.rig.dist = 46; this.rig.orbit = 0.045; this.rig.yaw = 0.6;
    const box = document.getElementById('title-actions');
    box.innerHTML = '';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = `btn ${cls}`; b.textContent = label; b.onclick = () => { this.audio.unlock(); this.audio.select(); fn(); }; box.appendChild(b); };
    if (this.hasSave) btn(`Continue ${this.world.name}`, 'primary', () => this.start());
    if (this.demo) btn('Explore Skyfold Bay', this.hasSave ? '' : 'primary', () => this.start());
    btn('Found a new city', this.hasSave || this.demo ? '' : 'primary', () => this.ui.openNewCity(true));
    btn('How to play', '', () => this.ui.openHelp());
    if (params.get('play')) this.start();
  }

  start() {
    const t = document.getElementById('title');
    t.classList.add('leaving');
    setTimeout(() => t.classList.add('hidden'), 600);
    document.body.classList.remove('title-mode');
    this.playing = true;
    this.rig.orbit = 0;
    this.rig.flyTo(0, 0, this.demo ? 30 : 24);
    this.setSpeed(params.get('speed') ? +params.get('speed') : 1);
    this.ui.updateHUD();
    this.ui.mountDesk(this.posture.posture);
    this.resize();
    if (!this.demo && this.world.day < 60) this.tutorial = 0;
    this.ui.toast(`Welcome to ${this.world.name}, Mayor.`);
    if (this.world.petitions.offer) this.ui.showPetition(this.world.petitions.offer);
  }

  newCity(name, seed) {
    const w = new World();
    w.generate(seed, name);
    this.world = w;
    this.demo = false;
    this.sim = this.makeSim(w);
    this.sim.refreshAll();
    this.view.setWorld(w);
    this.tutorial = 0;
    this.ui.showPetition(null);
    this.save();
    this.hasSave = true;
    if (!this.playing) this.start(); else { this.rig.flyTo(0, 0, 24); this.ui.updateHUD(); this.ui.toast(`${name} has been founded!`, 'milestone'); }
  }

  save(manual = false) {
    if (this.demo && !manual) return;
    this.demo = false;
    const ok = store.set(SAVE_KEY, this.world.serialize());
    if (manual) this.ui.toast(ok ? 'City saved' : 'Could not save (storage unavailable)', ok ? '' : 'bad');
  }

  // -------------------------------------------------------------- settings
  applySetting(k, v) {
    this.settings[k] = v;
    store.set(SET_KEY, JSON.stringify(this.settings));
    if (k === 'quality') this.r3d.applyQuality(v);
    if (k === 'fps') this.r3d.fpsCap = v;
    if (k === 'posture') this.applyPosture();
    if (k === 'sound') this.audio.setMuted(!v);
    if (k === 'disasters') { this.world.disasters = v; delete this.settings.disasters; store.set(SET_KEY, JSON.stringify(this.settings)); }
  }

  applyPosture() {
    const p = readPosture(this.settings.posture);
    const b = document.body;
    const title = b.classList.contains('title-mode');
    b.className = `posture-${p.posture} orient-${p.w >= p.h ? 'landscape' : 'portrait'}${title ? ' title-mode' : ''}`;
    if (p.hinge) {
      b.style.setProperty('--seg1', p.hinge.first + 'px');
      b.style.setProperty('--hinge', p.hinge.size + 'px');
    }
    const changed = !this.posture || this.posture.posture !== p.posture;
    this.posture = p;
    if (changed && this.ui) this.ui.mountDesk(p.posture);
    this.resize();
  }

  resize() {
    const v = document.getElementById('view').getBoundingClientRect();
    this.r3d.resize(v.width, v.height);
  }

  setSpeed(s) {
    if (s > 0) this.lastSpeed = s;
    this.speed = s;
    this.ui.setSpeed(s);
  }

  setOverlay(id) { this.view.setOverlay(id); this.ui.setOverlay(id); }

  focusTile(x, z) {
    this.rig.flyTo(x - MAP / 2 + 0.5, z - MAP / 2 + 0.5, Math.min(this.rig.dist, 22));
    this.view.setCursor(x, z, 1, true);
  }

  setTimeMode(m) {
    this.timeMode = m;
    if (TOD[m] !== undefined) this.tod = TOD[m];
  }

  cameraAction(a) {
    const r = this.rig;
    if (a === 'rotl') r.yaw += Math.PI / 4;
    if (a === 'rotr') r.yaw -= Math.PI / 4;
    if (a === 'home') r.flyTo(0, 0, 26);
    if (a === 'top') r.flyTo(0, 0, 95);
  }

  // -------------------------------------------------------------- tools
  tool() { return TOOLS.find((t) => t.id === this.toolId); }

  selectTool(id) {
    const t = TOOLS.find((x) => x.id === id);
    if (t.service && this.world.peakPop < SERVICES[t.service].unlock) {
      this.audio.error();
      this.ui.toast(`${SERVICES[t.service].name} unlocks at ${SERVICES[t.service].unlock.toLocaleString()} residents`, 'bad');
      return;
    }
    this.audio.select();
    this.toolId = id;
    this.ui.setTool(id);
    this.ghostAt = null;
    this.view.setGhost(null);
    this.view.setPreview([], '#fff');
    this.view.setCursor(0, 0, 1, true, false);
    document.getElementById('inspect').classList.add('hidden');
    if (id !== 'inspect') this.ui.hint(null);
    const tips = { avenue: 'Drag to build avenues — or drag over streets to upgrade them', road: 'Drag to draw a street', res: 'Drag to zone homes next to roads', com: 'Drag to zone shops', ind: 'Drag to zone industry', bulldoze: 'Drag over things to demolish' };
    if (tips[id] && this.tutorial == null) this.flashHint(tips[id]);
    if (t.service) this.flashHint(`${SERVICES[t.service].name} · $${SERVICES[t.service].cost.toLocaleString()} — ${SERVICES[t.service].desc}`);
  }

  flashHint(text) {
    this.ui.hint(text);
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => { if (this.tutorial == null) this.ui.hint(null); }, 2600);
  }

  inputHandlers() {
    return {
      toolMode: () => { const t = this.tool(); return !this.playing ? 'pan' : t.drag ? 'drag' : t.service ? 'tap' : 'pan'; },
      onAnyInput: () => { if (!this.playing) this.rig.orbit = 0; document.getElementById('layers').classList.add('hidden'); },
      onDown: (tile) => { if (!tile) return; this.drag = { a: tile, b: tile }; this.updateDrag(); },
      onMove: (tile) => { if (!this.drag || !tile) return; if (tile.x !== this.drag.b.x || tile.z !== this.drag.b.z) { this.drag.b = tile; this.updateDrag(); this.audio.click(); haptic('light'); } },
      onUp: () => this.commitDrag(),
      onCancel: () => { this.drag = null; this.view.setPreview([], '#fff'); this.ui.hint(null); },
      onHover: (tile) => this.hover(tile),
      onTap: (tile) => this.tap(tile),
    };
  }

  hover(tile) {
    if (!this.playing) return;
    const t = this.tool();
    if (!tile || !tile.inside) { this.view.setCursor(0, 0, 1, true, false); this.view.setGhost(null); return; }
    if (t.service) {
      const s = SERVICES[t.service], o = Math.floor((s.size - 1) / 2), x = tile.x - o, z = tile.z - o;
      const ok = this.sim.canPlaceService(x, z, t.service).ok;
      this.view.setGhost(t.service, x, z, ok);
      this.view.setCursor(x, z, s.size, ok);
      this.ghostAt = { x, z };
    } else if (!this.drag) this.view.setCursor(tile.x, tile.z, 1, true);
  }

  tap(tile) {
    if (!this.playing || !tile) return;
    const t = this.tool();
    if (!tile.inside) return;
    if (t.id === 'inspect') {
      this.audio.click();
      this.view.setCursor(tile.x, tile.z, 1, true);
      this.ui.showInspect(this.world.idx(tile.x, tile.z));
      return;
    }
    if (t.service) {
      const s = SERVICES[t.service], o = Math.floor((s.size - 1) / 2), x = tile.x - o, z = tile.z - o;
      if (!this.ghostAt || this.ghostAt.x !== x || this.ghostAt.z !== z) {
        const chk = this.sim.canPlaceService(x, z, t.service);
        this.view.setGhost(t.service, x, z, chk.ok);
        this.view.setCursor(x, z, s.size, chk.ok);
        this.ghostAt = { x, z };
        this.audio.click();
        this.ui.hint(chk.ok ? `Tap again to build ${s.name} · $${s.cost.toLocaleString()}` : chk.msg);
        return;
      }
      const res = this.sim.placeService(x, z, t.service);
      this.feedback(res, () => this.audio.build());
      if (res.ok) { this.ghostAt = null; this.view.setGhost(null); this.view.setCursor(0, 0, 1, true, false); this.ui.hint(null); }
    }
  }

  dragTiles() {
    const { a, b } = this.drag, t = this.tool();
    const cl = (v) => clamp(v, 0, MAP - 1);
    const out = [];
    if (t.drag === 'line') {
      const dx = b.x - a.x, dz = b.z - a.z;
      const hFirst = Math.abs(dx) >= Math.abs(dz);
      const corner = hFirst ? { x: b.x, z: a.z } : { x: a.x, z: b.z };
      const seg = (p, q) => {
        const n = Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z));
        for (let k = 0; k <= n; k++) out.push([Math.round(p.x + ((q.x - p.x) * k) / (n || 1)), Math.round(p.z + ((q.z - p.z) * k) / (n || 1))]);
      };
      seg(a, corner); seg(corner, b);
      return out.filter(([x, z]) => x >= 0 && z >= 0 && x < MAP && z < MAP);
    }
    const x0 = cl(Math.min(a.x, b.x)), x1 = cl(Math.max(a.x, b.x)), z0 = cl(Math.min(a.z, b.z)), z1 = cl(Math.max(a.z, b.z));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, z]);
    out.rect = { x0, x1, z0, z1 };
    return out;
  }

  updateDrag() {
    const t = this.tool(), w = this.world, tiles = this.dragTiles();
    let count = 0;
    const colored = tiles.map(([x, z]) => {
      const i = w.idx(x, z), k = w.kind[i];
      let ok;
      if (t.id === 'road') ok = !w.terrain[i] && (k === K.EMPTY || (ZONES.includes(k) && !w.level[i]));
      else if (t.id === 'avenue') ok = !w.terrain[i] && (k === K.EMPTY || (ZONES.includes(k) && !w.level[i]) || (k === K.ROAD && !w.level[i]));
      else if (t.zone) ok = !w.terrain[i] && (k === K.EMPTY || (ZONES.includes(k) && k !== t.zone && !w.level[i]));
      else ok = k !== K.EMPTY || !!w.tree[i];
      if (ok) count++;
      const zc = { res: '#5fd068', com: '#4aa8ff', ind: '#ffc547' }[t.id];
      return [x, z, ok ? (t.id === 'bulldoze' ? '#ff8a4a' : zc || '#e8f6ff') : ((t.id === 'road' || t.id === 'avenue') && k === K.ROAD ? '#9fb3c8' : '#ff4d5a')];
    });
    this.view.setPreview(colored);
    this.view.setCursor(this.drag.b.x, this.drag.b.z, 1, true);
    let cost = 0;
    if (t.id === 'avenue') for (const [x, z, col] of colored) { if (col === '#e8f6ff') cost += w.kind[w.idx(x, z)] === K.ROAD ? COST.upgrade : COST.avenue; }
    else cost = count * (t.id === 'road' ? COST.road : t.id === 'bulldoze' ? COST.bulldoze : COST.zone);
    this.ui.hint(`${t.label} · ${count} tile${count === 1 ? '' : 's'} · <span class="${cost > w.funds ? 'no' : 'ok'}">$${cost.toLocaleString()}</span>`);
  }

  commitDrag() {
    if (!this.drag) return;
    const t = this.tool(), tiles = this.dragTiles();
    let res;
    if (t.id === 'road') res = this.sim.buildRoads(tiles, 0);
    else if (t.id === 'avenue') res = this.sim.buildRoads(tiles, 1);
    else if (t.zone) res = this.sim.zone(tiles.rect, t.zone);
    else if (t.id === 'bulldoze') {
      res = this.sim.bulldoze(tiles.rect);
      if (res.ok) for (const [x, z] of tiles) if (Math.random() < 0.5) this.view.spawnDust(x - MAP / 2 + 0.5, z - MAP / 2 + 0.5, 1);
    }
    this.feedback(res, () => (t.id === 'road' || t.id === 'avenue' ? this.audio.road() : t.id === 'bulldoze' ? this.audio.bulldoze() : this.audio.zone()));
    this.drag = null;
    this.view.setPreview([], '#fff');
    if (this.tutorial == null) this.ui.hint(null);
  }

  feedback(res, ok) {
    if (!res) return;
    if (res.ok) { ok(); haptic('light'); this.ui.updateHUD(); }
    else { this.audio.error(); haptic('warning'); this.ui.toast(res.msg, 'bad'); }
  }

  // -------------------------------------------------------------- tutorial
  updateTutorial() {
    if (this.tutorial == null || !this.playing) return;
    const w = this.world, has = (fn) => { for (let i = 0; i < N; i++) if (fn(i)) return true; return false; };
    const svc = (id) => has((i) => w.kind[i] === K.SERVICE && w.root[i] === i && SERVICES[id] && w.svc[i] === Object.keys(SERVICES).indexOf(id) + 1);
    const steps = [
      { text: 'Pick <b>Homes</b> and drag beside the main street to zone housing', done: () => has((i) => w.kind[i] === K.RES) },
      { text: 'Place a <b>Wind Turbine</b> touching a road — power flows along streets', done: () => svc('wind') },
      { text: 'Zone <b>Shops</b> and <b>Industry</b> so residents have jobs', done: () => has((i) => w.kind[i] === K.COM) && has((i) => w.kind[i] === K.IND) },
      { text: 'Build a <b>Water Tower</b> so buildings can grow taller', done: () => svc('tower') },
      { text: 'Place a <b>Landfill</b> away from homes before garbage piles up', done: () => svc('landfill') },
      { text: 'Pinch to zoom, twist to rotate. Unfold your phone for the Mayor’s Desk — budgets, policies, petitions and news.', done: () => (this._tutT = (this._tutT || 0) + 1) > 48 },
    ];
    while (this.tutorial < steps.length && steps[this.tutorial].done()) { this.tutorial++; if (this.tutorial < steps.length) this.audio.select(); }
    if (this.tutorial >= steps.length) { this.tutorial = null; this.ui.hint(null); this.ui.toast('Tutorial complete — your city is in your hands.', 'milestone'); return; }
    if (!this.drag && !(this.tool().service && this.ghostAt)) this.ui.hint(`${this.tutorial + 1}/${steps.length} · ${steps[this.tutorial].text}`, () => { this.tutorial = null; this.ui.hint(null); });
  }

  // -------------------------------------------------------------- loop
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    if (this.r3d.fpsCap) {
      this.frameAcc += dt; this.last = now;
      if (this.frameAcc < 1 / this.r3d.fpsCap - 0.002) return;
      dt = this.frameAcc; this.frameAcc = 0;
    } else this.last = now;
    dt = Math.min(dt, 0.1);

    // simulation
    if (this.playing && this.speed > 0) {
      this.acc += dt * SPEEDS[this.speed];
      let steps = 0;
      while (this.acc >= SIM_DAY_SECONDS && steps < 10) { this.sim.step(); this.acc -= SIM_DAY_SECONDS; steps++; }
      if (steps >= 10) this.acc = 0;
    }
    // time of day
    if (this.timeMode === 'auto') this.tod = (this.tod + dt / 480 * (this.speed > 0 || !this.playing ? Math.max(1, SPEEDS[this.speed] * 0.6) : 0.15)) % 1;
    this.r3d.setTimeOfDay(this.tod);

    this.input.updateKeys(dt);
    this.rig.update(dt);
    this.r3d.focusTarget.copy(this.rig.target);
    this.r3d.viewDist = this.rig.dist;
    this.view.update(dt, this.playing ? this.speed : 1, this.sim.stats);
    this.r3d.frame(dt, now / 1000);

    this.hudT += dt;
    if (this.hudT > 0.25 && this.playing) { this.hudT = 0; this.ui.updateHUD(); this.updateTutorial(); }
    this.saveT += dt;
    if (this.saveT > 30 && this.playing) { this.saveT = 0; this.save(); }
    if (!this.booted) { this.booted = true; document.getElementById('boot').classList.add('done'); }
  }
}

// A pre-grown showcase city for the title screen / first launch.
function buildDemoCity(w, sim) {
  const c = MAP / 2;
  w.funds = 1e7; w.peakPop = 99999;
  const R = 13;
  const isLand = (x, z) => w.inb(x, z) && !w.terrain[w.idx(x, z)];
  const roads = [];
  for (let z = c - R; z <= c + R; z++) for (let x = c - R; x <= c + R; x++) {
    if (!isLand(x, z)) continue;
    if ((x - c) % 5 === 0 || (z - c) % 5 === 0) roads.push([x, z]);
  }
  sim.buildRoads(roads);
  // services
  const place = (id, x, z) => { if (sim.canPlaceService(x, z, id).ok) sim.placeService(x, z, id); };
  // zone blocks by distance from centre
  for (let z = c - R; z <= c + R; z++) for (let x = c - R; x <= c + R; x++) {
    if (!isLand(x, z) || w.kind[w.idx(x, z)] !== K.EMPTY) continue;
    const d = Math.max(Math.abs(x - c), Math.abs(z - c));
    const kind = d <= 4 ? K.COM : (x - c > 6 && z - c > 3) ? K.IND : K.RES;
    sim.zone({ x0: x, x1: x, z0: z, z1: z }, kind);
  }
  // clear some lots for services (bulldoze zones then place)
  const spots = [['stadium', c - 4, c + 6], ['hospital', c + 1, c - 9], ['school', c - 9, c - 4], ['gas', c + 11, c + 11], ['police', c + 2, c + 2], ['fire', c - 3, c - 3], ['park', c + 1, c - 1], ['park', c - 1, c + 1], ['park', c - 6, c + 2], ['park', c + 7, c - 6]];
  for (const [id, x, z] of spots) {
    const s = SERVICES[id];
    let free = true;
    for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) { const xx = x + ox, zz = z + oz; if (!isLand(xx, zz) || w.kind[w.idx(xx, zz)] === K.ROAD) free = false; }
    if (!free) continue;
    sim.bulldoze({ x0: x, x1: x + s.size - 1, z0: z, z1: z + s.size - 1 });
    place(id, x, z);
  }
  for (const [x, z] of [[c - 12, c - 12], [c + 12, c - 12], [c - 12, c + 12], [c - 7, c - 12], [c + 3, c + 12]]) { sim.bulldoze({ x0: x, x1: x, z0: z, z1: z }); place('tower', x, z); }
  const spot = (id, x, z) => { const s = SERVICES[id]; for (let oz = 0; oz < s.size; oz++) for (let ox = 0; ox < s.size; ox++) if (!isLand(x + ox, z + oz) || w.kind[w.idx(x + ox, z + oz)] === K.ROAD) return; sim.bulldoze({ x0: x, x1: x + s.size - 1, z0: z, z1: z + s.size - 1 }); place(id, x, z); };
  spot('landfill', c + 11, c - 4); spot('landfill', c - 14, c + 3); spot('clinic', c - 6, c - 6); spot('clinic', c + 6, c + 6); spot('university', c + 6, c - 4);
  for (const [x, z] of [[c - 1, c - 6], [c + 4, c + 1], [c - 6, c + 4], [c + 1, c + 9]]) spot('bus', x, z);
  const av = [];
  for (let k = -R; k <= R; k++) { if (isLand(c + k, c)) av.push([c + k, c]); if (isLand(c, c + k)) av.push([c, c + k]); }
  sim.buildRoads(av, 1);
  for (let k = 0; k < 8; k++) { const x = c - R + 1 + k * 3, z = c - R - 1; if (isLand(x, z) && isLand(x, z + 1)) place('wind', x, z); }
  sim.rng = mulberry(7);
  for (let d = 0; d < 1400; d++) sim.step();
  sim.rng = Math.random;
  w.funds = 85000; w.day = 0; w.history = [];
  w.peakPop = 0; sim.recount();
}
function mulberry(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// boot
try {
  window.game = new Game();
} catch (e) {
  console.error(e);
  document.getElementById('boot').innerHTML = `<div style="max-width:420px;text-align:center;padding:20px">Skyfold needs WebGL 2. ${String(e.message || e)}</div>`;
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
