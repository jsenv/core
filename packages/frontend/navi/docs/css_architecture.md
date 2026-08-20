# Navi CSS Architecture

## Overview

Navi components are styled through a combination of CSS custom properties (variables) and scoped CSS rules. The architecture is designed so that:

1. **Navi wins by default** — component rules are not placed inside `@layer`, so they beat any layered global styles.
2. **Defaults are easy to override** — default values for CSS variables are declared inside `@layer navi`, which has the lowest possible specificity, making them trivially overridable from outside.
3. **The preferred override surface is component props** — props translate to inline styles or data attributes, not class names.

---

## Layer structure

```
@layer navi {
  /* CSS variable defaults only */
  .navi_button {
    --button-height: 32px;
    --button-padding-x: 12px;
  }
}

/* Actual rules — outside any layer */
.navi_button {
  height: var(--button-height);
  padding-inline: var(--button-padding-x);
}
```

### Why defaults go inside `@layer navi`

CSS cascade layers are ordered below unlayered styles. Anything declared in `@layer navi` is automatically beaten by any unlayered rule from the page or a design system, without needing `!important`.

This means an app can override a Navi default from its own unlayered CSS, without `!important`, as long as its selector targets the same element the default was declared on:

```css
/* App CSS — no layer needed, automatically wins over @layer navi */
.navi_button {
  --button-height: 40px;
}
```

