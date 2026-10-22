// Browser pilot: cache reviewed same-origin application files only.
// Never intercept Supabase responses, Selkent feeds, or private API calls.
const CACHE = 'pitchkind-web-compact-shirts-20261022';
const STATIC = [
  './', './index.html', './manifest.json', './cloud-config.js', './cloud.js',
  './onboarding.js', './onboarding.css', './app.js','./kickoff-updates.js','./coach-qualifications.js','./member-contact-import.js','./person-profiles.js', './registration-conduct.js', './player-onboarding.js', './coach-onboarding.js', './static-feed-overlay.js',
  './notifications.css','./styles.css', './cloud.css', './app-design-system.css',
  './sunday-graphics.css', './graphics/pitch-portrait.webp', './graphics/pitch-wide.webp',
  './shared-surfaces.css', './shared-results.css', './shared-controls.css', './shared-navigation.css',
  './graphics/fabric.webp', './graphics/shirt-coach.webp', './graphics/shirt-goalkeeper.webp',
  './graphics/shirt-outfield.webp', './graphics/barlow-condensed-bold.ttf', './graphics/anton-regular.ttf',
  './inter-variable.woff2', './inter-OFL.txt',
  './pilot-rights-runtime.js', './shooters-hill-logo.png', './club-badge-unavailable.svg', './football-login-adult.jpg',
  './football-login-player.jpg', './football-login-club.jpg',
  './football-pitch-hero.jpg', './football-pitch-hero-illustration.png',
];
const ALLOWED = new Set(STATIC.map(path => new URL(path, self.registration.scope).pathname));
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('pitchkind-web-') || key === 'pitchkind-dashboard-kickoff-20260930-23679bad8def') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
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

// Generic lock-screen content. Notification clicks only open the signed-in app.
self.addEventListener('push',event=>{
  let updateId='';try{const p=event.data?.json();if(/^[0-9a-f-]{36}$/i.test(p?.update_id||''))updateId=p.update_id;}catch(_){}
  const url=new URL('./',self.registration.scope);url.searchParams.set('kickoff_update',updateId||'latest');
  event.waitUntil(self.registration.showNotification('Shooters Hill AFC',{body:'New match details are ready. Open the app to review and confirm.',icon:new URL('./shooters-hill-logo.png',self.registration.scope).href,tag:'kickoff-update:'+updateId,data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL('./',self.registration.scope);
  try{const requested=new URL(event.notification.data?.url);if(requested.origin===url.origin&&requested.pathname===url.pathname&&requested.searchParams.has('kickoff_update'))url.search=requested.search;}catch(_){}
  event.waitUntil(self.clients.openWindow(url.href));
});
