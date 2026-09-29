const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app-design-system.css'),'utf8');
const source=fs.readFileSync(path.join(root,'app.js'),'utf8');
const headerEnd=html.indexOf('</header>'),toolbar=html.indexOf('id="app-utility-bar"'),nav=html.indexOf('id="top-nav-tabs"');
assert.ok(headerEnd>0&&headerEnd<toolbar&&toolbar<nav,'the controls sit between the shared hero and navigation');
for(const id of ['notification-bell','hero-profile-switch','hero-admin-preview-back']){const index=html.indexOf(`id="${id}"`,toolbar);assert.ok(index>toolbar&&index<nav,`${id} is in the utility bar`);}
assert.doesNotMatch(css,/body\.match-plan-active \.hero[\s{.:]/,'Match plan uses the same hero as other pages');

const buttons=[{classList:{contains:()=>true}},{classList:{contains:()=>true}}];
let hidden=false;
const bar={querySelectorAll:()=>buttons,classList:{toggle:(name,value)=>{assert.equal(name,'hidden');hidden=value;}}};
const ctx={document:{getElementById:()=>bar}};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('function syncHeaderUtilityBar(){'),source.indexOf('function renderNotificationCenter(){')),ctx);
ctx.syncHeaderUtilityBar();assert.equal(hidden,true,'empty controls do not leave a blank strip');
buttons[0].classList.contains=()=>false;
ctx.syncHeaderUtilityBar();assert.equal(hidden,false,'the notification or role control makes the bar visible');
console.log('Hero utility bar checks passed');
