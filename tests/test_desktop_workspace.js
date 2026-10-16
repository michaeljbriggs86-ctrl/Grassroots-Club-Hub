// Regression contract: desktop workspace should not reuse the phone-width frame.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const css = fs.readFileSync('app/src/main/assets/app-design-system.css', 'utf8');
const html = fs.readFileSync('app/src/main/assets/index.html', 'utf8');
assert.match(html, /class="app-shell"/, 'shared shell exists');
assert.match(html, /id="top-nav-tabs"/, 'desktop top navigation exists');
assert.match(html, /id="view-home"/, 'shared Home exists');
const desktop = css.slice(css.lastIndexOf('/* Desktop workspace:'));
assert.match(desktop, /@media\s*\(min-width:\s*1200px\)/, 'wide breakpoint');
assert.match(desktop, /\.app-shell\s*\{[^}]*max-width:\s*none/s, 'desktop shell unrestricted');
assert.match(desktop, />\s*\.content\s*\{[^}]*max-width:\s*1800px/s, 'desktop content adapts with a generous cap');
assert.match(desktop, /#view-home\.active\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/s, 'Home has responsive desktop grid');
assert.match(desktop, /@media\s*\(min-width:\s*901px\)/, 'desktop navigation breakpoint');
assert.match(desktop, /\.bottom-nav\s*\{[^}]*display:\s*none\s*!important/s, 'desktop hides phone dock');
assert.match(css, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?#top-nav-tabs\s*\{display:\s*none!important/, 'mobile retains bottom navigation');
console.log('PASS desktop workspace responsive CSS contract');
