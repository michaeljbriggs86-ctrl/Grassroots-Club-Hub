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
design_system=txt('app/src/main/assets/app-design-system.css')
scraper=txt('scripts/scrape.py')
scraper_tests=txt('tests/test_selkent_scrape.py')
backend_contract=txt('LIVE_BACKEND_CONTRACT_v2_2_24.txt')

check('versionCode 2224','versionCode 2224' in gradle)
check('versionName 2.2.24',"versionName '2.2.24'" in gradle)
check('applicationId preserved',"applicationId 'com.grassrootsclubhub.universal'" in gradle)
check('native marker version','GrassrootsClubHub/2.2.24' in main)
check('auth scheme preserved','"grassrootsclubhub".equalsIgnoreCase' in main and 'android:scheme="grassrootsclubhub"' in txt('app/src/main/AndroidManifest.xml'))
check('ClubHubNative preserved','"ClubHubNative"' in main)
check('static feed host preserved','raw.githubusercontent.com' in main and 'Grassroots-Club-Hub/main/data/directory.json' in main and 'Grassroots-Club-Hub/main/data/results.json' in main)
check('Android app label PitchKind','>PitchKind<' in strings)
check('HTML title PitchKind','<title>PitchKind</title>' in index)
check('About version 2.2.24','App version 2.2.24' in index)
check('manifest name PitchKind',manifest.get('name')=='PitchKind' and manifest.get('short_name')=='PitchKind')
check('manifest version 2.2.24',manifest.get('version')=='2.2.24')
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
    'v2.2.24 native User-Agent constant',
    'private static final String NATIVE_USER_AGENT' in main
    and 'GrassrootsClubHub/2.2.24' in main
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
    'v2.2.24 workflow and artifact gate',
    'Android APK v2.2.24 PitchKind' in apk_workflow
    and 'verify_v2_2_24_pitchkind_ui.py' in apk_workflow
    and 'App version 2.2.24' in apk_workflow
    and 'PitchKind-v2.2.24-debug.apk' in apk_workflow
    and 'GrassrootsClubHub/2.2.24' in apk_workflow,
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
    and 'further.map(furtherFixtureCardHtml)' in app,
)
check(
    'Selkent feed refreshes six-hourly',
    "- cron: '0 */6 * * *'" in txt('.github/workflows/scrape-selkent.yml'),
)


check(
    'undo match played UI action',
    'id="undo-match-played"' in index
    and 'Undo match played' in index
    and "addEventListener('click',undoMatchPlayed)" in app,
)
check(
    'undo returns existing match to scheduled',
    'async function undoMatchPlayed()' in app
    and "m.status='scheduled'" in app
    and 'm.gf=0' in app
    and 'm.ga=0' in app,
)
check(
    'undo clears recorded match report data',
    "state.goals=state.goals.filter(x=>x.matchId!==id)" in app
    and "state.assists=(state.assists||[]).filter(x=>x.matchId!==id)" in app
    and "state.bookings=(state.bookings||[]).filter(x=>x.matchId!==id)" in app
    and "state.awards=state.awards.filter(x=>x.matchId!==id)" in app,
)
check(
    'undo clears attendance before local reversal',
    "await window.ClubHubCloud.saveMatchAttendance(id,[])" in app
    and "Could not clear match attendance, so the result has not been undone" in app
    and "await refreshAppearanceStats(false)" in app,
)
check(
    'undo clears coach note and audits reversal',
    "await window.ClubHubCloud.saveCoachMatchNote(id,'')" in app
    and "'match_played_undone'" in app
    and "'match_report_cleared'" in app,
)
check(
    'undo correction notification RPC wired',
    "notifyMatchReopened" in cloud
    and "rpc('notify_match_reopened'" in cloud
    and "window.ClubHubCloud?.notifyMatchReopened" in app,
)


