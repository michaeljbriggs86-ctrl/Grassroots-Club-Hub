// "Did we go through?" step in the match report: only on the final cup/vase game of a round, coaches only, saved to cupProgress.
const fs=require('fs'),assert=require('assert');
const js=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8'),html=fs.readFileSync(__dirname+'/../app/src/main/assets/index.html','utf8');
assert.ok(/id="match-through-section"[^>]*>/.test(html)&&/id="match-through-checkbox"/.test(html));
assert.ok(/key:'through',label:'Round',section:'match-through-section',enabled:staff&&isFinalCupGameOfRound\(m\)/.test(js),'step must be staff only and cup-final-game only');
assert.ok(/'match-through-section'\]\.forEach/.test(js),'step toggled with the other sections');
assert.ok(/match-through-section'\)\?\.classList\.add\('hidden'\)/.test(js),'reset hides it');
assert.ok(/matchReportStepDefinitions\(m\)/.test(js));
// behaviour of the final-game rule
const get=n=>js.match(new RegExp('function '+n+'\\([^)]*\\)\\{[\\s\\S]*?\\n\\}\\n'))[0];
const src=['normaliseCupProgress','cupNameAndRound','cupProgressKey'].map(n=>js.match(new RegExp('function '+n+'\\([^)]*\\)\\{[^\\n]*\\}'))[0]).join('\n')+get('isFinalCupGameOfRound');
const mk=(age,matches)=>new Function('ageGroupNumber','state','competitionBucket',src+';return isFinalCupGameOfRound;')(()=>age,{matches},m=>/cup/i.test(m.competition)?'cup':'');
const a={id:'a',date:'2026-10-10',competition:'U9 Selkent Cup Two - Round 1',status:'played'},b={id:'b',date:'2026-10-10',competition:'U9 Selkent Cup Two - Round 1',status:'played'};
assert.strictEqual(mk(9,[a])(a),false,'first game of a mini group: not asked');
assert.strictEqual(mk(9,[a,b])(b),true,'second game: asked');
assert.strictEqual(mk(9,[a,{...b,status:'scheduled'}])(a),false);
assert.strictEqual(mk(13,[a])(a),true,'older teams play one fixture per round: asked');
assert.strictEqual(mk(9,[{id:'l',date:'2026-10-04',competition:'Division',status:'played'}])({id:'l',date:'2026-10-04',competition:'Division'}),false,'league games never asked');
console.log('cup through in report OK');
