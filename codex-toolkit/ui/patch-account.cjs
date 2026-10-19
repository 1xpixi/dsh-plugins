const fs = require('node:fs');
const path = require('node:path');
const COMPONENT = path.join(__dirname, 'codex-usage.js');
const MODULE_ID = 'id: "@deepseek-ai/dsh-client-ui-settings-account"';
const PACKAGE_NAME = '@local/dsh-client-ui-settings-account-codex';
function once(source, oldText, newText, label) {
  if (source.split(oldText).length !== 2) throw new Error('Expected one Account patch marker: ' + label);
  return source.replace(oldText, newText);
}
function patchAccountClient(source, component = fs.readFileSync(COMPONENT, 'utf8').trimEnd()) {
  if (source.includes('function CodexUsageCard()')) throw new Error('Account client is already patched');
  const declaration = '\t\tfunction AccountSection({ t, useAccount, useTheme, start, cancel, openPlatformPage, avatarFailed }) {';
  let patched = once(source, declaration, component.split('\n').map(line => '\t\t' + line).join('\n') + '\n' + declaration, 'AccountSection declaration');
  const sectionStart = patched.indexOf(declaration);
  const sectionEnd = patched.indexOf('\n\t\t//#endregion', sectionStart);
  if (sectionStart < 0 || sectionEnd < 0) throw new Error('Expected AccountSection boundary');
  let section = patched.slice(sectionStart, sectionEnd);
  const tail = '\n\t\t\t\t]\n\t\t\t});\n\t\t}';
  section = once(section, tail, '\n\t\t\t\t, (0, react_jsx_runtime.jsx)(CodexUsageCard, {})\n\t\t\t\t]\n\t\t\t});\n\t\t}', 'AccountSection children');
  patched = patched.slice(0, sectionStart) + section + patched.slice(sectionEnd);
  patched = once(patched, MODULE_ID, 'id: "' + PACKAGE_NAME + '"', 'ModuleLoader id');
  patched = once(patched, 'const DESKTOP_ONBOARDING_NAMESPACE = "ui-settings-account";', 'const DESKTOP_ONBOARDING_NAMESPACE = "ui-settings-account-codex";', 'Account settings namespace');
  new (require('node:vm').Script)(patched);
  return patched;
}
module.exports = { patchAccountClient, PACKAGE_NAME };

