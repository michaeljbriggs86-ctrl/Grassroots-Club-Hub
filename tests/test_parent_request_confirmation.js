#!/usr/bin/env node
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const helper=source.slice(source.indexOf('let __appConfirmPending='),source.indexOf('function openParentRequestReview('));
const approval=source.slice(source.indexOf('let __parentRequestApprovalPending='),source.indexOf('async function openParentLinkDialog('));
assert(helper&&approval);

function fixture(){
 const queued=[],messages=[],alerts=[],calls=[],audits=[],refreshes=[];
 const document={activeElement:null};
 class Element{
   constructor(){this.listeners=new Map();this.open=false;this.isConnected=true;this.dataset={};this.value='';}
   addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
   removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
   emit(type,extra={}){const event={preventDefault(){this.prevented=true;},...extra};for(const fn of [...(this.listeners.get(type)||[])])fn(event);return event;}
   focus(){document.activeElement=this;}
   showModal(){this.open=true;}
   close(){this.open=false;queued.push(()=>this.emit('close'));}
 }
 const ids=['app-confirm-dialog','app-confirm-title','app-confirm-body','app-confirm-detail','app-confirm-cancel','app-confirm-accept','parent-request-review-id','parent-request-review-dialog','parent-request-approve'];
 const nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));
 document.getElementById=id=>nodes[id];
 const selected=new Element();selected.value='Lindi';
 document.querySelector=()=>selected;
 nodes['parent-request-review-id'].value='request';nodes['parent-request-review-dialog'].open=true;
 document.activeElement=nodes['parent-request-approve'];
 let team='team',user='staff',effectiveRole='coach';
 const cloud={currentTeam:()=>({id:team}),session:{user:{get id(){return user;}}},role:()=>effectiveRole,approveParentRequest:async(...args)=>calls.push(args)};
 const players=[{name:'Lindi'}];
 const ctx={document,window:{ClubHubCloud:cloud},currentRole:'coach',__pendingParentRequests:[{request_id:'request',user_id:'parent',child_name:'Lindi'}],__teamMembersStamp:10,
   activePlayers:()=>players,toast:x=>messages.push(x),alert:x=>alerts.push(x),auditEvent:(...x)=>audits.push(x),refreshTeamMembers:async()=>refreshes.push('members'),refreshNotifications:async()=>refreshes.push('notifications')};
 vm.createContext(ctx);vm.runInContext(helper+approval,ctx);
 return {ctx,nodes,selected,cloud,players,calls,messages,alerts,audits,refreshes,document,
   submit:()=>ctx.submitParentRequestReview({preventDefault(){}}),accept:()=>nodes['app-confirm-accept'].emit('click'),cancel:()=>nodes['app-confirm-cancel'].emit('click'),
   flush:()=>{while(queued.length)queued.shift()();},team:x=>team=x,user:x=>user=x,role:x=>effectiveRole=x};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let f=fixture();
 let pending=f.ctx.appConfirm({title:'<img src=x>',body:'A & B',detail:'Kept'});
 assert.equal(f.nodes['app-confirm-title'].textContent,'<img src=x>');
 assert.equal(f.document.activeElement,f.nodes['app-confirm-cancel']);
 assert.equal(await f.ctx.appConfirm({body:'overlapping'}),false);
 assert.equal(f.nodes['app-confirm-body'].textContent,'A & B');
 assert(f.nodes['app-confirm-dialog'].emit('keydown',{key:'Tab'}).prevented);
 assert.equal(f.document.activeElement,f.nodes['app-confirm-accept']);
 f.nodes['app-confirm-dialog'].emit('keydown',{key:'Tab',shiftKey:true});
 assert.equal(f.document.activeElement,f.nodes['app-confirm-cancel']);
 f.nodes['app-confirm-dialog'].emit('keydown',{key:'Escape'});assert.equal(await pending,false);
 assert.equal(f.document.activeElement,f.nodes['parent-request-approve']);
 assert.equal(f.nodes['parent-request-review-dialog'].open,true);
 // A close event queued by the previous invocation must not cancel a reopened prompt.
 pending=f.ctx.appConfirm({body:'next'});f.flush();assert.equal(f.nodes['app-confirm-dialog'].open,true);
 f.accept();f.accept();assert.equal(await pending,true);f.flush();
 for(const node of Object.values(f.nodes))for(const listeners of node.listeners.values())assert.equal(listeners.size,0);
 pending=f.ctx.appConfirm();f.nodes['app-confirm-dialog'].close();f.flush();assert.equal(await pending,false);
 pending=f.ctx.appConfirm();f.nodes['app-confirm-dialog'].emit('cancel');assert.equal(await pending,false);
 f.nodes['app-confirm-dialog'].showModal=()=>{throw Error('unavailable');};assert.equal(await f.ctx.appConfirm(),false);
 f.nodes['app-confirm-dialog'].showModal=()=>{f.nodes['app-confirm-dialog'].open=true;};
 f.nodes['parent-request-approve'].focus=()=>{throw Error('detached');};pending=f.ctx.appConfirm();f.cancel();assert.equal(await pending,false);
 delete f.nodes['app-confirm-dialog'];assert.equal(await f.ctx.appConfirm(),false);

 f=fixture();pending=f.submit();assert.equal(f.nodes['app-confirm-body'].textContent,'Approve this request and link Lindi to this parent?');
 assert.equal(f.nodes['app-confirm-detail'].textContent,'Existing child links are kept.');
 await f.submit();f.cancel();await pending;assert.equal(f.calls.length,0);assert.equal(f.audits.length,0);assert.equal(f.refreshes.length,0);
 assert.equal(f.nodes['parent-request-review-dialog'].open,true);
 f.ctx.__pendingParentRequests[0].child_name='Lindy';pending=f.submit();
 assert.equal(f.nodes['app-confirm-body'].textContent,'Approve this request? The parent typed “Lindy” and you chose Lindi.');
 f.accept();await pending;assert.deepEqual(f.calls,[['request','Lindi']]);assert.equal(f.audits.length,1);assert.deepEqual(f.refreshes,['members','notifications']);
 assert.equal(f.nodes['parent-request-review-dialog'].open,false);assert.equal(f.nodes['parent-request-approve'].disabled,false);

 const stale=[x=>x.team('other'),x=>x.user('other'),x=>x.ctx.currentRole='parent',x=>x.role('parent'),x=>x.ctx.window.ClubHubCloud={...x.cloud},x=>x.selected.value='other',x=>x.players.length=0,x=>x.ctx.__pendingParentRequests.length=0,x=>x.ctx.__pendingParentRequests[0].user_id='other',x=>x.ctx.__pendingParentRequests[0].child_name='changed',x=>x.nodes['parent-request-review-id'].value='other',x=>x.nodes['parent-request-review-dialog'].open=false];
 for(const change of stale){f=fixture();pending=f.submit();change(f);f.accept();await pending;assert.equal(f.calls.length,0);assert.equal(f.audits.length,0);assert.match(f.messages.at(-1),/changed/);}
 for(const change of [x=>x.ctx.currentRole='parent',x=>x.selected.value='',x=>x.players.length=0,x=>x.ctx.__pendingParentRequests.length=0]){f=fixture();change(f);await f.submit();assert.equal(f.calls.length,0);assert.equal(f.nodes['app-confirm-dialog'].open,false);}
 for(const role of ['admin','coach','assistant_coach']){f=fixture();f.ctx.currentRole=role;f.role(role);pending=f.submit();f.accept();await pending;assert.equal(f.calls.length,1);}
 f=fixture();f.ctx.__pendingParentRequests[0].child_name='  lindi  ';pending=f.submit();assert.equal(f.nodes['app-confirm-body'].textContent,'Approve this request and link Lindi to this parent?');f.cancel();await pending;

 // The guard covers both the dialog and the in-flight RPC, and recovers after errors.
 f=fixture();let release;f.cloud.approveParentRequest=(...args)=>{f.calls.push(args);return new Promise(resolve=>release=resolve);};
 pending=f.submit();await f.submit();f.accept();await tick();assert.equal(f.nodes['parent-request-approve'].disabled,true);await f.submit();assert.equal(f.calls.length,1);release();await pending;
 f=fixture();f.cloud.approveParentRequest=async()=>{throw Error('Retry');};pending=f.submit();f.accept();await pending;assert.deepEqual(f.alerts,['Retry']);assert.equal(f.nodes['parent-request-approve'].disabled,false);
 f.cloud.approveParentRequest=async(...args)=>f.calls.push(args);pending=f.submit();f.accept();await pending;assert.equal(f.calls.length,1);
 // Switching teams during an accepted RPC must not audit, close or refresh the new team.
 f=fixture();f.cloud.approveParentRequest=()=>new Promise(resolve=>release=resolve);pending=f.submit();f.accept();await tick();f.team('other');release();await pending;
 assert.equal(f.audits.length,0);assert.equal(f.refreshes.length,0);assert.equal(f.nodes['parent-request-review-dialog'].open,true);assert.match(f.messages.at(-1),/Reopen Team access/);
 f=fixture();f.cloud.approveParentRequest=()=>new Promise(resolve=>release=resolve);pending=f.submit();f.accept();await tick();f.nodes['parent-request-review-id'].value='other';release();await pending;assert.equal(f.nodes['parent-request-review-dialog'].open,true);

 const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
 assert.match(html,/id="app-confirm-dialog"[^>]*aria-labelledby="app-confirm-title"[^>]*aria-describedby="app-confirm-body app-confirm-detail"/);
 for(const id of ['app-confirm-cancel','app-confirm-accept'])assert.match(html,new RegExp('type="button" id="'+id+'"'));
 assert.match(html,/type="submit"[^>]*id="parent-request-approve"/);
 console.log('PASS app confirmation focus, cancellation, safe text, cleanup and reopen; approval wording, duplicate prevention, roles, stale context and RPC recovery');
})().catch(error=>{console.error(error);process.exitCode=1;});
