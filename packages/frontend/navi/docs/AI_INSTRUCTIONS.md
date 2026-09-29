# @jsenv/navi — context for AI assistants

This file gives context for using `@jsenv/navi` as intended, whether you read
the source or the built `dist/jsenv_navi.js` (e.g. inside
`node_modules/@jsenv/navi/`).

`dist/jsenv_navi.js` is navi's actual source, bundled — not an opaque blob. The
JSDoc on functions and exports is kept and carries real information; what
bundling loses is only file-level comments and comments attached to an
import/re-export statement.

## Where the answer to "how do I use X" is

There is deliberately **no per-export reference page**, and there never will
be: a page per component drifts from the code the day after it is written. Each
source of knowledge has one job:

- **These `docs/*.md` files** — decisions, concepts and invariants: what a
  mechanism is for, what it costs, what not to hand-write beside it — what a
  signature cannot say. Read the relevant one BEFORE writing code in its area;
  they are listed below.
- **JSDoc on an export** (`@type`, `@param`) — what a prop means and accepts. A
  hint at the call site, not exhaustive: the props that flow through to `Box`,
  the interplay between two props, what a component composes are not repeated
  there.
- **The built code, `dist/jsenv_navi.js`** — the exhaustive truth about the API,
  JSDoc included, always under `node_modules/@jsenv/navi/`. When a signature, a
  default or an accepted value is what you need, read it there rather than
  guessing.
