# Changelog

## 0.4.16

- Slowly shimmer the Canvas dither across the chat background; respect reduced motion.

## 0.4.15

- Vertically center the Preview badge beside the New Session headline.

## 0.4.14

- Strengthen the active composer fade while keeping its transition gradual.

## 0.4.13

- Extend the active composer background fade to 260px with gradual opacity stops, removing the abrupt dimming edge.

## 0.4.12

- Slightly reduce the blue field and glows. Keep expanded Think disclosure headers transparent so they blend with the chat background instead of turning black.

## 0.4.11

- Render one 1280x720 dithered background image and cover the conversation panel without tiling. Apply the effect to the full phase root and soften the active composer footer so the texture continues to the bottom.

## 0.4.10

- Replace the rigid repeating SVG with a single offscreen Canvas 2D render of a seamless Bayer-dithered blue field. It becomes a CSS background, not a DOM overlay; no animation or third-party engine.

## 0.4.9

- Strengthen the blue ordered-dither texture, add soft accent glows, and fade the top edge into the base color. Apply only behind blank and active conversation content; no animation or content overlay.

## 0.4.8

- Add a subtle static 4px dither tile only to the blank/new-session conversation canvas, using its semantic hero-phase marker. No overlay, animation, or changes to active chats and controls.

## 0.4.7

- Match enabled stop buttons to the same blue accent and darker hover as Send. Preserve native disabled styling and all button behavior.

## 0.4.6

- Remove the extra frame around the nested model-list menu and the searchbox's negative margins/oversized width. Style the actual Input wrapper, including focus and clear-button spacing.
- Give the model pane a viewport-bounded 300px width, consistent row insets and a stable scrollbar lane. Provider headings scroll normally rather than lingering at group boundaries.
- Match the enabled send-arrow button to the blue selection accent, with a slightly darker hover. Leave disabled and stop-square buttons native.
- Syntax, lifecycle/source regressions and installed-package checks only; no live visual verification of this build.

## 0.4.5

- Fix Session menu shortcut hiding and centered labels missing the renderer's `display: contents` slot wrapper. Match the named session-menu slot instead of assuming direct children or shortcut-row order; retain its 216px width.
- Keep the account menu, preset-card layout and blue model/effort selection unchanged, as shown in the user's screenshots.
- Source/lifecycle and installed-package checks only for this patch; refreshed session-menu appearance still needs visual confirmation.

## 0.4.4

- Hide shortcut badges in the Account and Session action menus, center labels independently of icons, and keep approximate 144px/216px widths. Target the real list/viewport structure rather than a nonexistent nested MenuSurface.
- Align preset descriptions at the top, remove description clamping, and separate titles from badges with IDs at the upper right.
- Replace green-teal decoration with the UI's blue token. Preserve semantic green online indicators and error states.
- Fix selected model/effort backgrounds losing to shipped hover, focus and active-model rules; exclude disabled rows and color only the selection checkmark.
- Verification is lifecycle/source-level plus installed-package checks, not live visual or computed-style verification.

## 0.4.3

- Give the active default preset a restrained teal edge and badge so its state reads at a glance.
- Widen shortcut-bearing menus slightly and outline keycaps for clearer alignment and separation.

## 0.4.2

- Agent preset cards show one more line so the PTC description isn't cut off mid-sentence; removed the extra footer padding to offset the added content.
- Session-option hover/focus now keeps the shipped interactive fill instead of overriding it with a weaker custom mix.

## 0.4.1

- Keep shortcut keycap text white during menu hover; the previous label-primary override made it low-contrast on the dark keycap in light theme.

## 0.4.0

