const fs=require('fs');const s=fs.readFileSync('app/src/main/assets/app.js','utf8');
const must=["data-review-coach-request","reviewCoachAccessNotification","type==='coach_access_request'","setClubTab('coaches')","refreshCoachRequests()"];
for(const m of must)if(!s.includes(m))throw new Error('missing '+m);
if(!/coachReview\}\$\{mark\}/.test(s))throw new Error('button not rendered in notification actions');
console.log('coach request notification link OK');
