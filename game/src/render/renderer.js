// Scene renderer: atmosphere, lighting, post-processing, adaptive quality.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clamp, lerp } from '../config.js';

export const QUALITY = {
  battery:  { label: 'Battery',  maxDpr: 1.25, shadow: 1024, post: false, bloom: false, tilt: false, msaa: 0 },
  balanced: { label: 'Balanced', maxDpr: 2,    shadow: 2048, post: true,  bloom: true,  tilt: false, msaa: 4 },
  ultra:    { label: 'Ultra',    maxDpr: 3,    shadow: 4096, post: true,  bloom: true,  tilt: true,  msaa: 4 },
};

// time-of-day keyframes (t: 0 = midnight, 0.5 = noon)
const KEYS = [
  { t: 0.00, top: 0x040918, hor: 0x13224a, sun: 0x8ea8ff, si: 0.55, hs: 0x2a3d6a, hg: 0x0c0f18, hi: 0.55, fog: 0x0c1632, exp: 1.0 },
  { t: 0.20, top: 0x0b1530, hor: 0x2a3560, sun: 0x9aaeff, si: 0.5, hs: 0x2e4270, hg: 0x10121a, hi: 0.55, fog: 0x18224a, exp: 1.0 },
  { t: 0.25, top: 0x34477a, hor: 0xf3a173, sun: 0xffad6b, si: 1.6, hs: 0x8fa2cc, hg: 0x3a3022, hi: 0.6, fog: 0xd6a48e, exp: 1.0 },
  { t: 0.32, top: 0x4b88d2, hor: 0xcfe5f5, sun: 0xfff0d6, si: 3.0, hs: 0xbad4ff, hg: 0x5a4a35, hi: 0.9, fog: 0xc2d8e8, exp: 1.0 },
  { t: 0.50, top: 0x3e7fd8, hor: 0xd9edf9, sun: 0xffffff, si: 3.3, hs: 0xc4dcff, hg: 0x5e4e38, hi: 1.0, fog: 0xcfe3f0, exp: 1.0 },
  { t: 0.68, top: 0x4a84cc, hor: 0xe6e2d6, sun: 0xffe6c2, si: 3.0, hs: 0xbcd2f6, hg: 0x5e4a34, hi: 0.9, fog: 0xd8dcd8, exp: 1.0 },
  { t: 0.76, top: 0x2c3c76, hor: 0xff955a, sun: 0xff8448, si: 1.6, hs: 0x8a90c0, hg: 0x3a2a22, hi: 0.6, fog: 0xcf8c74, exp: 1.0 },
  { t: 0.82, top: 0x0d1736, hor: 0x3a3060, sun: 0x9aaeff, si: 0.5, hs: 0x2e4270, hg: 0x10121a, hi: 0.55, fog: 0x1b2148, exp: 1.0 },
  { t: 1.00, top: 0x040918, hor: 0x13224a, sun: 0x8ea8ff, si: 0.55, hs: 0x2a3d6a, hg: 0x0c0f18, hi: 0.55, fog: 0x0c1632, exp: 1.0 },
];

