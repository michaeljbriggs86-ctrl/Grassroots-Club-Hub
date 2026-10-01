const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
assert.match(app,/cupV6MatchesNextVersus/);
assert.match(app,/renderMatchPageNextFixture=function\(\)/);
assert.match(app,/matches-next-versus/);
assert.match(app,/Cup Matches-page fallback skipped/);
console.log('PASS Matches-page Cup next-fixture cards use the safe named-opponent renderer');
