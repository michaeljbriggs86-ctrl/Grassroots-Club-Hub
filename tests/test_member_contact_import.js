#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/member-contact-import.js','utf8');
const api=require('../app/src/main/assets/member-contact-import.js');
const directory={can_manage:true,self:{user_id:'admin',full_name:'Secretary'},contacts:[
 {user_id:'a',full_name:'Alex Same',team_name:'Valiants',role:'parent'},
 {user_id:'a',full_name:'Alex Same',team_name:'Cannons',role:'parent'},
 {user_id:'b',full_name:'Alex Same',team_name:'Cannons',role:'parent'},
 {user_id:'c',full_name:'Coach, "Chris"',team_name:'Valiants',role:'coach'}]};
assert.equal(api.parseCsv('\uFEFFfull_name,email,phone\r\n"Coach, ""Chris""",coach@example.invalid,"07700 900123"\r\n')[0].full_name,'Coach, "Chris"');
assert.throws(()=>api.parseCsv('full_name,email\n"unclosed,a'),/Unclosed/);
assert.throws(()=>api.parseCsv('full_name,email\n"Alex"bad,a'),/Invalid CSV/);
assert.throws(()=>api.parseCsv('full_name,email,address\nAlex,a,secret'),/Addresses/);
assert.throws(()=>api.parseCsv('full_name,email,email\nAlex,a,b'),/Use only/);
assert.throws(()=>api.parseCsv('full_name,email\nAlex,a,extra'),/number of cells/);
assert.throws(()=>api.parseCsv('full_name,email\n'+'Alex,a\n'.repeat(501)),/500/);
assert.throws(()=>api.parseCsv('x'.repeat(api.MAX_BYTES+1)),/1 MB/);
let plan=api.planImport('full_name,email,phone\nAlex Same,a@example.invalid,07700 900123',directory);
assert.match(plan.errors[0],/more than one/);
plan=api.planImport('full_name,team,role,email,phone\nAlex Same,Valiants,parent,a@example.invalid,07700 900123',directory);
assert.deepEqual(plan.updates,[{user_id:'a',email:'a@example.invalid',phone:'07700 900123'}]);
plan=api.planImport('user_id,full_name,email,phone\na,Alex Same,,07700 900123\nc,"Coach, ""Chris""",[CLEAR],\nb,Alex Same,,',directory);
assert.deepEqual(plan.updates,[{user_id:'a',phone:'07700 900123'},{user_id:'c',email:''}]);assert.equal(plan.skipped,1);
assert.equal(plan.preview[0].email,'Keep existing');assert.equal(plan.preview[1].email,'Clear email');
assert(api.planImport('user_id,email\nforeign,a@example.invalid',directory).errors.length);
assert(api.planImport('user_id,full_name,email\na,Wrong person,a@example.invalid',directory).errors.length);
assert(api.planImport('user_id,email\na,bad',directory).errors.length);
assert(api.planImport('user_id,phone\na,1 Road London',directory).errors.length);
assert(api.planImport('user_id,email\na,a@example.invalid\na,b@example.invalid',directory).errors.length);
const template=api.templateCsv({...directory,contacts:[...directory.contacts,{user_id:'d',full_name:'=HYPERLINK("evil")',email:'private@example.invalid'}]});
assert(!template.includes('private@example.invalid'));assert(template.includes("'=HYPERLINK"));assert.equal(api.parseCsv(template).length,5,'one row per account, including admin');
assert(api.planImport(template,directory).updates.length===0);

const nodes=new Map(),events={};
function node(id){if(!nodes.has(id)){const flags=new Set();nodes.set(id,{value:'',files:[],innerHTML:'',textContent:'',disabled:true,
 classList:{add:x=>flags.add(x),toggle:(x,v)=>v?flags.add(x):flags.delete(x),contains:x=>flags.has(x)},addEventListener:(name,fn)=>events[id+':'+name]=fn});}return nodes.get(id);}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={document:{getElementById:node},console};context.window=context;vm.createContext(context);vm.runInContext(source,context);
