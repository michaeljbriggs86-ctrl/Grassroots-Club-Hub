// Run built-UI suites serially so they have independent servers and browser state.
// Retains response actions/device push and the compact Admin weekend status.
(async()=>{
 await require('./check_kickoff_response_actions.cjs').run();
 await require('./check_admin_weekend_seen.cjs').run();
})().catch(error=>{
 console.error(error);
 process.exitCode=1;
});
