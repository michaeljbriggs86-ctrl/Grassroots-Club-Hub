// Badge bytes are private R2 objects. The canonical directory controls which
// exact club ID and reviewed hash the protected website may serve.
const PATH = /^\/__pilot_badges\/([1-9]\d*)\/([a-f0-9]{64})$/;
const MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/avif']);

export async function pilotBadge(request, env) {
  const url = new URL(request.url);
  const match = PATH.exec(url.pathname);
  if (!match || url.hostname !== 'test.pitchkind.com' || url.protocol !== 'https:') {
    return new Response('Not found', { status: 404 });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (!env.PILOT_BADGES) return new Response('Unavailable', { status: 503 });
  try {
    const directoryResponse = await env.ASSETS.fetch(new Request(new URL('/data/directory.json', url)));
    if (!directoryResponse.ok) throw new Error('Directory unavailable');
    const directory = await directoryResponse.json();
    const [clubId, hash] = [Number(match[1]), match[2]];
    const club = directory.clubs?.find(c => Number(c.club_id) === clubId);
    if (club?.logo_status !== 'pilot_verified' ||
        String(club.logo_sha256 || '').toLowerCase() !== hash ||
        !directory.pilot_badges_revision) {
      return new Response('Not found', { status: 404 });
    }
    const object = await env.PILOT_BADGES.get(`${clubId}/${hash}`);
    if (!object) return new Response('Not found', { status: 404 });
    const type = object.httpMetadata?.contentType?.toLowerCase();
    if (!MIME.has(type)) return new Response('Unsupported badge type', { status: 502 });
    // The key is an identifier, not proof that stored bytes still match review.
    const bytes = await object.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (actual !== hash) return new Response('Badge hash mismatch', { status: 502 });
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return new Response('Unavailable', { status: 503 });
  }
}
