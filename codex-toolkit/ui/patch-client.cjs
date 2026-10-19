const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DEFAULT_SOURCE = process.env.DSH_MODELS_SOURCE ? path.join(path.resolve(process.env.DSH_MODELS_SOURCE), 'lib/client.js') : null;
function replaceOnce(source, needle, replacement) {
  if (source.split(needle).length !== 2) throw new Error('Expected one insertion point: ' + needle.slice(0, 100));
  return source.replace(needle, replacement);
}
function patchClient(source, controls = fs.readFileSync(path.join(__dirname, 'codex-auth-controls.js'), 'utf8')) {
  if (source.includes('function CodexAuthControls(')) throw new Error('Client is already patched');
  const picker = fs.readFileSync(path.join(__dirname, 'codex-model-picker.js'), 'utf8');
  let patched = replaceOnce(source, '\t\tfunction ModelsSection(props) {', (controls + '\n' + picker).split('\n').map(line => '\t\t' + line).join('\n') + '\n\t\tfunction ModelsSection(props) {');
  patched = replaceOnce(patched, '}), props.credentialOnly === true ? null : (0, react_jsx_runtime.jsxs)("details", {', '}), props.provider === "openai-codex" && family === "pi-ai" && props.credentialOnly !== true ? (0, react_jsx_runtime.jsx)(CodexModelPicker, { ...catalogProps, operations, settingsNs: namespace.ns, blocked: Object.keys(schema.getPath(fallback, ["modelOverrides"]) ?? {}).length > 0 }) : null, props.credentialOnly === true ? null : (0, react_jsx_runtime.jsxs)("details", {');
  patched = replaceOnce(patched, 'family === "deepseek" ? (0, react_jsx_runtime.jsx)(DeepSeekModelsEditor, {', 'props.provider === "openai-codex" ? null : family === "deepseek" ? (0, react_jsx_runtime.jsx)(DeepSeekModelsEditor, {');
  // The row header above already names the provider; drop the editor's duplicate title.
  patched = replaceOnce(patched, 'displayName: target.displayName,', 'displayName: target.displayName,\n\t\t\t\t...target.provider === "openai-codex" ? { hideTitle: true } : {},');
  patched = replaceOnce(patched, 'className: props.credentialOnly === true ? ModelsSection_module_css_default["addBlock"] : ModelsSection_module_css_default["editor"],', 'className: props.credentialOnly === true ? ModelsSection_module_css_default["addBlock"] : ModelsSection_module_css_default["editor"] + (props.provider === "openai-codex" ? " codex-provider-editor" : ""),');
  patched = replaceOnce(patched, 'if (anyUsable || row.entry.provider === "deepseek-account") return false;', 'if (anyUsable || row.entry.provider === "deepseek-account" || row.entry.provider === "openai-codex") return false;');
  patched = replaceOnce(patched, 'const credentialConfigured = row.credential?.configured === true;', 'const credentialConfigured = row.entry.provider !== "openai-codex" && row.credential?.configured === true;');
  patched = replaceOnce(patched, 'const credentialMissing = !credentialConfigured && row.apiKeyEnv !== void 0 && row.credential?.configured === false;', 'const credentialMissing = row.entry.provider !== "openai-codex" && !credentialConfigured && row.apiKeyEnv !== void 0 && row.credential?.configured === false;');
  // Lift the original head unchanged, then supply identity and action slots from one auth component.
  const heads = [...patched.matchAll(/^(\t+)\(0, react_jsx_runtime\.jsxs\)\("div", \{\n\1\tclassName: ModelsSection_module_css_default\["rowHead"\],/gm)];
  if (heads.length !== 1) throw new Error('Expected one provider rowHead insertion point');
  const indent = heads[0][1];
  const start = heads[0].index + indent.length;
  const endMarker = '\n' + indent + '}),';
  const end = patched.indexOf(endMarker, start);
  if (end < 0) throw new Error('Expected provider rowHead end');
  const originalHead = patched.slice(start, end + endMarker.length - 1);
  let head = replaceOnce(originalHead, 'row.entry.provider === "deepseek-account" ? (0, react_jsx_runtime.jsxs)("span", {', 'codexStatus,\n' + indent + '\t\t\trow.entry.provider === "deepseek-account" ? (0, react_jsx_runtime.jsxs)("span", {');
  head = replaceOnce(head, 'children: [row.entry.provider === "deepseek-account" ? null : (0, react_jsx_runtime.jsx)("button", {', 'children: [codexActions, row.entry.provider === "deepseek-account" ? null : (0, react_jsx_runtime.jsx)("button", {');
  patched = replaceOnce(patched, originalHead, 'row.entry.provider === "openai-codex" ? (0, react_jsx_runtime.jsx)(CodexAuthControls, { readOnly: !state.writable, onComplete: () => { controller.load(); }, children: renderHead }) : renderHead()');
  const missing = 'const credentialMissing = row.entry.provider !== "openai-codex" && !credentialConfigured && row.apiKeyEnv !== void 0 && row.credential?.configured === false;';
  patched = replaceOnce(patched, missing, missing + '\n' + indent.slice(0, -2) + 'const renderHead = (codexStatus = null, codexActions = null, codexDetails = null) => (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [' + head + ', codexDetails] });');
  return patched;
}
if (require.main === module) {
  const sourcePath = path.resolve(process.argv[2] || DEFAULT_SOURCE);
  const target = path.resolve(process.argv[3] || path.join(__dirname, 'client.js'));
  if (sourcePath === target || !target.startsWith(path.resolve(__dirname) + path.sep)) throw new Error('Output must be a separate file inside the workspace ui directory');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const patched = patchClient(source);
  new (require('node:vm').Script)(patched);
  fs.writeFileSync(target, patched);
  console.log(JSON.stringify({ source: sourcePath, output: target, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), outputSha256: crypto.createHash('sha256').update(patched).digest('hex') }, null, 2));
}
module.exports = { patchClient, DEFAULT_SOURCE };
