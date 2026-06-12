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

This means an app can override a Navi default simply by setting the variable anywhere in its own unlayered CSS:

```css
/* App CSS — no layer needed, automatically wins over @layer navi */
:root {
  --button-height: 40px;
}
```

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
  --button-height: 40px;
}
```

Because Navi defaults live in `@layer navi`, this unlayered `:root` rule wins automatically.

### 3. Direct rule override (avoid unless necessary)

Overriding the actual CSS rules (not the variables) is intentionally hard — that is by design. If you find yourself needing to do this, it usually means a CSS variable should be exposed for that property. Open an issue or add the variable yourself and contribute it back.

---

## Summary

| What you want to change      | How to do it                           |
| ---------------------------- | -------------------------------------- |
| One component instance       | Component prop or `style` attribute    |
| All instances of a component | CSS variable in unlayered app CSS      |
| A global design token        | CSS variable on `:root`                |
| A structural layout rule     | Expose a new CSS variable (contribute) |
