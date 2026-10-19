# DSH plugins

Two plugins for DeepSeek Harness Desktop 0.2.1-rc.2:

- **Beautify 0.4.16** — blue dithered conversation background with subtle shimmer, polished menus and composer. Source and tests in `beautify/`.
- **Codex Toolkit** — ChatGPT sign-in, model selection and usage limits with dithered bars. Models/Auth 1.0.1 and Account 1.0.4. Source, built packages and tests in `codex-toolkit/`.

## Install

Ready-to-install archives are in `packages/`. Install Beautify through Harness Plugin Manager. Codex needs both packages and the profile composition described in [Codex setup](codex-toolkit/README.md). Preserve your existing Account configuration. These forks are version-specific; check compatibility before upgrading Harness.

No profiles, credentials, personal backups or extracted reference dumps are included.

## Build and test

Requires Node.js 24 or newer; no build dependencies are needed.

```sh
node beautify/build.cjs
node beautify/test.cjs
```

Codex patches upstream compiled packages. Supply unmodified **DSH 0.2.1-rc.2** Models and Account package directories (each containing `package.json` and `lib/`). Upstream inputs are intentionally not included.

```sh
export DSH_MODELS_SOURCE=/path/to/dsh-client-ui-settings-models
export DSH_ACCOUNT_SOURCE=/path/to/dsh-client-ui-settings-account
node codex-toolkit/build.cjs
node codex-toolkit/ui/test-ui.cjs
node codex-toolkit/ui/test-model-editor.cjs
node codex-toolkit/ui/test-account-patch.cjs
node codex-toolkit/ui/test-model-picker.cjs
node codex-toolkit/ui/test-usage.cjs
```

In PowerShell set these with `$env:DSH_MODELS_SOURCE = '...'` and `$env:DSH_ACCOUNT_SOURCE = '...'`.

Built outputs are checked in so installing the packages does not require the upstream inputs. Use `npm pack ./beautify`, `npm pack ./codex-toolkit/package` and `npm pack ./codex-toolkit/account-package` to package them.

## License

MIT. Each plugin/package retains its license file and upstream notices. This is an unofficial community project, not affiliated with DeepSeek or OpenAI.