check(
    'dark mode is default for new installs',
    "function themePreference(){return localStorage.getItem(THEME_KEY)||'dark';}" in app,
)
check(
    'match details show home versus away teams',
    'id="match-detail-versus"' in index
    and 'class="match-versus"' in index
    and 'match-side-label' in styles
    and 'function renderMatchOverview(m)' in app,
)
check(
    'match details include kit visuals',
    'function kitIconHtml' in app
    and 'class="match-team-kit"' in app
    and 'Home' in app and 'Away' in app,
)
check(
    'match details include venue address and maps link',
    'id="match-detail-ground"' in index
    and 'id="match-detail-address"' in index
    and 'id="match-detail-map"' in index
    and 'mapHref:mapsHref(ground,address)' in app,
)
check(
    'coach uses fixture shirt toggle instead of free-text match kit correction',
    'id="match-detail-kit-toggle"' in index
    and 'id="match-kit-correction"' not in index
    and 'data-fixture-kit-select' in app
    and 'function setFixtureKitChoice(key,choice)' in app,
)
check(
    'match overview supports dark contrast',
    'html[data-theme="dark"] .match-versus' in styles
    and 'html[data-theme="dark"] .match-venue-card' in styles
    and 'color:#b9c7be!important' in styles,
)


check(
    'homepage and matches page expose fixture identity before Match played',
    'id="next-match-versus"' in index
    and 'id="matches-next-versus"' in index
    and "renderFixtureOverview('next-match',f)" in app
    and "renderFixtureOverview('matches-next',f)" in app,
)
check(
    'visible venue map snapshots are wired',
    'id="next-match-map-frame"' in index
    and 'id="matches-next-map-frame"' in index
    and 'id="match-detail-map-frame"' in index
    and 'function mapsEmbedHref(...parts)' in app
    and 'https://www.google.com/maps?q=' in app
    and 'fixture-map-preview' in styles,
)
check(
    'match played scoreline is Home Away with correct team-relative storage',
    '<label>Home<input id="match-report-gf"' in index
    and '<label>Away<input id="match-report-ga"' in index
    and 'm.gf=away?awayScore:homeScore' in app
    and 'm.ga=away?homeScore:awayScore' in app
    and 'reportAway?m.ga:m.gf' in app,
)
check(
    'manual add/edit scoreline is Home Away and goals target our side',
    '<span id="our-score-label">Home</span>' in index
    and '<label>Away<input id="match-ga"' in index
    and "const target=Number(document.getElementById(away?'match-ga':'match-gf').value||0)" in app
    and 'gf:isAway?awayScore:homeScore' in app
    and 'ga:isAway?homeScore:awayScore' in app,
)
check(
    'manually added matches can be removed',
    'id="delete-match-edit"' in index
    and 'id="delete-match-detail"' in index
    and 'async function deleteMatch(id)' in app
    and "'match_deleted'" in app,
)
check(
    'provider-owned fixtures cannot be deleted and match source survives edits',
    'function isProviderOwnedMatch(m={})' in app
    and 'Published Selkent fixtures cannot be removed.' in app
    and "source:existing?.source||'manual'" in app
    and 'providerTeamIds:Array.isArray(existing?.providerTeamIds)' in app,
)


check(
    'further fixtures use full visible identity venue and map treatment',
    'function furtherFixtureCardHtml(f,index)' in app
    and 'class="further-fixture-card"' in app
    and 'fixture-map-preview further-fixture-map' in app
    and 'data-further-match-played' in app
    and 'clubTeamLink(ctx.homeTeam)' in app
    and 'clubTeamLink(ctx.awayTeam)' in app,
)
check(
    'redundant Home Away summary box replaced by Competition',
    index.count('<span>Competition</span>') >= 2
    and 'fixtureCompetitionLabel(f)' in app
    and 'Competition TBC' in app,
)
check(
    'team kit profiles persist home and away shirt knowledge',
    'kitProfiles: {}' in app
    and 'kitProfiles: data.selkent?.kitProfiles' in app
    and "function kitProfileForTeam(teamName='',fallbackHome='')" in app
    and "const away=shirtColoursOnly(stored.away||'TBC')" in app,
)
check(
    'kit clash warning and coach shirt selection are wired',
    'function kitsClash' in app
    and '⚠️ Kit clash likely.' in app
    and 'function fixtureKitChoice(f={})' in app
    and 'function setFixtureKitChoice(key,choice)' in app
    and 'id="next-match-kit-warning"' in index
    and 'id="matches-next-kit-warning"' in index
    and 'kit-clash-warning' in styles,
)
check(
    'Club Admin and Coaches can maintain home and away shirt colours',
    'Home shirt colours' in index
    and 'Away shirt colours' in index
    and 'id="save-club-kit-profile"' in index
    and 'function saveClubKitProfile()' in app
    and "if(!(isAdmin()||isCoach()))return toast('Club staff access is required')" in app,
)
check(
    'programme no longer uses Add score entry cells',
    'function programmeParentView()' in app
    and 'Home result' in app
    and 'Away result' in app
    and 'data-match-report-review' in app
    and 'Add score</button>' not in app[app.find('function renderDivisionResultCell'):app.find('function matchCardHTML')],
)
check(
    'parent programme exposes Played Not played only',
    "${played?'Played':'Not played'}" in app
    and "if(miniResultsRestrictedView()&&['played','abandoned'].includes(s))return'Played';" in app
    and "matchHeading.textContent=miniResultsRestrictedView()?'Matches'" in app,
)
check(
    'club and result navigation routes are wired',
    'data-club-details-team' in app
    and 'openClubDetails(clubDetail.dataset.clubDetailsTeam)' in app
    and 'openMatchReportReview(reportReview.dataset.matchReportReview)' in app
    and "title.textContent='Match report'" in app,
)

