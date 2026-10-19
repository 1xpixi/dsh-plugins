const fs = require('node:fs');
const path = require('node:path');
const { patchClient } = require('./ui/patch-client.cjs');
const { patchAccountClient, PACKAGE_NAME: accountPackageName } = require('./ui/patch-account.cjs');
const root = __dirname;
if (!process.env.DSH_MODELS_SOURCE || !process.env.DSH_ACCOUNT_SOURCE) throw new Error('Set DSH_MODELS_SOURCE and DSH_ACCOUNT_SOURCE to the upstream DSH 0.2.1-rc.2 package directories.');
const original = path.resolve(process.env.DSH_MODELS_SOURCE);
const accountOriginal = path.resolve(process.env.DSH_ACCOUNT_SOURCE);
const out = path.join(root, 'package');
const accountOut = path.join(root, 'account-package');
const packageName = '@local/dsh-client-ui-settings-models-auth';
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });
fs.mkdirSync(path.join(out, 'locale'), { recursive: true });
const manifest = {
  name: packageName, version: '1.0.1', private: true, type: 'module',
  description: 'Sign in with ChatGPT, monitor Codex usage limits, and choose which models appear in the picker.',
  icon: './icon.svg', main: './lib/index.js',
  exports: { '.': './lib/index.js', './client': './lib/client.js', './package.json': './package.json', './locale/*.json': './locale/*.json', './icon.svg': './icon.svg' },
  dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: ['@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-api-remotes'], platform: 'web' } },
  peerDependencies: { '@deepseek-ai/cordis': '~4.0.5', '@deepseek-ai/schemastery': '~3.18.5' },
  dependencies: { '@earendil-works/pi-ai': '1.1.0' },
  keywords: ['dsh', 'dsh-plugin', 'codex', 'openai', 'chatgpt', 'usage'],
  files: ['lib', 'locale', 'cordis.patch.yml', 'icon.svg', 'LICENSE', 'README.md', 'CHANGELOG.md'], license: 'MIT'
};
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify(manifest, null, 2) + String.fromCharCode(10));
fs.writeFileSync(path.join(out, 'cordis.patch.yml'), [
  '- id: ui-settings-models',
  "  name: '@deepseek-ai/dsh-client-ui-settings-models'",
  '  disabled: true',
  '- insert:',
  '    - id: ui-settings-models-auth',
  "      name: '" + packageName + "'"
].join('\n'));
let client = patchClient(fs.readFileSync(path.join(original, 'lib/client.js'), 'utf8'));
const oldName = 'id: "@deepseek-ai/dsh-client-ui-settings-models"';
if (client.split(oldName).length !== 2) throw new Error('Unexpected ModuleLoader registration');
client = client.replace(oldName, 'id: "' + packageName + '"');
fs.writeFileSync(path.join(out, 'lib/client.js'), client);
const host = fs.readFileSync(path.join(original, 'lib/index.js'), 'utf8');
if (!host.includes('function apply(ctx, config) {')) throw new Error('Unexpected Host entry');
fs.writeFileSync(path.join(out, 'lib/index.js'), 'import { installCodexAuth } from "./codex-auth.js";\n' + host.replace('function apply(ctx, config) {', 'function apply(ctx, config) {\n  installCodexAuth(ctx);'));
fs.copyFileSync(path.join(root, 'backend/codex-auth.js'), path.join(out, 'lib/codex-auth.js'));
fs.copyFileSync(path.join(original, 'LICENSE'), path.join(out, 'LICENSE'));
for (const [lang, title, description] of [
  ['en', 'Codex Toolkit', 'ChatGPT sign-in, usage limits, and model selection for Codex.'],
  ['zh', 'Codex 工具箱', '登录 ChatGPT、查看用量限额，并选择要显示的 Codex 模型。']
]) fs.writeFileSync(path.join(out, 'locale', lang + '.json'), JSON.stringify({ meta: { title, description } }, null, 2) + '\n');
fs.copyFileSync(path.join(root, 'icon.svg'), path.join(out, 'icon.svg'));
fs.copyFileSync(path.join(root, 'README.md'), path.join(out, 'README.md'));
fs.copyFileSync(path.join(root, 'CHANGELOG.md'), path.join(out, 'CHANGELOG.md'));

// Register the companion under ui-settings-account-codex with a copy of the original Account config.
fs.mkdirSync(path.join(accountOut, 'lib'), { recursive: true });
fs.mkdirSync(path.join(accountOut, 'locale'), { recursive: true });
const accountManifest = JSON.parse(fs.readFileSync(path.join(accountOriginal, 'package.json'), 'utf8'));
accountManifest.name = accountPackageName;
accountManifest.version = '1.0.4';
accountManifest.private = true;
accountManifest.description = 'DeepSeek Account settings with Codex usage limits.';
accountManifest.files = ['lib/index.js', 'lib/client.js', 'locale/*.json', 'LICENSE', 'README.md', 'cordis.patch.yml', 'icon.svg'];
// Empty bundle lets Plugin Manager update this existing companion without replacing Account config.
accountManifest.dsh.bundle = { patch: './cordis.patch.yml' };
accountManifest.icon = './icon.svg';
for (const key of ['repository', 'publishConfig', 'devDependencies', 'types']) delete accountManifest[key];
accountManifest.exports = {
  '.': './lib/index.js',
  './client': './lib/client.js',
  './package.json': './package.json',
  './locale/*.json': './locale/*.json',
  './icon.svg': './icon.svg'
};
fs.writeFileSync(path.join(accountOut, 'package.json'), JSON.stringify(accountManifest, null, 2) + '\n');
fs.writeFileSync(path.join(accountOut, 'cordis.patch.yml'), '[]\n');
fs.copyFileSync(path.join(root, 'icon.svg'), path.join(accountOut, 'icon.svg'));
fs.copyFileSync(path.join(accountOriginal, 'lib/index.js'), path.join(accountOut, 'lib/index.js'));
fs.writeFileSync(path.join(accountOut, 'lib/client.js'), patchAccountClient(fs.readFileSync(path.join(accountOriginal, 'lib/client.js'), 'utf8')));
for (const file of fs.readdirSync(path.join(accountOriginal, 'locale'))) {
  if (file.endsWith('.json')) fs.copyFileSync(path.join(accountOriginal, 'locale', file), path.join(accountOut, 'locale', file));
}
for (const [lang, title, description] of [
  ['en', 'Codex Usage', 'Account settings with Codex usage limits and reset countdowns.'],
  ['zh', 'Codex 用量', '账户设置、Codex 用量限额和重置倒计时。']
]) {
  const file = path.join(accountOut, 'locale', lang + '.json');
  const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
  locale.meta = { ...locale.meta, title, description };
  fs.writeFileSync(file, JSON.stringify(locale, null, 2) + '\n');
}
fs.copyFileSync(path.join(root, 'package/LICENSE'), path.join(accountOut, 'LICENSE'));
fs.copyFileSync(path.join(root, 'README.md'), path.join(accountOut, 'README.md'));
console.log('Built Models plugin:', out);
console.log('Built companion Account fork:', accountOut);
