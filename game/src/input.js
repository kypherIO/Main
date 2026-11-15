// Camera rig + unified touch / mouse / keyboard input.
import * as THREE from 'three';
import { MAP, clamp, lerp } from './config.js';

const HALF = MAP / 2;
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.dist = 34;
    this.yaw = Math.PI * 0.25;
    this.tilt = 0;     // user pitch offset
    this.vel = new THREE.Vector2();
    this.minDist = 6; this.maxDist = 110;
    this.goal = null;  // smooth fly-to
    this.orbit = 0;    // idle orbit speed (title screen)
  }
  pitch() {
    const t = clamp((this.dist - this.minDist) / (this.maxDist - this.minDist), 0, 1);
    return clamp(lerp(0.52, 1.02, Math.pow(t, 0.7)) + this.tilt, 0.32, 1.3);
  }
  update(dt) {
    if (this.goal) {
      const k = 1 - Math.exp(-dt * 5);
      this.target.lerp(this.goal.target, k);
      if (this.goal.dist) this.dist = lerp(this.dist, this.goal.dist, k);
      if (this.target.distanceTo(this.goal.target) < 0.02) this.goal = null;
    }
    if (this.vel.lengthSq() > 1e-5) {
      this.target.x += this.vel.x * dt; this.target.z += this.vel.y * dt;
      this.vel.multiplyScalar(Math.exp(-dt * 5));
    }
    this.yaw += this.orbit * dt;
    this.target.x = clamp(this.target.x, -HALF, HALF);
    this.target.z = clamp(this.target.z, -HALF, HALF);
    this.dist = clamp(this.dist, this.minDist, this.maxDist);
    const p = this.pitch();
    const c = this.camera;
    c.position.set(
      this.target.x + Math.sin(this.yaw) * Math.cos(p) * this.dist,
      this.target.y + Math.sin(p) * this.dist,
      this.target.z + Math.cos(this.yaw) * Math.cos(p) * this.dist,
    );
    c.lookAt(this.target);
  }
  flyTo(x, z, dist) { this.goal = { target: new THREE.Vector3(x, 0, z), dist }; }
}

