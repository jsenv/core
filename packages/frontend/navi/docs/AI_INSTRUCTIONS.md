# @jsenv/navi — context for AI assistants

This file gives context for using `@jsenv/navi` as intended, useful whether
you're reading the source directly or the built `dist/jsenv_navi.js` (e.g.
inside `node_modules/@jsenv/navi/`).

`dist/jsenv_navi.js` is the bundled build of navi's actual source, not an
opaque blob — JSDoc comments on individual functions/exports are preserved
and carry real, useful information. What's lost in bundling is only
file-level comments and anything attached to an import/re-export statement
(the bundler only keeps a comment that sits directly above a declaration it
retains as-is).

## Library, but also a framework

Navi is a library in the sense that every export is independently usable —
pick just `stateSignal` or just `Table` if that's all you need, no
all-or-nothing adoption required.

But it's also meant as a framework: it provides low-level primitives for
things most apps otherwise reinvent inconsistently — routing, async data
lifecycle, CSS layering/design tokens, focus/keyboard handling, and more.
When building something Navi already has a primitive for, prefer that
primitive over a custom one, even if the custom one would be quicker to
write for this one case — the value of using Navi as a framework comes from
consistency across the app, not from any single call site.

## More context, if the JSDoc on what you're using isn't enough

- `README.md` (package root) — high-level overview of what Navi provides:
  routing, actions, layout (`Box`), typography, icons, forms/validation,
  `Table`, dialogs, popovers.
- `docs/css_architecture.md` — how Navi's CSS layering works, and the
  supported ways to override component styles (props > CSS variables > direct
  rule overrides, in that preference order).
- `docs/MOBILE_LAYOUT_PITFALLS.md` — mobile-specific layout gotchas (viewport
  units, virtual keyboard, safe areas).
- Source code on GitHub: https://github.com/jsenv/core/tree/main/packages/frontend/navi/src
  — worth checking if the JSDoc on an export genuinely doesn't answer your
  question.

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

If unsure which export solves a problem, check `README.md` first — the
`src/` tree on GitHub is there too if a specific export's own JSDoc doesn't
cover what you need.
