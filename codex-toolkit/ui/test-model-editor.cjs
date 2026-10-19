const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { patchClient, DEFAULT_SOURCE } = require('./patch-client.cjs');
const patched = patchClient(fs.readFileSync(DEFAULT_SOURCE, 'utf8'));
assert.ok(patched.includes('{ hideTitle: true }'), 'duplicate provider heading hidden inside the Codex editor');
assert.ok(patched.includes('" codex-provider-editor"'), 'Codex editor gets a scoping class for compact spacing');
const start = patched.indexOf('\t\tfunction draftAt(');
const end = patched.indexOf('\t\t//#endregion', start);
assert.ok(start >= 0 && end > start, 'extract actual ProviderEditor section');
const editorSource = patched.slice(start, end);
const plain = value => JSON.parse(JSON.stringify(value));
function getPath(value, path) { return path.reduce((at, key) => at?.[key], value); }
function setPath(value, path, next) {
  const copy = structuredClone(value);
  let at = copy;
  for (const key of path.slice(0, -1)) at = at[key] ??= {};
  at[path.at(-1)] = structuredClone(next);
  return copy;
}
function deletePath(value, path) {
  const copy = structuredClone(value);
  let at = copy;
  for (const key of path.slice(0, -1)) { at = at?.[key]; if (!at) return copy; }
  delete at[path.at(-1)];
  return copy;
}
function harness({ user = {}, base = {}, provider = 'openai-codex', readOnly = false, credentialOnly = false } = {}) {
  const settingsPath = ['providers', provider];
  let stored = { providers: { [provider]: structuredClone(user) } };
  const baseSection = { providers: { [provider]: structuredClone(base) } };
  const namespace = { ns: 'llm-pi-ai', schema: {}, revision: 41, user: structuredClone(stored), base: baseSection,
    value: { providers: { [provider]: { ...structuredClone(base), ...structuredClone(user) } } } };
  const cells = [], calls = [], closed = [];
  let slot = 0;
  const react = {
    useState(initial) { const i = slot++; if (!(i in cells)) cells[i] = typeof initial === 'function' ? initial() : initial; return [cells[i], next => { cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useMemo(callback) { return callback(); },
    useEffect() {}
  };
  const schema = { getPath, setPath, deletePath, hasPath: (value, path) => getPath(value, path) !== undefined,
    rehydrate: value => value, nodeAtPath: () => ({ meta: {} }), validate: () => undefined };
  const operations = {
    discoverModels: async () => ({ kind: 'found', models: [] }),
    async writeSettings(ns, ops, expectedRevision) {
      calls.push(plain({ ns, ops, expectedRevision }));
      for (const op of ops) stored = op.op === 'set' ? setPath(stored, op.path, op.value) : deletePath(stored, op.path);
      return { kind: 'written', view: { user: structuredClone(stored), revision: 42 } };
    },
    storeCredential() { throw new Error('model integration must not access credentials'); }
  };
  const components = Object.fromEntries(['CodexModelPicker', 'ModelListEditor', 'DeepSeekModelsEditor', 'ApiKeyInput', 'EditorFooter'].map(name => [name, function component() {}]));
  const jsx = (type, props) => ({ type, props });
  const context = vm.createContext({ react, react_jsx_runtime: { jsx, jsxs: jsx, Fragment: 'Fragment' }, structuredClone,
    ...components, ModelsSection_module_css_default: {}, _deepseek_ai_dsh_client_ui_primitives: { Tooltip: 'Tooltip' },
    deriveKeyRef: route => route.toUpperCase().replaceAll('-', '_') + '_API_KEY',
    protocolChoices: () => [], reasoningLevelChoices: () => [], apiKeyFailure: () => undefined,
    validateDeepSeekModels: () => undefined, validateReasoningEfforts: () => undefined,
    modelDrafts: value => Array.isArray(value) ? value : [] });
  vm.runInContext(editorSource + '\nthis.Editor = ProviderEditor;', context);
  const props = { namespace, settingsPath, schema, operations, provider, displayName: provider, t: value => value,
    nativeAuth: { env: [], oauth: true }, readOnly, credentialOnly, onClose: changed => closed.push(changed) };
  function render() { slot = 0; return context.Editor(props); }
  function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    const children = tree.props?.children;
    return [...(predicate(tree) ? [tree] : []), ...(Array.isArray(children) ? children : [children]).flatMap(child => nodes(child, predicate))];
  }
  const component = (tree, name) => nodes(tree, node => node.type === components[name]);
  async function apply() { component(render(), 'EditorFooter')[0].props.onSubmit(); for (let i = 0; i < 12; i++) await Promise.resolve(); }
  return { render, nodes, component, operations, calls, closed, apply, stored: () => plain(stored) };
}
(async () => {
  const original = { id: 'model-a', name: 'Kept', compat: { supportsStore: false }, reasoningEfforts: false, input: ['text'], maxTokens: 1234 };
  const h = harness({ user: { models: [original], headers: { 'x-custom': 'public-test' }, transport: 'sse', timeoutMs: 123 } });
  let tree = h.render();
  const picker = h.component(tree, 'CodexModelPicker');
  assert.equal(picker.length, 1);
  assert.equal(h.component(tree, 'ModelListEditor').length, 0);
  assert.equal(picker[0].props.operations, h.operations);
  assert.equal(picker[0].props.settingsNs, 'llm-pi-ai');
  assert.equal(picker[0].props.blocked, false);
  assert.ok(h.nodes(tree, node => node.type === 'input' && node.props['aria-label'] === 'baseUrl').length, 'advanced baseURL retained');
  const siblings = h.nodes(tree, node => node.type === 'Fragment' && Array.isArray(node.props.children) && node.props.children.includes(picker[0]))[0].props.children;
  assert.ok(siblings.indexOf(picker[0]) < siblings.findIndex(node => node?.type === 'details'), 'picker precedes details');
  const selected = [original, { id: 'model-b' }];
  picker[0].props.onChange(selected);
  assert.equal(h.calls.length, 0, 'selection only changes draft');
  assert.deepEqual(plain(h.component(h.render(), 'CodexModelPicker')[0].props.models), selected);
  await h.apply();
  assert.deepEqual(h.calls, [{ ns: 'llm-pi-ai', expectedRevision: 41, ops: [{ op: 'set', path: ['providers', 'openai-codex', 'models'], value: selected }] }]);
  assert.deepEqual(h.stored().providers['openai-codex'], { models: selected, headers: { 'x-custom': 'public-test' }, transport: 'sse', timeoutMs: 123 });
  assert.deepEqual(h.closed, [true]);

  const cancel = harness();
  cancel.component(cancel.render(), 'CodexModelPicker')[0].props.onChange([{ id: 'model-b' }]);
  cancel.component(cancel.render(), 'EditorFooter')[0].props.onCancel();
  assert.equal(cancel.calls.length, 0);
  assert.deepEqual(cancel.closed, [false]);

  const reset = harness({ user: { models: [{ id: 'user-model' }], timeoutMs: 123 }, base: { models: [{ id: 'base-model', contextWindow: 12345 }] } });
  reset.component(reset.render(), 'CodexModelPicker')[0].props.onReset();
  const inherited = reset.component(reset.render(), 'CodexModelPicker')[0].props;
  assert.equal(inherited.overridden, false);
  assert.deepEqual(plain(inherited.models), [{ id: 'base-model', contextWindow: 12345 }]);
  await reset.apply();
  assert.deepEqual(reset.calls[0].ops, [{ op: 'unset', path: ['providers', 'openai-codex', 'models'] }]);
  assert.deepEqual(reset.stored().providers['openai-codex'], { timeoutMs: 123 });

  for (const fixture of [{ user: { modelOverrides: { 'model-a': { maxTokens: 123 } } } }, { base: { modelOverrides: { 'model-a': { reasoningEfforts: false } } } }]) {
    const blocked = harness(fixture);
    assert.equal(blocked.component(blocked.render(), 'CodexModelPicker')[0].props.blocked, true, 'effective overrides block picker');
    assert.equal(blocked.calls.length, 0);
  }
  const other = harness({ provider: 'openai' });
  assert.equal(other.component(other.render(), 'CodexModelPicker').length, 0);
  assert.equal(other.component(other.render(), 'ModelListEditor').length, 1);
  const credentials = harness({ credentialOnly: true });
  assert.equal(credentials.component(credentials.render(), 'CodexModelPicker').length, 0);
  const readonly = harness({ readOnly: true });
  assert.equal(readonly.component(readonly.render(), 'CodexModelPicker')[0].props.disabled, true);
  assert.equal(readonly.component(readonly.render(), 'EditorFooter')[0].props.submitDisabled, true);
  console.log('PASS: extracted ProviderEditor integration, draft/apply pathOps and revision, hidden metadata, cancel, inherited reset, overrides, provider scope, credential-only and read-only');
})().catch(error => { console.error(error); process.exitCode = 1; });
