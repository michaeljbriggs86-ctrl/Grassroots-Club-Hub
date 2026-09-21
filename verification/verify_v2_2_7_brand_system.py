from pathlib import Path
from PIL import Image
import json, re, sys

root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
checks=[]
def check(name, ok, detail=''):
    checks.append((name,bool(ok),detail))
    print(('PASS' if ok else 'FAIL')+': '+name+(f' — {detail}' if detail else ''))

def txt(rel): return (root/rel).read_text(encoding='utf-8')

gradle=txt('app/build.gradle')
main=txt('app/src/main/java/com/grassrootsclubhub/universal/MainActivity.java')
index=txt('app/src/main/assets/index.html')
app=txt('app/src/main/assets/app.js')
cloud=txt('app/src/main/assets/cloud.js')
onboard=txt('app/src/main/assets/onboarding.js')
css=txt('app/src/main/assets/app-design-system.css')
styles=txt('app/src/main/assets/styles.css')
obcss=txt('app/src/main/assets/onboarding.css')
manifest=json.loads(txt('app/src/main/assets/manifest.json'))
sw=txt('app/src/main/assets/service-worker.js')
guidelines=txt('design_reference/APP-UI-DESIGN-GUIDELINES-v1.2.md')
marker='approved-app-ui-2026-09-19-v1.2-brand-system'
tag='CONNECT • ORGANISE • GROW THE GAME'

check('versionCode 2207','versionCode 2207' in gradle)
check('versionName 2.2.7',"versionName '2.2.7'" in gradle)
check('native marker 2.2.7','GrassrootsClubHub/2.2.7' in main)
check('UI code marker in cloud.js',marker in cloud)
check('UI code marker in design CSS',marker in css)
check('guideline v1.2','**Version:** 1.2' in guidelines and marker in guidelines)
check('exact product tagline in guideline',tag in guidelines)
check('grass-O rule documented','grass-O' in guidelines and 'letter **O**' in guidelines)
check('product-vs-club placement rules documented','Product brand vs club brand' in guidelines)
check('old lock-up retired from current guideline','PEOPLE · TEAMS · STRONGER TOGETHER' not in guidelines)

brand_assets=['gch-logo-primary.svg','gch-logo-reverse.svg','gch-mark.svg','gch-app-icon.svg','gch-app-icon-round.svg','gch-banner.svg']
for name in brand_assets:
    p=assets/name
    check(f'brand asset exists: {name}',p.exists() and p.stat().st_size>300)
for name in ['gch-logo-primary.svg','gch-logo-reverse.svg','gch-banner.svg']:
    s=(assets/name).read_text(encoding='utf-8')
    check(f'exact tagline embedded: {name}',tag in s)
    check(f'Club singular in {name}','CLUB HUB' in s and 'CLUBS HUB' not in s)
check('grass O visual device in primary logo','GRASSR' in (assets/'gch-logo-primary.svg').read_text() and '<circle' in (assets/'gch-logo-primary.svg').read_text())

check('splash uses reverse product lock-up','class="app-splash-logo"' in index and 'src="gch-logo-reverse.svg"' in index)
# Pull the actual splash block so a later unrelated club-logo mention does not mask regression.
splash=re.search(r'<div id="app-splash".*?</div>\s*</div>',index,re.S)
check('splash is not club-configured',bool(splash) and 'club-logo.png' not in splash.group(0))
apply=re.search(r'function applyClubConfiguration\(config\)\{.*?\n\}',app,re.S)
check('club config cannot target splash',bool(apply) and '.app-splash-logo' not in apply.group(0))
check('missing club badge uses neutral product mark',"img.src=logo||'gch-mark.svg'" in app)
check('initials fallback disabled','content:none!important' in styles and 'platform-club-placeholder' in styles)
check('auth uses one official product lock-up','function authBrand()' in cloud and 'gch-logo-primary.svg' in cloud)
for stale in ['PEOPLE · TEAMS · STRONGER TOGETHER','PLAY · LEARN · BELONG','ORGANISE · SUPPORT · GROW']:
    check(f'stale auth lock-up absent: {stale}',stale not in cloud)
check('club onboarding uses product banner','onboard-product-brand' in onboard and 'gch-banner.svg' in onboard)
check('onboarding banner styled','onboard-product-brand' in obcss)
check('settings/about uses product banner','id="gch-about-card"' in index and 'gch-banner.svg' in index and tag in index)

check('manifest version 2.2.7',manifest.get('version')=='2.2.7')
check('manifest theme is approved green',manifest.get('theme_color')=='#0B5D35')
icons=manifest.get('icons',[])
check('PWA any icons present',any(x.get('src')=='icon-192.png' for x in icons) and any(x.get('src')=='icon-512.png' for x in icons))
check('PWA maskable icon present',any(x.get('src')=='icon-maskable-512.png' and x.get('purpose')=='maskable' for x in icons))
check('service worker cache bumped',"grassroots-club-hub-v227-brand" in sw)
for name in ['gch-logo-primary.svg','gch-logo-reverse.svg','gch-mark.svg','gch-banner.svg','icon-maskable-512.png']:
    check(f'service worker caches {name}',f'./{name}' in sw)

png_sizes={'icon-192.png':(192,192),'icon-512.png':(512,512),'icon-maskable-512.png':(512,512),'gch-app-icon-1024.png':(1024,1024),'gch-mark.png':(512,512),'gch-banner.png':(1600,320)}
for name,size in png_sizes.items():
    p=assets/name
    ok=p.exists()
    actual=None
    if ok:
        with Image.open(p) as im: actual=im.size
    check(f'raster dimensions {name}',ok and actual==size,str(actual))

for folder,size in [('mipmap-mdpi',48),('mipmap-hdpi',72),('mipmap-xhdpi',96),('mipmap-xxhdpi',144),('mipmap-xxxhdpi',192)]:
    for name in ['ic_launcher.png','ic_launcher_round.png']:
        p=root/'app/src/main/res'/folder/name
        actual=None
        if p.exists():
            with Image.open(p) as im: actual=im.size
        check(f'Android {folder}/{name}',actual==(size,size),str(actual))

check('brand placement map bundled',(root/'design_reference/BRAND-ASSET-PLACEMENT-MAP.md').exists())
check('versioned v1.2 guideline bundled',(root/'design_reference/APP-UI-DESIGN-GUIDELINES-v1.2.md').exists())
check('release notes v2.2.7 bundled',(root/'RELEASE_NOTES_v2_2_7.txt').exists())
check('workflow points to v2.2.7 verifier','verify_v2_2_7_brand_system.py' in txt('.github/workflows/android.yml'))

failed=[n for n,o,d in checks if not o]
print(f'\nRESULT: {len(checks)-len(failed)}/{len(checks)} checks passed')
if failed:
    print('FAILED:')
    for n in failed: print(' - '+n)
    sys.exit(1)
