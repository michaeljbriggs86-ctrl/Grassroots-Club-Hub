// Browser pilot: cache reviewed same-origin application files only.
// Never intercept Supabase responses, Selkent feeds, or private API calls.
const CACHE = 'pitchkind-web-v2235-2';
const STATIC = [
  './', './index.html', './manifest.json', './cloud-config.js', './cloud.js',
  './onboarding.js', './onboarding.css', './app.js', './static-feed-overlay.js',
  './styles.css', './cloud.css', './app-design-system.css',
  './pilot-rights-runtime.js', './pitchkind-wt_logo-primary.svg',
  './pitchkind-wt_logo-reverse.svg', './pitchkind-wt_mark.svg',
  './pitchkind-wt_mark-reverse.svg', './pitchkind-wt_app-icon.svg',
  './shooters-hill-logo.png', './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './football-login-adult.jpg',
  './football-login-player.jpg', './football-login-club.jpg',
  './football-pitch-hero.jpg'
];
const ALLOWED = new Set(STATIC.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pitchkind-web-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Query parameters may contain one-time authentication tokens. Never cache them.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || !ALLOWED.has(url.pathname)) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(request)));
});
