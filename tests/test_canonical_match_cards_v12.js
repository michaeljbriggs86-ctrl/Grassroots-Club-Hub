const assert=require('node:assert/strict'); const fs=require('node:fs');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8'); const css=fs.readFileSync('app/src/main/assets/styles.css','utf8');
assert.match(app,/canonicalMatchCardFrameworkV11/); assert.match(app,/canonicalMatchCardFrameworkV12/); assert.match(app,/next-match-home-teams/); assert.match(app,/next-match-home-date/); assert.match(app,/canonical-v12-map-wrap/); assert.match(css,/canonical-v12-map-button/); console.log('PASS v12 dashboard grouping and venue map follow-up');
