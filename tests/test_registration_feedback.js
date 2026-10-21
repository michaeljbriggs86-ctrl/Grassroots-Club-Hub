'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let source=fs.readFileSync('app/src/main/assets/registration.js','utf8');
const marker=' start();\n})();';assert.equal(source.split(marker).length,2);
source=source.replace(marker," window.__feedbackTest={show:value=>{app=value;draft=value.answers||{};user={id:'fictional-admin'};renderApplication();}};\n})();");
const events={},nodes=new Map(),storage=new Map([['grassroots_hub_cloud_session_v1',JSON.stringify({user:{id:'fictional-admin'}})]]);let requests=0;
function node(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{toggle(){}},focus(){},addEventListener:(event,fn)=>events[id+':'+event]=fn});return nodes.get(id);}
const window={CLUB_HUB_CLOUD:{},addEventListener:(event,fn)=>events['window:'+event]=fn};
vm.runInNewContext(source,{window,document:{getElementById:node,documentElement:{dataset:{}},querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},location:{hash:'',pathname:'/register.html',search:''},history:{replaceState(){}},URLSearchParams,crypto:{randomUUID:()=> 'fictional'},fetch:()=>{requests++;throw Error('No external calls permitted');},Date,Set});
const api=window.__feedbackTest,body=()=>node('registration-content').innerHTML;
const application={id:'fictional-a',revision:2,admin:true,status:'corrections',team:'Example Greens',season:'2026/27',email:'parent@example.invalid',delivery:'sent',submissions:[]};
const note='Please confirm <school> & "year".\nSecond line <img src=x onerror=alert(1)>';
for(const status of ['corrections','declined']){
 api.show({...application,status,feedback:note});assert.match(body(),status==='corrections'?/Saved correction message/:/Saved decline message/);assert(body().includes('Please confirm &lt;school&gt; &amp; &quot;year&quot;.\nSecond line &lt;img src=x onerror=alert(1)&gt;'));assert.doesNotMatch(body(),/<img|<textarea|data-action="approve-screen"/);assert.equal((body().match(/class="registration-feedback"/g)||[]).length,1);
 api.show({...application,status,feedback:note});assert.equal((body().match(/class="registration-feedback"/g)||[]).length,1,'reopen replaces the note');
 for(const feedback of ['', ' \n\t ']){api.show({...application,status,feedback});assert.match(body(),/No review message was recorded\./);assert.doesNotMatch(body(),/unavailable/);}
 for(const feedback of [undefined,null,{},false]){api.show({...application,status,feedback});assert.match(body(),/The saved review message is unavailable\./);assert.doesNotMatch(body(),/No review message was recorded|\[object Object\]/);}
}
for(const status of ['invited','draft','submitted','approved','cancelled','expired']){api.show({...application,status,feedback:note});assert.doesNotMatch(body(),/registration-feedback|Saved correction message|Saved decline message|Second line/,'unrelated status does not present retained feedback as current');}
api.show({...application,feedback:'PRIVATE_OLD_NOTE'});api.show({...application,id:'fictional-b',status:'declined',feedback:'OTHER_NOTE'});assert.doesNotMatch(body(),/PRIVATE_OLD_NOTE/);assert.match(body(),/OTHER_NOTE/);
api.show({...application,admin:false,feedback:note});assert.match(body(),/A change is needed/);assert(body().includes('Please confirm &lt;school&gt;'));assert.doesNotMatch(body(),/Saved correction message/,'existing parent renderer retained');
api.show({...application,admin:false,status:'declined',feedback:note});assert.match(body(),/Application declined/);assert(body().includes('Please confirm &lt;school&gt;'));assert.doesNotMatch(body(),/Saved decline message/);
events['window:pagehide']();assert.equal(body(),'');assert.equal(requests,0);assert(![...storage.values()].some(v=>v.includes('NOTE')||v.includes('Please confirm')));
console.log('PASS registration feedback: saved correction/decline, escaped multiline, truthful empty/unavailable, other-status suppression, re-open/application replacement, unchanged parent messages and pagehide privacy; zero requests');