check(
    'Shooters Hill approved source logo is bundled and used in hero',
    (assets/'shooters-hill-logo.png').exists()
    and sha('app/src/main/assets/shooters-hill-logo.png')=='ea3b232a45b197da47d76ffc4bc38440eef9a096a9510af5a988aabc3df71bce'
    and './shooters-hill-logo.png' in sw
    and 'src="shooters-hill-logo.png"' in index,
)
check(
    'shirt colours only are normalised',
    "function shirtColoursOnly(text='')" in app
    and "colours:shirtColoursOnly(d.club_colours||'TBC')" in app
    and 'Home shirt colours' in index
    and 'Away shirt colours' in index,
)
check(
    'fixture shirt selection persists privately and repaints visible fixtures',
    'fixtureKitSelections: {}' in app
    and 'fixtureKitSelections: data.selkent?.fixtureKitSelections' in app
    and 'state.selkent.fixtureKitSelections[key]' in app
    and 'renderNextMatch();renderMatchPageNextFixture();renderSelkentFixtures();renderMatchdayDashboard();' in app,
)
check(
    'parents see selected shirt without staff controls',
    "if(!(isCoach()||isAdmin()))return'';" in app
    and 'kitToggleHtml(f,ctx)' in app,
)
check(
    'Next Fixture is prime dashboard card and old Division Record is retired',
    index.find('id="next-match-card"') < index.find('record-card knight-panel dashboard-record-retired')
    and 'record-card knight-panel dashboard-record-retired' in index
    and '.record-card.knight-panel.dashboard-record-retired{display:none!important}' in styles,
)
check(
    'only important announcements override prime Next Fixture',
    'important=active.filter(a=>a.important)' in app
    and "nextCard.classList.toggle('hidden',!!important.length)" in app,
)
check(
    'dark match availability contrast is explicit',
    'html[data-theme="dark"] .match-availability' in styles
    and 'html[data-theme="dark"] .availability-summary-group' in styles
    and 'html[data-theme="dark"] .availability-count' in styles,
)
check(
    'availability shirt numbers and rows are aligned',
    '.mini-jersey b{position:absolute!important' in styles
    and '.availability-summary-group span{display:grid;grid-template-columns:32px minmax(0,1fr)' in styles,
)
check(
    'club shirt editor is compact rather than permanent bottom kit panel',
    'club-shirt-editor' in index
    and '<summary>Edit shirt colours</summary>' in index
    and 'Kit details</h3>' not in index[index.find('id="club-detail-dialog"'):index.find('id="parent-link-dialog"')],
)