- Stopped overriding geometry the design system already owns. Menus keep the shipped `MenuSurface` radius, fill, and theme elevation; the list keeps its 4px padding across the plain, compact, dense, and scrollable variants. The old rules inflated every menu to 6px and replaced the light-theme shadow with a dark one.
- Removed radius overrides that shrank shipped corners: sidebar rows (12px → 8px), composer model and permission triggers (8px → 7px), model menu options (12px → 7px), the subagent popover (16px → 12px), and chat actions on hover (8px → 6px).
- Fixed the shortcut keycap in light theme. The chip fill is dark in both palettes, so pairing it with a theme-following text color produced a dark blob at 1.3:1 contrast; the foreground now follows the tooltip's own white.
- Dropped a redundant sidebar hover rule and the menu icon-color rule that restated shipped CSS.
- Replaced the approximate render fixtures with ones that load the real shipped stylesheets and the real theme token blocks, and added a rendered regression suite (44 assertions across dark and light) plus rule-level guards that fail if an owned property is re-declared.

## 0.3.0

- Replaced the shortcut text observer with the shipped key-group hook; keycaps now share the tooltip’s compact layout.
- Added composer focus feedback and open-state surfaces for the model and permission controls.
- Added subagent popover focus ring and stable metrics column.
- Added narrow-width preset-grid handling, settings row/card hover, and chat action/attachment affordances.
- Added dark, light, narrow, and reduced-motion rendered checks plus lifecycle/disposal coverage.

## 0.2.9

- Menus with shortcuts get a 190px minimum width so keycaps can right-align instead of crowding the label.

## 0.2.8

- Tightened shortcut keycaps: smaller type, less padding, and compressed word spacing so `Ctrl + Alt + G` reads as one compact key.

## 0.2.7

- Tag the whole shortcut group instead of the first key, so `Ctrl + Alt + G` gets one keycap.

## 0.2.6

- Widened the model search field slightly inside its row.

## 0.2.5

- Added keycap badges to menu shortcuts, using the tooltip hotkey treatment on the menu’s own surface.
- Added a small shortcut tagger and a regression check for it.

## 0.2.4

- Added hover radius/fill to sidebar tree rows and a clearer tab hover label.
- Added spacing between provider groups in the model picker.
- Left shortcut typography and the subagent popover untouched: both still need stable class hooks.

## 0.2.3

- Gave checked model/effort rows a teal tint and teal check.
- Matched the model/effort menu surfaces to the standard menu border, radius, and shadow.
- Made the model search field fill its row.

## 0.2.2

- Scoped menu surface chrome away from the composite model/effort menus so their shipped spacing is preserved.
- Removed item geometry overrides from standard menus; hover/radius polish remains.
- Added hover states to radio/check menu rows and an inset search field to the model picker.

## 0.2.1

- Reverted the tooltip and keycap overrides; the shipped tooltips were more compact. Menus and selection polish remain.

## 0.2.0

- Added shared in-app menu chrome: surface radius, border, shadow, item spacing, hover/focus fill, icon states, separators, and disabled rows.
- Added tooltip surface and keycap styling.
- Added a teal text-selection tint.

## 0.1.7

- Pushed the account footer arrow to the far right so the action row uses the full card width.

## 0.1.6

- Moved the account link into a divided footer row inside the identity card, aligned with the profile text.

## 0.1.5

- Made the sidebar footer label quieter and reduced the row to 36px.
- Aligned the account link with the profile name instead of centering it in the card.

## 0.1.4

- Removed the permanent launcher highlight; it now has a footer divider and a hover-only surface.
- Simplified the account identity card to the standard card surface with a quiet account link.
- New brush-and-sparkle icon and clearer listing copy.

## 0.1.3

- Calmer launcher typography and a resting surface so it looks intentional without hover.
- Smaller presence dots with lighter rings on both avatars.
- Larger, higher-contrast avatar glyphs.

## 0.1.2

- Use structural and localized `aria-label` hooks instead of `data-avatar-status`, which can be absent when the account has no image.

## 0.1.1

- Scope sidebar styling to the signed-in launcher so the signed-out state keeps its compact layout.

## 0.1.0

- Initial standalone release.
- Polished the sidebar account launcher and the Settings Account identity card.
- CSS-only client plugin: one injected stylesheet, no package forks.
