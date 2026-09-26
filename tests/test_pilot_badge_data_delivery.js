const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const directory = JSON.parse(fs.readFileSync(path.join(root, 'data/directory.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'verification/pilot_verified_badges.json'), 'utf8'));
const norm = (s = '') => String(s).toLowerCase().replace(/&amp;/g, 'and').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

function extract(file, start, end) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert(first >= 0 && last > first, `Missing app function: ${start}`);
  return source.slice(first, last);
}

const state = { selkent: { clubUrl: 'https://www.selkent.org.uk/public/clubs/499', directoryDetails: {} } };
const overlay = vm.createContext({ state, norm });
vm.runInContext(extract('app/src/main/assets/static-feed-overlay.js', '  function attachDirectoryBadges(', '  function loadDirectory('), overlay);
const window = { ClubHubNative: { isDebugBuild: () => true }, __PITCHKIND_PILOT_RIGHTS: { scope_verified: true, override_status: 'ACTIVE', active_club_ids: [499], permitted_club_ids: [499] } };
const app = vm.createContext({ state, window, providerType: () => 'selkent', primaryProvider: () => ({ config: { club_url: state.selkent.clubUrl } }),
  clubSettings: () => ({ display_name: 'Shooters Hill AFC' }), isOwnTeamName: () => false,
  selkentNorm: norm, pilotBadgeOverrideAllowed: () => false });
vm.runInContext(extract('app/src/main/assets/app.js', 'function pilotVerifiedBadgeScopeAllowed()', 'function clubIdentityName('), app);

const cray = manifest.badges.find(b => b.club_id === 250);
assert(cray && cray.logo_sha256 === '78dc32848d6919bcfe7c8b2aa6e93e766fd1c5d7d26fd166fdb8450345d11570');
const original = structuredClone(directory);
original.clubs.find(c => c.club_id === 250 && c.club_name === cray.club_name).logo_url = cray.logo_url;
Object.assign(original.clubs.find(c => c.club_id === 250), { logo_status: cray.logo_status, logo_sha256: cray.logo_sha256 });
const crayTeam = original.team_club_links.find(t => Number(t.club_id) === 250).team_name;
overlay.attachDirectoryBadges(original);
assert.equal(app.verifiedTeamBadgeUrl(crayTeam), cray.logo_url);

// A second approval enters through directory data with the same installed app code.
const second = structuredClone(original);
const another = second.clubs.find(c => c.club_id === 261);
const secondUrl = 'https://www.dulwichvillagefc.co.uk/images/crest.png';
Object.assign(another, { logo_status: 'pilot_verified', logo_url: secondUrl, logo_sha256: 'a'.repeat(64) });
const secondTeam = second.team_club_links.find(t => Number(t.club_id) === 261).team_name;
overlay.attachDirectoryBadges(second);
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), secondUrl);

// A removed approval clears the cached image while retaining the other club's approval.
const removed = structuredClone(second);
delete removed.clubs.find(c => c.club_id === 250).logo_status;
overlay.attachDirectoryBadges(removed);
assert.equal(app.verifiedTeamBadgeUrl(crayTeam), '');
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), secondUrl);

// Ambiguous provider team names cannot inherit the wrong club's badge.
const ambiguous = structuredClone(second);
ambiguous.team_club_links.push({ team_name: crayTeam, club_id: 261 });
overlay.attachDirectoryBadges(ambiguous);
assert.equal(app.verifiedTeamBadgeUrl(crayTeam), '');

// No pilot display in a release build, another club's runtime, or when config disagrees.
overlay.attachDirectoryBadges(second);
window.__PITCHKIND_PILOT_RIGHTS = undefined;
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.__PITCHKIND_PILOT_RIGHTS = { scope_verified: true, override_status: 'ACTIVE', active_club_ids: [499, 261], permitted_club_ids: [499] };
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.__PITCHKIND_PILOT_RIGHTS = { scope_verified: true, override_status: 'ACTIVE', active_club_ids: [499], permitted_club_ids: [499] };
window.ClubHubNative.isDebugBuild = () => false;
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.ClubHubNative.isDebugBuild = () => true;
state.selkent.clubUrl = 'https://www.selkent.org.uk/public/clubs/261';
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
state.selkent.clubUrl = 'https://www.selkent.org.uk/public/clubs/499';
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), secondUrl);

// The Cloudflare Access browser pilot can preview the same feed, but no other
// host or Android release build may inherit its exception.
window.ClubHubNative = undefined;
window.location = { protocol: 'https:', hostname: 'test.pitchkind.com' };
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), secondUrl);
window.location.hostname = 'pitchkind.com';
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.location.hostname = 'test.pitchkind.com';
window.location.protocol = 'http:';
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.location.protocol = 'https:';
window.ClubHubNative = { isDebugBuild: () => false };
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');
window.ClubHubNative = { isDebugBuild: () => true };

// Invalid feed metadata is never treated as a pilot approval.
const invalid = structuredClone(second);
invalid.clubs.find(c => c.club_id === 261).logo_sha256 = 'bad';
overlay.attachDirectoryBadges(invalid);
assert.equal(app.verifiedTeamBadgeUrl(secondTeam), '');

// A manual directory sync must fetch fresh data even while the app remains open.
(async () => {
  const calls = [];
  const refresh = vm.createContext({ state, window: { renderClubTeamOptions: () => {} },
    isSelkentProvider: () => true, original: {},
    loadDirectory: async force => { calls.push(force); return { last_updated: '2026-09-26T10:00:00Z' }; },
    buildClubTeams: () => [{ teamName: crayTeam }], persistWithoutRender: () => {}, CLOUD_MODE: false });
  vm.runInContext(extract('app/src/main/assets/static-feed-overlay.js', '  window.syncProviderClubTeams=async function(silent=true){', '  window.syncSelkentDivision='), refresh);
  await refresh.window.syncProviderClubTeams(false);
  await refresh.window.syncProviderClubTeams(true);
  assert.deepEqual(calls, [true, false]);
  console.log('Private-pilot badge data delivery checks passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
