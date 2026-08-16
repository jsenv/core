# @jsenv/navi

A frontend framework for building modern web applications, focused on routing, async data, and UI components.

## Routing

Routing is signal-based, which means URL state — including search params — can be bound to signals with two-way synchronization. Change a signal, the URL updates. Navigate to a URL, the signals update. Search params can also be validated and typed, so you always work with the right shape of data.

Routes are flexible: you can create route groups to share logic, state, or UI across multiple routes. Nested routing is supported, and the structure naturally maps to how your application is organized.

How to declare routes, render them, and turn them into tabs — including `RouteTravel`, which lets a thumb drag from one URL to the next without ever mounting a route that does not match — is in [docs/navigation.md](./docs/navigation.md).

## Actions

Actions are async operations with lifecycle management — pending, success, error. You can declare actions that run when navigating to a route, and any component can subscribe to them via `useAsyncData` to reflect what is happening: loading states, results, errors. No manual wiring.

## REST state

`resource()` turns a REST endpoint into a reactive store: one action per verb, a
shared signal store every component reads from, and automatic invalidation
between related actions. Parent/child relations are first-class — `.one`,
`.many`, `.scopedOne`, `.scopedMany` model a backend sub-resource such as
`/games/:id/candidates` rather than leaving you to hand-roll it. See
[docs/resource.md](./docs/resource.md).

## Layout & Typography

**`Box`** is the main layout primitive. It wraps CSS Flexbox with a friendlier API: `flex` for horizontal layout, `flex="y"` for vertical (no more guessing what `flex-direction: column` does visually). Supports `grid`, `inline`, alignment via `alignX`/`alignY`, and spacing props.

**`Text`** and related components (`Title`, `Paragraph`, `Code`, `Caption`) handle typography consistently across the app.

## Icons

Icons are a piece that is often missing or painful in web projects. The `Icon` component makes icons behave like text — they scale with font size, inherit color, and align naturally in any layout. No sizing hacks, no SVG wrangling.

## Fields & Forms

UI field components (`Input`, `Select`, `Checkbox`, `Radio`, etc.) accept an `action` prop — the standard way to respond to user interaction. Composing fields into forms is natural, and form submission flows through the same action system.

Validation goes beyond native browser constraints: custom rules, better error positioning, real-time feedback, and a UX that doesn't punish users before they've finished typing.

## Table

A capable `Table` component that handles what you'd expect from a spreadsheet-like interface: column management, sorting, multi-selection with keyboard shortcuts, and more.

## Other

Dialogs, badges, details/collapsible, separators, keyboard shortcuts, popovers, copy-to-clipboard, and other utilities.

A `Dialog`/`Popover` owns whether it is open; what varies is the trigger — a button, a gesture, a piece of application state. Which one to use, and what each costs, is in [docs/popup_open.md](./docs/popup_open.md).

---

Named after Navi, the fairy guide from Zelda — it helps you navigate through the complexities of building modern web applications.
