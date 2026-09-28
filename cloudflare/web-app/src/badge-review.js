// An Access-protected visual test of badges already admitted to the pilot feed.
// No source URLs are exposed and no badge can be selected outside the feed.
const HOST = 'test.pitchkind.com';
const HASH = /^[a-f0-9]{64}$/i;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

export async function badgeReview(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/__badge_review' || url.hostname !== HOST || url.protocol !== 'https:') {
    return new Response('Not found', { status: 404 });
  }
  if (request.method !== 'GET') return new Response('Method not allowed', {
    status: 405, headers: { Allow: 'GET' },
  });
  try {
    const feed = await env.ASSETS.fetch(new Request(new URL('/data/directory.json', url)));
    if (!feed.ok) throw new Error('Directory unavailable');
    const directory = await feed.json();
    if (!directory.pilot_badges_revision || !Array.isArray(directory.clubs)) {
      throw new Error('Pilot approvals unavailable');
    }
    const approved = directory.clubs.filter(club =>
      Number.isSafeInteger(Number(club.club_id)) && Number(club.club_id) > 0 &&
      club.logo_status === 'pilot_verified' && HASH.test(String(club.logo_sha256 || '')) &&
      typeof club.club_name === 'string' && club.club_name.trim());
    const requested = url.searchParams.get('club');
    const selected = requested
      ? approved.find(club => String(club.club_id) === requested)
      : approved.find(club => Number(club.club_id) === 447) || approved[0];
    if (!selected) return new Response('Badge not approved for pilot', { status: 404 });
    const id = Number(selected.club_id);
    const name = escapeHtml(selected.club_name);
    const asset = `/__pilot_badges/${id}/${String(selected.logo_sha256).toLowerCase()}`;
    const size = url.searchParams.get('size') === 'foldable' ? 'foldable' : 'phone';
    const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
    const href = (club, nextSize = size, nextTheme = theme) =>
      `/__badge_review?club=${Number(club)}&size=${nextSize}&theme=${nextTheme}`;
    const nav = approved.map(club => `<a href="${href(club.club_id)}" ${Number(club.club_id) === id ? 'aria-current="page"' : ''}>${escapeHtml(club.club_name)}</a>`).join('');
    const small = (pixels, label) => `<div class="sample"><img src="${asset}" width="${pixels}" height="${pixels}" alt="${name} badge at ${pixels} pixels"><span>${name}</span><small>${label} · ${pixels} px</small></div>`;
    const html = `<!doctype html>
<html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${name} · pilot badge review</title>
<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/app-design-system.css">
<style>
body{margin:0;padding:0 0 40px;background:var(--gch-canvas)}
.review{max-width:900px;margin:auto;padding:16px}.review h1{font-size:24px;margin:4px 0}.review p{margin:6px 0 14px;color:var(--gch-copy)}
.review-nav,.review-options{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.review a{color:var(--gch-green-900);font-weight:800}.review-nav a,.review-options a{border:1px solid var(--gch-line);background:#fff;border-radius:12px;padding:9px 12px;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}
.review a[aria-current=page],.review-options a[aria-current=page]{background:var(--gch-green-900);color:#fff}
.review-scroller{max-width:100%;overflow-x:auto;border:1px solid var(--gch-line);border-radius:20px}.review-stage{width:min(390px,100%);margin:auto;background:var(--gch-canvas);padding-bottom:14px}.review-stage.foldable{width:720px;max-width:none}
.review-stage .hero{width:100%}.review-stage.phone .hero{padding:14px 14px 104px;min-height:150px;border-radius:0 0 20px 20px}.review-stage.phone .hero-art{inset:auto 0 0;width:100%;height:96px;object-position:center 68%}
.review-stage.phone .hero::before{inset:auto 0 0;width:100%;height:96px;background:linear-gradient(180deg,var(--gch-green-950),rgba(6,69,38,.7) 24%,rgba(6,69,38,.06) 70%)}
.review-stage.phone .hero-inner{grid-template-columns:64px minmax(0,1fr)}.review-stage.phone .club-logo-wrap{width:64px;height:64px}
.review-stage.foldable .hero{min-height:190px;padding:18px 28px 20px;border-radius:0 0 24px 24px}.review-stage.foldable .hero-art,.review-stage.foldable .hero::before{inset:0 0 0 auto;width:60%;height:100%}
.review-stage.foldable .hero::before{background:linear-gradient(90deg,var(--gch-green-950),rgba(6,69,38,.86) 22%,rgba(6,69,38,.25) 62%,rgba(6,69,38,.08))}
.review-stage.foldable .hero-inner{grid-template-columns:86px minmax(0,1fr)}.review-stage.foldable .club-logo-wrap{width:86px;height:86px}
.review-cards{padding:14px}.review-cards h2{font-size:17px;margin:8px 0}.review-cards p{font-size:12px}
.samples{display:grid;gap:9px}.sample{display:flex;align-items:center;gap:9px;padding:10px;border:1px solid #dce6df;border-radius:15px;background:#fff;min-height:54px}.sample img{object-fit:contain;flex:none}.sample span{font-size:12px;font-weight:800;min-width:0;overflow-wrap:anywhere}.sample small{margin-left:auto;white-space:nowrap;color:#596960;font-size:10px}
.review-stage.dark{background:#121b15;color:#f0f7f1}.review-stage.dark .sample{background:#1d2920;color:#f0f7f1;border-color:#3b5040}.review-stage.dark .sample small{color:#bed3c3}
.review-stage.dark .review-cards p{color:#bed3c3}.review-stage.dark .review-cards h2{color:#f0f7f1}
.review-note{margin-top:14px;font-size:12px}.review-note strong{color:#7a5222}
@media(max-width:430px){.review{padding:12px}.review-stage .hero{min-height:150px}.review-stage .hero-copy h1{font-size:27px}}
</style></head><body><main class="review"><p class="kicker">Protected pilot · visual review</p><h1>${name}</h1>
<p>Select an approved club, then check the actual badge at the hero and card sizes. This page uses the private reviewed asset.</p>
<nav class="review-nav" aria-label="Approved pilot clubs">${nav}</nav>
<div class="review-options" aria-label="Preview width"><a href="${href(id, 'phone', theme)}" ${size === 'phone' ? 'aria-current="page"' : ''}>Phone 390 px</a><a href="${href(id, 'foldable', theme)}" ${size === 'foldable' ? 'aria-current="page"' : ''}>Foldable 720 px</a></div>
<div class="review-options" aria-label="Card theme"><a href="${href(id, size, 'light')}" ${theme === 'light' ? 'aria-current="page"' : ''}>Light cards</a><a href="${href(id, size, 'dark')}" ${theme === 'dark' ? 'aria-current="page"' : ''}>Dark cards</a></div>
<div class="review-scroller"><div class="review-stage ${size} ${theme}"><header class="hero"><div class="hero-pattern" aria-hidden="true"></div><img class="hero-art" src="/football-pitch-hero-illustration.png" alt="" aria-hidden="true"><div class="hero-inner"><div class="club-logo-wrap"><img class="club-logo" src="${asset}" alt="${name} club badge"></div><div class="hero-copy"><p class="eyebrow">${name.toUpperCase()}</p><h1>TEAM PREVIEW</h1><p class="season-line">Protected badge pilot</p></div></div></header>
<section class="review-cards"><h2>Result card badge</h2><p>Example layout. No match or score is implied.</p><div class="samples">${small(20, 'Compact phone')}${small(28, 'Standard')}</div><h2>Match card badge</h2><div class="samples">${small(56, 'Phone')}${small(60, 'Standard')}</div></section></div></div>
<p class="review-note"><strong>Visual test only.</strong> Rights remain on hold. If an image fails to load, do not approve its appearance.</p>
</main></body></html>`;
    return new Response(html, { headers: HEADERS });
  } catch {
    return new Response('Review unavailable', { status: 503, headers: HEADERS });
  }
}