export class Input {
  constructor(el, rig, h) {
    this.el = el; this.rig = rig; this.h = h; // h: { toolMode(): 'pan'|'tap'|'drag', onDown, onMove, onUp, onCancel, onHover, onTap }
    this.ptrs = new Map();
    this.mode = null; // 'tool' | 'pan' | 'gesture' | 'orbit'
    this.ray = new THREE.Raycaster();
    this.keys = new Set();
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.h.onHover?.(null); });
    el.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT') this.keys.add(e.key.toLowerCase()); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  local(e) { const r = this.el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }

  groundAt(sx, sy) {
    const r = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.rig.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(ground, p) ? p : null;
  }

  tileAt(sx, sy) {
    const p = this.groundAt(sx, sy);
    if (!p) return null;
    const x = Math.floor(p.x + HALF), z = Math.floor(p.z + HALF);
    return { x, z, inside: x >= 0 && z >= 0 && x < MAP && z < MAP };
  }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    const l = this.local(e);
    this.ptrs.set(e.pointerId, { x: l.x, y: l.y, sx: l.x, sy: l.y, t: performance.now(), btn: e.button, type: e.pointerType });
    this.rig.vel.set(0, 0); this.rig.goal = null;
    this.h.onAnyInput?.();
    if (this.ptrs.size === 1) {
      const toolMode = this.h.toolMode();
      if (e.pointerType === 'mouse' && e.button === 2) this.mode = 'orbit';
      else if (e.pointerType === 'mouse' && e.button === 1) this.mode = 'pan';
      else if (toolMode === 'drag' || toolMode === 'tap') { this.mode = 'tool'; this.toolStarted = false; this.pendingTool = toolMode; }
      else this.mode = 'pan';
      this.lastGround = this.groundAt(l.x, l.y);
      if (this.mode === 'tool' && this.pendingTool === 'drag') { this.toolStarted = true; this.h.onDown?.(this.tileAt(l.x, l.y)); }
    } else if (this.ptrs.size === 2) {
      if (this.mode === 'tool' && this.toolStarted) this.h.onCancel?.();
      this.mode = 'gesture';
      this.startGesture();
    }
  }

  startGesture() {
    const [a, b] = [...this.ptrs.values()];
    this.g = { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: this.rig.dist, yaw: this.rig.yaw };
    this.g.ground = this.groundAt(this.g.mx, this.g.my);
  }

  move(e) {
    const l = this.local(e);
    const p = this.ptrs.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') this.h.onHover?.(this.tileAt(l.x, l.y)); return; }
    const dx = l.x - p.x, dy = l.y - p.y;
    p.x = l.x; p.y = l.y;
    if (this.mode === 'tool') {
      if (this.toolStarted) this.h.onMove?.(this.tileAt(l.x, l.y));
      else if (Math.hypot(l.x - p.sx, l.y - p.sy) > 12) { this.mode = 'pan'; this.lastGround = this.groundAt(l.x, l.y); }
      if (e.pointerType === 'mouse') this.h.onHover?.(this.tileAt(l.x, l.y));
    } else if (this.mode === 'pan') {
      const g = this.groundAt(l.x, l.y);
      if (g && this.lastGround) {
        const ddx = this.lastGround.x - g.x, ddz = this.lastGround.z - g.z;
        this.rig.target.x += ddx; this.rig.target.z += ddz;
        const dt = Math.max(1, performance.now() - (this.lastMoveT || 0)) / 1000;
        this.rig.vel.set(ddx / Math.min(dt, 0.05), ddz / Math.min(dt, 0.05)).multiplyScalar(0.5);
        this.lastMoveT = performance.now();
        this.rig.update(0);
        this.lastGround = this.groundAt(l.x, l.y);
      }
    } else if (this.mode === 'orbit') {
      this.rig.yaw -= dx * 0.008;
      this.rig.tilt = clamp(this.rig.tilt + dy * 0.004, -0.25, 0.3);
    } else if (this.mode === 'gesture' && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.rig.dist = clamp(this.g.dist * (this.g.d / Math.max(20, d)), this.rig.minDist, this.rig.maxDist);
      let da = ang - this.g.ang;
      if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      this.rig.yaw = this.g.yaw + da;
      this.rig.update(0);
      // keep the ground point under the fingers
      const g = this.groundAt(mx, my);
      if (g && this.g.ground) { this.rig.target.x += this.g.ground.x - g.x; this.rig.target.z += this.g.ground.z - g.z; this.rig.update(0); }
    }
  }

  up(e, cancel = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const l = this.local(e);
    this.ptrs.delete(e.pointerId);
    if (this.mode === 'tool') {
      const tap = Math.hypot(l.x - p.sx, l.y - p.sy) < 12 && performance.now() - p.t < 600;
      if (cancel) this.h.onCancel?.();
      else if (this.toolStarted) this.h.onUp?.(this.tileAt(l.x, l.y));
      else if (tap) this.h.onTap?.(this.tileAt(l.x, l.y));
    } else if (this.mode === 'pan') {
      const tap = Math.hypot(l.x - p.sx, l.y - p.sy) < 10 && performance.now() - p.t < 400;
      if (tap) { this.rig.vel.set(0, 0); this.h.onTap?.(this.tileAt(l.x, l.y)); }
      if (performance.now() - (this.lastMoveT || 0) > 80) this.rig.vel.set(0, 0);
    }
    if (this.ptrs.size === 1 && this.mode === 'gesture') {
      // continue as pan with the remaining finger
      this.mode = 'pan';
      const r = [...this.ptrs.values()][0];
      this.lastGround = this.groundAt(r.x, r.y);
      this.rig.vel.set(0, 0);
    } else if (this.ptrs.size === 0) this.mode = null;
  }

  wheel(e) {
    e.preventDefault();
    const l = this.local(e);
    if (e.ctrlKey) { // trackpad pinch
      this.zoomAt(l.x, l.y, Math.exp(e.deltaY * 0.01));
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaMode === 0 && !Number.isInteger(e.deltaY)) {
      this.rig.yaw += e.deltaX * 0.004;
    } else {
      this.zoomAt(l.x, l.y, Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0012)));
    }
  }

  zoomAt(sx, sy, factor) {
    const before = this.groundAt(sx, sy);
    this.rig.dist = clamp(this.rig.dist * factor, this.rig.minDist, this.rig.maxDist);
    this.rig.update(0);
    const after = this.groundAt(sx, sy);
    if (before && after) { this.rig.target.x += before.x - after.x; this.rig.target.z += before.z - after.z; }
  }

  updateKeys(dt) {
    const k = this.keys, r = this.rig;
    if (!k.size) return;
    const sp = r.dist * 0.9 * dt;
    const fx = -Math.sin(r.yaw), fz = -Math.cos(r.yaw), rx = Math.cos(r.yaw), rz = -Math.sin(r.yaw);
    if (k.has('w') || k.has('arrowup')) { r.target.x += fx * sp; r.target.z += fz * sp; }
    if (k.has('s') || k.has('arrowdown')) { r.target.x -= fx * sp; r.target.z -= fz * sp; }
    if (k.has('d') || k.has('arrowright')) { r.target.x += rx * sp; r.target.z += rz * sp; }
    if (k.has('a') || k.has('arrowleft')) { r.target.x -= rx * sp; r.target.z -= rz * sp; }
    if (k.has('q')) r.yaw += dt * 1.6;
    if (k.has('e')) r.yaw -= dt * 1.6;
    if (k.has('=') || k.has('+')) r.dist *= 1 - dt * 1.5;
    if (k.has('-')) r.dist *= 1 + dt * 1.5;
  }
}