const ui=context.ClubHubContactImport;let admin=true,key='admin|club',writes=[],imported=0;
const cloud={context:{profile:{user_id:'admin'}},listContactDirectory:async()=>directory,importMemberContactDetails:async rows=>{writes.push(rows);return{ok:true,imported:rows.length};}};
ui.configure({isAdmin:()=>admin,contextKey:()=>key,cloud:()=>cloud,escape:esc,onImported:async count=>{imported=count;}});
const file=text=>{node('contact-import-file').files=[{name:'contacts.csv',size:text.length,text:async()=>text}];};
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:value=>resolve(value)};};
(async()=>{
 const cloudSource=fs.readFileSync('app/src/main/assets/cloud.js','utf8');let role='parent',testMode=false,rpcCalls=[];
 const cloudCtx={role:()=>role,testModeActive:()=>testMode,rpc:async(name,payload)=>{rpcCalls.push({name,payload});return{ok:true,imported:1};}};
 vm.createContext(cloudCtx);vm.runInContext(cloudSource.slice(cloudSource.indexOf('  async function importMemberContactDetails('),cloudSource.indexOf('  async function listClubMessages(')),cloudCtx);
 for(role of ['parent','coach','assistant_coach','player'])await assert.rejects(cloudCtx.importMemberContactDetails([{user_id:'a',email:'a@example.invalid'}]),/Club Admin/);
 role='admin';testMode=true;await assert.rejects(cloudCtx.importMemberContactDetails([{}]),/Club Admin/);testMode=false;
 await assert.rejects(cloudCtx.importMemberContactDetails([]),/500/);
 await cloudCtx.importMemberContactDetails([{user_id:'a',phone:'07700 900123'}]);
 assert.equal(rpcCalls.length,1);assert.equal(rpcCalls[0].name,'import_member_contact_details');assert.equal(rpcCalls[0].payload.p_rows[0].phone,'07700 900123');
 ui.show(true);file('user_id,email,phone\na,new@example.invalid,07700 900123');await ui.preview();
 assert.equal(writes.length,0,'preview never writes');assert.equal(node('contact-import-save').disabled,false);
 await ui.save();assert.equal(writes.length,1);assert.equal(imported,1);assert.equal(node('contact-import-results').innerHTML,'');
 ui.show(true);file('user_id,email\na,bad');await ui.preview();await ui.save();assert.equal(writes.length,1,'any error blocks whole batch');
 file('user_id,email\na,a@example.invalid');await ui.preview();events['contact-import-file:change']();await ui.save();assert.equal(writes.length,1,'new file invalidates preview');
 const late=deferred();cloud.listContactDirectory=()=>late.promise;file('user_id,email\na,a@example.invalid');const reading=ui.preview();
 await Promise.resolve();admin=false;key='parent|team';ui.reset();late.resolve(directory);await reading;
 assert.equal(node('contact-import-results').innerHTML,'','late admin data discarded');assert(node('contact-import-panel').classList.contains('hidden'));await ui.preview();assert.equal(writes.length,1);
 admin=true;key='admin|club';cloud.listContactDirectory=async()=>({...directory,contacts:[{...directory.contacts[0],full_name:'<script>'}]});ui.show(true);file('user_id,email\na,a@example.invalid');await ui.preview();
 assert(!node('contact-import-results').innerHTML.includes('<script>'));assert(node('contact-import-results').innerHTML.includes('&lt;script&gt;'));
 const saveLate=deferred();cloud.importMemberContactDetails=()=>saveLate.promise;const saving=ui.save();ui.reset();key='other-account';saveLate.resolve({ok:true,imported:1});await saving;assert.equal(imported,1,'late save does not repopulate another account');
 console.log('PASS spreadsheet contacts: CSV quoting/BOM/limits, matching, duplicates, blank preservation, explicit clears, safe template, preview gate and stale/account responses');
})().catch(e=>{console.error(e);process.exitCode=1;});
