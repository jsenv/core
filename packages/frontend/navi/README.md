# @jsenv/navi

A Preact framework for building web applications: routing, async data, REST state, controls and forms, popups, gestures, layout and text. Every export can be used on its own, but they are designed to work together, and an app gets the most out of navi by reaching for its primitive whenever one exists.

This page names what navi provides, area by area. The reasoning behind each area lives in [docs/](./docs/), and [docs/AI_INSTRUCTIONS.md](./docs/AI_INSTRUCTIONS.md) lists every doc with the moment to read it.

## Routing

Routing is signal-based, which means URL state — including search params — can be bound to signals with two-way synchronization. Change a signal, the URL updates. Navigate to a URL, the signals update. Search params can also be validated and typed, so you always work with the right shape of data.

Routes are flexible: you can create route groups to share logic, state, or UI across multiple routes. Nested routing is supported, and the structure naturally maps to how your application is organized. `routeFallback()` names the not-found page.

`Link` knows whether it points where the user is, and `Nav` turns links into a tab row whose indicator travels from tab to tab. `Binder` draws tabs and the page they open as one shape. `RouteTravel` lets a thumb drag from one URL to the next without ever mounting a route that does not match. See [docs/navigation.md](./docs/navigation.md).

## Transitions

A navigation can be animated as a relation the user reads as a map: `defineRouteTransition` declares how one page gives way to another (a slide, a cover), and the browser's back button plays it the other way. See [docs/route_transitions.md](./docs/route_transitions.md), and [docs/view_transitions.md](./docs/view_transitions.md) before starting a view transition of your own.

`UITransition` animates a change inside a box — one content replacing another, or a loading state giving way to the result — while the box resizes from one to the other.

## State

`stateSignal` is a signal that knows more about its value: a type, a default (possibly another signal), constraints such as `oneOf` or `min`/`max`, and where it lives — memory, `localStorage` (`persists`), or the URL when a route binds it.

State navi shows is bound, not copied back by a callback: a control, a popup, a tab row take a `signal` and read and write it themselves. See [docs/state_binding.md](./docs/state_binding.md).

## Actions

Actions are async operations with lifecycle management — pending, success, error. You can declare actions that run when navigating to a route, and any component can subscribe to them via `useAsyncData` to reflect what is happening: loading states, results, errors. No manual wiring. See [docs/actions.md](./docs/actions.md), and [docs/data_states.md](./docs/data_states.md) for drawing a skeleton, a result and an error from the same action.

Code loaded on demand is the same thing: a page's `import()` is a route action, started with the page's data on the url change and prefetched when a link to it is hovered or focused; a component inside a page that stays reads its own with `useAsyncData(() => import(…))`. One wait, one failure, no lazy-shaped API. See [docs/dynamic_import.md](./docs/dynamic_import.md).

Errors are kept in two kinds — a request refused versus a bug — each shown in its own place; `ErrorBoundary` and `Loading` are the boundaries. See [docs/error_handling.md](./docs/error_handling.md).

## REST state

`resource()` turns a REST endpoint into a reactive store: one action per verb, a
shared signal store every component reads from, and automatic invalidation
between related actions. Parent/child relations are first-class — `.one`,
`.many`, `.scopedOne`, `.scopedMany` model a backend sub-resource such as
`/games/:id/candidates` rather than leaving you to hand-roll it. With `persist`,
the last answer is drawn again right after a reload, before the network
answers. See [docs/resource.md](./docs/resource.md).

`setNetworkPolicy` decides whether a request may go out at all — offline, or
any reason the app has: writes are held, reads answered from the store or let
through, and the controls bound to them say why. See
[docs/network_policy.md](./docs/network_policy.md).

## Fields & Forms

Field components (`Input` of every type, checkbox and radio included, `Select`, `Textarea`, `Picker`, …) hold their own value. Inside a `Form` they need nothing wired: the form reads them when it sends, through the same action system, and sends nothing when nothing changed. When the app needs a value, a `signal` binds it both ways. An `action` runs what a change must cause when that can fail or take time; it is one option, not the way a field is wired. See [docs/control_value.md](./docs/control_value.md) and [docs/form_changed.md](./docs/form_changed.md).

`Picker` is a control whose value is chosen in a popup: a list of options, a confirmation, or several controls composing one object value. Its trigger wears the wait and the error of what the choice runs. See [docs/control_object.md](./docs/control_object.md).

Validation goes beyond native browser constraints: custom rules, better error positioning, real-time feedback, and a UX that doesn't punish users before they've finished typing. See [docs/field_validation.md](./docs/field_validation.md).