Targeting the same element is not a detail — see [`--navi-*` vs `--component-*`](#--navi-vs---component-where-the-override-has-to-go) below.

### Why actual rules stay outside any layer

Navi components often need to enforce specific values that global resets or utility libraries may clobber — for example `box-sizing: content-box`, `white-space: nowrap`, or `display: inline-flex`. If these rules were inside `@layer navi`, any unlayered global style (e.g. `* { box-sizing: border-box }`) would silently override them, breaking component layout.

By keeping rules outside any layer, Navi wins by default without resorting to `!important`. An app that genuinely needs to change a structural rule should do so through the CSS variable surface, not by overriding the rule directly.

---

## Override surfaces

### 1. Component props (preferred)

Props are the primary way to customize appearance. They translate to inline `style` attributes or `data-*` attributes, both of which have higher specificity than class-based rules.

```jsx
// Size and color via props
<Button size="l" primary />

// Custom CSS variable via style prop
<Button style={{ "--button-height": "48px" }} />
```

#### Variants set defaults, never resolved values

A control resolves each styled property in two steps: the public variable
holds what was asked for (`--picker-background-color`), and an internal
`--x-` variable holds what is finally painted, per state:

```css
.navi_picker {
  --x-picker-background-color: var(--picker-background-color);

  &[data-hover] {
    --x-picker-background-color: var(--picker-background-color-hover);
  }
}
```

A variant (`icon`, `discrete`, `bare`, `border`, `headless`…) describes what
the caller did **not** say, so it writes the public variable — the default —
and never the `--x-` one:

```css
&[data-variant="icon"] {
  /* ✅ a default: a backgroundColor prop, being inline on this same element, wins */
  --picker-background-color: transparent;
  /* ❌ a verdict: the prop is read, translated, and then thrown away */
  --x-picker-background-color: transparent;
}
```

Writing `--x-` from a variant is the one failure mode that costs real time to
diagnose: the prop is accepted, it reaches its variable with the right value,
and nothing happens. A prop silently without effect is worse than a prop
refused.

Two things come with moving the default:

- the **per-state** variables are derived from the base one by formula
  (`hover` = 5% black over the background, `disabled` = 5% grey), so a variant
  that clears the background must re-point them at the base
  (`--picker-background-color-hover: var(--picker-background-color)`), or a box
  reappears on hover under a control that is supposed to have none. When the
  variant does have a resting movement, express it as a mix **into** the
  background (`color-mix(in srgb, currentColor 8%, var(--picker-background-color))`)
  rather than a replacement, so it still composes with a color the caller gave.
- a variable fed by another prop keeps that chain in its fallback:
  `--button-background-color: var(--button-background, transparent)` leaves both
  `background` and `backgroundColor` working.

The same holds for sizing: a variant lowers `--picker-padding-x-default`, not
`--x-picker-padding-left`.

### 2. CSS variables (for global or theme-level changes)

When the same change applies to many components (e.g. a design token update), set the variable at a higher scope:

```css
/* Override Navi's default at the page or theme level */
:root {
  --navi-s: 6px; /* spacing token */
}
```

Because Navi's `--navi-*` defaults are themselves declared on `:root` inside `@layer navi`, this unlayered `:root` rule targets the same element and wins automatically.

#### `--navi-*` vs `--component-*`: where the override has to go

The two families are **not** interchangeable, and layers have nothing to do with it:

| Token           | Declared on             | Overridable from `:root`?       |
| --------------- | ----------------------- | ------------------------------- |
| `--navi-*`      | `:root` (`@layer navi`) | Yes                             |
| `--component-*` | `.navi_<component>`     | **No** — must match the element |

For a custom property, a declaration made **on the element itself** always beats the same property **inherited** from an ancestor. The cascade (specificity, layers, `!important`) only arbitrates between declarations targeting the same element — it never lets an ancestor win over the element's own declaration.

So this does nothing, because `.navi_link` declares `--link-color-pressed` on itself:

```css
:root {
  --link-color-pressed: blue; /* ignored: never reaches .navi_link */
}
```

Three ways to actually change it:

```css
/* 1. The theme-level token (preferred) — declared on :root, so :root wins */
:root {
  --navi-link-color-pressed: blue;
}

/* 2. An unlayered rule that matches the links themselves */
.my-sidebar .navi_link {
  --link-color-pressed: blue;
}
```

```jsx
/* 3. Per instance */
<Link style={{ "--link-color-pressed": "blue" }} />
```

Note that scoping to an ancestor is not enough: `.my-sidebar { --link-color-pressed: blue }` fails for the same reason `:root` does. The selector has to reach the link element itself.

When a component default deserves to be themed globally, promote it: declare a `--navi-<component>-<thing>` in [navi_css_vars.js](../src/navi_css_vars.js) and make the component default read `var(--navi-…)`.

#### An app narrower than the screen

An app that never spans the whole window — a phone-shaped column centered in a
wide one, bands on the sides — has one problem with popups: a dialog lives in
the browser's top layer, so it is calibrated on the _viewport_, and would paint
1500px of modal over a 600px app. The top bar and the bottom nav have the same
problem and solve it by repeating the app width by hand; popups must not need
that, because the app would then have to know which components exist.

So the app states its own screen once, and never names a component:

```css
:root {
  --navi-app-max-width: 600px;
  /* --navi-app-max-height too, for an app that also caps its height */
}
```

In pixels: popup placement reads this value back from CSS to compute its own
margins, and a custom property computes to a token stream rather than to a
length, so `40rem` would arrive there as the string `"40rem"`. A non-px value
still caps the popup's size (that part is pure CSS) but leaves the margins
viewport-sized, and says so in the console.

Every popup follows: `Dialog`, `Popover`, and everything built on them
(`Picker`, `Select`…). It is a ceiling and nothing more — on a screen narrower
than the app it never binds, and each popup still subtracts its own
`marginWithContainer` from it, so the gap with the edges is kept either way.
That gap is itself a share of the app's screen, not of the window (`"3appw"`,
navi's own unit alongside `vvw`/`vvh`) — otherwise a 3% margin measured on a
1500px window would eat 90px out of a 600px app.

Do **not** try to get this by setting `--dialog-max-width` on `.navi_dialog`
from the app. Two reasons:

- it is a `--component-*` token, declared on the element (see the table above),
  so components that write it themselves outrank an app rule of lower
  specificity — `.navi_picker[aria-haspopup="dialog"] .navi_dialog` does exactly
  that, and the app's cap silently disappears for every picker;
- it is the knob a single popup uses to ask for a specific size, not a ceiling.
  `--navi-app-max-width` feeds `--dialog-maxmax-width`, the hard ceiling _under_
  that knob, so a popup that genuinely needs its own `maxWidth` can still say so
  without any of them escaping the app's screen.

##### Current limitations

`--navi-app-max-width` caps how big a popup may get; it does not move where one
is placed. Placement is still computed against the real viewport
(`pickPositionRelativeTo`, in `@jsenv/dom`). That is invisible for anything
centered on its cross axis — `center`, `bottom`, `top`, which is what a dialog
does nearly always — but shows for anything anchored to an edge: a
`positionArea` like `bottom-start`, a `SidePanel`, a fixed bar. Those sit
against the window's edge rather than the app column's, so they stay on the real
viewport for now (`side_panel.jsx` restates `--dialog-maxmax-width` as the full
viewport on purpose).

Making them follow the app column too means narrowing the container rect
placement is computed against, inside `pickPositionRelativeTo` — worth doing the
day a side panel or a fixed bar has to live inside a simulated screen.

Note that an app can already get all of it, placement included, by rendering
itself in an iframe of the target width: the viewport then genuinely _is_ the
app's screen and no token is needed at all. `--navi-app-max-width` is the answer
for an app that does not want to pay that price.

### 3. Direct rule override (avoid unless necessary)

Overriding the actual CSS rules (not the variables) is intentionally hard — that is by design. If you find yourself needing to do this, it usually means a CSS variable should be exposed for that property. Open an issue or add the variable yourself and contribute it back.

---

## Summary

| What you want to change      | How to do it                                                               |
| ---------------------------- | -------------------------------------------------------------------------- |
| One component instance       | Component prop or `style` attribute                                        |
| All instances of a component | `--component-*` in unlayered app CSS, on a selector matching the component |
| A global design token        | `--navi-*` on `:root`                                                      |
| How wide popups may ever get | `--navi-app-max-width` on `:root`                                          |
| A structural layout rule     | Expose a new CSS variable (contribute)                                     |
| What a variant decided       | A prop — a variant only ever moves defaults, so props keep winning         |