- **Sources, demos and tests** — how an export is really used:
  `src/**/demos/*_demo.html` exercise one component per page, prop by prop. They
  are not published to npm, so they live only in the repo
  (https://github.com/jsenv/core/tree/main/packages/frontend/navi); a project
  that wants an AI to work with navi seriously keeps a local clone beside it.

So when the JSDoc did not answer: read the built export, then find a demo using
it. Write what you learned into a `docs/*.md` only if it is a decision or an
invariant — never as a reference page for one component.

## Library, but also a framework

Every export is usable on its own — just `stateSignal`, just `Table`. But navi
also provides the primitives most apps otherwise reinvent inconsistently:
routing, the async data lifecycle, CSS layering and tokens, focus and keyboard
handling, and more. When navi has a primitive for what you are building, prefer
it over a custom one, even when the custom one would be quicker to write for this
one case: the value of navi as a framework is the consistency across the app,
not any single call site.

## The docs, and when to read each

One line per file: what it decides, and the moment to open it.

`README.md` (package root) names what navi provides, area by area — the place to
start when unsure which export solves a problem.

### Routing and movement

- `navigation.md` — the position of the user belongs in the URL by default:
  routes and which branch renders, search params, redirections, the back arrow
  (`navBack`), where a navigation lands (a `#id` for an element), a
  `SlideContainer` read from the URL, what a layer drawn over the screen may say
  in its address. Before any routing code.
- `route_transitions.md` — a transition states a relation between two pages;
  `RouteTravel` or a transition, never both on one pair; fixed bars and
  `RouteTransitionArea`; the page being left stays mounted, hidden, until the
  movement is over; a test waits for the page, never for its address; what a
  transition costs. Before animating a navigation, and before believing a
  symptom that only appears once a pair is animated.
- `view_transitions.md` — what the browser does to any view transition: unique
  names (and none inside a page that moves), the fallback fade, a callback in
  which no frame ticks, `ready` and `finished`, the top layer, what restyles the
  whole document, what cannot be pointed at while one plays. Before
  `document.startViewTransition`, and before putting a value on `:root` for a
  movement.
- `drag_to_travel.md` — a pointer or a wheel pushing a screen aside, and who owns
  a press several boxes want. Before putting anything that reads the pointer
  inside a box that travels.

### Data

- `actions.md` — calling versus binding, a failing run rejects, reading is not
  running (`{ run: true }` is the fallback), `action` versus `uiAction`, an
  action and a command on one press. Before running an action from a component.
- `resource.md` — `resource()` and its relations (never an `op` discriminator),
  `GET_RANGE`, a search as the same `GET_MANY`, `withParams()` scopes and
  `dependencies`, `persist`, a function versus the verb's instance. Before
  writing a resource, and before caching a response yourself.
- `data_states.md` — `data`, `loading` and `error` are three questions;
  `loading: true` never suspends; a skeleton is told whether it is loading.
  Before drawing a skeleton on `!data` or hiding content because `error` is set.
- `list_refresh.md` — what a write sends back and what stays on screen meanwhile;
  `rerunOn` and its defaults; coming back to a list. Before adding verbs to
  `rerunOn` or remounting a list to refresh it.
- `list_action.md` — where the `action` lives decides who waits; a row whose
  button works is `readOnly`, not `loading`; `parallelGuard`. Before
  `<List readOnly={pending}>` or a second spinner beside a control's own.
- `error_handling.md` — a refusal versus a bug, where each is shown, displaying
  is claiming, the rules of a boundary. Before displaying an error by hand or
  writing a boundary.
- `network_policy.md` — `setNetworkPolicy`: writes held before the press, reads
  answered from the store or let through. Before caching responses in the app, or
  guarding writes in its own request layer.
- `dynamic_import.md` — code arrives like data: a page's import is a route
  action, a component's is started by what asks; links prefetch on intent; a
  chunk that does not come needs a fresh document; no `lazy()`. Before an
  `import()` in a component or a page.

### Controls and forms

- `state_binding.md` — state navi shows is bound (`signal`), not copied back by a
  callback; the three shapes (`signal`, `action`, `command` + `commandFor`).
  Before any handler whose body only assigns state.
- `control_value.md` — who holds a control's value; `--navi-update` for a button
  proposing one; a `defaultValue` follows the record it was read from; empty
  keeps the shape of the question. Before wiring a value with `value` +
  `uiAction`.
- `control_object.md` — one value made of several controls: `ControlGroup` versus
  `Form`, naming, `<Picker type="object">`, a settings sheet. Before putting
  anything in a picker popup.
- `group.md` — `<Group>`: several controls reading as one framed object. Before
  negative margins or `border-radius: 0` by hand.
- `form_changed.md` — a form sends nothing when nothing changed; what "changed"
  is measured against; `pristineKey`; `standalone`; what follows a send
  (`command`, `--navi-void`). Before `canSendWhileUnchanged`, and before a control
  inside a group whose value it has no business joining.
- `field_validation.md` — what only a browser can answer versus "is this value
  acceptable" (@jsenv/validity's); constraints as props; `singleSpace="autoFix"`;
  guards. Before writing a constraint.
- `create_and_edit.md` — the create/edit loop assembled from `route`,
  `resource`, `Form` and `RouteTravel`. Before writing a create or edit screen.

### Popups

- `popup_open.md` — a popup owns its open state; `command` + `commandFor`,
  `triggerNaviCommand` as the last resort; opening ON something; a press that
  opens and acts is a `Picker`; Escape cancels; the close cross;
  `signal`/`navState`/`open`; a popup that loads data; `mount`; a closed
  `Dialog` costs one element until asked (a row may hold the dialogs of its
  own actions). Before passing `open`, calling `triggerNaviCommand`, or
  writing a close button.
- `popup_backdrop.md` — three independent questions: a wall or not, what an
  outside press does, how far the page withdraws. Before CSS for a backdrop.
- `popup_lift.md` — `animation="lifting"`: the pressed card brought to the front.
  Before giving a `Dialog` or a `Picker` `animation="lifting"`.
- `dialog_shape.md` — bounds rather than a width, the container ceiling, the
  docked sheet. Before deriving `smallTouchScreenSignal` in an app or writing CSS
  to make a dialog fit.
- `autofocus.md` — the ladder that hands out the keyboard, `autoFocus` on a
  surface versus a field, the ring, `moveFocusTo`. Before calling
  `element.focus()` anywhere.

### Gestures

- `interactions.md` — a gesture is named, not read by hand: the `interactions`
  prop, swipes, holds, counted taps, the gate, `selfInteractions`, registering a
  detector. Before a `pointerdown` listener of your own, and before stopping
  propagation to keep a popup shut.
- `drag_interactions.md` — an element carried: `move`, `reorder`, `land`,
  `toss`, `leave`, `moving`, the `grab`/`release`/`refuse` moments,
  `--navi-grab`, dressing the clone. Before moving anything with the pointer.
- `pan_zoom.md` — a surface under the hand: `pan`, `zoom`, and what a touch or a
  wheel over it may do to the page around it.
- `mobile_touch.md` — what Chrome and Safari do with a finger, measured, and how
  to reproduce it without a device. Before reading a finger yourself, and before
  concluding a gesture works because it works with a mouse.

### Layout, CSS and text

- `css_architecture.md` — navi wins by default, defaults in `@layer navi`, props
  first; `--navi-*` versus `--component-*`; what a popup inherits from its
  opener; structural selectors (`:last-child`…) and navi's out-of-flow children;
  `import.meta.css` and what a `${}` costs; browser support. Before overriding a
  component style or writing `import.meta.css`.
- `safe_area.md` — the app's rectangle and the band left free inside it, an app
  narrower than the window (`--navi-app-max-width`), `data-navi-safe-area`, the
  viewport under a virtual keyboard, a document wider than the screen. Before
  hand-writing an offset to clear a `FixedBar`.
- `scroll.md` — where scrolling happens: `header`/`body`/`footer`, a `List`'s
  `scroller`, where a list opens (a position handed back whole, `visibleCount`
  included), a popup that scrolls, many rows (`<List.Items>`, the render window
  and its first picture, `findText`), hover while scrolling. Before writing CSS
  to make something scroll, and before rendering a collection as `<List.Item>`
  children.
- `z_index.md` — DOM order first; a `z-index` without `isolation: isolate`
  competes with the page; navi's bands. Before writing a `z-index`.
- `typography.md` — text is a component; `maxLines` is the one truncation; one
  line height for everything; `BadgeList`. Before an overflowing label, and
  before touching a `line-height`.
- `i18n.md` — `interpolateText`/`<Interpolate>` for one sentence, `createI18n`
  for the app's texts, `naviI18n` for navi's own. Before writing a user-visible
  sentence.
- `testid.md` — role and accessible name first; where `data-testid` lands; what
  not to target. Before a selector in a test.

## Key concepts to know before guessing an API

- **Routing is signal-based**: URL state, search params included, two-way syncs
  with signals. Don't build parallel state for what a route or query signal
  already tracks.
- **A link lands on an element by its fragment**: give the element an `id` and
  link to `#id` — never a search param plus `scrollIntoView` in an effect.
- **Actions** model async operations with a lifecycle (idle, running, completed,
  failed, aborted). Components read an action's state with `useAsyncData`, not
  hand-tracked loading/error booleans. Reading does not run it: a `routeAction`,
  a control's `action`, or `useAsyncData(action, { run: true })` starts it.
- **REST state is modelled with `resource()`**, and parent/child relations with
  `.one` / `.many` / `.scopedOne` / `.scopedMany` — never a backend sub-resource
  (`/games/:id/candidates`) encoded as an `op`/`type` discriminator inside one
  verb's callback. Searching a collection is that collection's `GET_MANY` with
  one more param.
- **`Box`** is the element every component is drawn with: `flex` (side by side),
  `flex="y"` (stacked), `grid`, `inline`, `alignX`/`alignY`, `spacing` for the gap
  (there is no `gap` prop), sizes from the `"xxs"`…`"xxl"` scale. Prefer it over
  raw CSS for layout.
- **A control holds its own value.** `Input` (checkbox and radio are
  `<Input type="checkbox">`/`<Input type="radio">`; there is no `Checkbox`),
  `Select`, `Picker` and the others work with nothing wired: inside a `Form`, the
  form reads them when it sends. When the app needs the value, bind it with
  `signal`. `action` reacts to a change that can fail or take time; it is not how
  a control is wired. Never `onChange` + manual state.
- **A gesture is named, not read by hand**: `interactions={{ swipe_right: … }}`
  on any `Box`, so on any component — never a `pointerdown` listener of your own.
- **Texts**: a user-visible sentence containing a value is one template with
  `[placeholder]`s (`interpolateText` / `<Interpolate>`), not JSX fragments or
  concatenations. Beyond a handful of texts, the app declares them in its own
  `createI18n()` instance, the English text as the key; navi's `naviI18n` uses
  opaque keys, and application texts never go into it.
- **View transitions**: navi components animate their own changes and never
  decide for the whole document. What an app starting its own transition has to
  know is `view_transitions.md`.
