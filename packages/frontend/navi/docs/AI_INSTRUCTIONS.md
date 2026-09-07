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

## The docs, and when to read each

One line per file: what it decides, and the moment to open it. The file itself
holds the reasoning; nothing here substitutes for it.

`README.md` (package root) names what navi provides, area by area — the place
to start when unsure which export solves a problem.

### Routing and movement

- `navigation.md` — the position of the user belongs in the URL by default,
  and that decision is not retrofittable: routes, params, search params,
  `<Route>`, tab rows, `navBack`, `RouteTravel`, where a navigation lands, a
  `SlideContainer` read from the URL, and what a layer drawn over the screen may
  say in its address. Read before writing any routing code.
- `route_transitions.md` — a transition states a relation the user reads as a
  map; a pair of routes is animated by `RouteTravel` or by a transition, never
  both; a test waits for the page arriving, never for its address. Read before
  animating a navigation, and before believing a symptom that only appears once
  a pair is animated.
- `view_transitions.md` — what the browser does to any transition an app
  starts itself: names unique per document, the fallback fade, rendering
  suspended for the whole callback, `finished` rejecting. Read before calling
  `document.startViewTransition`.
- `drag_to_travel.md` — a pointer pushing a whole screen aside, and who owns a
  press several boxes want. Read before putting anything that reads the pointer
  inside a box that travels.

### Data

- `actions.md` — an action and its params: calling versus binding, a failing
  run rejects, reading is not running (`{ run: true }` is the fallback),
  `action` versus `uiAction`, an action and a command on one press, and a
  debounced binding following where its signal settles. Read before running an
  action from a component, and before putting a delay on params.
- `resource.md` — REST state: `resource()`, the callback contract of each
  relationship method (not guessable), `GET_RANGE`, a search as the same
  `GET_MANY`, `withParams()` scopes and `dependencies`. Read before writing a
  resource; never encode a sub-route as an `op` discriminator.
- `data_states.md` — `data`, `loading` and `error` are three questions; the
  four combinations of the first two; `loading: true` never suspends; a skeleton
  is told whether it is loading. Read before drawing a skeleton on `!data` or
  hiding content because `error` is set.
- `list_refresh.md` — what a write sends back and what stays on screen
  meanwhile; `rerunOn` and its defaults; a paginated list re-reading its window;
  on the way back, the source decides the re-read and never the navigation.
  Read before adding verbs to `rerunOn` or remounting a list to refresh it.
- `list_action.md` — where the `action` lives decides who waits; a row whose
  button works is `readOnly`, not `loading`; `parallelGuard`. Read before
  `<List readOnly={pending}>` or a second spinner beside a control's own.
- `error_handling.md` — two kinds of error kept apart; where each is shown;
  what a failing run rejects with; the `__handled_by__` mark; the two rules of
  a boundary. Read before displaying an error by hand or writing a boundary.
- `offline.md` — `setNetworkPolicy`: answer from the store, ask nothing, refuse
  writes politely. Read before caching responses in the app.
- `dynamic_import.md` — a screen's code arrives like its data: a page's
  import is a `routeAction` read with `loading: true` (a branch, not a
  `<Loading>`), a component reads its own with `useAsyncData(() => import(…))`;
  links prerun on intent what asks nothing of the address; a transition
  photographs the pending screen; a chunk's `import.meta.css`; a chunk that
  does not come is never a bug and never comes twice in one document — offer
  `reload()`; why not preact's `lazy`. Read before an `import()` in a component
  or a page, and before `prefetch={false}`.

### Controls and forms

- `state_binding.md` — the rule the API rests on: state navi shows is BOUND
  (`signal`), not copied back by a callback; the three shapes (`signal`,
  `action`, `command` + `commandFor`). Read before writing any handler whose
  body only assigns state.
- `control_value.md` — who holds a control's value; `--navi-update` for a
  button proposing a value; empty keeps the shape of the question; what a
  `stateSignal` brings; a time of day typed (`TimeSpin`) or turned
  (`TimeWheel`). Read before wiring a value with `value` + `uiAction`.
- `control_object.md` — one value made of several controls: `ControlGroup`
  versus `Form`, naming, `<Picker type="object">`, `distributeChildStates`, a
  settings sheet. Read before putting anything in a picker popup.
- `control_group.md` — `<Group>`: several controls reading as one framed
  object. Read before negative margins or `border-radius: 0` by hand.
- `form_changed.md` — a form sends nothing when nothing changed; what "changed"
  is measured against; `pristineKey`; `standalone`. Read before
  `canSendWhileUnchanged`, and before a control inside a group whose value it
  has no business joining.
- `field_validation.md` — what only a browser can answer versus "is this value
  acceptable" (validity's); constraints as props; `charGuard`/`maxLengthGuard`.
  Read before writing a constraint: if the sentence would make sense in a
  server's response, the rule belongs in validity.
- `create_and_edit.md` — the create/edit loop assembled from `route`,
  `resource`, `Form` and `RouteTravel`. Read before writing a create or edit
  screen.
