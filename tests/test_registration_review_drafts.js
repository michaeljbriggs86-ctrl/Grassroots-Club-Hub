'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let source=fs.readFileSync('app/src/main/assets/registration.js','utf8');const marker=' start();\n})();';assert.equal(source.split(marker).length,2);
source=source.replace(marker," window.__reviewTest={setApp:value=>{app=value;draft={};user={id:'admin-a'};},setIdentity:value=>localStorage.setItem(SESSION,JSON.stringify({user:{id:value}}))};\n})();");
const events={},nodes=new Map(),storage=new Map([['grassroots_hub_cloud_session_v1',JSON.stringify({user:{id:'admin-a'}})]]);let confirmed=false,requests=0;
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{toggle(){}},focus(){},addEventListener:(event,fn)=>events[id+':'+event]=fn});return nodes.get(id);}
const window={CLUB_HUB_CLOUD:{},addEventListener:(event,fn)=>events['window:'+event]=fn};
vm.runInNewContext(source,{window,document:{getElementById:node,documentElement:{dataset:{}},querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{hash:'',pathname:'/register.html',search:''},history:{replaceState(){}},URLSearchParams,crypto:{randomUUID:()=> 'fictional'},confirm:()=>confirmed,fetch:()=>{requests++;throw Error('No external calls permitted');},Date,Set});
const application=id=>({id,revision:1,admin:true,status:'submitted',team:'Example Greens',season:'2026/27',email:'parent@example.invalid',submissions:[]});
const click=action=>events['registration-content:click']({target:{closest:()=>({dataset:{action}})}});
const type=value=>events['registration-content:input']({target:{name:'note',value}});
window.__reviewTest.setApp(application('app-a'));click('corrections-screen');type('Correct A <example>');click('resume');click('corrections-screen');assert.match(node('registration-content').innerHTML,/Correct A &lt;example&gt;/,'same-application corrections draft survives Back');
click('resume');click('decline-screen');assert.doesNotMatch(node('registration-content').innerHTML,/Correct A/);type('Decline A');click('resume');click('corrections-screen');assert.match(node('registration-content').innerHTML,/Correct A/);click('resume');click('decline-screen');assert.match(node('registration-content').innerHTML,/Decline A/);
let prevented=false;events['window:beforeunload']({preventDefault(){prevented=true;}});assert(prevented,'unsent Admin note has unload protection');
window.__reviewTest.setApp(application('app-b'));click('corrections-screen');assert.doesNotMatch(node('registration-content').innerHTML,/Correct A|Decline A/);type('Private B');window.__reviewTest.setIdentity('admin-b');click('corrections-screen');assert.doesNotMatch(node('registration-content').innerHTML,/Private B/);
window.__reviewTest.setApp({...application('app-b'),revision:2});click('decline-screen');assert.doesNotMatch(node('registration-content').innerHTML,/Private B|Decline A/);
events['window:pagehide']();assert.equal(node('registration-content').innerHTML,'');assert.equal(requests,0);assert(![...storage.values()].some(v=>/Correct A|Private B|Decline A/.test(v)));
console.log('PASS registration review drafts: separate decision notes, same-context Back/reopen, escaped content, account/application/revision/pagehide isolation and unload guard; zero requests');
