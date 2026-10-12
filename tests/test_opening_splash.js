const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
const splashTitle = html.match(/<h1 class="app-splash-title">([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
assert.equal(splashTitle, 'Shooters Hill AFC', 'opening title uses the approved club name');
const start = app.indexOf('let openingSplashReady=false');
const end = app.indexOf('const GENERIC_STARTER_TEAMS', start);
assert(start >= 0 && end > start);
assert(app.includes('}finally{__booting=false;finishOpeningSplash();}'), 'release the splash after the app or sign-in screen is ready');
const startup = app.slice(start, end);

function boot({ readyState = 'loading', reducedMotion = false, animationFrame = true } = {}) {
  const classes = new Set();
  const frames = [], timers = [], listeners = {};
  let removed = false, scrollLocked = true;
  const splash = {
    classList: { contains: name => classes.has(name), add: name => classes.add(name) },
    remove() { removed = true; },
  };
  const window = {
    setTimeout(callback, delay) { timers.push({ callback, delay }); },
    addEventListener(type, callback) { listeners[type] = callback; },
    matchMedia() { return { matches: reducedMotion }; },
  };
  if (animationFrame) window.requestAnimationFrame = callback => frames.push(callback);
  const context = vm.createContext({
    window,
    document: {
      readyState,
      getElementById() { return removed ? null : splash; },
      body: { classList: { remove(name) { if (name === 'splash-active') scrollLocked = false; } } },
    },
  });
  vm.runInContext(startup, context);
  return { context, listeners, frames, timers, classes,
    get removed() { return removed; }, get scrollLocked() { return scrollLocked; } };
}

// Fast startup holds the agreed opening duration before the short dissolve.
const normal = boot();
assert(normal.scrollLocked);
vm.runInContext('finishOpeningSplash();', normal.context);
assert.equal(normal.frames.length,0,'a ready app still holds the three-second opening');
normal.timers.find(t=>t.delay===3000).callback();
normal.frames.shift()();
assert(!normal.classes.has('is-leaving'), 'give the app its first paint');
normal.frames.shift()();
assert(normal.classes.has('is-leaving'));
assert.equal(normal.scrollLocked, false);
assert.equal(normal.removed, false);
const exit = normal.timers.find(t => t.delay === 250);
assert(exit, 'remove the overlay after its dissolve');
vm.runInContext('dismissOpeningSplash(); dismissOpeningSplash();', normal.context);
assert.equal(normal.timers.filter(t => t.delay === 250).length, 1, 'teardown is idempotent');
exit.callback();
assert(normal.removed);
vm.runInContext('dismissOpeningSplash();', normal.context);

const reduced = boot({ reducedMotion: true, readyState: 'complete' });
vm.runInContext('finishOpeningSplash();', reduced.context);
assert.equal(reduced.removed,false);
reduced.timers.find(t=>t.delay===3000).callback();
reduced.frames.shift()(); reduced.frames.shift()();
assert(reduced.removed, 'reduced motion skips the dissolve');
assert.equal(reduced.scrollLocked, false);

const slow = boot();
slow.timers.find(t=>t.delay===3000).callback();
assert.equal(slow.frames.length,0,'hold until the app or sign-in screen is ready');
vm.runInContext('finishOpeningSplash();',slow.context);
slow.frames.shift()();slow.frames.shift()();
assert(slow.classes.has('is-leaving'));

const stalled = boot();
stalled.timers.find(t => t.delay === 4000).callback();
assert.equal(stalled.scrollLocked, false, 'a stalled startup releases scrolling');
stalled.timers.find(t => t.delay === 250).callback();
assert(stalled.removed, 'a stalled startup cannot trap the user under the splash');

const fallback = boot({ animationFrame: false, readyState: 'complete' });
vm.runInContext('finishOpeningSplash();', fallback.context);
fallback.timers.find(t=>t.delay===3000).callback();
fallback.timers.find(t => t.delay === 0).callback();
fallback.timers.filter(t => t.delay === 0)[1].callback();
assert(fallback.classes.has('is-leaving'), 'startup also works without animation-frame support');
console.log('PASS three-second opening splash, slow readiness, reduced motion, idempotence and stalled-startup fallback');
