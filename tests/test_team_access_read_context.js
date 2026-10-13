const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
const code=source.slice(source.indexOf('let __teamMembersStamp=0;'),source.indexOf('let __appConfirmPending=false;'));
function fixture(){
 let team='one',user='staff',pending=[];const list={innerHTML:''};
 const cloud={currentTeam:()=>({id:team}),session:{user:{get id(){return user;}}},
 listTeamMembers:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),listParentPlayerLinks:async()=>[],listPlayerAccountLinks:async()=>[],listPendingParentRequests:async()=>[{request_id:team,parent_name:team}]};
 const ctx={window:{ClubHubCloud:cloud},document:{getElementById:()=>list},CLOUD_MODE:true,currentRole:'coach',Date,Promise,
 personNameButton:(name,id,source,team,detail)=>[name,id,source,team,detail].join(':'),accessRoleLabel:role=>role};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,list,cloud,pending,load:quiet=>ctx.refreshTeamMembers(quiet),team:value=>team=value,user:value=>user=value};
}
(async()=>{
 let f=fixture(),p=f.load();f.team('two');f.pending[0].resolve([{user_id:'old',full_name:'Old team',role:'coach'}]);assert.equal(await p,null);assert(!f.list.innerHTML.includes('Old team'));
 f=fixture();const old=f.load();f.team('two');const fresh=f.load(true);assert.equal(f.pending.length,2,'quiet load cannot reuse another team’s stamp');
 f.pending[1].resolve([{user_id:'new',full_name:'New team',role:'coach'}]);await fresh;f.pending[0].resolve([{user_id:'old',full_name:'Old team',role:'coach'}]);await old;assert.match(f.list.innerHTML,/New team/);assert(!f.list.innerHTML.includes('Old team'));
 for(const change of [x=>x.user('other'),x=>x.ctx.currentRole='parent',x=>x.ctx.window.ClubHubCloud={...x.cloud}]){f=fixture();p=f.load();change(f);f.pending[0].resolve([{full_name:'Restricted',role:'coach'}]);assert.equal(await p,null);assert(!f.list.innerHTML.includes('Restricted'));}
 f=fixture();f.cloud.listPendingParentRequests=async()=>{throw Error('Requests unavailable');};p=f.load();f.pending[0].resolve([{full_name:'Known account',role:'parent'}]);await p;assert.match(f.list.innerHTML,/Could not load parent requests/);assert.match(f.list.innerHTML,/Known account/);assert.match(f.list.innerHTML,/own-child information only/);
 f=fixture();f.cloud.listPendingParentRequests=async()=>[];p=f.load();f.pending[0].resolve([{full_name:'Known account',role:'coach'}]);await p;assert.match(f.list.innerHTML,/Active access/);assert(!f.list.innerHTML.includes('No team access accounts'));
 console.log('PASS Team Access reads reject changed team/user/role/API and out-of-order responses; partial and empty requests preserve active accounts');
})().catch(e=>{console.error(e);process.exitCode=1;});
