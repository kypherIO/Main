// Offline cache for Skyfold. Bump VERSION when shipping changes.
const VERSION = 'skyfold-v2';
const FILES = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './assets/icon.svg', './assets/icon-180.png', './assets/icon-192.png', './assets/icon-512.png',
  './src/main.js', './src/config.js', './src/world.js', './src/sim.js', './src/input.js', './src/ui.js', './src/audio.js', './src/posture.js', './src/ai.js', './src/events.js',
  './src/render/renderer.js', './src/render/cityview.js', './src/render/models.js', './src/render/geo.js', './src/render/textures.js',
  './vendor/three/three.module.min.js',
  './vendor/three/addons/postprocessing/EffectComposer.js', './vendor/three/addons/postprocessing/RenderPass.js',
  './vendor/three/addons/postprocessing/ShaderPass.js', './vendor/three/addons/postprocessing/MaskPass.js',
  './vendor/three/addons/postprocessing/Pass.js', './vendor/three/addons/postprocessing/UnrealBloomPass.js',
  './vendor/three/addons/postprocessing/OutputPass.js', './vendor/three/addons/shaders/CopyShader.js',
  './vendor/three/addons/shaders/LuminosityHighPassShader.js', './vendor/three/addons/shaders/OutputShader.js',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
