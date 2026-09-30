const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
assert.match(source,/const compactTime=resolvedFixture\(f\)\.time\|\|f\.time\|\|'';if\(dateEl\)dateEl\.textContent=f\.date\?\[formatDate\(f\.date\),compactTime\|\|'Kick-off TBC'\]\.join\(' · '\):'Date TBC';/);
console.log('PASS dashboard compact card exposes confirmed kick-off time beside the date');
