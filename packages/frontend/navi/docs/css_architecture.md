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

### 3. Direct rule override (avoid unless necessary)

Overriding the actual CSS rules (not the variables) is intentionally hard — that is by design. If you find yourself needing to do this, it usually means a CSS variable should be exposed for that property. Open an issue or add the variable yourself and contribute it back.

---

## Summary

| What you want to change      | How to do it                                                               |
| ---------------------------- | -------------------------------------------------------------------------- |
| One component instance       | Component prop or `style` attribute                                        |
| All instances of a component | `--component-*` in unlayered app CSS, on a selector matching the component |
| A global design token        | `--navi-*` on `:root`                                                      |
| A structural layout rule     | Expose a new CSS variable (contribute)                                     |
