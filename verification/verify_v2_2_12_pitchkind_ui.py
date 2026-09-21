#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, re, struct, sys
root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
fail=[]; passed=0

def check(name, cond):
    global passed
    if cond: passed+=1; print('PASS',name)
    else: fail.append(name); print('FAIL',name)

def txt(p): return (root/p).read_text(encoding='utf-8')
def sha(p): return hashlib.sha256((root/p).read_bytes()).hexdigest()

gradle=txt('app/build.gradle')
main=txt('app/src/main/java/com/grassrootsclubhub/universal/MainActivity.java')
strings=txt('app/src/main/res/values/strings.xml')
index=txt('app/src/main/assets/index.html')
app=txt('app/src/main/assets/app.js')
cloud=txt('app/src/main/assets/cloud.js')
onboard=txt('app/src/main/assets/onboarding.js')
sw=txt('app/src/main/assets/service-worker.js')
manifest=json.loads(txt('app/src/main/assets/manifest.json'))
results_feed=json.loads(txt('data/results.json'))
styles=txt('app/src/main/assets/styles.css')
scraper=txt('scripts/scrape.py')
scraper_tests=txt('tests/test_selkent_scrape.py')

check('versionCode 2212','versionCode 2212' in gradle)
check('versionName 2.2.12',"versionName '2.2.12'" in gradle)
check('applicationId preserved',"applicationId 'com.grassrootsclubhub.universal'" in gradle)
check('native marker version','GrassrootsClubHub/2.2.12' in main)
check('auth scheme preserved','"grassrootsclubhub".equalsIgnoreCase' in main and 'android:scheme="grassrootsclubhub"' in txt('app/src/main/AndroidManifest.xml'))
check('ClubHubNative preserved','"ClubHubNative"' in main)
check('static feed host preserved','raw.githubusercontent.com' in main and 'Grassroots-Club-Hub/main/data/directory.json' in main and 'Grassroots-Club-Hub/main/data/results.json' in main)
check('Android app label PitchKind','>PitchKind<' in strings)
check('HTML title PitchKind','<title>PitchKind</title>' in index)
check('About version 2.2.12','App version 2.2.12' in index)
check('manifest name PitchKind',manifest.get('name')=='PitchKind' and manifest.get('short_name')=='PitchKind')
check('manifest version 2.2.12',manifest.get('version')=='2.2.12')
check('v1.4 marker','approved-app-ui-2026-09-21-v1.4-pitchkind' in cloud and 'approved-app-ui-2026-09-21-v1.4-pitchkind' in txt('app/src/main/assets/app-design-system.css'))

hashes={
 'pitchkind-wt_logo-primary.svg':'5b8ef5b72e2d6d1b283a0a489f27fd33faedafc3b57ea1027dd5fbd9b9b5e900',
 'pitchkind-wt_logo-reverse.svg':'54beb69b69e226edf24861db56bf8afab17badf7b4b32f3f78e33be8be1614d9',
 'pitchkind-wt_mark.svg':'bcf214780a10b7c682c0cde92475c948151ffc772c457a837c30765df81a3efb',
 'pitchkind-wt_mark-reverse.svg':'7978318a04a1a09964410a596e1168406e75ecc80e89808612e516d892b342f2',
 'pitchkind-wt_app-icon.svg':'ddab3592640bc05e7974d474e0f06dae1a104bc5478b7920eb08e0be6173a754',
 'pitchkind-wt_app-icon-foreground.svg':'dcd648d4f93efe3f7ba7be200d58baaace7cd29323b6cff704c28cb8ec803c4f',
}
for name,want in hashes.items():
    check(name+' exact approved bytes', (assets/name).exists() and sha('app/src/main/assets/'+name)==want)

