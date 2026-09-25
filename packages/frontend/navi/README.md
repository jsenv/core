# @jsenv/navi

A frontend framework for building modern web applications, focused on routing, async data, and UI components.

## Routing

Routing is signal-based, which means URL state — including search params — can be bound to signals with two-way synchronization. Change a signal, the URL updates. Navigate to a URL, the signals update. Search params can also be validated and typed, so you always work with the right shape of data.

Routes are flexible: you can create route groups to share logic, state, or UI across multiple routes. Nested routing is supported, and the structure naturally maps to how your application is organized.

How to declare routes, render them, and turn them into tabs — including `RouteTravel`, which lets a thumb drag from one URL to the next without ever mounting a route that does not match — is in [docs/navigation.md](./docs/navigation.md).

## Actions

Actions are async operations with lifecycle management — pending, success, error. You can declare actions that run when navigating to a route, and any component can subscribe to them via `useAsyncData` to reflect what is happening: loading states, results, errors. No manual wiring.

Code loaded on demand is the same thing: a page's `import()` is a route action, started with the page's data on the url change and prefetched when a link to it is hovered or focused; a component inside a page that stays reads its own with `useAsyncData(() => import(…))`. One wait, one failure, no lazy-shaped API. See [docs/dynamic_import.md](./docs/dynamic_import.md).

## REST state

`resource()` turns a REST endpoint into a reactive store: one action per verb, a
shared signal store every component reads from, and automatic invalidation
between related actions. Parent/child relations are first-class — `.one`,
`.many`, `.scopedOne`, `.scopedMany` model a backend sub-resource such as
`/games/:id/candidates` rather than leaving you to hand-roll it. See
[docs/resource.md](./docs/resource.md).

## Layout & Typography

**`Box`** is the main layout primitive. It wraps CSS Flexbox with a friendlier API: `flex` for horizontal layout, `flex="y"` for vertical (the axis things line up on, rather than guessing what `flex-direction: column` does visually). Supports `grid`, `inline`, alignment via `alignX`/`alignY`, and spacing props.

**`createSlot`** renders content declared in one place at another: a toolbar, a status, or one `SidePanel` for a whole board bound to the state that names what it shows (see [docs/popup_open.md](./docs/popup_open.md)).

**`Text`** and related components (`Title`, `Paragraph`, `Code`, `Caption`) handle typography consistently across the app — including the parts of a line that are not text: icons, counts, truncation (`maxLines`), skeletons, and where a line may break. See [docs/typography.md](./docs/typography.md).

## Texts & i18n

`interpolateText`/`Interpolate` keep a sentence containing values readable as one string, and `createI18n` gives the app a single place holding its wording — worth it even with one language. `naviI18n` is where navi's own texts (validation messages, button labels, relative time) can be overridden or translated. See [docs/i18n.md](./docs/i18n.md).

## Icons

Icons are a piece that is often missing or painful in web projects. The `Icon` component makes icons behave like text — they scale with font size, inherit color, and align naturally in any layout. No sizing hacks, no SVG wrangling.

## Fields & Forms

Field components (`Input` of every type, checkbox and radio included, `Select`, `Textarea`, `Picker`, …) hold their own value. Inside a `Form` they need nothing wired: the form reads them when it sends, through the same action system. When the app needs a value, a `signal` binds it both ways. An `action` runs what a change must cause when that can fail or take time; it is one option, not the way a field is wired. See [docs/control_value.md](./docs/control_value.md).

Validation goes beyond native browser constraints: custom rules, better error positioning, real-time feedback, and a UX that doesn't punish users before they've finished typing. See [docs/field_validation.md](./docs/field_validation.md).

Some values are moved rather than typed: `Spin` puts the way back and the way on around a value one step at a time, and `SpinGroup` makes several of them read as one — `TimeSpin` ("07h30") and `TimeRangeSpin` ("de 7h à 21h", end after start) are built that way.

## Table

A `Table` for spreadsheet-like screens: columns reordered by drag, columns and rows resized, sticky leading rows and columns, and cell, row and column selection with keyboard shortcuts.

## Other

Dialogs, badges, details/collapsible, separators, keyboard shortcuts, popovers, copy-to-clipboard, and other utilities.

A `Dialog`/`Popover` owns whether it is open; what varies is the trigger — a button, a gesture, a piece of application state. Which one to use, and what each costs, is in [docs/popup_open.md](./docs/popup_open.md).

---

Named after Navi, the fairy guide from Zelda — it helps you navigate through the complexities of building modern web applications.
