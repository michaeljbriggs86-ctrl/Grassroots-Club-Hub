const s=require('fs').readFileSync('app/src/main/assets/app.js','utf8');
if(!s.includes("n.type==='match_report'&&/restricted for this age group/i.test"))throw new Error('restricted match notification filter missing');
const f=n=>!(n.type==='match_report'&&/restricted for this age group/i.test(String(n.body||'')));
if(f({type:'match_report',body:'Match information against X has been updated. Scores and results are restricted for this age group.'}))throw new Error('should hide');
if(!f({type:'match_report',body:'The match report against X (2-1) has been updated.'}))throw new Error('should keep published age group');
if(!f({type:'access_approved',body:'Your coach access has been approved.'}))throw new Error('should keep other types');
console.log('restricted match notification filter OK');
