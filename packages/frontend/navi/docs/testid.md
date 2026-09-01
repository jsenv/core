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

`aria-label` and `aria-labelledby` take the same road, and for the reason the
section above gives: the name has to be where the role is. The root box has no
role — it is a wrapper — so a name left on it would be announced by nothing and
found by nothing, while the host is what the user focuses and what
`getByRole(role, { name })` and `getByLabel()` read.

```jsx
<Picker variant="icon" aria-label="Aide" ui={<Icon>…</Icon>} />
```

```html
<div class="navi_picker" navi-control="picker" aria-expanded="false">
  <input navi-control-host="picker" aria-label="Aide" readonly />
</div>
```

Which role that host answers to is what the control really is, not what it is
drawn like: a button's host is a `<button>`, and a picker's host is an
`<input>` — a `textbox`, because it holds text the user chose.

A picker that picks nothing is the exception, and answers to `button`: its
popup is a question (`type="confirm"`) or something to read
(`mode="callout"`), so it is a door, and a door is pressed. Its name is the
label it draws — the `ui` you gave it, or its placeholder — unless you name it
yourself:

```jsx
<Picker type="confirm" ui="Delete" action={deleteFile} />
<Picker mode="callout" aria-label="Aide" ui={<Icon>…</Icon>}>…</Picker>
```

```js
await page.getByRole("button", { name: "Delete" }).click();
await page.getByRole("button", { name: "Aide" }).click();
```

A trigger drawn as an icon draws no words, so `aria-label` is the only thing
that can name it — for the test and for a screen reader alike.

When the wrapper IS what the test wants — a whole field with its label and its
error message, a section, a row — put the testid on the surrounding component
(`<Field data-testid="email-field">`, `<Box data-testid="cart-row">`); anything
built on `Box` forwards it to its own element.

A picker's popup is the one element the application does not render itself:
`<Picker>` builds it, so a `data-testid` on the picker names the trigger and
nothing names the popup. `popupTestId` does:

```jsx
<Picker data-testid="tie-break" popupTestId="tie-break-sheet">
  …
</Picker>
```

Most tests do not need it — a testid on what the popup holds (`<Box
data-testid="place-pick">` among the children) names the screen, not the frame,
and is the better name for a test that reads or clicks the content. Reach for
`popupTestId` when the frame IS what the test looks at: a screenshot of the
popup's surface, its position, its size, its backdrop. It names the popup in
every mode, including `mode="callout"`, where the frame is a callout rather
than a sheet.

## A callout is a role first

A callout — a control's `readOnlyMessage` or failing constraint, a
`mode="callout"` picker, a direct `openCallout()` — is drawn by navi from end to
end: the application supplies the sentence and nothing else, so there is often
nothing of its own to name. It carries a role for that, and the role is the
contract: `alert` when it says something went wrong (`warning`, `error`),
`status` otherwise (`info`, `success`, or no status at all).

```js
await page.getByRole("button", { name: "Publier" }).click();
await expect(page.getByRole("alert")).toHaveText("Il manque le lieu");
```

That is not a testing convenience: a message appearing without the user asking
for it is what a live region is for, and the role is what makes a screen reader
read it out. A test targeting it asserts that.

When the role is not enough — two callouts up at once, a screenshot of one
particular surface — `openCallout` takes a `testId`, and a picker's
`popupTestId` covers the one it opens. Waiting on `.navi_callout` is the thing
to replace: it is a navi class like any other.

`<ControlSwap.Side>` answers the same situation the other way: the cap at the
end of the row is drawn by navi, and every prop the side does not use for
itself lands on it — so `data-testid` on the side names the cap, while what the
side holds is a vnode of yours that takes its own.

## What not to target

Navi's own attributes are implementation, not a contract: `data-header`,
`data-body`, `data-scrollable`, `data-variant`, `data-callout-*`,
`navi-control*`, `.navi_*` class names, the ids navi generates when none is
given (`useId`), and the ids it derives from yours (a picker's popup id is built
from the picker's, so the suffix is navi's even when the base is not). They
change without notice and without a migration note.
Likewise a `view-transition-name` or a CSS variable: those exist to draw, not
to be found.

## Naming

The name says what the thing is in the application, never how it looks or where
it sits: `save-game`, `player-row`, `cart-total` — not `blue-button`,
`second-input`, `header-btn`. It is a public name of the app for its tests: when
it has to change, it is because the feature changed.

`data-testid` stays in the production DOM — navi strips nothing. That is
accepted: a few bytes per element, against tests that survive a redesign.
