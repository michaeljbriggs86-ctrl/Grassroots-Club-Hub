// Both hostnames belong to the same Shooters Hill pilot Worker. Cloudflare
// Worker Access must protect all traffic before another origin is admitted.
const PILOT_ORIGINS = new Set([
  'https://test.pitchkind.com',
  'https://shootershillafc.app',
]);

export function isPilotOrigin(url) {
  return PILOT_ORIGINS.has(url.origin);
}
