// Lifecycle and source-level CSS regressions; not browser layout/cascade verification.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, 'lib/client.js'), 'utf8');
let definition;
const styles = [];
const attrs = new Set();
let canvasSize;
let canvasAlphaPixels = 0;
let canvasAlphaValue = 0;
let canvasRenders = 0;
const document = {
	getElementById(id) { return styles.find(style => style.id === id) || null; },
	createElement(tag) {
		if (tag === 'canvas') return {
			width: 0,
			height: 0,
			getContext(type) {
				assert.equal(type, '2d');
				return {
					createImageData(width, height) {
						canvasSize = [width, height];
						return { data: new Uint8ClampedArray(width * height * 4) };
					},
					putImageData(image) {
						for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) { canvasAlphaPixels++; canvasAlphaValue = image.data[i]; }
					}
				};
			},
			toDataURL(type) {
				assert.equal(type, 'image/png');
				canvasRenders++;
				return 'data:image/png;base64,canvas-dither';
			}
		};
		return { id: '', textContent: '', remove() { styles.splice(styles.indexOf(this), 1); } };
	},
	head: { appendChild(style) { styles.push(style); } },
	documentElement: {
		setAttribute(name) { attrs.add(name); },
		removeAttribute(name) { attrs.delete(name); }
	}
};
vm.runInNewContext(source, {
	window: { __ModuleLoader__: { load(value) { definition = value; } } },
	document
});
assert.equal(definition.id, 'dsh-beautify');
const client = definition.factory();
const cleanups = [];
const ctx = { effect(fn) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); } };
client.apply(ctx);
client.apply(ctx);
assert.equal(styles.length, 1, 'duplicate activation injects only one stylesheet');
assert.ok(attrs.has('data-dsh-beautify'), 'activation adds scope');
const css = styles[0].textContent;
const cssTemplate = fs.readFileSync(require('node:path').join(__dirname, 'src/polish.css'), 'utf8');
assert.deepEqual(canvasSize, [1280, 720], 'dither uses one full-panel, non-repeating canvas render');
assert.ok(canvasAlphaPixels > 0, 'ordered-dither renderer creates visible pixels');
assert.equal(canvasAlphaValue, 52, 'canvas blue intensity is gently reduced');
assert.equal(canvasRenders, 1, 'full background renders once on activation, not per frame');
assert.equal(css, cssTemplate.replace('__BEAUTIFY_DITHER_BACKGROUND__', 'data:image/png;base64,canvas-dither'), 'generated CSS is current and uses the canvas background');
function rule(selector) {
	const start = css.indexOf(selector + ' {');
	assert.notEqual(start, -1, `rule exists: ${selector}`);
	return css.slice(start + selector.length + 2, css.indexOf('}', start));
}
const menu = 'html[data-dsh-beautify] ._list_4ub78_7[role="menu"]:is(:has(> ._viewport_4ub78_19 > ._itemWrap_4ub78_90 ._shortcut_4ub78_198), :has([data-slot="sidebar.workspaces.session.menu.item"]))';
assert.match(rule(menu), /width: min\(var\(--beautify-menu-width, 144px\), calc\(100vw - 16px\)\);/, 'account width defaults to 144px');
assert.match(rule(menu), /min-width: min\(var\(--beautify-menu-width, 144px\), calc\(100vw - 16px\)\);/, 'width remains viewport bounded');
assert.match(rule('html[data-dsh-beautify] ._list_4ub78_7[role="menu"]:has([data-slot="sidebar.workspaces.session.menu.item"])'), /--beautify-menu-width: 216px;/, 'session width uses its named slot, regardless of wrapper depth or row order');
assert.ok(!css.includes('._itemWrap_4ub78_90:nth-child(2)'), 'session matching must not depend on shortcut row positions');
assert.match(rule(menu + ' ._shortcut_4ub78_198'), /display: none;/, 'hide badges, not keyboard actions');
assert.match(rule(menu + ' ._item_4ub78_90'), /grid-template-columns: 14px minmax\(0, 1fr\) 14px;/, 'equal gutters center text independently of icons');
assert.match(rule(menu + ' ._item_4ub78_90'), /text-align: center;/);
assert.match(rule(menu + ' ._itemLabel_4ub78_190'), /grid-column: 2;/);
const selected = 'html[data-dsh-beautify] :is([role="menuitemradio"], [role="menuitemcheckbox"])[aria-checked="true"]:not(:disabled):not([aria-disabled="true"])';
assert.match(rule(selected), /background: color-mix\(in srgb, var\(--beautify-accent\) 16%, transparent\);/, 'selected rule includes scope and disabled guards to outrank shipped hover/focus/active selectors');
assert.match(rule('html[data-dsh-beautify] .wq12jW_option[aria-checked="true"]:not(:disabled):not([aria-disabled="true"]) > .wq12jW_check > svg'), /color: var\(--beautify-accent\);/, 'color only the enabled checkmark, not provider or pending icons');
assert.ok(!css.includes('#59c9b5'), 'no former green-teal accent');
assert.match(rule('html[data-dsh-beautify]'), /--beautify-accent: var\(--dsw-static-blue-450, #4d93f8\);/, 'blue theme-token accent');
const dither = rule('html[data-dsh-beautify] [data-phase]:is([data-phase="hero"], [data-phase="active"])');
assert.match(dither, /data:image\/png;base64,canvas-dither/, 'chat background uses the canvas-rendered image');
assert.match(dither, /radial-gradient\(ellipse at 18% 12%, color-mix\(in srgb, var\(--beautify-accent\) 18%, transparent\)/, 'first blue glow is slightly softer');
assert.match(dither, /radial-gradient\(ellipse at 88% 78%, color-mix\(in srgb, var\(--beautify-accent\) 12%, transparent\)/, 'second blue glow is slightly softer');
assert.match(dither, /var\(--dsw-alias-bg-base\) 55%, transparent\) 42%/, 'top edge fades smoothly into the base background');
assert.match(dither, /background-size: 100% 220px, 110% 110%, 100% 100%, 100% 100%;/, 'canvas covers the full conversation panel');
assert.match(dither, /background-repeat: no-repeat;/, 'background image never tiles');
assert.match(dither, /animation: beautify-dither-shimmer 14s/, 'Canvas background shimmers slowly');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'background motion respects accessibility preference');
const previewBadge = rule('html[data-dsh-beautify] .Hqq-bq_previewBadge');
assert.match(previewBadge, /align-self: center;/, 'hero Preview badge aligns with the headline');
assert.match(previewBadge, /margin-top: 0;/, 'remove the badge’s extra top offset');
const composerFade = rule('html[data-dsh-beautify] [data-phase="active"] [data-conversation-region="composer"]');
assert.match(composerFade, /background: linear-gradient\(180deg, transparent 0, color-mix\(in srgb, var\(--dsw-alias-bg-base\) 20%, transparent\) 60px, color-mix\(in srgb, var\(--dsw-alias-bg-base\) 48%, transparent\) 145px, color-mix\(in srgb, var\(--dsw-alias-bg-base\) 70%, transparent\) 240px\);/, 'active composer fade is visible but gradual');
const thinkHeader = rule('html[data-dsh-beautify] [data-variant="think"][data-expanded] [data-open] [data-disclosure-header]');
assert.match(thinkHeader, /background: transparent;/, 'expanded Think header reveals the normal conversation background');
assert.ok(!css.includes('body::before'), 'dither is not a viewport overlay');
assert.ok(!css.includes('__BEAUTIFY_DITHER_BACKGROUND__'), 'canvas URL is fully inserted');
assert.ok(!css.includes('[data-phase="settling"]'), 'transitional shells stay untouched');
const desc = rule('[data-shortcut-modal="settings"] .KZf9OG_cardDesc');
assert.match(desc, /margin-block: 0;/, 'descriptions share the same top baseline');
assert.match(desc, /display: block;/);
assert.match(desc, /-webkit-line-clamp: unset;/, 'read the whole description');
assert.match(rule('[data-shortcut-modal="settings"] .KZf9OG_cardIdentity'), /flex-direction: column;/, 'badges no longer squeeze titles');
assert.match(rule('[data-shortcut-modal="settings"] .KZf9OG_cardActive:not(.KZf9OG_cardBroken)'), /box-shadow: inset 3px 0 0 var\(--beautify-accent\);/, 'broken state is not overridden by blue default state');
assert.ok(!css.includes('[role="menu"] [role="menuitem"]:hover'), 'plain-menu hover stays native');
assert.ok(!css.includes('[role="menu"]:has([role="menuitemradio"])'), 'no extra frame around the nested model-list menu');
assert.ok(!css.includes('width: calc(100% + 8px)'), 'searchbox must not expand beyond its Input wrapper');
assert.ok(!css.includes('margin: 0 -4px'), 'no negative searchbox margins');
assert.match(rule('html[data-dsh-beautify] .wq12jW_menu:has(> .wq12jW_groups)'), /width: min\(300px, calc\(100vw - 24px\)\);/, 'only model pane gets a stable viewport-bounded width');
assert.match(rule('html[data-dsh-beautify] .wq12jW_searchRow .wq12jW_search'), /border: 1px solid var\(--dsw-alias-border-l2\);/, 'search wrapper owns the single field border');
assert.match(rule('html[data-dsh-beautify] .wq12jW_searchRow .wq12jW_search input'), /border: 0;/, 'nested input remains frameless');
assert.match(rule('html[data-dsh-beautify] .wq12jW_searchRow .wq12jW_searchWithQuery'), /padding-inline-end: 34px;/, 'typed search retains room for its clear button');
assert.match(rule('html[data-dsh-beautify] .wq12jW_searchRow .wq12jW_search:focus-within'), /box-shadow: 0 0 0 2px/, 'focus ring has room inside the panel');
assert.match(rule('html[data-dsh-beautify] .wq12jW_menu > .wq12jW_groups'), /scrollbar-gutter: stable;/, 'reserve a consistent scrollbar lane');
assert.match(rule('html[data-dsh-beautify] .wq12jW_groups [data-menu-group-heading]'), /position: static;/, 'provider labels scroll away instead of lingering over another group');
assert.match(rule('html[data-dsh-beautify] .RlGAzG_primary:not(:disabled)'), /background: var\(--beautify-accent\);/, 'enabled Send and Stop share blue while disabled buttons stay native');
assert.match(rule('html[data-dsh-beautify] .RlGAzG_primary:not(:disabled):hover'), /var\(--beautify-accent\) 90%/, 'Send and Stop share the darker hover');
assert.ok(!css.includes('.RlGAzG_primary:not(:disabled):has('), 'stop-square must not be excluded by icon shape');
cleanups.forEach(cleanup => cleanup());
assert.equal(styles.length, 0, 'disposal removes stylesheet');
assert.ok(!attrs.has('data-dsh-beautify'), 'disposal removes scope');
client.apply(ctx);
assert.equal(styles.length, 1, 'client can reactivate');
console.log('PASS: client lifecycle and CSS regressions for centered menus, preset copy, blue selection and disabled guards');
