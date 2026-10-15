/* Hunt Map service worker: works offline and keeps map tiles you have viewed. */
const APP = 'huntmap-app-v7', TILES = 'huntmap-tiles-v1', MAX_TILES = 4000;
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(APP).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('huntmap-app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const isTile = u => /arcgisonline\.com\/ArcGIS\/rest\/services\/.+\/tile\//.test(u) || /tile\.openstreetmap\.org/.test(u);
let trimming = false;
async function trim() {
  if (trimming) return; trimming = true;
  try { const c = await caches.open(TILES); const ks = await c.keys(); if (ks.length > MAX_TILES) for (const k of ks.slice(0, ks.length - MAX_TILES)) await c.delete(k); } finally { trimming = false; }
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = req.url;
  if (isTile(url)) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') { c.put(req, r.clone()); if (Math.random() < 0.02) trim(); } return r; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (req.mode === 'navigate' || url.endsWith('/index.html')) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(APP).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (url.startsWith(self.location.origin) || url.includes('fonts.g') || url.includes('cdnjs'))) { const cp = r.clone(); caches.open(APP).then(c => c.put(req, cp)); }
    return r;
  })));
});
