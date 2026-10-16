// Original CI entry point delegates to the reviewed response-action suite.
// Retains device push, failed saves, stale versions and typography checks.
require('./check_kickoff_response_actions.cjs').run().catch(error=>{
 console.error(error);
 process.exitCode=1;
});
