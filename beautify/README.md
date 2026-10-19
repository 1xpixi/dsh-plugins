# dsh-beautify

Standalone visual polish for DeepSeek Harness. Injects one stylesheet using version-pinned class hooks; it does not fork, replace, or touch any shipped package.

## What it styles

- **Account and session menus** — shortcut badges hidden, labels centered independently of icons, and approximate existing widths (144px and 216px). Keyboard shortcuts still work; their accessibility attributes remain intact.
- **Other in-app menus** — native surface, elevation, padding and destructive states.
- **Model picker** — a viewport-bounded 300px model pane with a single search-field frame, clear-button room, scrollbar clearance and provider labels that scroll with their models. Blue selection remains visible through hover, focus and keyboard highlighting. Disabled rows retain native styling.
- **Composer** — enabled Send and Stop buttons matching the blue accent, plus a restrained focus outline and open-state controls. Disabled buttons, editable text, placeholder, height and behavior are untouched.
- **Subagent popover** — wider surface, stable metrics column, and a visible keyboard focus ring.
- **Settings** — preset names above badges, IDs at the upper right, top-aligned full descriptions and a blue default-preset state. Cards shrink at narrow widths; error states stay distinct.
- **Chat** — hover/focus affordances for message actions, attachments, and tool summaries without revealing unavailable actions; expanded Think disclosures stay transparent.
- **Sidebar and tabs** — quiet footer launcher, clearer tab hover.
- **Account** — identity card with a header/action structure and far-right link arrow.
- **Selection** — a soft blue text-selection tint.
- **Conversation backgrounds** — a full-panel Canvas-generated blue ordered-dither image with slightly softer accent glows, fading at the top. Non-repeating; continues behind active chat and fades gently through the composer footer.

Menu surfaces retain native radii and elevation. Model-pane insets are adjusted; other menu padding and row heights remain native.

## Install

Ask Harness to install the packed `dsh-beautify-0.4.16.tgz` archive through Plugin Manager. Use the versioned archive, not a linked workspace directory. Plugin Manager manages profile dependencies and activation; follow its returned refresh/restart instructions.

The plugin appears under Installed plugins as **Beautify** and can be disabled with its toggle.

## How it works

The client module appends one `<style id="dsh-beautify">` element inside a `ctx.effect`, so disabling the plugin removes the stylesheet and its `data-dsh-beautify` scope. A detached Canvas 2D render creates one fixed-aspect PNG background on activation; CSS uses it behind the full conversation panel with no repeated tiling. Selectors use semantic attributes and `0.2.1-rc.2` CSS-module class tokens; there is no DOM canvas, observer, per-frame Canvas rendering, or package fork. CSS slowly shifts the large dither background to shimmer; reduced-motion preferences keep it still.

## Compatibility

- Written against DeepSeek Harness `0.2.1-rc.2` markup. A future UI refactor can rename or restructure these hooks; re-check the selectors after upgrading.
- Independent of Codex Toolkit. It does not read credentials, call endpoints, or change behavior.
- Decorative accents use the UI blue token in light and dark themes; online status remains semantically green.
- The session menu uses its named `data-slot` wrapper; account-menu styling uses the shipped shortcut-row structure. Re-check after UI refactors.

## Development

```powershell
node dsh-beautify/build.cjs
node dsh-beautify/test.cjs
npm pack ./dsh-beautify
```

Edit `src/polish.css`, then rebuild and pack. `lib/client.js` is generated; do not edit it by hand. Visual review should use the authenticated Harness page, not a local mock fixture.

## License

MIT.
