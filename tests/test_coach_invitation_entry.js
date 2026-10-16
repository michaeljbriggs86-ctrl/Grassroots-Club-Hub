const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/coach-onboarding.js','utf8');
const cloud=fs.readFileSync('app/src/main/assets/cloud.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
assert.match(cloud,/signup=coach/,'registration URL selects existing coach account form');
assert.match(cloud,/setGateHtml\(coachInvitation\?'coachsignup':parentSignIn\?'parentsignin':'signin'\)/);
assert.match(app,/openInviteDraft:href=>\{if\(typeof href==='string'&&href\.startsWith\('mailto:'\)\)window\.location\.assign\(href\)/);
const events={},nodes=new Map(),drafts=[],clipboard=[];
class Node{
 constructor(id){this.id=id;this.value='';this.validity=true;this.textContent='';this.html='';this.classList={toggle(){}};this.dataset={};}
 get innerHTML(){return this.html;}set innerHTML(v){this.html=v;}
 replaceChildren(){this.html='';}setAttribute(){}addEventListener(){}focus(){this.focused=true;}checkValidity(){return this.validity;}
}
const node=id=>{if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);};
const w={navigator:{clipboard:{writeText:async url=>clipboard.push(url)}},confirm:()=>true,addEventListener:()=>{},ClubHubCoachQualifications:{catalogue:[]}};
vm.runInContext(source,vm.createContext({window:w,document:{getElementById:node,addEventListener:(name,fn)=>events[name]=fn}}));
let allowed=true;
const cloudApi={listPendingCoachRequests:async()=>[],listClubAccessAccounts:async()=>[],listClubCoaches:async()=>[],visibleTeamList:()=>[]};
w.ClubHubCoachOnboarding.configure({
 allowed:()=>allowed,currentView:()=> 'coach-onboarding',contextKey:()=> 'admin|club',
 cloud:()=>cloudApi,
 openInviteDraft:href=>drafts.push(href),toast(){},confirm:async()=>true
});
const invite=async kind=>events.click({target:{closest:selector=>selector==='[data-coach-invite]'?{dataset:{coachInvite:kind}}:null}});
(async()=>{
 await w.ClubHubCoachOnboarding.enter();
 assert.match(node('coach-onboarding-content').innerHTML,/Invite a coach/);
 assert.match(node('coach-onboarding-content').innerHTML,/No Coach or Assistant Coach requests waiting/);
 await invite('email');
 assert.match(node('coach-invite-feedback').textContent,/valid email/);
 assert.equal(drafts.length,0,'no draft for missing email');
 node('coach-invite-email').value='coach@example.invalid';
 await invite('email');
 assert.equal(drafts.length,1,'email prepared');
 assert(drafts[0].startsWith('mailto:coach%40example.invalid?'));
 assert(decodeURIComponent(drafts[0]).includes('https://shootershillafc.app/?signup=coach'));
 assert(!decodeURIComponent(drafts[0]).includes('automatically sent'));
 await invite('copy');
 assert.equal(clipboard[0],'https://shootershillafc.app/?signup=coach');
 allowed=false;
 await invite('email');
 assert.equal(drafts.length,1,'no further invitation without Admin permission');
 console.log('PASS invitation entry with empty request queue, email validation, draft, link copy, Admin role guard and existing signup route');
})().catch(error=>{console.error(error);process.exitCode=1});
