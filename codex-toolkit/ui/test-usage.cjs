const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'codex-usage.js'), 'utf8');
assert.ok(source.includes('--codex-color:var(--dsw-static-blue-450,#4d93f8); --codex-end:var(--dsw-static-blue-300,#93c5fd);'), 'normal usage uses the blue gradient');
assert.ok(source.includes('[data-tone="warning"] { --codex-color:#e5ad55; --codex-end:#f3cd85;'), 'warning stays amber');
assert.ok(source.includes('[data-tone="critical"] { --codex-color:#ec7e86; --codex-end:#f5a3a4;'), 'critical stays red');

function harness(responder) {
  const cells = [], refs = [], effects = [], calls = [], timers = new Map();
  let slot = 0, refSlot = 0, effectSlot = 0, canvasSize = null, canvasAlphaPixels = 0, canvasRenders = 0;
  const react = {
    useState(initial) { const i = slot++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = refSlot++; return refs[i] ||= { current: initial }; },
    useEffect(callback, deps) { const i = effectSlot++, old = effects[i]; if (!old) effects[i] = { deps, pending: callback }; }
  };
  const jsx = (type, props) => ({ type, ...props });
  const css = Object.fromEntries(['balanceCard','row','divider','linkButton','secondary'].map(key => [key, key]));
  const document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    return { width: 0, height: 0,
      getContext(type) {
        assert.equal(type, '2d');
        return {
          createImageData(width, height) { canvasSize = [width, height]; return { data: new Uint8ClampedArray(width * height * 4) }; },
          putImageData(image) { for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) canvasAlphaPixels++; }
        };
      },
      toDataURL(type) { assert.equal(type, 'image/png'); canvasRenders++; return 'data:image/png;base64,usage-dither'; }
    };
  } };
  const context = vm.createContext({ react, react_jsx_runtime: { jsx, jsxs: jsx }, AccountSection_module_css_default: css, document,
    setInterval(callback, delay) { assert.equal(delay, 30000); const id = {}; timers.set(id, callback); return id; }, clearInterval(id) { timers.delete(id); },
    AbortController, Date, Number, fetch: async (url, options) => { calls.push({ url, options }); const value = await responder(url, options); return { ok: value.ok !== false, json: async () => value.body ?? value }; } });
  vm.runInContext(source + '\nthis.CodexUsageCard = CodexUsageCard;', context);
  function render() { slot = refSlot = effectSlot = 0; const tree = context.CodexUsageCard(); for (const effect of effects) if (effect.pending) { const cb = effect.pending; effect.pending = null; effect.cleanup = cb(); } return tree; }
  const flush = async () => { for (let i=0; i<20; i++) await Promise.resolve(); };
  function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; const children = Array.isArray(tree.children) ? tree.children : [tree.children]; return [...(predicate(tree) ? [tree] : []), ...children.flatMap(child => nodes(child, predicate))]; }
  return { render, flush, nodes, calls, timers, get canvasSize() { return canvasSize; }, get canvasAlphaPixels() { return canvasAlphaPixels; }, get canvasRenders() { return canvasRenders; }, unmount() { for (const e of effects) e.cleanup?.(); assert.equal(timers.size, 0, 'unmount clears countdown timer'); } };
}
(async () => {
  const formatContext = vm.createContext({});
  vm.runInContext(source, formatContext);
  const now = 1900000000000;
  for (const [seconds, expected] of [[-1, 'Reset due'], [0, 'Reset due'], [1, 'Resets in 1m'], [3540, 'Resets in 59m'], [3600, 'Resets in 1h'], [13320, 'Resets in 3h 42m'], [86400, 'Resets in 1d'], [529200, 'Resets in 6d 3h']]) {
    assert.equal(formatContext.codexResetLabel(now / 1000 + seconds, now), expected);
  }
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(formatContext.codexResetLabel(value, now), 'Reset unknown');
  const disconnected = harness(async () => ({ configured: false }));
  disconnected.render(); await disconnected.flush();
  assert.equal(disconnected.render(), null);
  assert.deepEqual(disconnected.calls.map(c => c.url), ['/api/codex-auth/status']);
  disconnected.unmount();

  const ts = 1900000000;
  const connected = harness(async url => url.endsWith('/status') ? { configured: true } : { primary: { usedPercent: 35, resetsAt: ts }, secondary: { usedPercent: 80, resetsAt: ts + 100 } });
  connected.render(); await connected.flush();
  let tree = connected.render();
  const text = JSON.stringify(tree);
  assert.ok(text.includes('5-hour limit') && text.includes('Weekly limit'));
  assert.ok(text.includes('35% used · 65% remaining') && text.includes('80% used · 20% remaining'));
  assert.ok(connected.nodes(tree, n => n.title === new Date(ts * 1000).toLocaleString()).some(n => n.children.startsWith('Resets in ')));
  assert.equal(connected.timers.size, 1);
  for (const tick of connected.timers.values()) tick();
  assert.equal(connected.calls.length, 2, 'countdown ticks do not refetch usage');
  const meters = connected.nodes(tree, n => n.role === 'progressbar');
  assert.equal(meters.length, 2);
  const style = connected.nodes(tree, n => n.type === 'style')[0];
  assert.ok(style.children.includes('data:image/png;base64,usage-dither'), 'canvas texture is injected into the bar styles');
  assert.deepEqual(connected.canvasSize, [128, 6]);
  assert.ok(connected.canvasAlphaPixels > 0, 'canvas contains visible ordered-dither pixels');
  assert.ok(style.children.includes('z-index:1;'), 'dither paints visibly above the gradient fill');
  assert.ok(style.children.includes('background-size:128px 100%; background-repeat:repeat-x;'), 'texture keeps its pixel scale and repeats seamlessly');
  assert.ok(style.children.includes('codex-dither-shimmer 4.2s linear infinite'), 'dither shifts continuously to create a shimmer');
  assert.ok(style.children.includes('@keyframes codex-dither-shimmer'), 'shimmer keyframes are present');
  assert.equal(connected.canvasRenders, 1, 'texture is rendered once and reused across component renders');
  assert.equal(meters[0].style['--codex-fill-cutoff'], '65%');
  assert.equal(meters[1].style['--codex-fill-cutoff'], '20%');
  assert.equal(meters[0]['aria-label'], '5-hour limit');
  assert.equal(meters[0]['aria-valuenow'], 35);
  assert.equal(meters[1]['aria-valuenow'], 80);
  assert.equal(connected.nodes(tree, n => n.className === 'codex-meter-fill')[0].style['--codex-fill'], .35);
  assert.deepEqual(connected.nodes(tree, n => n.className === 'codex-limit').map(n => n['data-tone']), ['normal', 'warning']);
  assert.ok(text.includes('prefers-reduced-motion:reduce'));
  assert.equal(tree['aria-busy'], false);
  assert.equal(connected.calls.length, 2);
  assert.ok(connected.calls.every(c => c.options.credentials === 'same-origin' && c.options.cache === 'no-store'));
  const refresh = connected.nodes(tree, n => n.type === 'button')[0];
  const refreshing = refresh.onClick();
  const busyTree = connected.render();
  assert.equal(busyTree['aria-busy'], true);
  assert.equal(connected.nodes(busyTree, n => n.type === 'button')[0].disabled, true);
  assert.equal(connected.nodes(busyTree, n => n.role === 'status')[0].className, 'codex-loading-status');
  assert.deepEqual(connected.nodes(busyTree, n => n.role === 'progressbar').map(n => n['aria-valuenow']), [35, 80], 'refresh retains current usage');
  assert.deepEqual(busyTree.children.map(n => n?.type), tree.children.map(n => n?.type), 'refresh keeps the same card structure');
  await refreshing;
  await connected.flush();
  assert.equal(connected.render()['aria-busy'], false);
  assert.equal(connected.calls.filter(c => c.url.endsWith('/status')).length, 2);
  connected.unmount();

  let failed = true;
  const retry = harness(async url => { if (url.endsWith('/status')) return { configured: true }; if (failed) return { ok: false, body: { error: 'SECRET SERVER DETAIL' } }; return { primary: null, secondary: null }; });
  retry.render(); await retry.flush(); tree = retry.render();
  assert.ok(retry.nodes(tree, n => n.role === 'alert').length);
  assert.ok(!JSON.stringify(tree).includes('SECRET SERVER DETAIL'));
  failed = false; await retry.nodes(tree, n => n.type === 'button')[0].onClick(); await retry.flush(); tree = retry.render();
  assert.ok(JSON.stringify(tree).includes('Unknown'));
  assert.equal(retry.calls.filter(c => c.url.endsWith('/usage')).length, 2);
  const unknownMeters = retry.nodes(tree, n => n.role === 'progressbar');
  assert.ok(unknownMeters.every(n => !('aria-valuenow' in n) && n['aria-valuetext'] === 'Usage unknown'));
  assert.equal(retry.nodes(tree, n => n.className === 'codex-meter-fill').length, 0);
  retry.unmount();

  const bounds = harness(async url => url.endsWith('/status') ? { configured: true } : { primary: { usedPercent: -5 }, secondary: { usedPercent: 120 } });
  bounds.render(); await bounds.flush(); tree = bounds.render();
  assert.deepEqual(bounds.nodes(tree, n => n.role === 'progressbar').map(n => n['aria-valuenow']), [0, 100]);
  assert.equal(bounds.nodes(tree, n => n.className === 'codex-limit')[1]['data-tone'], 'critical');
  bounds.unmount();

  for (const [usedPercent, tone] of [[79.99, 'normal'], [80, 'warning'], [94.99, 'warning'], [95, 'critical'], [100, 'critical']]) {
    const boundary = harness(async url => url.endsWith('/status') ? { configured: true } : { primary: { usedPercent }, secondary: null });
    boundary.render(); await boundary.flush();
    assert.equal(boundary.nodes(boundary.render(), n => n.className === 'codex-limit')[0]['data-tone'], tone, `usage tone at ${usedPercent}%`);
    boundary.unmount();
  }

  let signal;
  const pending = harness(async (url, options) => { signal = options.signal; return new Promise(() => {}); });
  pending.render(); pending.unmount();
  assert.ok(signal?.aborted, 'unmount aborts pending fetch');
  console.log('PASS: disconnected, usage limits/reset, retry, unknown windows, abort on unmount');
})().catch(error => { console.error(error); process.exitCode = 1; });
