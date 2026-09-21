#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
checks=[]
def check(name, cond):
    checks.append((name,bool(cond)))

gradle=(root/'app/build.gradle').read_text()
main=(root/'app/src/main/java/com/grassrootsclubhub/universal/MainActivity.java').read_text()
index=(assets/'index.html').read_text()
cloud=(assets/'cloud.js').read_text()
cloudcss=(assets/'cloud.css').read_text()
ds=(assets/'app-design-system.css').read_text()
guidelines=(root/'design_reference/APP-UI-DESIGN-GUIDELINES-SNAPSHOT-2026-09-19.md').read_text()

check('versionCode 2205','versionCode 2205' in gradle)
check('versionName 2.2.5',"versionName '2.2.5'" in gradle)
check('native marker 2.2.5','GrassrootsClubHub/2.2.5' in main)
check('design revision marker','approved-app-ui-2026-09-19-v1' in cloud and 'approved-app-ui-2026-09-19-v1' in ds)
check('design stylesheet linked', 'app-design-system.css' in index and index.index('app-design-system.css') > index.index('onboarding.css'))
check('canonical guideline bundled',(root/'design_reference/APP-UI-DESIGN-GUIDELINES-SNAPSHOT-2026-09-19.md').exists())
check('no-deviation language','No deviations. No exceptions.' in guidelines)
check('Claude and ChatGPT rules','ChatGPT' in guidelines and 'Claude' in guidelines)
check('app-wide scope','entire product' in guidelines and 'all future screens' in guidelines)
check('responsive device classes','Small phones' in guidelines and 'Large tablets / web' in guidelines)
check('real imagery mandatory','Real imagery' in guidelines and 'Forbidden' in guidelines)
check('svg football scene files removed',not any(assets.glob('auth-scene-*.svg')))
for name in ['football-login-adult.jpg','football-login-player.jpg','football-login-club.jpg','football-pitch-hero.jpg','football-team-huddle.jpg']:
    check(f'jpeg asset {name}',(assets/name).exists() and (assets/name).read_bytes()[:2]==b'\xff\xd8')
check('adult uses raster hero',"football-login-adult.jpg" in cloudcss and "football-login-adult.jpg" in ds)
check('player uses raster hero',"football-login-player.jpg" in cloudcss and "football-login-player.jpg" in ds)
check('club uses raster hero',"football-login-club.jpg" in cloudcss and "football-login-club.jpg" in ds)
check('app hero uses raster image',"football-pitch-hero.jpg" in ds and '.hero{' in ds)
check('no auth svg refs','.svg' not in ''.join(line for line in cloudcss.splitlines() if 'auth-scene' in line and 'background-image' in line))
check('short screen scroll rule','Short screens now scroll' in ds and '@media(max-height:730px)' in ds)
check('small phone breakpoint','@media(max-width:374px)' in ds)
check('tablet breakpoint','@media(min-width:600px)' in ds)
check('large breakpoint','@media(min-width:900px)' in ds)
check('minimum touch target','min-height:44px' in ds)
check('no default signed-out banner',"setGateHtml('signin','Signed out.')" not in cloud)
check('old login spec superseded',(root/'design_reference/LOGIN_DESIGN_SPEC.md').read_text().startswith('# SUPERSEDED'))
check('stale replacement workflow removed',not (root/'build-apk-static-feed.REPLACEMENT.yml').exists())
check('static feed retained',(assets/'static-feed-overlay.js').exists() and 'static-feed-overlay.js' in index)

failed=[n for n,v in checks if not v]
for n,v in checks: print(('PASS' if v else 'FAIL')+': '+n)
print(f'\n{len(checks)-len(failed)}/{len(checks)} checks passed')
if failed:
    print('FAILED:',', '.join(failed)); sys.exit(1)
