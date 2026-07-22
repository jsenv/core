# Instructions for AI assistants — read this before using @jsenv/navi

This file is meant for an AI reading `dist/jsenv_navi.js` (e.g. while debugging
inside `node_modules/@jsenv/navi/`). That file is a **generated build
artifact** — bundled and flattened, without the comments or JSDoc that live in
the original source. Don't infer usage or edit behavior from reading it
directly; treat it as an implementation detail.

## Where to find real documentation

- `README.md` (package root) — high-level overview of what Navi provides:
  routing, actions, layout (`Box`), typography, icons, forms/validation,
  `Table`, dialogs, popovers.
- `docs/css_architecture.md` — how Navi's CSS layering works, and the
  supported ways to override component styles (props > CSS variables > direct
  rule overrides, in that preference order).
- `docs/MOBILE_LAYOUT_PITFALLS.md` — mobile-specific layout gotchas (viewport
  units, virtual keyboard, safe areas).
- Source code on GitHub: https://github.com/jsenv/core/tree/main/packages/frontend/navi/src
  — the actual source, with per-file context, is more reliable than the
  bundled `dist/` output for understanding a specific export.

## Key concepts to know before guessing an API

- **Routing is signal-based**: URL state (including search params) two-way
  syncs with signals. Don't build parallel state for what a route/query
  signal already tracks.
- **Actions** model async operations with lifecycle (idle/running/success/
  error). Components read an action's state via `useAsyncData`, not by
  manually tracking loading/error booleans.
- **`Box`** is the layout primitive (Flexbox wrapper: `flex`, `flex="y"` for
  column, `grid`, `alignX`/`alignY`). Prefer it over raw CSS for layout inside
  Navi apps.
- **Field components** (`Input`, `Select`, `Checkbox`, etc.) take an `action`
  prop to respond to interaction — this is the standard wiring, not
  `onChange` + manual state.

If unsure which export solves a problem, check `README.md` and the `src/`
tree on GitHub before assuming behavior from the bundled code.