active_text='\n'.join([index,app,cloud,onboard,sw,txt('app/src/main/assets/app-design-system.css'),txt('app/src/main/assets/onboarding.css')])
check('no retired official tagline in active UI','CONNECT • ORGANISE • GROW THE GAME' not in active_text)
check('no More Than A Game text in active UI','More Than A Game' not in active_text)
check('no retired visual asset refs',not re.search(r'(?<![A-Za-z0-9_-])gch-(?:logo|mark|banner|app-icon)', active_text))
check('splash uses reverse PitchKind logo','pitchkind-wt_logo-reverse.svg' in index)
check('auth uses primary PitchKind logo','pitchkind-wt_logo-primary.svg' in cloud)
check('onboarding uses primary PitchKind logo','pitchkind-wt_logo-primary.svg' in onboard)
check('fallback uses PitchKind mark',"img.src=logo||'pitchkind-wt_mark.svg'" in app)
check('demo club does not masquerade platform mark as club badge',"logo_asset:''" in cloud)
check('service worker caches PitchKind assets','pitchkind-wt_logo-primary.svg' in sw and 'gch-logo-primary.svg' not in sw)

# Image dimensions without external libraries.
def png_size(p):
    b=p.read_bytes()[:24]
    if b[:8]!=b'\x89PNG\r\n\x1a\n': return None
    return struct.unpack('>II',b[16:24])
def jpeg_size(p):
    data=p.read_bytes(); i=2
    if data[:2]!=b'\xff\xd8': return None
    while i < len(data)-9:
        if data[i]!=0xFF: i+=1; continue
        marker=data[i+1]; i+=2
        if marker in (0xD8,0xD9): continue
        if i+2>len(data): break
        ln=int.from_bytes(data[i:i+2],'big')
        if marker in range(0xC0,0xC4):
            h=int.from_bytes(data[i+3:i+5],'big'); w=int.from_bytes(data[i+5:i+7],'big'); return (w,h)
        i+=ln
    return None
for name,size in {'icon-192.png':(192,192),'icon-512.png':(512,512),'icon-maskable-512.png':(512,512)}.items():
    check(name+' dimensions',png_size(assets/name)==size)
for name in ['football-login-adult.jpg','football-login-player.jpg','football-login-club.jpg','football-pitch-hero.jpg']:
    check(name+' 2048x740',jpeg_size(assets/name)==(2048,740))

for density,size in {'mdpi':48,'hdpi':72,'xhdpi':96,'xxhdpi':144,'xxxhdpi':192}.items():
    for name in ['ic_launcher.png','ic_launcher_round.png']:
        check(f'{density}/{name} dimensions',png_size(root/f'app/src/main/res/mipmap-{density}/{name}')==(size,size))

check('single APK workflow',(root/'.github/workflows/build-apk.yml').exists() and len(list((root/'.github/workflows').glob('build-apk*.y*ml')))==1)
check('current UI guide bundled',(root/'APP-UI-DESIGN-GUIDELINES.md').exists() and 'Version 1.4' in txt('APP-UI-DESIGN-GUIDELINES.md'))
check('brand guide bundled',(root/'BRAND-GUIDELINES.md').exists() and 'Version 1.0' in txt('BRAND-GUIDELINES.md'))
check('image provenance bundled',(root/'IMAGE-PROVENANCE-v2.2.8.md').exists())

check(
    'Inbox role routing fixed',
    "view==='inbox'&&!['admin','coach','assistant_coach','parent'].includes(currentRole)" in app,
)
check(
    'verified live Selkent fixture parser present',
    "fixtureContainer.querySelectorAll('h2.subHead,.panel-title,.fixtureRow')" in app
    and "providerTeamIds" in app,
)
check(
    'Match played wizard present',
    'data-match-played' in app
    and 'matchReportStepDefinitions' in app
    and 'match-report-score-section' in index,
)
check(
    'Next fixture Match played route is wired',
    'id=\"next-match-played\"' in index
    and 'id=\"matches-next-played\"' in index
    and 'openNextFixtureMatchReport' in app
    and "addEventListener('click',openNextFixtureMatchReport)" in app
    and 'fixtureLinkedMatch' in app,
)
check(
    'Static fixture authority is wired into runtime',
    "FIXTURE_SOURCE='github-static-fixtures-v2'" in txt('app/src/main/assets/static-feed-overlay.js')
    and 'applyStaticFixtures' in txt('app/src/main/assets/static-feed-overlay.js')
    and 'ClubHubStaticSelkent?.applyStaticFixtures' in app,
)
check(
    'attendance slider present',
    'data-attendance-toggle' in app
    and 'attendance-switch' in txt('app/src/main/assets/styles.css'),
)

check(
    'v2.2.12 native User-Agent constant',
    'private static final String NATIVE_USER_AGENT' in main
    and 'GrassrootsClubHub/2.2.12' in main
    and 'c.setRequestProperty("User-Agent", NATIVE_USER_AGENT);' in main,
)

