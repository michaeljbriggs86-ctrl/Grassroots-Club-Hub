const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/src/main/assets/app.js'), 'utf8');
const assets = path.join(__dirname, '../app/src/main/assets');
const html = fs.readFileSync(path.join(assets, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(assets, 'app-design-system.css'), 'utf8');

const moreSheet = html.indexOf('id="mobile-more-sheet"');
const moreEnd = html.indexOf('</section>', moreSheet);
assert(moreSheet > 0 && moreEnd > moreSheet);
assert(!html.includes('id="league-table-panel"'), 'Home has no duplicate standings card');
assert(html.includes('id="league-quick-table-body"'), 'Table tab retains the standings');
assert(!html.includes('id="league-quick-opponents"'), 'Table tab has no repeated opponents list');
assert.match(html, /data-mobile-tab="3" hidden[\s\S]*?<span>Table<\/span>/);
for (const id of ['mobile-notification-bell', 'mobile-context-switch']) {
  const button = html.indexOf(`id="${id}"`);
  assert(button > moreSheet && button < moreEnd, `${id} is available under More`);
}
assert.match(css, /@media\(max-width:900px\)[\s\S]*?body \.app-utility-bar\{display:none!important\}/,
  'the mobile page has no account strip below the hero');
assert.match(source, /mobile-notification-bell'\)\?\.addEventListener\('click',\(\)=>\{closeMobileMore\(\);openNotifications\(\);\}\)/);
assert.match(source, /mobile-context-switch'\)\?\.addEventListener\('click',openAccountContextSwitch\)/);
assert.match(source, /button:not\(\[hidden\]\):not\(\.hidden\)/,
  'hidden account actions are skipped by the More focus trap');

const start = source.indexOf('function closeMobileMore(restoreFocus=false){');
const end = source.indexOf('function navigate(view,scroll=true){', start);
assert(start >= 0 && end > start, 'mobile navigation functions are present');

function fixture(role, club, league, awards, tab = 'overview') {
  const tabs = [0, 1, 3, 2, 'more'].map(key => ({
    dataset: {mobileTab: String(key)},
    label: {textContent: ''},
    attributes: {},
    querySelector() { return this.label; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
  }));
  const menu = ['league', 'awards', 'club-results', 'club-coaches', 'inbox', 'more'].map(target => ({
    dataset: {mobileMenuTarget: target}, hidden: false, firstChild: {textContent: 'Inbox '},
  }));
  const context = {
    currentRole: role, currentView: club ? 'club' : 'home', __clubTab: tab,
    isClubOverviewMode: () => club,
    isPublishedLeagueTeam: () => league,
    isAdminCoachMode: () => false,
    featureEnabled: name => name === 'awards' && awards,
    document: {
      getElementById: id => id === 'mobile-primary-nav' ? {querySelectorAll: () => tabs, classList: {toggle: () => {}}} : null,
      querySelectorAll: selector => selector === '[data-mobile-menu-target]' ? menu : [],
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return {context, tabs, menu: Object.fromEntries(menu.map(item => [item.dataset.mobileMenuTarget, item]))};
}

{
  const {context, tabs, menu} = fixture('coach', false, true, true);
  context.syncMobileNavigation();
  assert.deepEqual([tabs[0], tabs[1], tabs[3]].map(item => [item.label.textContent, item.dataset.mobileTarget]),
    [['Home', 'home'], ['Matches', 'matches'], ['Squad', 'squad']]);
  assert.equal(tabs[0].attributes['aria-current'], 'page');
  assert.equal(tabs[2].dataset.mobileTarget, 'league');
  assert.equal(tabs[2].hidden, false);
  assert.equal(menu.league.hidden, false);
  assert.equal(menu.awards.hidden, false);
  assert.equal(menu['club-results'].hidden, false);
  assert.equal(menu.inbox.hidden, false);
  assert.equal(menu['club-coaches'].hidden, true);
  context.syncMobileNavigation('inbox');
  assert.equal(tabs[4].attributes['aria-current'], 'page', 'inbox selects More');
  context.syncMobileNavigation('league');
  assert.equal(tabs[2].attributes['aria-current'], 'page', 'league selects Table');
}
{
  const {context, tabs, menu} = fixture('admin', true, false, false);
  context.syncMobileNavigation();
  assert.deepEqual([tabs[0], tabs[1], tabs[3]].map(item => [item.label.textContent, item.dataset.mobileTarget]),
    [['Club', 'club'], ['Fixtures', 'club-fixtures'], ['Results', 'club-results']]);
  assert.equal(menu['club-coaches'].hidden, false);
  assert.equal(menu.inbox.firstChild.textContent, 'Communications ');
  assert.equal(menu.awards.hidden, true);
  assert.equal(menu.league.hidden, true);
  assert.equal(tabs[2].hidden, true);
  context.__clubTab = 'coaches';
  context.syncMobileNavigation();
  assert.equal(tabs[4].attributes['aria-current'], 'page', 'Coaches is under More');
  context.syncMobileNavigation('club-fixtures');
  assert.equal(tabs[1].attributes['aria-current'], 'page');
}
{
  const {context, menu, tabs} = fixture('parent', false, false, false);
  context.syncMobileNavigation();
  assert.equal(menu.inbox.hidden, false);
  assert.equal(menu.league.hidden, true);
  assert.equal(tabs[2].hidden, true);
  assert.equal(menu.awards.hidden, true);
  assert.equal(menu['club-results'].hidden, true);
}
{
  const {context, menu} = fixture('player', false, false, true);
  context.syncMobileNavigation();
  assert.equal(menu.inbox.hidden, true, 'player access never exposes Inbox');
  assert.equal(menu['club-coaches'].hidden, true);
  assert.equal(menu['club-results'].hidden, true);
}
console.log('Mobile navigation role and destination checks passed');