check(
    'Squad and Tactics use explicit pages instead of horizontal swipe',
    'id="squad-pages"' in index
    and 'id="squad-list-page"' in index
    and 'id="squad-tactics-page"' in index
    and 'id="squad-swipe"' not in index
    and "document.querySelectorAll('[data-squad-view]')" in app
    and 'scroll-snap-type:x mandatory' not in styles,
)
check(
    'Tactics board is above matchday squad controls',
    index.find('id="tactics-pitch"') < index.find('id="matchday-squad-picker"')
    and index.find('id="tactics-formation"') < index.find('id="tactics-pitch"'),
)
check(
    'Matchday squad controls are collapsible after the board',
    '<details class="matchday-squad-picker tactics-squad-options" id="matchday-squad-picker">' in index
    and 'matchday-squad-summary' in index
    and 'tactics-squad-options-body' in index,
)
check(
    'Tactics board is an optional team feature',
    'id="feature-tactics"' in index
    and "['tactics','goals','assists','awards','bookings']" in app
    and "['tactics','goals','assists','awards']" in app
    and "const tacticsOn=featureEnabled('tactics')" in app
    and "tacticsTab?.classList.toggle('hidden',!tacticsOn)" in app
    and "openTactics?.classList.toggle('hidden',!tacticsOn)" in app,
)
check(
    'Settings use Features and Rules procedures language',
    '<summary><span>Features</span>' in index
    and 'Rules &amp; procedures' in index
    and 'Universal Core v1' not in index[index.find('id="view-more"'):index.find('</main>')],
)
check(
    'Settings are grouped in a coherent user-facing order',
    index.find('>Team</span><small>Tools and access for this team') < index.find('id="match-detail-settings"')
    and index.find('Rules &amp; safeguarding') < index.find('id="rules-procedures-settings"')
    and index.find('>History</span><small>Previous seasons') < index.find('id="season-history-settings"')
    and index.find('>App</span><small>Device and account preferences') < index.find('id="appearance-settings"')
    and index.find('id="appearance-settings"') < index.find('id="access-panel"'),
)
check(
    'Rules procedures are staff-only and use configured age rules',
    'id="rules-procedures-settings" data-staff-settings' in index
    and "document.querySelectorAll('[data-staff-settings]')" in app
    and "const r=competitionRuleForAge(ageGroupNumber())" in app
    and 'Scores remain private to authenticated club accounts' in app
    and 'Before the match' in index
    and 'After the match' in index,
)
check(
    'v2.2.18 responsive settings and tactics styles are present',
    'v2.2.18 — explicit squad pages, tactics-first layout and settings cleanup' in styles
    and '.settings-group-heading' in styles
    and '.tactics-squad-options>summary' in styles
    and 'html[data-theme="dark"] .procedure-list article' in styles,
)

check(
    'Shooters Hill app badge is 512px and exact reviewed derivative',
    png_size(assets/'shooters-hill-logo.png')==(512,512)
    and sha('app/src/main/assets/shooters-hill-logo.png')=='ea3b232a45b197da47d76ffc4bc38440eef9a096a9510af5a988aabc3df71bce',
)
check(
    'club-logo-q1 verifier is integrated',
    (root/'verification/verify_club_logo_quality.py').exists()
    and 'GATE_VERSION = "club-logo-q1"' in txt('verification/verify_club_logo_quality.py')
    and 'DEFAULT_RASTER_FLOOR = 512' in txt('verification/verify_club_logo_quality.py')
    and 'DEFAULT_MIN_SCALE_FACTOR = 4' in txt('verification/verify_club_logo_quality.py'),
)
check(
    'club logo quality regression tests are integrated',
    (root/'tests/test_club_logo_quality.py').exists()
    and 'test_48px_raster_fails' in txt('tests/test_club_logo_quality.py')
    and 'test_512px_raster_passes' in txt('tests/test_club_logo_quality.py')
    and 'test_default_scan_includes_unsupported_club_logo_file' in txt('tests/test_club_logo_quality.py'),
)
check(
    'CI gates source and packaged club-logo technical quality',
    'python verification/verify_club_logo_quality.py' in apk_workflow
    and 'assets/shooters-hill-logo.png > "$RUNNER_TEMP/shooters-hill-logo.png"' in apk_workflow
    and '--asset "$RUNNER_TEMP/shooters-hill-logo.png"' in apk_workflow
    and 'ea3b232a45b197da47d76ffc4bc38440eef9a096a9510af5a988aabc3df71bce' in apk_workflow,
)

check(
    'verified club badge hero uses circular artwork presentation',
    'v2.2.20 — verified club badge hero formatting' in design_system
    and '.club-logo-wrap:not(.platform-club-placeholder)' in design_system
    and 'border-radius:50%!important' in design_system
    and 'background:transparent!important' in design_system
    and 'clip-path:circle(49.4% at 50% 50%)!important' in design_system,
)
check(
    'missing club badge placeholder keeps neutral tile treatment',
    '.club-logo-wrap.platform-club-placeholder' in design_system
    and 'background:rgba(255,255,255,.96)!important' in design_system
    and '.club-logo-wrap.platform-club-placeholder .club-logo' in design_system
    and 'clip-path:none!important' in design_system,
)

