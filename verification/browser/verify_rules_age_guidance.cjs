// Exercise the real generated app against fictional HTTP responses only.
const fs=require('node:fs'),assert=require('node:assert/strict');
let harness=fs.readFileSync('verification/browser/verify_account_context_isolation.cjs','utf8');
const boundary=" try{\n  for(const [initial,role] of [['coach-a','coach'],['admin-a','club_admin']]){";
assert.equal(harness.split(boundary).length,2);
harness=harness.slice(0,harness.indexOf(boundary));
harness=harness.replace("callback='',variant='fresh'}={})", "callback='',variant='fresh',ruleEmpty=false}={})");
harness=harness.replace("  page.on('pageerror'", "  f.ruleFixture={empty:ruleEmpty};\n  page.on('pageerror'");
const dispatch='   const holdIndex=holds.findIndex(row=>row.match(call));';
assert.equal(harness.split(dispatch).length,2);
harness=harness.replace(dispatch,`   if(f.ruleFixture&&call.path==='/rest/v1/teams')body=f.ruleFixture.empty?teams.map(t=>({...t,age_group:null})):clone(teams);
   if(f.ruleFixture&&call.name==='get_my_club_configuration')body={...body,settings:{...body.settings,default_provider_key:'selkent'},providers:[{provider_key:'fictional-selkent',provider_type:'selkent',is_primary:true,enabled:true,config:{}}],teams:f.ruleFixture.empty?teams.map(t=>({...t,age_group:null})):clone(teams),rules:[{age_group:12,format:'11v11',players_on_pitch:11,max_registered:18,matchday_max:16,rolling_substitutions:true,results_published:true,player_accounts_allowed:false}]};
${dispatch}`);
const scenarios=async function(){
 try{
  const cases=[],measurements=[];let procedures='';
  for(const theme of ['dark','light'])for(const width of [320,393,1440])for(const empty of [true,false]){
   console.log('Checking Rules',theme,width,empty?'no available ages':'selected age');
   const f=await fixture({initial:'admin-a',role:'club_admin',theme,width,ruleEmpty:empty});await f.ready();await f.go('?view=rules');await f.ready();const p=f.page,select=p.locator('#club-rule-age'),intro=p.locator('#rules-procedures-intro'),rules=p.locator('#universal-config-rules');
   await p.waitForLoadState('networkidle');await select.waitFor({state:'visible'});
   const general=await p.locator('#view-rules .procedure-list').innerText();if(procedures)assert.equal(general,procedures);else procedures=general;
   if(empty){assert.equal(await select.locator('option').count(),1);assert.match(await select.innerText(),/No age groups available/);assert.match(await intro.innerText(),/No age groups are currently available in this view/);assert.match(await rules.innerText(),/General procedures remain below/);assert.doesNotMatch(await rules.innerText(),/Choose|No teams|failed|error/i);}
   else{assert.match(await intro.innerText(),/Choose an age group/);await select.focus();await select.selectOption('12');assert.match(await rules.innerText(),/11v11/);assert.equal(await select.inputValue(),'12');const focus=await select.evaluate(n=>({retained:document.activeElement===n,active:document.activeElement?.id,visible:!!n.getClientRects().length,details:n.closest('details')?.open,view:document.querySelector('.view.active')?.id}));assert(focus.retained,'native selected-age redraw retains focus: '+JSON.stringify(focus));}
   assert(!await select.isDisabled());const source=p.locator('#view-rules a.map-link');assert.equal(await source.getAttribute('href'),'https://www.selkent.org.uk/');assert.equal(await source.getAttribute('target'),'_blank');assert.equal(await source.getAttribute('rel'),'noopener noreferrer');
   const layout=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,width:innerWidth,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,selectorHeight:document.getElementById('club-rule-age').getBoundingClientRect().height}));assert.equal(layout.theme,theme);assert(!layout.overflow);assert(layout.selectorHeight>=48);measurements.push({...layout,empty});
   assert.equal(f.calls.filter(c=>/^(save_|assign_|create_|archive_|rollover_|record_audit_event|mark_)/.test(c.name)).length,0);cases.push(`admin-${theme}-${width}-${empty?'empty':'selected'}`);await f.close();
  }
  for(const role of ['coach','assistant_coach']){const f=await fixture({role,width:393,ruleEmpty:true});await f.ready();await f.go('?view=rules');await f.ready();assert(!await f.page.locator('#club-rule-age-field').isVisible());assert.doesNotMatch(await f.page.locator('#rules-procedures-intro').innerText(),/No age groups|Choose an age group/);cases.push('team-'+role);await f.close();}
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);assert.deepEqual(externalWrites,[]);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({browser:browser.version(),cases,measurements,pageErrors:errors,externalRequests,externalWrites},null,2));console.log('PASS built Rules guidance: 12 Admin empty/selected theme/viewport cases and 2 team roles; general procedures/source semantics unchanged, native selection focus retained, no rule or account writes. Page-wide typography and native zoom remain unverified.');
 }finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();await new Promise(resolve=>server.close(resolve));}
};
new Function('require','process',harness+'await ('+scenarios.toString()+')();\n}\nmain().catch(error=>{console.error(error);server.close();process.exitCode=1;});')(require,process);
