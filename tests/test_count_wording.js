const fs=require('fs'),assert=require('assert');
const app=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8');
const plural=new Function(app.match(/function plural\(n,one,many\)\{[^\n]*\}/)[0]+';return plural;')();
assert.strictEqual(plural(1,'parent'),'1 parent');assert.strictEqual(plural(3,'Admin'),'3 Admins');assert.strictEqual(plural(0,'player'),'0 players');assert.strictEqual(plural(1,'child','children'),'1 child');
assert.ok(!/\$\{counts\.(admins|parents|players)\} (Admin|parents|players)/.test(app),'access chips use plural()');
assert.ok(!/\$\{selected\.length\} players in matchday/.test(app)&&!/\$\{res\?\.teams\|\|0\} teams rolled/.test(app));
console.log('count wording OK');
