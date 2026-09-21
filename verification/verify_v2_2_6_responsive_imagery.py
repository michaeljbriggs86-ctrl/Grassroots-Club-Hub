#!/usr/bin/env python3
from pathlib import Path
import sys

root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets'
checks=[]

def check(name, cond):
    checks.append((name,bool(cond)))

def jpeg_size(path: Path):
    data=path.read_bytes()
    if not data.startswith(b'\xff\xd8'):
        return None
    i=2
    while i+9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        while i < len(data) and data[i] == 0xFF:
            i += 1
        if i >= len(data): break
        marker=data[i]; i+=1
        if marker in (0xD8,0xD9):
            continue
        if i+2 > len(data): break
        seglen=int.from_bytes(data[i:i+2],'big')
        if seglen < 2 or i+seglen > len(data): break
        if marker in {0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF}:
            if seglen >= 7:
                h=int.from_bytes(data[i+3:i+5],'big')
                w=int.from_bytes(data[i+5:i+7],'big')
                return (w,h)
        i += seglen
    return None

gradle=(root/'app/build.gradle').read_text()
main=(root/'app/src/main/java/com/grassrootsclubhub/universal/MainActivity.java').read_text()
index=(assets/'index.html').read_text()
cloud=(assets/'cloud.js').read_text()
cloudcss=(assets/'cloud.css').read_text()
ds=(assets/'app-design-system.css').read_text()
guidelines=(root/'design_reference/APP-UI-DESIGN-GUIDELINES-SNAPSHOT-2026-09-19.md').read_text()

marker='approved-app-ui-2026-09-19-v1.1-responsive-imagery'
check('versionCode 2206','versionCode 2206' in gradle)
check('versionName 2.2.6',"versionName '2.2.6'" in gradle)
check('native marker 2.2.6','GrassrootsClubHub/2.2.6' in main)
check('design revision marker',marker in cloud and marker in ds)
check('design stylesheet linked','app-design-system.css' in index and index.index('app-design-system.css') > index.index('onboarding.css'))
check('guideline v1.1','**Version:** 1.1' in guidelines and marker in guidelines)
check('no-deviation language','No deviations. No exceptions.' in guidelines)
check('ChatGPT and Claude contract','ChatGPT' in guidelines and 'Claude' in guidelines)
check('minimum imagery width rule','at least 1600 px wide' in guidelines)
check('physical-to-css inset rule','physical pixels' in guidelines and 'CSS px' in guidelines)

# Native safe-area regression guard.
check('native converts inset by density','topInset / density' in main and 'bottomInset / density' in main)
check('native sends converted inset','cssTopInset' in main and 'cssBottomInset' in main)
check('native defensive inset bounds','Math.min(56' in main and 'Math.min(72' in main)
check('auth shell does not reapply top inset','padding-top:0!important' in ds and 'padding-top:0;font-family:var(--auth-font)' in cloudcss)
check('auth header owns inset','padding:calc(10px + var(--android-inset-top,0px))' in ds)

# Generated raster imagery quality and old mock graphics removal.
check('svg football scenes removed',not any(assets.glob('auth-scene-*.svg')))
for name in ['football-login-adult.jpg','football-login-player.jpg','football-login-club.jpg','football-pitch-hero.jpg']:
    path=assets/name
    size=jpeg_size(path) if path.exists() else None
    check(f'high-res jpeg {name}',path.exists() and size is not None and size[0] >= 1600 and path.stat().st_size >= 250_000)
check('legacy low-quality huddle removed',not (assets/'football-team-huddle.jpg').exists())
check('hero has no duplicate DOM slogan','auth-scene-note' not in cloud)
check('CSS hides legacy slogan hook','.auth-scene-note{display:none!important}' in cloudcss and '.auth-scene-note{display:none!important}' in ds)
check('app hero uses generated raster','football-pitch-hero.jpg' in ds and '.hero{' in ds)
check('auth uses generated raster','football-login-adult.jpg' in ds)
check('auth footer is non-photographic','No second decorative/photographic strip' in ds and "auth-grass-footer" in ds and "url('football-pitch-hero.jpg')" not in ds[ds.index('.auth-grass-footer'):ds.index('/* Small/short phones')])

# Responsive integrity.
check('small phone breakpoint','@media(max-width:374px)' in ds)
check('foldable portrait breakpoint','@media(min-width:600px) and (max-width:899px) and (orientation:portrait)' in ds)
check('large tablet split breakpoint','@media(min-width:900px)' in ds and 'grid-template-columns:minmax(0,1.08fr)' in ds)
check('landscape split breakpoint','@media(orientation:landscape) and (min-width:600px) and (max-height:620px)' in ds)
check('short screens scroll','scroll naturally' in ds.lower() and '@media(max-height:730px)' in ds)
check('auth controls remain 54-56px','min-height:56px!important' in ds and 'min-height:54px!important' in ds)
check('app-wide overflow protection','html,body{max-width:100%;overflow-x:hidden}' in ds)
check('content min-width zero','.content>*{max-width:100%;min-width:0}' in ds)
check('tables explicitly scroll','overflow-x:auto' in ds and 'min-width:620px' in ds)

# Source hygiene / retained architecture pieces.
check('static feed retained',(assets/'static-feed-overlay.js').exists() and 'static-feed-overlay.js' in index)
check('old login spec superseded',(root/'design_reference/LOGIN_DESIGN_SPEC.md').read_text().startswith('# SUPERSEDED'))
check('versioned guideline copy bundled',(root/'design_reference/APP-UI-DESIGN-GUIDELINES-v1.1.md').exists())
check('v1.1 visual reference bundled',(root/'design_reference/APP_WIDE_UI_REFERENCE_v1_1_2026-09-19.png').exists())
check('auth v1.1 reference bundled',(root/'design_reference/AUTH_LOGIN_REFERENCE_v1_1_2026-09-19.png').exists())

# Lightweight CSS structural guard.
check('app design css braces balanced',ds.count('{')==ds.count('}'))
check('cloud css braces balanced',cloudcss.count('{')==cloudcss.count('}'))

failed=[n for n,v in checks if not v]
for n,v in checks:
    print(('PASS' if v else 'FAIL')+': '+n)
print(f'\n{len(checks)-len(failed)}/{len(checks)} checks passed')
if failed:
    print('FAILED:',', '.join(failed))
    sys.exit(1)
