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

## Where the answer to "how do I use X" is

There is deliberately **no per-export reference page** here, and there never
will be: a page per component drifts from the code the day after it is written,
and the code is right there. Each source of knowledge has one job:

- **These `docs/*.md` files** — decisions, concepts and invariants: what a
  mechanism is for, what it costs, what not to hand-write beside it. They are
  what you cannot deduce from a signature. Read the relevant one BEFORE writing
  code in its area; they are listed below.
- **JSDoc on an export** (`@type`, `@param`) — a hint at the call site: what a
  prop means and what it accepts, for autocompletion and for you. It is not
  exhaustive and does not pretend to be: props that flow through to `Box`, the
  interplay between two props, everything a component composes are not repeated
  there.
- **The built code, `dist/jsenv_navi.js`** — the exhaustive truth about the API.
  It is navi's real source, bundled, with the JSDoc kept (see above). When a
  signature, a default, an accepted value or a prop nobody documented is what
  you need, read it there rather than guessing. It ships in the npm package, so
  it is always available under `node_modules/@jsenv/navi/`.
- **Sources, demos and tests** — how an export is really used, and the closest
  thing to an example gallery: `src/**/demos/*_demo.html` exercise one component
  per page, prop by prop. They are NOT published to npm (the whole source tree
  would dwarf the package), so they live only in the repo:
  https://github.com/jsenv/core/tree/main/packages/frontend/navi. A project that
  wants an AI to work with navi seriously is better off with a local clone of
  that repo alongside it — the demos answer "how is this used" faster than any
  page could.

So the loop, when the JSDoc did not answer: read the built export, then find a
demo using it. Write the answer down in one of these `docs/*.md` files only if
what you learned is a decision or an invariant — never as a reference page for
one component.

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
- `docs/resource.md` — REST state: `resource()`, relationships, callback return
  contracts, autorerun rules. Companion files: `docs/actions.md`,
  `docs/resource_with_params.md`, `docs/resource_dependencies.md`.
- `docs/list_refresh.md` — what a write sends back to the network and what stays
  on screen meanwhile: stale data returned by `useAsyncData({ loading: true })`,
  what updates from a response without any request, `rerunOn` and its defaults,
  and how a paginated `<List.Items>` re-reads its slices without disappearing.
  Read it before adding verbs to `rerunOn`, hiding a list on `loading`, or
  remounting a list with a `key` to refresh it.
- `docs/css_architecture.md` — how Navi's CSS layering works, and the
  supported ways to override component styles (props > CSS variables > direct
  rule overrides, in that preference order).
- `docs/scroll.md` — where scrolling happens: what turns `Box`
  `header`/`body`/`footer` on, `FixedBar` space, `List`'s `scroller`, scroll
  inside a `Dialog`/`Popover`, and what a scroll does to hover
  (`hoverWhileScrolling`, `isScrolling()`). Read it before writing CSS to make
  something scroll — navi almost certainly already has the prop.
- `docs/control_value.md` — who holds a control's value: nobody, a bound
  `signal` (two-way, in both directions), or you (`value`/`checked`). What
  `signal` + `defaultValue` says, what a signal holds for each kind of control,
  and why `value` and `signal` cannot both be passed. Read it before wiring a
  control's value by hand with `value` + `uiAction`.
- `docs/form_changed.md` — what a `<Form>` sends: submitting a form nobody
  touched runs no action, what "changed" is measured against, and the trap —
  which fields count as already held (a `defaultValue` is a suggestion, a
  `signal` carrying something is an answer). Read it before a screen that
  modifies an existing resource (`pristineKey`), and before reaching for
  `canSendWhileUnchanged` because a submit "does nothing".
- `docs/control_group.md` — `<Group>`: several controls reading as one framed
  object (one border per seam, radius on the outer corners only). Read it
  before placing bordered controls against each other, and before writing
  negative margins or `border-radius: 0` by hand to make them join.
- `docs/z_index.md` (and its tokens in `src/navi_z_indexes.js`) — stacking: why DOM order is the first tool, what a
  `z-index` without `isolation: isolate` actually competes against, and the
  values navi's own popups/bars/tables use. Read it before writing a `z-index`.
