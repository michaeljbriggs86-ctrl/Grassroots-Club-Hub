// Coach "through to next round" marker: kept by the state normaliser, coach-only in the UI.
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8');
const get=n=>src.match(new RegExp('function '+n+'\\([^)]*\\)\\{[^\\n]*\\}'))[0];
const f=new Function(get('normaliseCupProgress')+get('cupNameAndRound')+get('cupProgressKey')+';return {normaliseCupProgress,cupProgressKey};')();
assert.strictEqual(f.cupProgressKey({competition:'U9 Selkent Cup Two - Round 1'}),'Selkent Cup Two|Round 1');
const kept=f.normaliseCupProgress({'Selkent Cup Two|Round 1':{through:true,at:'2026-10-10T12:00:00Z'},'bad key':{through:true},'X|Y':'nope'});
assert.deepStrictEqual(Object.keys(kept),['Selkent Cup Two|Round 1']);
assert.strictEqual(kept['Selkent Cup Two|Round 1'].through,true);
assert.deepStrictEqual(f.normaliseCupProgress(null),{});assert.deepStrictEqual(f.normaliseCupProgress([1]),{});
assert.ok(/cupProgress: normaliseCupProgress\(data\.cupProgress\)/.test(src),'normaliser must keep cupProgress or it is lost on reload');
assert.ok(/renderCupProgress\(wrap,kind==='cup'\?rows:\[\]\)/.test(src));
console.log('cup progress marker OK');
