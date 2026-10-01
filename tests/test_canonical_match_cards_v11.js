const assert=require('node:assert/strict'); const fs=require('node:fs');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8'); const css=fs.readFileSync('app/src/main/assets/styles.css','utf8');
assert.match(app,/canonicalMatchCardFrameworkV11/); assert.match(app,/replace\(\/_\/g/); assert.match(app,/clubIdentityBadgeHtml/); assert.match(app,/renderMatchPageNextFixture/); assert.match(app,/renderNextMatch/); assert.match(css,/canonical-v11-badge/); console.log('PASS v11 shared match-card contract');
