# Codex Toolkit

Sign in with ChatGPT, watch your Codex usage limits, and choose which models appear in the picker — inside the existing DeepSeek Harness Settings panels.

Codex Toolkit is a local fork of the shipped DSH Models and Account settings UIs. It adds three things without changing the Electron application archive:

- **Codex sign-in** in the Models provider row, with browser and device-code flows, prompts, and cancellation.
- **Usage limits** on the Account page: 5-hour and weekly windows, remaining percentages, reset countdowns, and manual refresh.
- **Model visibility** in the Codex editor: a searchable checklist that decides which models the model picker offers, with Show all, Reset, and Apply/Cancel semantics.

## Privacy and security

- OAuth credentials never reach the browser. The status endpoint returns only whether a credential is saved, never a token or grant payload.
- Usage is fetched server-side through the existing Codex provider. Expired access tokens are refreshed atomically; refresh failures are reported without leaking upstream details.
- Model discovery reads the installed catalog. Opening the model checklist does not contact OpenAI and does not read credentials.
- Endpoints are exact DSH Connection fetch routes, so they inherit the host's cookie authentication, Host/Origin checks, and owner-principal requirement.
- Starting or cancelling a sign-in never deletes an existing credential. The authorization flow replaces it only after a successful commit.

## Requirements

- DeepSeek Harness desktop built against `0.2.1-rc.2`, the shipped versions this fork patches.
- A ChatGPT account with Codex access for sign-in and usage.
- pnpm for installing the local tarballs into a DSH profile.

## Install

For an existing installation, update the Account companion archive through Harness Plugin Manager; the Models/Auth package remains at 1.0.1. The Account companion has an empty bundle patch so this update preserves its existing row/configuration. Follow the returned refresh/restart instructions. The setup below documents the original two-component composition.

The release contains two tarballs:

- `local-dsh-client-ui-settings-models-auth-1.0.1.tgz` — Models fork, Codex backend, and model selector.
- `local-dsh-client-ui-settings-account-codex-1.0.4.tgz` — Account fork with visibly dithered, shimmering usage bars.

1. Copy both tarballs into your profile's `vendor/` directory, for example `~/.dsh/profiles/desktop/vendor/`.
2. Add both packages to the profile's `package.json` dependencies:

   ```json
   "dependencies": {
     "@local/dsh-client-ui-settings-models-auth": "file:./vendor/local-dsh-client-ui-settings-models-auth-1.0.1.tgz",
     "@local/dsh-client-ui-settings-account-codex": "file:./vendor/local-dsh-client-ui-settings-account-codex-1.0.4.tgz"
   }
   ```

3. Add the Models bundle to `dsh.profile.bundles`, after `@deepseek-ai/dsh-web-app`:

   ```json
   "@local/dsh-client-ui-settings-models-auth"
   ```

4. In the profile's `cordis.patch.yml`, disable the shipped Models and Account entries and insert the forks. Copy your existing Account `config:` block verbatim so onboarding state is preserved:

   ```yaml
   - id: ui-settings-models
     name: '@deepseek-ai/dsh-client-ui-settings-models'
     disabled: true
   - insert:
       - id: ui-settings-models-auth
         name: '@local/dsh-client-ui-settings-models-auth'
   - id: ui-settings-account
     name: '@deepseek-ai/dsh-client-ui-settings-account'
     disabled: true
     config: { ...your existing Account config... }
   - insert:
       - id: ui-settings-account-codex
         name: '@local/dsh-client-ui-settings-account-codex'
         config: { ...your existing Account config... }
   ```

5. Install and restart DSH:

   ```powershell
   pnpm install
   ```

A full application restart is required; a page refresh alone does not adopt new package resolution.

## Using it

- **Connect**: Settings → Models → `openai-codex` → Sign in. Use the browser flow or the device code shown. The row shows Signed in once a credential is saved.
- **Usage**: Settings → Account. The Codex usage card refreshes on open and on demand. Reset times update without refetching.
- **Models**: Settings → Models → `openai-codex` → Edit. Pick the models to expose, then Apply. Reset restores the profile's inherited list; Show all selects the entire installed catalog. At least one model must stay selected because the adapter treats an empty list as "serve the full catalog".

## Compatibility and limits

- The fork pins the internals of `@deepseek-ai/dsh-client-ui-settings-models` and `@deepseek-ai/dsh-client-ui-settings-account` at `0.2.1-rc.2`. A DSH update can change those modules; rebuild the fork against the new shipped packages before upgrading.
- Profiles that set `modelOverrides` on the Codex route cannot also set an explicit model list — the adapter rejects that combination. The selector detects effective overrides and disables editing with an explanation instead of dropping them.
- Model checklist changes are draft-only until Apply. Cancel discards them; Reset removes the profile's `models` override.
- The fork does not manage API keys for other providers, change the selected model, or provide usage history.

## Uninstall

1. Remove the two inserted entries from `cordis.patch.yml` and re-enable `ui-settings-models` and `ui-settings-account`.
2. Remove the two packages from the profile dependencies and from `dsh.profile.bundles`.
3. Delete the tarballs from `vendor/`, run `pnpm install`, and restart DSH.

Credentials are left untouched. To remove the saved Codex login, use Sign out / Delete in the Models row or remove the credential record through DSH.

## Development

The build consumes unmodified upstream DSH 0.2.1-rc.2 Models and Account package directories. Set both environment variables; no machine-specific defaults or extracted reference dumps are included. Run from the repository root:

```powershell
$env:DSH_MODELS_SOURCE = '/path/to/dsh-client-ui-settings-models'
$env:DSH_ACCOUNT_SOURCE = '/path/to/dsh-client-ui-settings-account'
node --test codex-toolkit/backend/codex-auth.test.mjs
node codex-toolkit/ui/test-ui.cjs
node codex-toolkit/ui/test-model-picker.cjs
node codex-toolkit/ui/test-model-editor.cjs
node codex-toolkit/ui/test-usage.cjs
node codex-toolkit/ui/test-account-patch.cjs
node codex-toolkit/build.cjs
```

Build output lands in `package/` and `account-package/`. Pack them with `npm pack` and install the resulting tarballs. Tests use fake credentials and flows; they never read the user's real refresh token.

## License

MIT. This project includes modified copies of DeepSeek Harness client packages; the upstream MIT license is retained in each package. DeepSeek Harness and OpenAI Codex are trademarks of their respective owners.
