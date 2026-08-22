# Naming an element for a test (`data-testid`)

What we want: **a test names what it targets, not how it is drawn.** A test
that finds a button through `.navi_button_content > span:nth-child(2)`, or
through the sentence written in it, breaks the day the component is restyled,
the wording changes, or the app is translated — and it breaks with a failure
that says nothing about the application. `data-testid` is the name the test
uses: an attribute that exists for no other reason, so nothing but the test can
break it.

```jsx
<Button data-testid="save-game" action={save}>
  Save
</Button>
```

```js
// playwright
await page.getByTestId("save-game").click();
// cypress
cy.get('[data-testid="save-game"]').click();
```

`data-testid` is that exact spelling on purpose: it is Playwright's default
`testIdAttribute` and Testing Library's default, and it is the one navi knows
about (see below). Cypress has no built-in attribute — it reads it as a plain
selector — so the same name works there too. Don't invent `data-test`,
`data-cy` or `data-qa` variants per project.

## Prefer the contract the user already sees

`data-testid` is not the first tool. When an element has a role and a stable
accessible name, target THAT:

```js
await page.getByRole("button", { name: "Save" }).click();
await page.getByLabel("Email").fill("a@b.c");
```

It asserts something the application actually owes the user — a button that is
a button, a field that is labelled — so the test fails when accessibility
regresses, which a `data-testid` never notices. Reach for `data-testid` when
that contract is absent or not usable:

- there is no accessible name, or it is an icon, or it is dynamic;
- the app is translated, and the test must pass in every language;
- several elements legitimately share role and name (rows of a list, cells of a
  table) and only their position tells them apart — a per-item
  `data-testid={`row-${id}`}` names them by identity instead of by index.

## Where it lands in navi

Navi renders more than one element per component: a control is a little tree —
a wrapper box, sometimes a label, slots, and inside it the real
`<input>`/`<button>`/`<select>` that holds the value and receives the clicks
(the **host**, marked `navi-control-host` in the DOM; the root of the tree
carries `navi-control`).

**`data-testid` lands on the host**, not on the wrapper. That is deliberate and
it is the whole point: `getByTestId("email")` gives back the element you can
`fill()`, `check()`, `press()`, and assert `toBeDisabled()` / `toHaveValue()`
on. A testid on the wrapper would answer a click with a hit on the padding.

```jsx
<Input name="email" data-testid="email" />
```

```html
<span class="navi_input" navi-control="input">
  <input navi-control-host="input" data-testid="email" />
</span>
```

This routing is what `CONTROL_ATTRIBUTE_SET` in
`src/control/control_context.js` lists: the props navi hands to the host rather
than to the box around it (`id`, `name`, `type`, `value`, `tabIndex`,
`data-testid`, …). Any prop navi does not know lands on the root box instead —
so a `data-test-id` or a `data-qa` of your own would name the wrapper, which is
the second reason to keep the standard spelling.

When the wrapper IS what the test wants — a whole field with its label and its
error message, a section, a row — put the testid on the surrounding component
(`<Field data-testid="email-field">`, `<Box data-testid="cart-row">`); anything
built on `Box` forwards it to its own element.

## What not to target

Navi's own attributes are implementation, not a contract: `data-header`,
`data-body`, `data-scrollable`, `data-variant`, `data-callout-*`,
`navi-control*`, `.navi_*` class names, and the ids navi generates when none is
given (`useId`). They change without notice and without a migration note.
Likewise a `view-transition-name` or a CSS variable: those exist to draw, not
to be found.

## Naming

The name says what the thing is in the application, never how it looks or where
it sits: `save-game`, `player-row`, `cart-total` — not `blue-button`,
`second-input`, `header-btn`. It is a public name of the app for its tests: when
it has to change, it is because the feature changed.

`data-testid` stays in the production DOM — navi strips nothing. That is
accepted: a few bytes per element, against tests that survive a redesign.
