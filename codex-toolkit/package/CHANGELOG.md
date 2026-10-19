# Changelog

## Account 1.0.4

- Fade animated usage speckles from nearly absent at the left to full strength at the right of the filled portion. Keep the existing moving dither animation and reduced-motion behavior.

## 1.0.1

- Match model checklist cards, checks, count and search focus to the UI blue accent, independently of Beautify.
- Use a blue gradient for normal Codex usage. Amber at 80% and red at 95%, including their existing gradient colors, remain unchanged.
- Make the Account companion updateable through Plugin Manager with an empty bundle patch; preserve the existing Account row and its configuration. Add localized companion display metadata and the Toolkit icon.
- Add regressions for blue accents and usage-tone boundaries. Authentication, refresh, model selection and usage calculations are unchanged.

## 1.0.0

First packaged release of Codex Toolkit.

- Codex sign-in in the Models provider row, with browser and device-code authorization, interactive prompts, cancellation, and safe status reporting.
- Codex usage on the Account page: 5-hour and weekly limits, remaining percentages, reset countdowns, manual refresh, and animated usage bars with reduced-motion support.
- Model visibility selector in the Codex editor: searchable catalog checklist, selected-first ordering, Show all, Reset, and Apply/Cancel draft semantics.
- Server-side usage and credential handling; no OAuth material reaches the browser.
- Local catalog discovery for the model selector; no network request or credential read.
- Regression tests for authentication, usage, the model selector, the Account patch, and installed artifacts.
- MIT license retained from the upstream DeepSeek Harness client packages.