Some values are moved rather than typed: `Spin` puts the way back and the way on around a value one step at a time, and `SpinGroup` makes several of them read as one — `TimeSpin` ("07h30") and `TimeRangeSpin` ("de 7h à 21h", end after start) are built that way. `Wheel` is the scroll picker a phone shows for the same job, with `TimeWheel` and `TimeRangeWheel` built on it.

`Group` makes several controls read as one framed object, `Editable` edits a value in place, exactly where it is written.

## List

`List` shows a collection: rows that can be selected, searched (`createSearch`), grouped and separated, with a skeleton while the first answer is out and the error in its place when it fails. Thousands of rows render through `<List.Items>` and a render window, and a list remembers where it was scrolled when the user comes back. See [docs/scroll.md](./docs/scroll.md), [docs/list_refresh.md](./docs/list_refresh.md) and [docs/list_action.md](./docs/list_action.md).

## Table

A `Table` for spreadsheet-like screens: columns reordered by drag, columns and rows resized, sticky leading rows and columns, and cell, row and column selection with keyboard shortcuts.

## Popups

`Dialog`, `Popover` and `SidePanel` own whether they are open; what varies is the trigger — a button (`command` + `commandFor`), a gesture, a piece of application state. A popup can lift the card that was pressed to the front (`animation="lifting"`), dock to an edge on a small touch screen, and choose how far the page behind it withdraws. `Expandable` opens in place, pushing the content below. `createSlot` renders content declared in one place at another: one `SidePanel` for a whole board, bound to the state that names what it shows. See [docs/popup_open.md](./docs/popup_open.md), [docs/popup_backdrop.md](./docs/popup_backdrop.md), [docs/popup_lift.md](./docs/popup_lift.md) and [docs/dialog_shape.md](./docs/dialog_shape.md).

A callout (`openCallout`) points at an element to say something about it — a validation message, a refused press.

## Gestures

A gesture is named, not read by hand: the `interactions` prop, available on every component, answers swipes, holds, double clicks and keyboard shortcuts with an action. Elements are carried with `move`, `reorder`, `land`, `toss` and `leave`, and a surface is panned and zoomed with `pan`/`zoom`. Touch, mouse and pen share one model of who owns a press. See [docs/interactions.md](./docs/interactions.md), [docs/drag_interactions.md](./docs/drag_interactions.md), [docs/pan_zoom.md](./docs/pan_zoom.md) and [docs/drag_to_travel.md](./docs/drag_to_travel.md).

Who holds the keyboard, and whether a focus ring shows, is decided in one place for every component. See [docs/autofocus.md](./docs/autofocus.md).

## Layout

**`Box`** is the main layout primitive. It wraps CSS Flexbox with a friendlier API: `flex` for horizontal layout, `flex="y"` for vertical (the axis things line up on, rather than guessing what `flex-direction: column` does visually). Supports `grid`, `inline`, alignment via `alignX`/`alignY`, and spacing props.

`FixedBar` pins a strip to an edge of the window and gives the space back to the content, clearing the notch and the virtual keyboard (see [docs/safe_area.md](./docs/safe_area.md)). `SlideContainer` holds slides that replace one another in one box, dragged or bound to the URL. `CardLayout`, `StepList` and `Separator` cover the rest of a screen's usual shapes.

Components are styled from `@layer navi` and `--navi-*` tokens, so an app theme and a plain CSS rule win without a fight. See [docs/css_architecture.md](./docs/css_architecture.md).

## Text & i18n

**`Text`** and related components (`Title`, `Paragraph`, `Code`, `Caption`) handle typography consistently across the app — including the parts of a line that are not text: icons, counts, truncation (`maxLines`), skeletons, and where a line may break. Values have components of their own: `Time`, `TimeRange`, `Quantity`, `Unit`, `Meter`, `Badge`, `BadgeList`. See [docs/typography.md](./docs/typography.md).

Icons are a piece that is often missing or painful in web projects. The `Icon` component makes icons behave like text — they scale with font size, inherit color, and align naturally in any layout. No sizing hacks, no SVG wrangling.

`interpolateText`/`Interpolate` keep a sentence containing values readable as one string, and `createI18n` gives the app a single place holding its wording — worth it even with one language. `naviI18n` is where navi's own texts (validation messages, button labels, relative time) can be overridden or translated. The `format*` helpers write dates, times, durations and numbers for the user's language. See [docs/i18n.md](./docs/i18n.md).

---

Named after Navi, the fairy guide from Zelda — it helps you navigate through the complexities of building modern web applications.
