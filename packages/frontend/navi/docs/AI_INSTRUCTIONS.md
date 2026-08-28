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
  and how a paginated `<List.Items>` re-reads its slices without disappearing,
  including on its way back from a screen that unmounted it.
  It also says who decides a re-read on the way back — the source the list
  reads through, never the navigation and never a route transition.
  Read it before adding verbs to `rerunOn`, hiding a list on `loading`,
  remounting a list with a `key` to refresh it, or reporting that a page
  stopped refreshing since a transition was defined on its pair.
- `docs/error_handling.md` — the two kinds of error and how navi keeps them
  apart: where an error is shown depending on where it came from (a control's
  action shows it on what was clicked, a route action replaces the page, a
  refused value is validation and not an error at all), why a run never rejects,
  the `__handled_by__` mark that means "this error is on screen somewhere" (and
  what `preact/debug` throws over your app without it), what becomes of an error
  nobody displays, and the two rules any error boundary must follow — mark only
  what you render, reset on the document URL and not only on the rerun. Read it
  before displaying an error by hand, before writing an error boundary of your
  own, and before concluding that a dev overlay over a page that already shows
  its error is a crash.
- `docs/field_validation.md` — what a control refuses and who decides it: the
  split between what only a browser can answer (a blocked keystroke, where the
  callout lands, when the message appears) and « is this value acceptable »,
  which is @jsenv/validity's and which a server asks about the same value. The
  constraint attributes navi ships, the `charGuard`/`maxLengthGuard` props that
  act before there is a value, how a message key is overridden, and the three
  places an app's own rule can live — both sides via
  `constraintFromValidityRule`, the server alone, the browser alone. Read it
  before writing a constraint of your own: if the sentence would make sense in a
  server's response, the rule belongs in validity and the constraint is only its
  browser-side caller.
- `docs/css_architecture.md` — how Navi's CSS layering works, and the
  supported ways to override component styles (props > CSS variables > direct
  rule overrides, in that preference order).
- `docs/safe_area.md` — where the app is in the window and what covers it:
  the two inset families (`--navi-app-inset-*` for what is pinned to an edge,
  `--navi-safe-area-inset-*` for what flows inside), how an app declares itself
  narrower than the window, `data-navi-safe-area`, how something new joins the
  sum, and which viewport is which once a virtual keyboard is open. Read it
  before hand-writing an offset to clear a `FixedBar`, before reaching for
  `env(safe-area-inset-*)` directly, and before making an app simulate a phone
  screen.
- `docs/dialog_shape.md` — where a `Dialog` sits and how big it gets: bounds
  rather than a width, the container ceiling no prop can exceed, the two shapes
  one dialog has (centered box vs. bottom sheet under
  `dockedOnSmallTouchScreen`) and which bounds apply to which — `maxWidth`
  describes the centered shape and docking withdraws it, so both can be stated
  at once. Also `expandX`/`expandY` vs. docking, `marginWithContainer` deciding
  the gap and the ceiling together, `sizing="frozen"`, `layer="local"`, and the
  `dialog*` props a `Picker`/`SplitButton` forwards. Read it before deriving
  `smallTouchScreenSignal` in an app to change a dialog's size, before passing
  `expandX={false}` to stop a dialog sprawling, and before writing CSS to make a
  dialog fit the screen.
- `docs/autofocus.md` — who gets the keyboard when a popup opens or a slide
  arrives: the ladder navi walks, what `autoFocus` means on a surface (`true`
  = the surface takes it, for a popup that is READ before it is filled) versus
  on a field, why a docked dialog keeps the keyboard down on a phone, and what
  happens when the opening finds nothing to focus. Read it before wondering
  where the focus went when a popup opened, and before removing `autoFocus`
  from fields to stop a virtual keyboard rising — the surface is what decides,
  not the absence of a field asking.
- `docs/scroll.md` — where scrolling happens: what turns `Box`
  `header`/`body`/`footer` on, `FixedBar` space, `List`'s `scroller`, scroll
  inside a `Dialog`/`Popover`, and what a scroll does to hover
  (`hoverWhileScrolling`, `isScrolling()`). Read it before writing CSS to make
  something scroll — navi almost certainly already has the prop.