- `docs/i18n.md` — where the texts an app displays live: `interpolateText` /
  `<Interpolate>` for one sentence, `createI18n` for the app's registry,
  `naviI18n` for navi's own texts. Read it before writing a user-visible
  sentence, and before overriding a navi message.
- `docs/interactions.md` — the `interactions` prop: making a component answer a
  swipe, a held press, a shortcut, and registering a gesture navi does not have.
  Read it before reading the pointer by hand — who owns a press between nested
  boxes, and what a touch may do, are decided before the first pixel moves and
  cannot be got right from outside navi.
- `docs/MOBILE_LAYOUT_PITFALLS.md` — mobile-specific layout gotchas (viewport
  units, virtual keyboard, safe areas).
- `docs/navigation.md` — how to build navigation: declaring routes
  (`route()` / `setupRoutes()`), when a section is a route of its own rather
  than a param, search params bound to signals, rendering with `<Route>`,
  tab rows (`Nav` / `Link` / `RouteTravel`), and the few cases where tabs are
  legitimately not URLs. Read it before writing any routing code — the
  position of the user belongs in the URL by default, and that decision is
  not retrofittable.
- Source code and demos on GitHub:
  https://github.com/jsenv/core/tree/main/packages/frontend/navi — where to go
  when the built export's JSDoc doesn't answer the question (see "Where the
  answer to how do I use X is" above).

## Key concepts to know before guessing an API

- **Routing is signal-based**: URL state (including search params) two-way
  syncs with signals. Don't build parallel state for what a route/query
  signal already tracks.
- **Actions** model async operations with lifecycle (idle/running/success/
  error). Components read an action's state via `useAsyncData`, not by
  manually tracking loading/error booleans.
- **REST state is modelled with `resource()`**, and parent/child relations with
  `.one` / `.many` / `.scopedOne` / `.scopedMany`. Never encode a backend
  sub-resource (`/games/:id/candidates`) as an `op`/`type` discriminator inside
  one verb's callback. Read `docs/resource.md` before writing a resource — the
  callback return contracts differ per relationship method and are not
  guessable.
- **`Box`** is the layout primitive (Flexbox wrapper: `flex`, `flex="y"` for
  column, `grid`, `alignX`/`alignY`). Prefer it over raw CSS for layout inside
  Navi apps.
- **Field components** (`Input`, `Select`, `Checkbox`, etc.) take an `action`
  prop to respond to interaction — this is the standard wiring, not
  `onChange` + manual state.
- **A gesture is named, not read by hand**: `interactions={{ swipe_right: … }}`
  on any `Box` (so on any component). Never a `pointerdown` listener of your own
  — see `docs/interactions.md`.
- **Texts**: a user-visible sentence containing a value is written as one
  template with `[placeholder]`s (`interpolateText` / `<Interpolate>`), not cut
  into JSX fragments or concatenations. Beyond a handful of texts, an app
  declares them in its own `createI18n()` instance — using the English text
  itself as the key, whereas navi's `naviI18n` uses opaque keys. Application
  texts never go into `naviI18n`. See `docs/i18n.md`.
- **View transitions**: navi components animate their own changes
  (`itemTransition` on `List`, `RouteTravel` for routes) and never decide for
  the whole document. Two things are the application's call, not navi's:
  - a `view-transition-name` must be unique per document (a duplicate aborts
    the transition) — scope any name your app adds;
  - list/grid transitions rely on nested groups
    (`view-transition-group: contain`, Chrome/Edge 140+). On browsers without
    it nothing is named, so an unconditional `startViewTransition` falls back
    to a full-page cross-fade. If that fade is unwanted in your app, the app —
    not a component — writes:
    `@supports not (view-transition-group: contain) { :root { view-transition-name: none } }`.
    Only the application knows whether a page-wide fade is a decent default or
    a glitch there.
  - a bonus that costs nothing: any element given its own
    `view-transition-name` (a tab underline, a header) is animated by the
    browser from where it was to where it is during any transition — `Nav`
    does this for its current-tab indicator automatically
    (`currentIndicator`), which is why the bar follows a `RouteTravel` swipe
    with no wiring.

If unsure which export solves a problem, check `README.md` first: it names what
navi provides, area by area. From a name, the built export tells you the API and
a demo tells you the usage.
