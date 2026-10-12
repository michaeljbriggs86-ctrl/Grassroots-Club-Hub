# Read-only browser QA with synthetic accounts; all network requests are intercepted.
# Requires Python Playwright and its Chromium binary.
from pathlib import Path
import tempfile
from playwright.sync_api import sync_playwright
import mimetypes,json
root=Path(__file__).resolve().parents[1]/'app/src/main/assets'
shots=Path(tempfile.mkdtemp(prefix='linked-pages-qa-'))
app=(root/'app.js').read_text().replace("bootTracker().catch(err=>console.error('Tracker boot failed',err));",'// Test harness controls startup; production navigation and rendering are unchanged.')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':390,'height':844})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def intercept(route):
  path=route.request.url.split('?',1)[0].split('/')[-1] or 'index.html'
  if path in ['cloud.js','cloud-config.js','onboarding.js','static-feed-overlay.js','supabase.js'] or not (root/path).is_file():route.fulfill(status=200,body='{}' if 'json' in path else '',content_type='application/json' if 'json' in path else 'application/javascript');return
  if path=='app.js':route.fulfill(body=app,content_type='application/javascript');return
  route.fulfill(body=(root/path).read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
 page.route('**/*',intercept)
 page.add_init_script('''window.testRole='admin';const team={id:'team-a',clubId:'club-a',ageGroup:'U9',teamName:'Test Team',name:'Test Team',season:'2026/27'};
 window.ClubHubCloud={configured:()=>true,session:{user:{id:'test-user'}},context:{profile:{user_id:'test-user',club_id:'club-a',full_name:'Test User',role:'club_admin'}},role:()=>window.testRole,realRole:()=>window.testRole==='admin'?'club_admin':window.testRole,actingAsParent:()=>false,isStaffAccount:()=>window.testRole!=='parent',currentTeam:()=>team,assignedTeam:()=>window.testRole==='admin'?null:team,coachTeam:()=>null,visibleTeamList:()=>[team],listMyCoachTeams:async()=>[],listParentTeamContexts:async()=>[],currentParentTeam:()=>null,listParentPlayerLinks:async()=>[],listPlayerAccountLinks:async()=>[],listTeamMembers:async()=>[],listPendingParentRequests:async()=>[],listClubCoaches:async()=>[],listPendingCoachRequests:async()=>[],listClubAccessAccounts:async()=>[],listClubMessages:async()=>[],listAnnouncements:async()=>[],listNotifications:async()=>[],listSeasonArchives:async()=>[],listAuditHistory:async()=>[],listCoachQualifications:async()=>[],getClubOverview:async()=>[],getClubComplianceStatus:async()=>({}),listAppearanceStats:async()=>[],listContactDirectory:async()=>({self:{user_id:'test-user',full_name:'Test User'},can_manage:window.testRole==='admin',contacts:[{user_id:'test-coach',full_name:'Test Coach',role:'coach',kind:'staff',team_id:'team-a',team_name:'Test Team',age_group:9,email:'test@example.invalid',phone:''}]}),getCoachQualifications:async()=>({records:[],revision:0})};''')
 page.goto('http://app.test/index.html',wait_until='networkidle')
 page.evaluate("dismissOpeningSplash();document.getElementById('activation-gate').classList.add('hidden');account={user:'Test User',role:'admin',team:{id:'team-a',ageGroup:'U9',teamName:'Test Team'}};__navigationReady=true;navigate('club',false)")
 page.wait_for_timeout(200)
 assert not errors,errors
 assert page.locator('#admin-home-request-status').inner_text()=='No requests waiting'
 assert page.locator('#coach-documents-summary-status').inner_text()!='Loading coach documents…'
 for view in ['club','club-teams','coach-documents','club-coaches','staff-requests','app-access','contacts','rules','season-history','audit-history','raise-concern']:
  page.evaluate('(view)=>navigate(view,false)',view);page.wait_for_timeout(80)
  actual=page.evaluate('currentView');assert actual==('club' if view=='club-coaches' else view),(view,actual)
  assert page.locator('.view.active').count()==1
  assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),view
  if view in ['club','contacts','coach-documents']:page.screenshot(path=str(shots/f'{view}.png'),full_page=True)
 # Use the real link and browser history, then open a name as a parent.
 page.evaluate("window.testRole='parent';currentRole='parent';navigate('inbox',false)")
 page.locator('#member-contacts-link').click();page.wait_for_timeout(80)
 assert page.evaluate('currentView')=='contacts'
 page.locator('#member-contacts-list [data-person-profile]').click();page.wait_for_timeout(100)
 assert page.evaluate('currentView')=='person','parent profile survives real applyAccessMode'
 assert page.locator('#person-profile-name').inner_text()=='Test Coach'
 assert page.locator('#person-profile-body').inner_text().find('test@example.invalid')>=0
 page.locator('#person-profile-back').click();page.wait_for_timeout(100)
 assert page.evaluate('currentView')=='contacts'
 assert page.locator('#member-contacts-list [data-person-profile]').count()==1
 page.go_back();page.wait_for_timeout(100)
 # Open forbidden deep link in parent capacity, then test a role change while on a page.
 page.evaluate("navigate('app-access',false)");assert page.evaluate('currentView')=='home'
 page.evaluate("window.testRole='admin';currentRole='admin';adminUiMode='club';navigate('coach-documents',false);window.testRole='parent';currentRole='parent';applyAccessMode()")
 assert page.evaluate('currentView')=='home'
 for width in [360,768,1280]:
  page.set_viewport_size({'width':width,'height':844});page.evaluate("navigate('contacts',false)");page.wait_for_timeout(80);assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
 assert not errors,errors
 print('PASS real app links, ten pages, parent individual profile and Back, capacity redirects, and 360/390/768/1280px layouts; no JavaScript errors')
 b.close()