- `docs/badge_list.md` — what a `BadgeList` does per prop (plain, `max`,
  `shrinkWrap`, `maxLines`) and how it counts its badges (a `Badge` inside one
  renders nothing and hands itself to the list — so badges must be direct
  children). How `maxLines` reaches a list drawn inside a `Picker`
  (`MaxLinesContext`, the picker's own clamp turned off), and why a list in a
  picker needs a `fallback` — the placeholder text, as plain text: a picker
  given a `ui` draws no placeholder of its own. Read it before putting a
  `BadgeList` in a picker's `ui`, before wrapping its fallback in a `Badge`,
  and before setting `maxLines` on the list rather than on the picker.
- `docs/control_value.md` — who holds a control's value: nobody, a bound
  `signal` (two-way, in both directions), or you (`value`/`checked`). What
  `signal` + `defaultValue` says, what a signal holds for each kind of control,
  and why `value` and `signal` cannot both be passed. It also holds the answer
  to "a shortcut button beside a control" — `--navi-update`, gated like every
  interaction, against an `onClick` writing the signal, which is not and fires
  on a read-only control — and `--navi-update:smooth`, the control seen moving
  to the value it was given. Read it before wiring a control's value by hand
  with `value` + `uiAction`, and before writing a button that proposes a value.
- `docs/create_and_edit.md` — the loop almost every app has: a screen that
  creates a resource, the page of what was created, a screen that edits it. The
  routes and why several match at once, one form for two modes, filling the edit
  screen a request after it opened, a field picking from a list too big to load
  (a url designates an item the list's page may not contain), and where each
  screen goes next. Read it
  before writing a create or edit screen — it is the assembly of `route`,
  `resource`, `Form` and `RouteTravel`, and every piece of it is easy to get
  subtly wrong alone.
- `docs/form_changed.md` — what a `<Form>` sends and what follows the send:
  submitting a form nobody touched runs no action (and still navigates/closes),
  what "changed" is measured against, and the trap —
  which fields count as already held (a `defaultValue` is a suggestion, a
  `signal` carrying something is an answer). Read it before a screen that
  modifies an existing resource (`pristineKey`), and before reaching for
  `canSendWhileUnchanged` because a submit "does nothing".
- `distributeChildStates` on a group — the way down asked once for ALL the
  children, when they cannot be placed one at a time (four seats where who sits
  down decides who moves), and asked again whenever one of them speaks, so the
  other views of the same answer follow. The mirror of `aggregateChildStates`;
  see control_object.md. Read it before writing a `uiAction` whose only job is to
  translate. Two neighbouring questions have answers already: a yes/no shown as
  two rows needs no translation (`List.Item value={true}` beside
  `value={false}` IS a boolean control), and a cross that means "back to the
  usual answer" needs none either — clearing empties, and `placeholder` is
  where that sentence is written (control_value.md).
- `docs/control_object.md` — a value made of several controls: `<ControlGroup>`
  (the shape) vs `<Form>` (the shape plus a send), what a group's `name` does
  and what a nameless one merges, and what a `<Picker type="object">` needs in
  its popup (one group, not two controls). Read it before making one value out
  of several controls, and before putting anything in a picker popup.
- A time of day, and a span between two of them, come as a pair of components
  and the choice between them is about the GESTURE:
  `TimeSpin`/`TimeRangeSpin` (`src/control/picker/preset/spin_time.jsx`) are
  fields one types in, and `TimeWheel`/`TimeRangeWheel`
  (`src/control/wheel/wheel_time.jsx`) are wheels one turns. Both carry a single
  `"HH:MM"` (or `{ start, end }` for a span), so a form holds one field either
  way. Prefer the wheels whenever a half-written value would be nonsense — a
  time typed digit by digit goes through states that are not times ("1" on its
  way to "18"), each of them bounded and corrected under the fingers, while a
  wheel only ever shows values that exist. Two things only the wheels have:
  the bounds of a span PUSH each other while they turn (`minDuration`) instead
  of being refused at send, and `placeholder` is a position shown without being
  an answer — for a span that is optional ("any time of day") on wheels that
  have no blank row to land on. A clear (or a value written as `undefined`) puts
  such a pair back on its placeholder and back to answering nothing, so a row's
  cross means what it says. `hours` bounds what the wheels offer
  (`{ min: 7, max: 21 }`, or the list itself) — rows nobody can land on are rows
  in the way. Read this before writing a time input, and
  before making a pair of wheels say "nothing set" by hand.
- `docs/control_group.md` — `<Group>`: several controls reading as one framed
  object (one border per seam, radius on the outer corners only). Read it
  before placing bordered controls against each other, and before writing
  negative margins or `border-radius: 0` by hand to make them join.
- `docs/z_index.md` (and its tokens in `src/navi_z_indexes.js`) — stacking: why DOM order is the first tool, what a
  `z-index` without `isolation: isolate` actually competes against, and the
  values navi's own popups/bars/tables use. Read it before writing a `z-index`.
- `docs/typography.md` — text as a component: why every string goes through
  `Text`, `maxLines` as the one way to truncate (and why `lineClamp={1}` is
  not it), what makes truncation actually happen in a flex row, and the two
  opposite shapes of "icon | text | icon" — the end icon kept outside the
  truncating text, or `attachLastChild` so it never lands alone on a line —
  and why every text — controls included — is written on one line height
  (`--navi-line-height`, 1.25): the number below which an emoji is clipped and
  above which the rows drift apart.
  Read it before writing an overflowing label or a row with a trailing icon,
  and before touching any `line-height`.
- `docs/i18n.md` — where the texts an app displays live: `interpolateText` /
  `<Interpolate>` for one sentence, `createI18n` for the app's registry,
  `naviI18n` for navi's own texts. Read it before writing a user-visible
  sentence, and before overriding a navi message.
- `docs/testid.md` — how a test names an element: why role + accessible name
  comes first, when `data-testid` takes over, and where navi puts it — on the
  control's host (the real `<input>`/`<button>`), not on the box around it.
  Read it before writing a selector in a Playwright/Cypress test against a navi
  app, and before targeting a `.navi_*` class or a `navi-*`/`data-*` attribute
  of navi's own.
- `docs/interactions.md` — the `interactions` prop: making a component answer a
  swipe, a held press, a shortcut, and registering a gesture navi does not have.
  It also holds `ownTarget`, for an affordance an application draws inside a
  zone that belongs to another control — a chip's cross, an eye, a diskette:
  the three modes and the question that picks one (does it write to the control
  it sits in?), the `Box` form that claims the press and nothing more (so an
  affordance keeps its own drawing instead of becoming a control), and what
  `ownTarget` does NOT stop (a plain `onClick` on an ancestor).
  Read it before reading the pointer by hand — who owns a press between nested
  boxes, and what a touch may do, are decided before the first pixel moves and
  cannot be got right from outside navi — and before stopping the propagation of
  a pointerdown/mousedown/click to keep a popup from opening.
- `docs/drag_to_travel.md` — a pointer pushing a whole screen aside
  (`SlideContainer`, `RouteTravel`) and a popup pushed back towards its edge:
  what the gesture is, and above all who owns a press several boxes want — a
  scroller with room left, a nested travelling box, something being carried, a
  surface in the top layer, and the grip a docked popup narrows itself to. Read
  it before putting anything that reads the pointer inside a box that travels,
  and before wondering why a page moved under a gesture meant for what was in
  it.
- `docs/MOBILE_LAYOUT_PITFALLS.md` — mobile-specific layout gotchas (viewport
  units, virtual keyboard, safe areas).
- `docs/route_transitions.md` — how pages move against each other on
  navigation (`defineRouteTransition`): a transition states a relation the
  user reads as a map, which movement fits which relation, when a global
  default is right, how one link or one `navTo` overrides what the pair says
  for the length of a single navigation (`<Link routeTransition>`), marking the page
  area between fixed bars, and why a pair of routes is animated by
  `RouteTravel` or by a route transition but never both. It also says why a
  test must wait for the page arriving rather than for its address — a back
  taken before the page has rendered returns to a page that never left, which
  looks exactly like the arriving page failing to load or refresh. Read it
  before animating any navigation, and before believing a symptom that only
  appears once a pair is animated.
- `docs/navigation.md` — how to build navigation: declaring routes
  (`route()` / `setupRoutes()`), when a section is a route of its own rather
  than a param, search params bound to signals, rendering with `<Route>`,
  tab rows (`Nav` / `Link` / `RouteTravel`), where a navigation lands
  (scroll: a push arrives at the top, a back or forward lands where the page
  was left), a back arrow that stays inside the app (`useCanNavBack()` /
  `navBack({ fallback })`), and the few cases where tabs are legitimately not
  URLs. Read it before writing any routing code — the
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
  - the document's rendering is SUSPENDED for the whole update callback, from
    the capture of the old state to the capture of the new one. Nothing paints,
    and `requestAnimationFrame` does not tick in there — awaiting a frame
    inside the callback awaits something that cannot happen, until the browser
    gives up on the transition entirely (`Transition was aborted because of
timeout in DOM update`). Await a microtask, a task or a render; never a
    frame.
  - that suspension lasts exactly as long as the callback, and **in a
    sub-document it takes the scrollbar with it**: an iframe's scrollbar is
    painted by the framed document, so it goes and comes back, shifting the
    layout by its width. A top-level page is spared — its root scrollbar is the
    compositor's. So a callback that waits on the network flickers every demo
    shown in an iframe while the same app, opened on its own, shows nothing.
    Keep the callback short, and suspect the frame before the code when a
    scrollbar blinks.
  - `viewTransition.finished` REJECTS when another transition replaces this one
    — there is only ever one per document. `.finally()` does not handle a
    rejection, so an unhandled one is what it leaves behind; `.then(done, done)`
    is the shape that ends a transition whichever way it went.

If unsure which export solves a problem, check `README.md` first: it names what
navi provides, area by area. From a name, the built export tells you the API and
a demo tells you the usage.
