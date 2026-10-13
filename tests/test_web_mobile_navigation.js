const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/app.js'), 'utf8');
const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(assets, 'app-design-system.css'), 'utf8');

const morePage = html.indexOf('id="view-more"');
const moreEnd = html.indexOf('id="view-training-settings"',morePage);
assert(morePage > 0 && moreEnd > morePage);
assert(!html.includes('id="mobile-more-sheet"'), 'More is a page, not an intermediate modal');
assert(!html.includes('id="league-table-panel"'), 'Home has no duplicate standings card');
assert(html.includes('id="league-quick-table-body"'), 'Table tab retains the standings');
assert(!html.includes('id="league-quick-opponents"'), 'Table tab has no repeated opponents list');
assert.match(html, /data-mobile-tab="3" hidden[\s\S]*?<span>Table<\/span>/);
for (const id of ['mobile-notification-bell', 'mobile-context-switch']) {
  const button = html.indexOf(`id="${id}"`);
  assert(button > morePage && button < moreEnd, `${id} is available under More`);
}
assert.match(css, /@media\(max-width:900px\)[\s\S]*?body \.app-utility-bar\{display:none!important\}/,
  'the mobile page has no account strip below the hero');
assert.match(source, /mobile-notification-bell'\)\?\.addEventListener\('click',\(\)=>\{closeMobileMore\(\);openNotifications\(\);\}\)/);
assert.match(source, /mobile-context-switch'\)\?\.addEventListener\('click',openAccountContextSwitch\)/);
const start = source.indexOf('function closeMobileMore(){');
const end = source.indexOf('// Screen routes use', start);
assert(start >= 0 && end > start, 'mobile navigation functions are present');

function fixture(role, club, league, awards, tab = 'overview') {
  const tabs = [0, 1, 3, 2, 'more'].map(key => ({
    dataset: {mobileTab: String(key)},
    label: {textContent: ''},
    attributes: {},
    querySelector(selector) { return selector === 'span' ? this.label : {setAttribute() {}}; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  }));
  const context = {
    CLOUD_MODE: true,
    currentRole: role, currentView: club ? 'club' : 'home', __clubTab: tab,
    isClubOverviewMode: () => club,
    isPublishedLeagueTeam: () => league,
    isAdminCoachMode: () => false,
    featureEnabled: name => name === 'awards' && awards,
    document: {
      getElementById: id => id === 'mobile-primary-nav' ? {querySelectorAll: () => tabs, classList: {toggle: () => {}}} : null,
      querySelectorAll: () => [],
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  context.navigate=view=>{context.destination=view;};
  return {context, tabs};
}

{
  const {context, tabs} = fixture('coach', false, true, true);
  context.syncMobileNavigation();
  assert.deepEqual([tabs[0], tabs[1], tabs[3]].map(item => [item.label.textContent, item.dataset.mobileTarget]),
    [['Home', 'home'], ['Matches', 'matches'], ['Squad', 'squad']]);
  assert.equal(tabs[0].attributes['aria-current'], 'page');
  context.openMobileMore();
  assert.equal(context.destination,'more','More navigates directly to the hub');
  assert.equal(tabs[2].dataset.mobileTarget, 'league');
  assert.equal(tabs[2].hidden, false);
  context.syncMobileNavigation('inbox');
  assert.equal(tabs[4].attributes['aria-current'], 'page', 'inbox selects More');
  context.syncMobileNavigation('league');
  assert.equal(tabs[2].attributes['aria-current'], 'page', 'league selects Table');
}
{
  const {context, tabs} = fixture('admin', true, false, false);
  context.syncMobileNavigation();
  assert.deepEqual([tabs[0], tabs[1], tabs[3]].map(item => [item.label.textContent, item.dataset.mobileTarget]),
    [['Home', 'club'], ['Matches', 'club-matches'], ['Staff', 'club-coaches']]);
  assert.equal(tabs[2].hidden, true);
  context.__clubTab = 'coaches';
  context.syncMobileNavigation();
  assert.equal(tabs[3].attributes['aria-current'], 'page', 'Coaches selects Staff');
  context.syncMobileNavigation('club-fixtures');
  assert.equal(tabs[1].attributes['aria-current'], 'page');
}
{
  const {context,tabs} = fixture('parent', false, false, false);
  context.syncMobileNavigation();
  assert.equal(tabs[2].hidden, true);
}
{
  const {context} = fixture('player', false, false, true);
  context.syncMobileNavigation();
}
console.log('Mobile navigation role and destination checks passed');
