// Mike confirmed 2026-10-10: a U8-U11 Cup group is two games, not three.
const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync(require('path').join(__dirname, '../app/src/main/assets/app.js'), 'utf8');
assert.doesNotMatch(app, /Three games back to back/);
assert.match(app, /Group starts \$\{esc\(details\.time\)\} · Two games back to back/);
console.log('cup group two games text OK');