- `badge_list.md` — how a `BadgeList` counts its badges, `maxLines` inside a
  `Picker`, why it needs a `fallback` there.

### Popups

- `popup_open.md` — a popup owns its open state; `command` + `commandfor`;
  `triggerNaviCommand` as the last resort, with the event forwarded and never
  invented; opening ON something; a press that opens and acts is a `Picker`;
  Escape cancels; the close cross; a popup that loads data. Read before passing
  `open`, calling `triggerNaviCommand`, or writing a close button.
- `popup_backdrop.md` — three independent questions: a wall or not
  (`backdrop={false}`), what an outside press does, how far the page withdraws;
  `data-navi-popup-outside`. Read before writing CSS for a backdrop.
- `dialog_shape.md` — bounds rather than a width, the container ceiling, the
  centered box versus the bottom sheet, `marginWithContainer`. Read before
  deriving `smallTouchScreenSignal` in an app or writing CSS to make a dialog
  fit.
- `autofocus.md` — the ladder that hands out the keyboard, `autoFocus` on a
  surface versus on a field, the ring decided by the modality of what asked,
  `moveFocusTo`. Read before calling `element.focus()` anywhere.

### Gestures

- `interactions.md` — a gesture is named, not read by hand: the `interactions`
  prop, swipes and holds, the gate, `selfInteractions` for an affordance inside
  somebody else's box, `actionStandalone` for a run nothing above waits on,
  registering a detector. Read before a `pointerdown` listener of your own, and
  before stopping propagation to keep a popup shut.
- `drag_interactions.md` — an element carried: `move`, `reorder`, `land`,
  `toss`, `leave`, `moving`, the `grab`/`release`/`refuse` moments, dressing the
  clone, and the machinery for a gesture whose product is a value. Read before
  moving anything with the pointer.
- `pan_zoom.md` — a surface under the hand: `pan`, `zoom`, and what a touch or
  a wheel over it may do to the page around it.
- `mobile_tap_suppression_after_drag.md` — Chrome Android drops the click that
  follows a JS-driven touch drag; refuse `touchmove` while dragging.

### Layout, CSS and text

- `css_architecture.md` — navi wins by default, defaults sit in `@layer navi`,
  props first; `--navi-*` versus `--component-*`; what a popup inherits from its
  opener; `import.meta.css` and what a `${}` costs; browsers are the consuming
  app's target. Read before overriding a component style, and before any
  `import.meta.css`.
- `safe_area.md` — the two inset families, an app narrower than the window
  (`--navi-app-max-width`), `data-navi-safe-area`, which viewport is which under
  a virtual keyboard. Read before hand-writing an offset to clear a `FixedBar`.
- `scroll.md` — where scrolling happens: `header`/`body`/`footer`, `List`'s
  `scroller`, a popup that scrolls, hover while scrolling. Read before writing
  CSS to make something scroll.
- `mobile_layout_pitfalls.md` — a horizontal overflow inflates the layout
  viewport on Chrome Android and miscenters every dialog; `overflow-x: clip`.
- `z_index.md` — DOM order first; a `z-index` without `isolation: isolate`
  competes with the page; navi's bands. Read before writing a `z-index`.
- `typography.md` — text is a component; `maxLines` is the one truncation;
  `attachLastChild`; one line height for everything (`--navi-line-height`,
  1.25). Read before an overflowing label, and before touching a
  `line-height`.
- `i18n.md` — `interpolateText`/`<Interpolate>` for one sentence, `createI18n`
  for the app's texts, `naviI18n` for navi's own. Read before writing a
  user-visible sentence.
- `testid.md` — role and accessible name first; `data-testid` lands on the
  control's host; what not to target. Read before a selector in a test.

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
  one verb's callback. Searching a collection is that collection's `GET_MANY`
  with one more param, never a resource or an action of its own.
- **`Box`** is the layout primitive (Flexbox wrapper: `flex`, `flex="y"` for
  column, `grid`, `alignX`/`alignY`). Prefer it over raw CSS for layout inside
  Navi apps.
- **Field components** (`Input`, `Select`, `Checkbox`, etc.) take an `action`
  prop to respond to interaction — this is the standard wiring, not
  `onChange` + manual state.
- **A gesture is named, not read by hand**: `interactions={{ swipe_right: … }}`
  on any `Box` (so on any component). Never a `pointerdown` listener of your own.
- **Texts**: a user-visible sentence containing a value is written as one
  template with `[placeholder]`s (`interpolateText` / `<Interpolate>`), not cut
  into JSX fragments or concatenations. Beyond a handful of texts, an app
  declares them in its own `createI18n()` instance — using the English text
  itself as the key, whereas navi's `naviI18n` uses opaque keys. Application
  texts never go into `naviI18n`.
- **View transitions**: navi components animate their own changes and never
  decide for the whole document. What an app starting its own transition has
  to know — unique names, the fallback fade, a callback in which no frame ever
  ticks — is `view_transitions.md`.
