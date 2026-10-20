// Reuse the actual built-app HTTP fixture; never replace the app/cloud API,
// bootstrap or permission functions. RPC responses below are fictional only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2,'shared fixture boundary must remain unique');
harness=harness.slice(0,harness.indexOf(boundary));
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';
assert.equal(harness.split(dispatch).length,2,'shared transport hook must remain unique');
harness=harness.replace(dispatch,`   if(f.rpcOverride){const result=f.rpcOverride(call);if(result){body=result.body;status=result.status||200;}}
${dispatch}`);
const scenarios=async function(){
 try{
  for(const theme of ['dark','light'])for(const width of [320,393,1440]){
   const f=await fixture({initial:'admin-a',role:'club_admin',width,theme});await f.ready();await f.go('?view=coach-onboarding');await f.ready();
   const p=f.page,email=p.locator('#coach-invite-email');await email.waitFor();await email.fill('fictional-coach@example.invalid');
   let accept=false,dialogs=[];p.on('dialog',async dialog=>{dialogs.push(dialog.message());await(accept?dialog.accept():dialog.dismiss());});
   await p.getByRole('button',{name:'Refresh onboarding',exact:true}).click();assert.equal(await email.inputValue(),'fictional-coach@example.invalid');assert.equal(dialogs.length,1);assert.match(dialogs[0],/Discard this unsaved/);
   assert(await p.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}));
   assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));accept=true;await p.getByRole('button',{name:'Refresh onboarding',exact:true}).click();await p.waitForFunction(()=>document.getElementById('coach-invite-email')?.value==='');assert.equal(dialogs.length,2);
   assert.equal(f.calls.filter(c=>/review_coach_request|assign_coach_team|create_invite/.test(c.name)).length,0);cases.push(`${theme}-${width}`);await f.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,pageErrors:errors,externalRequests,externalWrites},null,2));
  console.log('PASS built coach invitation draft: 6 theme/viewport scenarios; native Cancel retains text, explicit discard reloads, unload guard and zero invitation/permission writes');
 }finally{for(const context of contexts)await context.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
// Compile only the fixture and this test function. Production code is served
// unmodified from dist and executes with the actual cloud client in Chromium.
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
