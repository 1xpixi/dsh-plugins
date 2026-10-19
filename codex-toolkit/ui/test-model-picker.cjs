const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'codex-model-picker.js'), 'utf8');
assert.ok(source.includes('--codex-accent:var(--dsw-static-blue-450,#4d93f8)'), 'Toolkit owns its blue accent without requiring Beautify');
assert.ok(!source.includes('#59c9b5'), 'selected cards, count, search focus and checkboxes no longer use the former green-teal');
assert.ok(source.includes('border-color:var(--codex-accent); background:var(--codex-accent); color:var(--dsw-static-neutral-bluish-1000,#0f1115);'), 'checked glyph stays dark on blue');
const catalog = Array.from({ length: 8 }, (_, i) => ({ id: 'model-' + i, name: 'Model ' + i, maxTokens: 1000 }));
function harness(initial = {}, discover = async () => ({ kind: 'found', models: catalog })) {
  const state = [], refs = [], effects = [], calls = [], changes = [];
  let slot = 0, refSlot = 0, effectSlot = 0, resets = 0;
  let props = { models: [], overridden: false, disabled: false, settingsNs: 'llm-pi-ai',
    operations: { discoverModels: async (...args) => { calls.push(args); return discover(...args); } },
    onChange(models) { changes.push(models); props = { ...props, models, overridden: true }; },
    onReset() { resets++; props = { ...props, models: [{ id: 'model-1' }], overridden: false }; }, ...initial };
  const react = {
    Fragment: 'fragment',
    useState(initial) { const i = slot++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
    useRef(initial) { return refs[refSlot++] ||= { current: initial }; },
    useEffect(callback, deps) { const i = effectSlot++, old = effects[i]; if (!old || deps.some((value, at) => !Object.is(value, old.deps[at]))) { old?.cleanup?.(); effects[i] = { deps, pending: callback }; } }
  };
  const jsx = (tag, props) => ({ tag, ...props });
  const context = vm.createContext({ react, react_jsx_runtime: { jsx, jsxs: jsx }, ModelsSection_module_css_default: { modelCatalog: 'modelCatalog', linkButton: 'linkButton', input: 'input' } });
  vm.runInContext(source, context);
  function render(update) { props = { ...props, ...update }; slot = refSlot = effectSlot = 0; const tree = context.CodexModelPicker(props); for (const effect of effects) if (effect.pending) { const callback = effect.pending; effect.pending = null; effect.cleanup = callback(); } return tree; }
  function nodes(tree, predicate) { if (!tree || typeof tree !== 'object') return []; return [...(predicate(tree) ? [tree] : []), ...[tree.children].flat().flatMap(child => nodes(child, predicate))]; }
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const checkbox = (tree, id) => nodes(tree, n => n.type === 'checkbox' && n.value === id)[0];
  const button = (tree, label) => nodes(tree, n => n.tag === 'button' && n.children === label)[0];
  return { render, nodes, flush, checkbox, button, calls, changes, resets: () => resets, unmount() { effects.forEach(effect => effect.cleanup?.()); } };
}
(async () => {
  const all = harness();
  let tree = all.render();
  assert.ok(all.nodes(tree, n => n.role === 'status').length);
  await all.flush(); tree = all.render();
  assert.deepEqual(JSON.parse(JSON.stringify(all.calls)), [['llm-pi-ai', { provider: 'openai-codex' }]]);
  assert.equal(all.nodes(tree, n => n.type === 'checkbox' && n.checked).length, 8, 'empty means installed catalog');
  assert.equal(all.nodes(tree, n => n.className === 'codex-model-search-icon').length, 1, 'search field has a magnifier icon');
  assert.ok(JSON.stringify(tree).includes('8 of 8'), 'header shows selected count');
  all.checkbox(tree, 'model-0').onChange({ target: { checked: false } }); tree = all.render();
  assert.equal(all.changes.at(-1).length, 7);
  assert.equal(all.nodes(tree, n => n.type === 'checkbox')[0].value, 'model-0', 'toggle keeps rows in place');
  assert.ok(JSON.stringify(tree).includes('7 of 8'));
  assert.deepEqual(JSON.parse(JSON.stringify(all.changes.at(-1)[0])), { id: 'model-1' }, 'new selection inherits catalog capabilities');
  all.nodes(tree, n => n.type === 'search')[0].onChange({ target: { value: 'Model 0' } }); tree = all.render();
  assert.equal(all.nodes(tree, n => n.type === 'checkbox').length, 1);
  assert.equal(all.checkbox(tree, 'model-0').checked, false);
  all.button(tree, 'Show all').onClick(); tree = all.render();
  assert.equal(all.changes.at(-1).length, 8, 'Show all includes filtered-out models');
  all.unmount();

  const custom = { id: 'custom-id', name: 'My custom model', input: ['text', 'image'], maxTokens: 321, compat: { supportsStore: false }, reasoningEfforts: { off: null, high: 'high' } };
  const subset = harness({ models: [custom, { id: 'model-2', contextWindow: 12345 }], overridden: true });
  subset.render(); await subset.flush(); tree = subset.render();
  assert.equal(subset.nodes(tree, n => n.type === 'checkbox' && n.checked).length, 2);
  const boxes = subset.nodes(tree, n => n.type === 'checkbox');
  assert.deepEqual(boxes.slice(0, 2).map(n => n.value).sort(), ['custom-id', 'model-2'], 'selected models occupy the first rows');
  assert.ok(boxes.findIndex(n => !n.checked) > 1, 'selected rows stay above unselected ones');
  assert.ok(JSON.stringify(tree).includes('2 of 9'));
  subset.checkbox(tree, 'custom-id').onChange({ target: { checked: false } }); tree = subset.render();
  assert.equal(subset.nodes(tree, n => n.type === 'checkbox')[1].value, 'custom-id', 'deselect does not reorder the grid');
  assert.equal(subset.checkbox(tree, 'model-2').disabled, true, 'cannot remove final selected model');
  assert.equal(subset.nodes(tree, n => n.tag === 'label' && n.title === 'At least one model is required').length, 1, 'last selected tile explains why it is locked');
  subset.checkbox(tree, 'model-2').onChange({ target: { checked: false } });
  assert.equal(subset.changes.at(-1).length, 1, 'handler also rejects empty selections');
  subset.checkbox(tree, 'custom-id').onChange({ target: { checked: true } }); tree = subset.render();
  assert.equal(subset.changes.at(-1).find(model => model.id === 'custom-id'), custom, 'deselect/reselect preserves all metadata');
  subset.button(tree, 'Show all').onClick(); tree = subset.render();
  assert.equal(subset.changes.at(-1).find(model => model.id === 'custom-id'), custom);
  assert.equal(subset.changes.at(-1).find(model => model.id === 'model-2').contextWindow, 12345);
  subset.button(tree, 'Reset').onClick(); tree = subset.render();
  assert.equal(subset.resets(), 1);
  assert.equal(subset.checkbox(tree, 'custom-id'), undefined, 'reset drops old custom metadata cache');
  assert.equal(subset.checkbox(tree, 'model-1').checked, true, 'reset uses inherited subset');
  assert.equal(subset.button(tree, 'Reset').disabled, true);
  subset.unmount();

  for (const lock of [{ disabled: true }, { blocked: true }]) {
    const locked = harness({ models: [{ id: 'model-0' }, { id: 'model-1' }], overridden: true, ...lock });
    locked.render(); await locked.flush(); tree = locked.render();
    assert.ok(locked.nodes(tree, n => n.type === 'checkbox').every(n => n.disabled));
    locked.checkbox(tree, 'model-0').onChange({ target: { checked: false } });
    locked.button(tree, 'Show all').onClick(); locked.button(tree, 'Reset').onClick();
    assert.equal(locked.changes.length, 0); assert.equal(locked.resets(), 0);
    if (lock.blocked) assert.ok(locked.nodes(tree, n => n.role === 'note').length);
    locked.unmount();
  }

  for (const failure of [async () => ({ kind: 'refused', message: 'SECRET' }), async () => { throw Error('SECRET'); }, async () => ({ kind: 'found', models: [{}] })]) {
    const failed = harness({ models: [{ id: 'model-0' }, { id: 'model-1' }] }, failure);
    failed.render(); await failed.flush(); tree = failed.render();
    assert.ok(failed.nodes(tree, n => n.role === 'alert').length);
    assert.ok(!JSON.stringify(tree).includes('SECRET'));
    failed.checkbox(tree, 'model-0').onChange({ target: { checked: false } });
    assert.equal(failed.changes.length, 0);
    failed.button(tree, 'Retry').onClick(); failed.render(); await failed.flush();
    assert.equal(failed.calls.length, 2);
    failed.unmount();
  }
  const empty = harness({}, async () => ({ kind: 'found', models: [] }));
  empty.render(); await empty.flush(); tree = empty.render();
  assert.ok(JSON.stringify(tree).includes('No Codex models are available'));
  assert.equal(empty.button(tree, 'Show all').disabled, true);
  empty.unmount();

  let release;
  const late = harness({}, () => new Promise(resolve => { release = resolve; }));
  late.render(); late.unmount(); release({ kind: 'found', models: catalog }); await late.flush();
  assert.equal(late.changes.length, 0);
  assert.ok(late.nodes(late.render(), n => n.role === 'status').length, 'late discovery did not update state');
  late.unmount();
  console.log('PASS: Codex model catalog, selection, metadata, reset, search, read-only/override guards, discovery failures and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