check(
    'U7-U11 parent client sanitizer removes direct and indirect result data',
    "function sanitizeMiniSoccerParentStateClient(input,age,profileRole=context?.profile?.role||'')" in cloud
    and "copy.goals=[];" in cloud
    and "copy.assists=[];" in cloud
    and "copy.bookings=[];" in cloud
    and "copy.leagueResults=[];" in cloud
    and "['gf','ga','score','result','outcome','points','won','drawn','lost','goalDifference','winRate','notes']" in cloud,
)
check(
    'U7-U11 parent client sanitizer preserves awards and strips shirt mapping',
    "copy.squad=(Array.isArray(copy.squad)?copy.squad:[]).map" in cloud
    and "delete p.number" in cloud
    and "copy.awards=[]" not in cloud,
)
check(
    'remote team state applies parent privacy defense before handoff',
    "row.state=sanitizeMiniSoccerParentStateClient(row.state,age,context?.profile?.role||'')" in cloud
    and "if(age>=7&&age<=11)localStorage.removeItem(TEAM_STATE_CACHE_PREFIX+teamId)" in cloud,
)
check(
    'live U7-U11 backend privacy contract is recorded',
    '20260923064334' in backend_contract
    and 'tighten_u11_parent_result_sanitizer' in backend_contract
    and 'goals = []' in backend_contract
    and 'assists = []' in backend_contract
    and 'bookings = []' in backend_contract
    and 'U9 input containing a 3-2 match' in backend_contract
    and 'same test payload passed through age 12 unchanged' in backend_contract,
)

check(
    'parent self-signup is exposed from adult login',
    'id="cloud-parent-signup"' in cloud
    and 'Parent Sign Up' in cloud
    and "setGateHtml('parentsignup')" in cloud
    and 'Club Sign Up' not in cloud[cloud.find("if(mode==='signin')"):cloud.find("if(mode==='playerlogin')")],
)
check(
    'parent self-signup collects account club team and child',
    "if(mode==='parentsignup')" in cloud
    and "id:'cloud-parent-name'" in cloud
    and "id:'cloud-parent-email'" in cloud
    and "id:'cloud-parent-password'" in cloud
    and 'id="cloud-parent-club"' in cloud
    and 'id="cloud-parent-team"' in cloud
    and "id:'cloud-parent-child'" in cloud
    and '<select id="cloud-parent-child"' not in cloud
    and 'cloud-parent-player' not in cloud,
)
check(
    'parent self-signup uses public login directory selectors',
    'function populateParentSignupChoices()' in cloud
    and 'await listLoginClubs()' in cloud
    and 'await listLoginTeams(slug)' in cloud,
)
check(
    'parent signup metadata survives email verification',
    'parent_signup:true' in cloud
    and 'requested_team_id:teamId' in cloud
    and 'requested_child_name:child' in cloud
    and 'PENDING_PARENT_REQUEST_KEY' in cloud,
)
check(
    'verified parent account submits server-side pending request',
    'request_parent_access' in cloud
    and 'await requestParentAccess(metaTeam,metaChild)' in cloud
    and "return 'parentrequest'" in cloud
    and "['recovery','parentrequest','error'].includes(callbackType)" in cloud,
)
check(
    'pending parent remains approval-gated',
    "if(context.profile.role==='pending_parent')" in cloud
    and "setGateHtml('approval','Your parent account is ready. Waiting for coach approval.')" in cloud,
)
check(
    'coach Team access no longer creates parent invite codes',
    'Parents do not need an invite code' in index
    and 'id="generate-team-parent-invite"' not in index
    and 'id="team-parent-invite-code"' not in index
    and 'createTeamParentInvite' not in app,
)
check(
    'coaches see pending child identity before approval',
    'listPendingParentRequests' in cloud
    and 'list_pending_parent_requests' in cloud
    and 'pendingRequests' in app
    and 'pending-parent-details' in app
    and '<b>Child name</b>${esc(req.child_name' in app
    and '<b>Email</b>${esc(req.parent_email' in app,
)
check(
    'coach explicitly allocates player after parent approval',
    'data-link-parent-player' in app
    and 'async function approveParent(userId)' in app
    and 'saveParentPlayerLinks' not in app[app.find('async function approveParent(userId)'):app.find('async function resetParentPin')]
    and 'The name is identification only. After approval, use Link player' in index,
)
check(
    'live parent self-signup backend contract is recorded',
    '20260923192456' in backend_contract
    and 'parent_self_signup_requests' in backend_contract
    and 'request_parent_access' in backend_contract
    and 'list_pending_parent_requests' in backend_contract
    and '20260923193851' in backend_contract
    and 'parent_approval_requires_explicit_player_link' in backend_contract
    and 'approve_parent DOES NOT create public.parent_player_links' in backend_contract
    and 'Link player control after approval' in backend_contract
    and 'adult-email-invite' in backend_contract
    and 'SUPERSEDED and disabled' in backend_contract,
)

