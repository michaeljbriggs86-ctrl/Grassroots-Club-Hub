const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/app.js'), 'utf8');
const body = src.slice(src.indexOf('window.applyPilotOwnClubBadge=function(){'), src.indexOf('function verifiedTeamBadgeUrl(', src.indexOf('window.applyPilotOwnClubBadge=function(){')));
const failed = new Set();
const requests = [];
let currentSrc = '';
const image = {
  getAttribute(name){return name === 'src' ? currentSrc : null;},
  get src(){return currentSrc;},
  set src(value){currentSrc = value; requests.push(value);}
};
const window = {};
new Function('window', 'document', 'privatePilotOwnBadgeUrl', 'FAILED_BADGE_URLS', 'clubSettings', body)(
  window,
  {querySelectorAll:selector => selector === '.club-logo' ? [image] : []},
  () => '/__pilot_badges/499/example', failed,
  () => ({display_name:'Shooters Hill AFC',logo_asset:'shooters-hill-logo.png'})
);
window.applyPilotOwnClubBadge();
window.applyPilotOwnClubBadge();
assert.deepEqual(requests, ['/__pilot_badges/499/example'], 'repeat directory loads do not restart an unchanged badge request');
image.onerror();
assert.deepEqual(requests, ['/__pilot_badges/499/example', 'shooters-hill-logo.png'], 'failed badge switches to fallback once');
window.applyPilotOwnClubBadge();
assert.equal(requests.length, 2, 'a failed uploaded badge is not retried on every refresh');

const stableBody = src.slice(src.indexOf('function setStableHtml(element,markup){'), src.indexOf('// Club lists share the exact same admission', src.indexOf('function setStableHtml(element,markup){')));
const setStableHtml = new Function(`${stableBody}\nreturn setStableHtml;`)();
let writes = 0;
const list = {set innerHTML(value){writes++;this.markup=value}};
setStableHtml(list, '<img src="badge-a.png">');
setStableHtml(list, '<img src="badge-a.png">');
setStableHtml(list, '<img src="badge-b.png">');
assert.equal(writes, 2, 'unchanged cards preserve their image nodes but a new badge renders');
console.log('Uploaded badge render stability checks passed');
