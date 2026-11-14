// Service worker: офлайн-работа. Стратегия stale-while-revalidate —
// приложение открывается мгновенно из кэша, а обновления (в т.ч. новая версия программы)
// скачиваются в фоне и применяются при следующем открытии. Личные данные здесь не хранятся.
const CACHE = 'fitapp-v8';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/logic.js', './js/ui.js', './js/duel.js', './js/gender.js', './js/morph.js', './js/xlsx.js', './js/export-xlsx.js',
  './js/data/exercises.js', './js/data/exercises-him.js', './js/data/program.js', './js/data/foods.js', './js/data/plan-meta.js',
  './js/views/home.js', './js/views/calendar.js', './js/views/train.js', './js/views/food.js', './js/views/profile.js', './js/views/sheets.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    return cached || (await net) || cache.match('./index.html');
  }));
});