check('verified parent signup can resume after broken browser redirect',
    'function resumeParentSignupRequestFromMetadata()' in cloud
    and 'metadata.requested_team_id||local.team_id' in cloud
    and 'metadata.requested_child_name||local.child_name' in cloud
    and 'await requestParentAccess(teamId,child)' in cloud)
check('normal email password login resumes parent signup request',
    "if(context.profile.role==='pending'){await resumeParentSignupRequestFromMetadata();}" in cloud
    and "setGateHtml('approval','Your parent access request has been sent to the coaching staff for verification.')" in cloud)
check('bootstrap and normal login share parent request recovery',
    "try{await resumeParentSignupRequestFromMetadata();}" in cloud
    and "Your account is verified, but the parent access request could not be submitted." in cloud)
check('verify screen supports manual return when deep link fails',
    'id="cloud-verify-continue"' in cloud
    and 'I’ve Verified My Email' in cloud
    and 'If the browser does not reopen the app automatically' in cloud
    and "setGateHtml('signin','Sign in to finish sending your parent access request.'" in cloud)
check('live redirect failure is recorded without claiming it fixed',
    'http://localhost:3000' in backend_contract
    and 'email_confirmed_at was set' in backend_contract
    and 'OPEN Supabase Auth URL-configuration issue' in backend_contract
    and 'Do not claim the deep-link redirect itself fixed' in backend_contract)
check('parent request coach notification backend is recorded',
    '20260923200527' in backend_contract
    and 'notify_parent_access_requests' in backend_contract
    and 'type = parent_access_request' in backend_contract
    and 'title = Parent access request' in backend_contract)
check('Club Admin team preview can review pending parent access',
    'id="team-access-settings" data-staff-settings' in index
    and "const canApprove=pendingRow&&['admin','coach','assistant_coach'].includes(currentRole)" in app
    and "!preview&&pendingRow" not in app)
check('parent approval client allows authorised access staff',
    "if(!['admin','coach','assistant_coach'].includes(currentRole))return toast('Staff access is required to approve parents.')" in app
    and 'Approve parent' in app)
check('coach-only player controls stay coach-only',
    'playerAccountsAllowedForAge(ageGroupNumber())&&isCoach()' in app
    and '!preview&&parent&&isCoach()' in app)
check('parent access notification provides review action',
    'function reviewParentAccessNotification(notificationId)' in app
    and 'data-review-parent-request' in app
    and 'Review request' in app)
check('notification review routes to selected team Team access',
    "adminUiMode='view';localStorage.setItem(ADMIN_UI_MODE_KEY,'view')" in app
    and "navigate('more',false);applyAccessMode()" in app
    and "panel.open=true" in app
    and 'await refreshTeamMembers(false)' in app)
check('pending parent card wraps identity data without clipping',
    'v2.2.24 — pending parent review alignment and approval UX' in styles
    and '.team-member-row.pending{grid-template-columns:minmax(0,1fr)!important' in styles
    and '.pending-parent-details' in styles
    and 'overflow-wrap:anywhere' in styles
    and '.parent-approve-action' in styles)
check('notification content wraps and actions stay usable',
    '.notification-item-head>div{min-width:0}' in styles
    and '.notification-item-head strong,.notification-item p{white-space:normal;overflow-wrap:anywhere' in styles
    and '.notification-item-actions{display:flex' in styles)
check('live pending request and UI root cause are recorded',
    'one live pending request' in backend_contract
    and 'recipient account is a Club Admin with a coach_team_id' in backend_contract
    and 'admin-preview mode hides data-requires-edit' in backend_contract
    and 'approve_parent itself already authorises club_admin' in backend_contract)

print(f'\n{passed} passed; {len(fail)} failed')
if fail:
    print('Failures:')
    for x in fail: print('-',x)
    sys.exit(1)