const skyVert = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix*vec4(position,0.0)).xyz); vec4 p = projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.0); gl_Position = p.xyww; }`;
const skyFrag = `
uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float stars; uniform float time;
varying vec3 vDir;
float h(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(hor, top, pow(clamp(y,0.0,1.0), 0.55));
  col = mix(col, hor*0.55, clamp(-y*3.0,0.0,1.0));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunCol * (pow(s, 600.0)*6.0 + pow(s, 12.0)*0.35);
  if (stars > 0.0 && y > 0.0) {
    vec3 q = floor(d*380.0);
    float r = h(q);
    float tw = 0.6 + 0.4*sin(time*2.0 + r*50.0);
    col += vec3(step(0.9975, r)) * stars * tw * smoothstep(0.0, 0.25, y) * 1.6;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, resolution: { value: new THREE.Vector2(1, 1) }, blur: { value: 0 }, focus: { value: 0.52 }, vignette: { value: 0.9 }, saturation: { value: 1.08 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 resolution; uniform float blur; uniform float focus; uniform float vignette; uniform float saturation;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (blur > 0.0) {
        float r = smoothstep(0.16, 0.5, abs(vUv.y - focus)) * blur;
        if (r > 0.3) {
          vec4 acc = c; float tot = 1.0;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt(float(i) + 0.5) / 3.4641;
            acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * rr * r / resolution);
            tot += 1.0;
          }
          c = acc / tot;
        }
      }
      vec2 p = vUv - 0.5;
      c.rgb *= 1.0 - dot(p, p) * vignette;
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      gl_FragColor = c;
    }`,
};

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.3, 1200);

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, stars: { value: 0 }, time: { value: 0 } },
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), this.skyMat);
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.skyMat));
    this.pmrem = new THREE.PMREMGenerator(r);
    this.envRT = null; this.envAge = 1e9;

    // lights
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.scene.fog = new THREE.Fog(0xcfe3f0, 60, 300);

    this.timeOfDay = 0.38;
    this.night = 0;
    this.focusTarget = new THREE.Vector3();
    this.viewDist = 40;
    this.quality = 'balanced';
    this.resScale = 1;
    this.fpsCap = 0; // 0 = display rate
    this._ft = 1 / 60;
    this.size = { w: 1, h: 1 };
    this.applyQuality(this.quality);
  }

  applyQuality(q) {
    this.quality = q;
    const Q = QUALITY[q];
    this.sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.resScale = 1;
    this.composer?.dispose?.();
    this.composer = null;
    if (Q.post) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: Q.msaa });
      const c = new EffectComposer(this.renderer, rt);
      c.addPass(new RenderPass(this.scene, this.camera));
      if (Q.bloom) { this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.92); c.addPass(this.bloom); } else this.bloom = null;
      this.grade = new ShaderPass(GradeShader);
      c.addPass(this.grade);
      c.addPass(new OutputPass());
      this.composer = c;
    }
    this.resize(this.size.w, this.size.h);
  }

  dpr() { return Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].maxDpr) * this.resScale; }

  resize(w, h) {
    this.size = { w: Math.max(1, w), h: Math.max(1, h) };
    const dpr = this.dpr();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.size.w, this.size.h, false);
    this.camera.aspect = this.size.w / this.size.h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(this.size.w, this.size.h);
      this.grade.uniforms.resolution.value.set(this.size.w * dpr, this.size.h * dpr);
      if (this.bloom) this.bloom.resolution.set(this.size.w * dpr * 0.5, this.size.h * dpr * 0.5);
    }
  }

  setTimeOfDay(t) {
    this.timeOfDay = ((t % 1) + 1) % 1;
    t = this.timeOfDay;
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let k = 0; k < KEYS.length - 1; k++) if (t >= KEYS[k].t && t <= KEYS[k + 1].t) { a = KEYS[k]; b = KEYS[k + 1]; break; }
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
    const mix = (p, q) => new THREE.Color(p).lerp(new THREE.Color(q), f);
    this.skyMat.uniforms.top.value.copy(mix(a.top, b.top));
    this.skyMat.uniforms.hor.value.copy(mix(a.hor, b.hor));
    this.sun.color.copy(mix(a.sun, b.sun));
    this.sun.intensity = lerp(a.si, b.si, f);
    this.hemi.color.copy(mix(a.hs, b.hs));
    this.hemi.groundColor.copy(mix(a.hg, b.hg));
    this.hemi.intensity = lerp(a.hi, b.hi, f);
    this.scene.fog.color.copy(mix(a.fog, b.fog));
    // night factor
    const nf = t < 0.5 ? 1 - smooth(0.21, 0.29, t) : smooth(0.74, 0.82, t);
    this.night = nf;
    this.skyMat.uniforms.stars.value = nf;
    // sun / moon direction
    const ang = (t - 0.25) * Math.PI * 2;
    const elev = Math.sin(ang);
    const az = ang * 0.5 + 0.7;
    const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(Math.asin(clamp(elev, -1, 1))), elev, Math.sin(az) * 0.8).normalize();
    this.skyMat.uniforms.sunDir.value.copy(sunDir);
    this.skyMat.uniforms.sunCol.value.copy(this.sun.color).multiplyScalar(elev > -0.05 ? 1 : 0.15);
    const light = elev > 0.05 ? sunDir.clone() : new THREE.Vector3(-0.45, 0.8, -0.35).normalize();
    if (elev > 0.05 && light.y < 0.28) { light.y = 0.28; light.normalize(); }
    this.lightDir = light;
    if (this.bloom) this.bloom.strength = 0.18 + nf * 0.75;
    this.envAge = Math.max(this.envAge, 999); // request env refresh
  }

  updateEnv(dt) {
    this.envAge += dt;
    if (this.envAge < 6) return;
    this.envAge = 0;
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    this.scene.environment = this.envRT.texture;
    old?.dispose();
  }

  frame(dt, time) {
    this.skyMat.uniforms.time.value = time;
    this.sky.position.copy(this.camera.position);
    // shadow frustum follows the view
    const S = clamp(this.viewDist * 0.85, 8, 46);
    const cam = this.sun.shadow.camera;
    if (cam.right !== S) { cam.left = -S; cam.right = S; cam.top = S; cam.bottom = -S; cam.near = 1; cam.far = 220; cam.updateProjectionMatrix(); }
    // snap to shadow texels to reduce shimmer
    const texel = (2 * S) / this.sun.shadow.mapSize.x;
    const tx = Math.round(this.focusTarget.x / texel) * texel, tz = Math.round(this.focusTarget.z / texel) * texel;
    this.sun.target.position.set(tx, 0, tz);
    this.sun.position.set(tx, 0, tz).addScaledVector(this.lightDir || new THREE.Vector3(0.4, 1, 0.3), 100);
    this.scene.fog.near = this.viewDist * 1.6;
    this.scene.fog.far = this.viewDist * 5 + 60;
    if (this.grade) {
      const Q = QUALITY[this.quality];
      this.grade.uniforms.blur.value = Q.tilt ? clamp(11 - this.viewDist * 0.12, 1.5, 7) * this.dpr() : 0;
    }
    this.updateEnv(dt);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  // dynamic resolution to hold frame rate on ProMotion displays
  adapt(dt) {
    this._ft = this._ft * 0.95 + dt * 0.05;
    this._adaptT = (this._adaptT || 0) + dt;
    if (this._adaptT < 1.5) return;
    this._adaptT = 0;
    const target = this.fpsCap ? 1 / this.fpsCap : 1 / 60;
    let s = this.resScale;
    if (this._ft > target * 1.25 && s > 0.55) s = Math.max(0.55, s - 0.1);
    else if (this._ft < target * 0.8 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== this.resScale) { this.resScale = s; this.resize(this.size.w, this.size.h); }
  }
}

function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
