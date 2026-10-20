'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {deferred,tick}=require('./helpers/cloud_client_harness');
const source=fs.readFileSync('app/src/main/assets/registration.js','utf8');
function section(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function fixture(){
 const digest=deferred(),request=deferred(),events=[];let account='a';
 const ctx={app:{id:'a',admin:true},serial:1,busy:false,reads:new Set(),identity:()=>account,
  document:{querySelectorAll:()=>[]},status:(...x)=>events.push(['status',...x]),
  readFields:()=>events.push(['readFields']),rpc:()=>request.promise,
  crypto:{subtle:{digest:()=>digest.promise}},TextEncoder,Uint8Array,
  heading:x=>x,panel:(x,y)=>y,button:()=>'',esc:x=>x,render:x=>events.push(['render',x])};
 vm.createContext(ctx);vm.runInContext(section('async function run(fn){',' function field(')+section('async function documentPage(kind){'," $('registration-content').addEventListener('input'"),ctx);
 return {ctx,digest,request,events,account:x=>account=x,start:()=>ctx.run(()=>ctx.documentPage('terms'))};
}
(async()=>{
 for(const stage of ['request','digest'])for(const transition of ['account','application','signout'])for(const outcome of ['resolve','reject']){
  const f=fixture(),p=f.start();
  if(stage==='digest'){f.request.resolve({document:{text:'Original terms',sha256:'01'}});await tick();}
  if(transition==='account'){f.account('b');f.ctx.serial++;f.ctx.app={id:'b',admin:true};}
  if(transition==='application')f.ctx.app={id:'b',admin:true};
  if(transition==='signout'){f.account('');f.ctx.serial++;f.ctx.app=null;}
  const before=f.events.length;
  const pending=stage==='request'?f.request:f.digest;
  if(outcome==='reject')pending.reject(Error('old request failed'));
  else pending.resolve(stage==='request'?{document:{text:'Original terms',sha256:'01'}}:new Uint8Array([1]).buffer);
  await p;
  assert(!f.events.slice(before).some(e=>e[0]==='render'||e[0]==='status'&&e[2]===true),`${stage}/${transition}/${outcome}: old content/error must not enter the new context`);
  assert.equal(f.ctx.reads.size,0);
 }
 for(const valid of [true,false]){
  const f=fixture(),p=f.start();f.request.resolve({document:{text:'Original terms',title:'Terms',sha256:valid?'01':'wrong'}});await tick();f.digest.resolve(new Uint8Array([1]).buffer);await p;
  assert.equal(f.ctx.reads.has('terms'),valid);
  assert.equal(f.events.some(e=>e[0]==='render'),valid);
  if(!valid)assert(f.events.some(e=>e[0]==='status'&&/integrity check failed/.test(e[1])));
 }
 console.log('PASS registration documents: late read/digest success and rejection, account/application/signout isolation, valid and invalid checksums');
})().catch(e=>{console.error(e);process.exitCode=1;});
