// Cup rows show the real competition name and round, not an invented "Challenge Cup".
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync(__dirname+'/../app/src/main/assets/app.js','utf8');
const fn=src.match(/function cupNameAndRound\(m\)\{[^\n]*\}/)[0];
const cupNameAndRound=new Function(fn+';return cupNameAndRound;')();
assert.deepStrictEqual(cupNameAndRound({competition:'U9 Selkent Cup Two - Round 1'}),{name:'Selkent Cup Two',round:'Round 1'});
assert.deepStrictEqual(cupNameAndRound({competition:'U12X Selkent Cup One - Prelim Round'}),{name:'Selkent Cup One',round:'Prelim Round'});
assert.deepStrictEqual(cupNameAndRound({competition:'U14 London Cup'}),{name:'London Cup',round:''});
assert.ok(!/Challenge (Cup|Vase)/.test(src),'no invented Challenge Cup/Vase labels');
console.log('cup name and round OK');
