const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { patchClient, DEFAULT_SOURCE } = require('./patch-client.cjs');
const controls = fs.readFileSync(path.join(__dirname, 'codex-auth-controls.js'), 'utf8');
const source = fs.readFileSync(DEFAULT_SOURCE, 'utf8');
const patched = patchClient(source);
new vm.Script(patched);
assert.throws(() => patchClient(patched), /already patched/);
assert.throws(() => patchClient(source.replace('function ModelsSection(props)', 'function Changed(props)')), /insertion point/);
assert.ok(patched.includes('row.entry.provider === "openai-codex" ? (0, react_jsx_runtime.jsx)(CodexAuthControls'));
assert.ok(patched.includes('row.entry.provider === "deepseek-account" ? null : (0, react_jsx_runtime.jsx)("button"'));
assert.ok(patched.includes('if (anyUsable || row.entry.provider === "deepseek-account" || row.entry.provider === "openai-codex") return false;'));
function harness(responder) {
  const cells = [], effects = [], refs = [], calls = [], timers = new Map();
  let slot = 0, refSlot = 0, effectSlot = 0, timerId = 0;
  const react = {
    Fragment: 'Fragment',
    useState(initial) { const i = slot++; if (!(i in cells)) cells[i] = initial; return [cells[i], value => { cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = refSlot++; return refs[i] ||= { current: initial }; },
    useEffect(callback, deps) {
      const i = effectSlot++, old = effects[i];
      if (!old || deps.some((value, index) => !Object.is(value, old.deps[index]))) {
        old?.cleanup?.(); effects[i] = { deps, pending: callback };
      }
    }
  };
  const jsx = (type, props) => ({ type, ...props });
  const context = vm.createContext({ react, react_jsx_runtime: { jsx }, ModelsSection_module_css_default: { accountStatus: 'accountStatus', credentialDot: 'credentialDot', credentialDotConfigured: 'credentialDotConfigured', rowIdentity: 'rowIdentity', rowActions: 'rowActions', rowHead: 'rowHead' }, URL,
    fetch: async (url, options) => { calls.push({ url, options }); const result = await responder(url, options); return { ok: result.ok !== false, status: result.status || 200, json: async () => result.body ?? result }; },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(controls + '\nthis.Controls = CodexAuthControls; this.safeUrl = codexAuthorizationUrl;', context);
  let completed = 0;
  function render(props = {}) {
    slot = refSlot = effectSlot = 0;
    const tree = context.Controls({ onComplete: () => completed++, readOnly: false, ...props });
    for (const effect of effects) if (effect.pending) { const callback = effect.pending; effect.pending = null; effect.cleanup = callback(); }
    return tree;
  }
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    const children = Array.isArray(tree.children) ? tree.children : [tree.children];
    return [...(predicate(tree) ? [tree] : []), ...children.flatMap(child => nodes(child, predicate))];
  }
  return { render, flush, nodes, calls, context, timers, completed: () => completed,
    unmount() { for (const effect of effects) effect.cleanup?.(); },
    tick: async () => { const pending = [...timers.values()]; timers.clear(); for (const callback of pending) await callback(); }
  };
}
(async () => {
  let state = 'pending';
  const h = harness(async url => {
    if (url.endsWith('/status')) return { configured: true };
    if (url.endsWith('/begin')) return { flowId: 'flow-1' };
    if (url.includes('/poll?')) return { state, message: 'Device code: ABCD-EFGH', authorizationUrl: 'https://auth.openai.com/oauth/authorize?state=public', ...(state === 'prompt' ? { prompt: { id: 'prompt-1', type: 'secret', message: 'Paste code' } } : {}) };
    return { status: 204 };
  });
  h.render(); await h.flush();
  let tree = h.render();
  assert.ok(h.nodes(tree, n => Array.isArray(n.children) && n.children.includes('Signed in')).length);
  assert.ok(h.nodes(tree, n => n.className === 'accountStatus').length, 'saved login uses exact DeepSeek Account badge class');
  const renderHeadExpression = patched.match(/const renderHead = ([\s\S]*?);\n\t+return \(0, react_jsx_runtime.jsxs\)\("li"/);
  assert.ok(renderHeadExpression, 'original head is lifted once for split rendering');
  Object.assign(h.context, { row: { entry: { provider: 'openai-codex', displayName: 'OpenAI Codex' }, removable: true }, state: { writable: true, status: 'ready' }, target: {}, open: false, credentialConfigured: false, credentialMissing: false, t: value => value, providerCopy: value => value });
  h.context.react_jsx_runtime.jsxs = h.context.react_jsx_runtime.jsx;
  vm.runInContext('this.renderHead = ' + renderHeadExpression[1], h.context);
  const split = h.render({ children: h.context.renderHead });
  const identity = h.nodes(split, n => n.className === 'rowIdentity')[0];
  const actions = h.nodes(split, n => n.className === 'rowActions')[0];
  assert.ok(h.nodes(identity, n => n.className === 'accountStatus').length, 'badge is beside provider name');
  assert.equal(h.nodes(actions, n => n.className === 'accountStatus').length, 0, 'status is not in right-side actions');
  assert.ok(h.nodes(actions, n => n.children === 'Sign in again').length);
  assert.ok(h.nodes(actions, n => n.children === 'edit').length);
  assert.ok(h.nodes(actions, n => n.children === 'remove').length);
  assert.equal(actions.children[0].type, 'Fragment', 'auth actions add no DOM wrapper before existing buttons');
  await h.nodes(tree, n => n.type === 'button' && n.children === 'Sign in again')[0].onClick();
  tree = h.render(); await h.flush(); tree = h.render();
  assert.ok(h.nodes(tree, n => n.type === 'a' && n.rel === 'noopener noreferrer').length);
  assert.ok(h.nodes(tree, n => n.children === 'Device code: ABCD-EFGH').length);
  const activeSplit = h.render({ children: h.context.renderHead });
  const activeHeader = h.nodes(activeSplit, n => n.className === 'rowHead')[0];
  assert.equal(h.nodes(activeHeader, n => n.children === 'Device code: ABCD-EFGH').length, 0, 'device details stay below header');
  assert.ok(h.nodes(activeSplit, n => n.children === 'Device code: ABCD-EFGH').length);
  assert.ok(h.nodes(activeHeader, n => n.children === 'Cancel sign in').length, 'cancel stays aligned with edit/remove');
  assert.ok(h.nodes(tree, n => Array.isArray(n.children) && n.children.includes('Signed in')).length, 'existing credential remains while signing in');
  state = 'prompt'; await h.tick(); tree = h.render();
  // JSX type prop is represented by this small harness as the effective type.
  const secretInput = h.nodes(tree, n => n.type === 'password')[0];
  assert.ok(secretInput);
  assert.equal(secretInput.autoComplete, 'off');
  secretInput.onChange({ target: { value: 'sensitive-response' } }); tree = h.render();
  await h.nodes(tree, n => n.type === 'form')[0].onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(h.calls.find(c => c.url.endsWith('/respond')).options.body).response, 'sensitive-response');
  assert.equal(JSON.parse(h.calls.find(c => c.url.endsWith('/respond')).options.body).promptId, 'prompt-1');
  tree = h.render();
  assert.equal(h.nodes(tree, n => n.type === 'password').length, 0, 'response input disappears and draft clears');
  state = 'complete'; await h.tick(); await h.flush(); tree = h.render();
  assert.equal(h.completed(), 1);
  assert.ok(h.nodes(tree, n => n.children === 'Sign in again').length);
  for (const call of h.calls) { assert.equal(call.options.credentials, 'same-origin'); assert.equal(call.options.cache, 'no-store'); assert.equal(call.options.redirect, 'error'); }
  for (const bad of ['javascript:alert(1)', 'https://evil.example/', 'https://auth.openai.com.evil.example/', 'https://user@auth.openai.com/', 'http://auth.openai.com/']) assert.equal(h.context.safeUrl(bad), undefined);
  assert.equal(h.context.safeUrl('https://auth.openai.com/oauth/authorize'), 'https://auth.openai.com/oauth/authorize');
  h.unmount();
  const failed = harness(async () => ({ ok: false, body: { access_token: 'do-not-render' } }));
  failed.render(); await failed.flush(); tree = failed.render();
  assert.ok(failed.nodes(tree, n => n.role === 'alert').length);
  assert.ok(!JSON.stringify(tree).includes('do-not-render'));
  failed.unmount();
  let cancelState = 'pending';
  const cancel = harness(async url => {
    if (url.endsWith('/status')) return { configured: false, expired: true };
    if (url.endsWith('/begin')) return { flowId: 'flow-2' };
    if (url.includes('/poll?')) return { state: cancelState };
    return { status: 204 };
  });
  cancel.render(); await cancel.flush(); tree = cancel.render();
  assert.ok(cancel.nodes(tree, n => Array.isArray(n.children) && n.children.includes('OAuth expired')).length);
  assert.equal(cancel.nodes(tree, n => n.className === 'accountStatus').length, 0, 'expired login is not styled as green signed-in status');
  assert.ok(cancel.nodes(cancel.render({ readOnly: true }), n => n.children === 'Sign in' && n.disabled).length);
  await cancel.nodes(tree, n => n.children === 'Sign in')[0].onClick(); tree = cancel.render(); await cancel.flush(); tree = cancel.render();
  await cancel.nodes(tree, n => n.children === 'Cancel sign in')[0].onClick(); tree = cancel.render();
  assert.ok(cancel.calls.some(call => call.url.endsWith('/cancel')));
  assert.ok(cancel.nodes(tree, n => n.children === 'Cancelling…').length, 'accepted cancel is not a terminal result');
  cancelState = 'cancelled'; await cancel.tick(); await cancel.flush(); tree = cancel.render();
  assert.ok(cancel.nodes(tree, n => n.children === 'Sign in').length);
  assert.equal(cancel.calls.filter(call => call.url.endsWith('/status')).length, 2, 'refresh status after terminal cancellation');
  cancelState = 'pending';
  await cancel.nodes(tree, n => n.children === 'Sign in')[0].onClick(); tree = cancel.render(); await cancel.flush(); tree = cancel.render();
  await cancel.nodes(tree, n => n.children === 'Cancel sign in')[0].onClick();
  cancelState = 'complete'; await cancel.tick(); await cancel.flush(); tree = cancel.render();
  assert.equal(cancel.completed(), 1, 'commit can win the cancellation race and must refresh Models');
  cancel.unmount();
  let releaseBegin;
  const slow = harness(async url => url.endsWith('/status') ? { configured: true } : url.endsWith('/begin') ? new Promise(resolve => { releaseBegin = resolve; }) : { status: 204 });
  slow.render(); await slow.flush(); tree = slow.render();
  const beginning = slow.nodes(tree, n => n.children === 'Sign in again')[0].onClick();
  slow.unmount(); releaseBegin({ flowId: 'late-flow' }); await beginning;
  assert.ok(slow.calls.some(call => call.url.endsWith('/cancel') && JSON.parse(call.options.body).flowId === 'late-flow'));
  console.log('PASS: syntax, insertion guards, original login preservation, status, async URL, prompts/respond, completion refresh, cancel, read-only, safe errors and URL allowlist');
})().catch(error => { console.error(error); process.exitCode = 1; });
