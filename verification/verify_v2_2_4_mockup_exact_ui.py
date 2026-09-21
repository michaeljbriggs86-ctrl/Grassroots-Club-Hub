from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
cloud=(root/'app/src/main/assets/cloud.js').read_text()
css=(root/'app/src/main/assets/cloud.css').read_text()
index=(root/'app/src/main/assets/index.html').read_text()
gradle=(root/'app/build.gradle').read_text()
main=(root/'app/src/main/java/com/grassrootsclubhub/universal/MainActivity.java').read_text()
onboarding=(root/'app/src/main/assets/onboarding.js').read_text()
edge=(root/'pending_backend_not_deployed/player-access/index.ts').read_text()
sql=(root/'pending_backend_not_deployed/20260919_player_access_credentials.sql').read_text()
checks={
 'versionCode 2204': 'versionCode 2204' in gradle,
 "versionName 2.2.4": "versionName '2.2.4'" in gradle,
 'native UA 2.2.4': 'GrassrootsClubHub/2.2.4' in main,
 'static feed still referenced': '<script src="static-feed-overlay.js"></script>' in index,
 'mockup design revision marker': "AUTH_DESIGN_REVISION = 'approved-mockup-2026-09-19-v1'" in cloud,
 'design marker emitted in DOM': 'gate.dataset.authDesign=AUTH_DESIGN_REVISION' in cloud,
 'adult screen exact core copy': all(x in cloud for x in ['Welcome Back','Admins, Coaches and Parents sign in with email and password.','Email address','Password','Forgot password?','Player Login','Club Sign Up','One login page for all adult users']),
 'adult screen has no migration links': 'cloud-adult-setup' not in cloud and 'cloud-legacy-access' not in cloud,
 'player screen exact core copy': all(x in cloud for x in ['Player Access','No email required.','Player Name','Player Code','Enter App','Back to Main Login','reusable code provided by their coach or club']),
 'club screen exact core copy': all(x in cloud for x in ['Create Club Account','Set up your club and start inviting coaches, parents and players.','Club Name','Email address','Password','County FA / League','Create Club','Already have an account?']),
 'approved green design tokens': all(x in css for x in ['--auth-green-900:#0b5d35','--auth-canvas:#f3f6f4','--auth-radius-field:11px','--auth-screen-max:430px']),
 'approved scene assets wired': all(x in css for x in ["auth-scene-adult.svg","auth-scene-player.svg","auth-scene-club.svg"]),
 'rounded full-width primary CTA': '.auth-primary' in css and 'width:100%' in css and 'border-radius:var(--auth-radius-button)' in css,
 'outlined player CTA': '.auth-secondary' in css and 'border:1.8px solid var(--auth-green-700)' in css,
 'grass footer implemented': '.auth-grass-footer' in css and 'repeating-linear-gradient' in css,
 'mockup asset retained': (root/'design_reference/APPROVED_LOGIN_MOCKUP_2026-09-19.png').exists(),
 'design brief retained': (root/'design_reference/LOGIN_DESIGN_BRIEF_2026-09-19.png').exists(),
 'club signup prefills onboarding': 'admin_email:email' in cloud and 'admin_password:password' in cloud and 'function open(prefill={})' in onboarding,
 'client U15 gate': "Number(context?.team?.age_group||0)!==15" in cloud,
 'player access endpoint': '/functions/v1/player-access' in cloud,
 'server U15 gate': 'Number(team.age_group) !== 15' in edge,
 'raw player code not stored': 'code_hash' in sql,
 'backend still marked not deployed': 'NOT DEPLOYED' in edge,
}
failed=[k for k,v in checks.items() if not v]
for k,v in checks.items(): print(('PASS' if v else 'FAIL'), '-', k)
if failed:
    print('\nFAILED: '+', '.join(failed), file=sys.stderr)
    sys.exit(1)
print(f'\n{len(checks)}/{len(checks)} structural checks passed.')