check(
    'native worker contains no WebView User-Agent read',
    'getUserAgentString()' not in main
    and main.count('setUserAgentString(NATIVE_USER_AGENT)') >= 2,
)

check(
    'new matches default to Scheduled',
    "function openNewMatchForCompetition(competition,status='scheduled')" in app
    and "status.value='scheduled'" in app
    and "defaultStatus||'scheduled'" in app
    and '<select id="match-status"><option value="scheduled">Scheduled</option>' in index,
)

check(
    'full-screen Match played state',
    '/* v2.2.11 — full-screen Match played flow */' in styles
    and 'dialog.report-wizard-mode' in styles
    and 'height:100dvh!important' in styles
    and "classList.add('report-wizard-mode')" in app,
)

u9 = next((g for g in results_feed.get('age_groups', []) if g.get('age_group') == 'U9'), {})
u9_fixtures = u9.get('fixtures') or []
check(
    'verified populated U9 multi-week fixture feed retained',
    u9.get('fixture_parse_status') == 'verified_multiweek_fixture_rows_v2'
    and 2 in (u9.get('fixture_week_ids') or [])
    and 3 in (u9.get('fixture_week_ids') or [])
    and any(
        f.get('date') == '2026-09-27'
        and f.get('division_name') == 'Under 9D Navy'
        and f.get('home') == 'Junior Reds Sabres'
        and f.get('away') == 'Shooters Hill AFC Valiants'
        and f.get('provider_team_ids') == ['139', '972']
        for f in u9_fixtures
    )
    and any(
        f.get('date') == '2026-10-04'
        and f.get('division_name') == 'Under 9D Navy'
        and f.get('home') == 'Shooters Hill AFC Valiants'
        and f.get('away') == 'Phoenix Sports Panthers'
        and f.get('provider_team_ids') == ['972', '771']
        for f in u9_fixtures
    ),
)

build_gradle = txt('app/build.gradle')
apk_workflow = txt('.github/workflows/build-apk.yml')

check(
    'permanent signing Gradle config present',
    'PITCHKIND_KEYSTORE_FILE' in build_gradle
    and "storeType 'PKCS12'" in build_gradle
    and 'signingConfig signingConfigs.pitchkind' in build_gradle,
)

check(
    'permanent signing workflow present',
    'PITCHKIND_KEYSTORE_B64' in apk_workflow
    and 'PITCHKIND_KEYSTORE_PASSWORD' in apk_workflow
    and 'PITCHKIND_KEY_ALIAS' in apk_workflow
    and 'PITCHKIND_KEY_PASSWORD' in apk_workflow
    and 'Verify permanent APK signer' in apk_workflow,
)

check(
    'v2.2.12 workflow and artifact gate',
    'Android APK v2.2.12 PitchKind' in apk_workflow
    and 'verify_v2_2_12_pitchkind_ui.py' in apk_workflow
    and 'App version 2.2.12' in apk_workflow
    and 'PitchKind-v2.2.12-debug.apk' in apk_workflow
    and 'GrassrootsClubHub/2.2.12' in apk_workflow,
)


check(
    'all-age multi-week fixture discovery',
    'def parse_fixture_week_ids' in scraper
    and 'fixturespage/{agegroup_id}/{week_id}' in scraper
    and 'fixture_week_ids' in scraper
    and 'verified_multiweek_fixture_rows_v2' in scraper,
)
check(
    'multi-week fixture regression tests',
    'test_fixture_week_ids_are_discovered_from_real_provider_shape' in scraper_tests
    and 'test_verified_week_three_valiants_fixture_parses' in scraper_tests
    and 'test_collect_fixtures_fetches_every_advertised_week_without_u9_special_case' in scraper_tests,
)
check(
    'full future fixture list is accessible',
    'further.slice(0,11)' not in app
    and 'further.map(f=>' in app,
)
check(
    'Selkent feed refreshes six-hourly',
    "- cron: '0 */6 * * *'" in txt('.github/workflows/scrape-selkent.yml'),
)

print(f'\n{passed} passed; {len(fail)} failed')
if fail:
    print('Failures:')
    for x in fail: print('-',x)
    sys.exit(1)
