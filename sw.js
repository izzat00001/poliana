/* Цветочная поляна: офлайн-режим. Версия кэша = версия игры. */
const CACHE = 'poliana-1.6.3';
/* музыка лежит в отдельной памяти: при обновлении игры 9 МБ заново не скачиваются (меняйте номер, только если файлы музыки заменили) */
const MUSIC = 'poliana-music-1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== MUSIC).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!same && !font) return;
  if (req.mode === 'navigate' || (same && url.pathname.endsWith('index.html'))) {
    /* сначала сеть, чтобы новая версия приходила сразу; без сети берём из памяти */
    e.respondWith(
      fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return r; })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  if (same && url.pathname.indexOf('/music/') >= 0) {
    /* музыка: сначала из памяти, скачиваем один раз при первом прослушивании */
    e.respondWith(
      caches.open(MUSIC).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; })))
    );
    return;
  }
  /* остальное: из памяти, а в фоне обновляем */
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    })
  );
});
