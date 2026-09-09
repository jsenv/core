# Navi CSS Architecture

- [Overview](#overview)
- [Where CSS lives: `import.meta.css`](#where-css-lives-importmetacss)
  - [`${}` blinds the whole stylesheet](#-blinds-the-whole-stylesheet)
  - [Beware when moving a shared sheet out](#beware-when-moving-a-shared-sheet-out)
  - [Browser support: navi's css and your target](#browser-support-navis-css-and-your-target)
- [Layer structure](#layer-structure)
  - [Why defaults go inside `@layer navi`](#why-defaults-go-inside-layer-navi)
  - [Why actual rules stay outside any layer](#why-actual-rules-stay-outside-any-layer)
  - [The exception: a rule navi offers back](#the-exception-a-rule-navi-offers-back)
- [Override surfaces](#override-surfaces)
  - [1. Component props (preferred)](#1-component-props-preferred)
  - [2. CSS variables (for global or theme-level changes)](#2-css-variables-for-global-or-theme-level-changes)
  - [3. Direct rule override (avoid unless necessary)](#3-direct-rule-override-avoid-unless-necessary)
- [Counting children: what navi puts in your tree](#counting-children-what-navi-puts-in-your-tree)
  - [Say which children the rule means](#say-which-children-the-rule-means)
- [Summary](#summary)

## Overview

Navi components are styled through a combination of CSS custom properties (variables) and scoped CSS rules. The architecture is designed so that:

1. **Navi wins by default** — the rules that paint and lay a component out are not placed inside `@layer`, so they beat any layered global style. The exception is deliberate and always says so in a comment: a rule navi is happy to hand back sits in `@layer navi` next to the defaults — see [The exception](#the-exception-a-rule-navi-offers-back).
2. **Defaults are easy to override** — default values for CSS variables are declared inside `@layer navi`, which has the lowest possible specificity, making them trivially overridable from outside.
3. **The preferred override surface is component props** — props translate to inline styles or data attributes, not class names.

---

## Where CSS lives: `import.meta.css`

A navi component declares its stylesheet with `import.meta.css`, and the build
**parses that css**. Everything below depends on it staying parseable.

```js
const css = /* css */ `
  .navi_button {
    height: var(--button-height);
  }
`;
import.meta.css = css;
```

The `css` constant may be declared next to the assignment or anywhere in the same
module — the build follows the name to where it is declared. What it cannot
follow is a name coming from **another** module: `import.meta.css = importedCss`
is read only when the constant belongs to the module doing the assignment.

**Keep the assignment in a render, not at module scope.** A component's
stylesheet is adopted when the component first renders, so a page that never
renders it never carries it, and a bundler that sees no caller drops the css
along with the code. `import.meta.css = css` at the top level of a module makes
the sheet a module side effect: it lands on every page importing the module, for
a component that may never appear, and nothing can shake it out.

That is also how a stylesheet shared between components is written — a module of
its own, exposing an install function its callers run from their render:

```js
// input_css.js
const inputCss = /* css */ `
  @layer navi {
    .navi_input {
      /* ... */
    }
  }
`;
// Keyed on this module, so the controls drawn as a .navi_input box share one
// stylesheet instead of each carrying a copy.
export const installInputCss = () => {
  import.meta.css = inputCss;
};
```

```js
// textarea.jsx
import { installInputCss } from "./input_css.js";

export const Textarea = (props) => {
  installInputCss();
  import.meta.css = css; // this component's own css, and nothing else
  // ...
};
```

Note the setter is keyed by module: **two assignments in one module do not add
up**, the second replaces the first. One `import.meta.css` per module — which is
why the shared sheet has to live in a module of its own rather than be
concatenated into the component's.

The exception is a module that is a side effect by design — `navi_css_vars.js`
and the sheets it pulls in are the app's tokens, always needed, and assign at
module scope on purpose.

### `${}` blinds the whole stylesheet

A substitution the build cannot read makes the **entire** template opaque, not
just its line, and the stylesheet then ships verbatim: comments and whitespace
included, nothing transpiled for the browsers the app targets (nesting,
`light-dark()`, `color-mix()` reach them as written), a `url("./icon.svg")`
neither copied nor hashed and resolved against the document — a silent 404 in
production — nothing checked, nothing minified. The build warns about it; a css comment
containing `jsenv-css-opaque` inside the template silences that one template when there
is no way around it.

The one substitution the build reads stands exactly **where a css value
stands** — inside a rule block, after the `:` of a declaration, not in a string,
in `url()`, in a selector, a property name or an at-rule prelude. Everything
else blinds the sheet. So write css without a `${}`: a value the JS knows is a
custom property the css reads (`width: var(--panel-width, 300px)`, set from JS
with `element.style.setProperty`); a selector or attribute name held in a JS
constant is written out literally in the css, the constant staying on the JS
side; a variant is a data attribute with both branches in the css; a repeated
block is a selector list; a shared sheet is a module exposing an install
function, as above.

```js
const SWIPE_AXES_ATTRIBUTE = "data-swipe";

// avoid — the attribute name comes from JS, the whole sheet is opaque
import.meta.css = `[${SWIPE_AXES_ATTRIBUTE}="x"] { touch-action: pan-y; }`;

// prefer — the css is static, JS keeps the constant for setAttribute
import.meta.css = /* css */ `
  [data-swipe="x"] {
    touch-action: pan-y;
  }
`;
element.setAttribute(SWIPE_AXES_ATTRIBUTE, "x");
```

### Beware when moving a shared sheet out

Splitting a chunk out of a template changes **cascade order**: the extracted
sheet is adopted by the install call, which runs before the component's own
assignment, so it now comes _before_ that sheet instead of after it. That matters only when the two carry
the same selector at the same specificity and in the same layer — check for that
before splitting. In navi, `popup_css.js` and `surface_text_css.js` overlap
`.navi_dialog` and `.navi_popover` with dialog's and popover's own css, which is
why they are still concatenated.

### A sheet on the far side of a split

A module reached by `import()` carries its stylesheet in its chunk, adopted
when the chunk runs: a fallback rendered before it cannot use its classes, and
between unlayered sheets the last adopted wins. What follows for code loaded
on demand is in [dynamic_import.md](./dynamic_import.md).

### Browser support: navi's css and your target

**navi does not require recent browsers.** Its css is written with modern
features — css nesting, `light-dark()`, `color-mix()` — and it ships that way:
navi's own build targets a runtime where all of it is native, so what lands in
`dist/` is what was authored, unrewritten.

The runtime that decides is **yours**. An app's build reads navi's stylesheets
out of `node_modules` like any other css and lowers them to the target the app
declares. Targeting Chrome 89, everything above comes out as nesting-free rules
and a pair of custom properties standing in for `light-dark()`; targeting the
default, nothing is touched.

Which is the part worth knowing: **jsenv's default target is recent**, and by
default it assumes the modern form is fine. An app that must support older
browsers says so, once, and both its dev server and its build follow — the
declaration and what each step down costs are in
[jsenv's browser support](https://github.com/jsenv/core/blob/main/docs/users/c_build/c_build.md#21-browser-support).
Nothing in the app's own css has to change either: it is lowered by the same
pass.

One thing is NOT lowered, and it is the trap the section above already names: a
stylesheet the build cannot parse. A `${}` outside a value position makes the
whole template opaque, and an opaque template is shipped verbatim — nesting
included, `light-dark()` included, whatever the target. Such a stylesheet
silently requires the browsers its own css requires, and no declaration can
lower it. That is the strongest reason not to write one.

---

## Layer structure

```
@layer navi {
  /* CSS variable defaults — and, when navi says so, a rule it offers back */
  .navi_button {
    --button-height: 32px;
    --button-padding-x: 12px;
  }
}

/* The rules that paint and lay out — outside any layer */
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

Targeting the same element is not a detail — see [`--navi-*` vs `--component-*`](#--navi--vs---component--where-the-override-has-to-go) below.

### Why actual rules stay outside any layer

Navi components often need to enforce specific values that global resets or utility libraries may clobber — for example `box-sizing: content-box`, `white-space: nowrap`, or `display: inline-flex`. If these rules were inside `@layer navi`, any unlayered global style (e.g. `* { box-sizing: border-box }`) would silently override them, breaking component layout.

By keeping rules outside any layer, Navi wins by default without resorting to `!important`. An app that genuinely needs to change a structural rule should do so through the CSS variable surface, not by overriding the rule directly.

### The exception: a rule navi offers back

Some rules are not structure — they are what navi puts there in the absence of
anything else, and an app (or another navi component) is meant to win over them
plainly. Those go **inside** `@layer navi`, rules and all, and each one carries a
comment naming who is supposed to win:

- `[navi-aspect-ratio]`'s `min-width/min-height` and `.navi_icon`'s `display`
  (`box.jsx`, `text.jsx`), so box.jsx's own unlayered `[navi-box-flow]`
  attributes can still change the display;
- the text properties a surface takes back from its opener
  (`surface_text_css.js`), so an app that wants one of them back says so;
- the `[data-url-target]` mark, the document's `line-height` and
  `font-family`, a Field's spacing and a Label's dimmed color — appearance with
  no structural role;
- `[data-navi-safe-area]`'s padding (`safe_area.js`), which is a suggestion for
  an element the **app** owns.

So the layer is readable from the outside as a statement rather than an
accident:

| In `@layer navi`                                 | Unlayered                        |
| ------------------------------------------------ | -------------------------------- |
| every CSS variable default                       | the rules that paint and lay out |
| a rule navi offers back (commented, on the rule) | navi's own structure             |

Either way an app never has to inflate a selector: a layered rule loses to any
unlayered rule of the app's, and an unlayered one is reached through the
variable that feeds it — `--picker-border-radius` for the picker's corners,
`--navi-control-border-radius` for every control's, both declared in the layer
and both overridable from a single-class rule.

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

#### Two planes: the paper and the frame

An app draws on two planes, and navi names both so that nothing has to invent
the second one:

- **the paper**, `--navi-surface-color`, what content sits on — a control's
  background, a card, a popup;
- **the frame**, `--navi-chrome-color`, what surrounds a screen — a top bar, a
  side menu, a toolbar.

```jsx
<Box background="chrome" />
```

The frame is derived from the paper (a step toward the dark on a light page,
toward the light on a dark one) rather than written as a literal, which is the
whole point: `#f6f7f9` on a bar is a bar that stops being one in dark mode, and
a bar painted in the paper's own color on a page of that color is not a bar, it
is a line. An app that wants another frame sets the one token on `:root`.

#### A surface is a new paper: what reaches a popup from its opener

A popup (`Dialog`, `Popover`, everything built on them) and a callout are
painted in the top layer but live in the DOM subtree of what opened them. For
the cascade they are descendants of that element: every inherited property and
every custom property declared on an ancestor reaches them, the top layer
changing nothing about it. A dark card that writes in white, declared on the
card, is the color a dialog opened from that card starts with.

Navi takes back what it knows a surface needs of its own — declared on the
surface element itself, so it beats whatever an ancestor declared, whatever
the layer (see the table above):

| taken back                                                                                  | where                                                                                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| the ink (`color`)                                                                           | `--navi-popup-color` on `.navi_popover` / `.navi_dialog`; `revert` (the UA's `CanvasText`) on `.navi_callout` |
| text properties that belong to the opener (alignment, transform, shadow, spacing, wrapping) | `surface_text_css.js`, which also says what is deliberately kept                                              |
| the five color keywords `--navi-color-primary/secondary/emphasis/discrete/hint`             | re-declared on each surface in `navi_css_vars.js`                                                             |

Everything else declared on a container is inherited by the popup it opens.
That is the shape of the bug to expect: a token an app pinned on a container
for that container's paper — a background, a border color, a spacing, one of
its own `--app-*` — arriving on a popup that has a different paper. When it
hits, the answers are, in order:

1. the token is about the paper and navi owns it: re-declare it on the surface,
   next to the color keywords;
2. the token is the app's: the app declares it on the popup too
   (`.navi_dialog { --app-thing: … }`, unlayered), or writes it against the ink
   (`currentColor`) so it follows whatever ink the surface writes in.

##### Ink, ratio, paper: the color keywords

`primary` is an absolute (the surface's ink, `--navi-surface-text-color`). The
other four are formulas on `currentColor` — `secondary` is
`color-mix(in srgb, currentColor 80%, transparent)` — so they follow the ink of
whatever writes them: a dark card sets `color: white` and nothing else, and its
secondary is white at 80%. Which is also what lets a surface re-declare the
same formulas and have them come out right: on a popup writing in black, they
mix black.

The share of ink in each is a token: `--navi-color-secondary-mix` (80%),
`--navi-color-emphasis-mix` (50%), `--navi-color-discrete-mix` (60%),
`--navi-color-hint-mix` (25%). A theme that wants a fainter secondary sets the
ratio on `:root`, and the page and its popups agree:

```css
:root {
  --navi-color-secondary-mix: 70%;
}
```

The ratio is a `:root` knob only, and this is the trap to know about. A `var()`
inside a custom property is substituted where **that** property is declared,
not where it is read: `--navi-color-secondary` is declared on `:root` (and on
each surface), so the `80%` is baked in there and a card inherits the
already-mixed formula. A ratio set on a container changes nothing for the
container's own text — and it _is_ read by the next surface opened from it,
which re-declares the formula and resolves the `var()` against the inherited
ratio:

```css
.card {
  /* ❌ the card stays at 80%; the dialog it opens goes to 88% */
  --navi-color-secondary-mix: 88%;
  /* ✅ the card's paper — stops at the next surface */
  --navi-color-secondary: rgb(255 255 255 / 88%);
}
```

So a theme is a number on `:root`; a paper is a color, pinned on the container,
and it stops at the surface. What must not be done to make container ratios
work is declaring the formulas on `*` so they resolve on every element: the
pinned keyword above would then be overwritten on each of the card's children,
and a paper could no longer say anything.

#### An app narrower than the screen

A dialog lives in the browser's top layer and is calibrated on the viewport, so
an app that is a column in a wide window states its own screen once, on `:root`,
with `--navi-app-max-width` — and never caps popups through
`--dialog-max-width`, a `--component-*` token the pickers already write
themselves. The whole of it, placement included, is in
[safe_area.md](./safe_area.md#an-app-that-is-narrower-than-the-window).

### 3. Direct rule override (avoid unless necessary)

Overriding the actual CSS rules (not the variables) is intentionally hard — that is by design. If you find yourself needing to do this, it usually means a CSS variable should be exposed for that property. Open an issue or add the variable yourself and contribute it back.

---

## Counting children: what navi puts in your tree

Some of what navi shows is rendered inside the tree you wrote. A popup renders
in its opener's own subtree, so a `Dialog` or `Popover` written next to the
button that opens it is a sibling of that button. A callout — the speech bubble
a control pops to explain itself — is mounted on what it explains, or beside it
when that element cannot hold it (a `<button>`, an `<input>`, anything inside a
`<label>`). This is deliberate: they inherit your fonts, your colors, your
custom properties, and they leave with the screen that opened them.

None of them draws in the flow. They are `position: fixed`/`absolute`, most of
them in the top layer: no grid track, no flex item, no line box, no gap. They
move nothing.

**But they are element children, and structural selectors count element
children.** `:last-child`, `:first-child`, `:nth-child`, `:nth-last-child`,
`:only-child`, `:empty`, `> * + *` look at the element tree — never at
`display`, `position`, or the top layer, and CSS offers no exception for
out-of-flow elements. So a rule of yours that depends on the number or the
order of children stops matching for exactly as long as a popup or a callout is
open:

```css
/* three cells in a two-column grid, the odd last one spanning both */
.grid > .cell:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
```

Press the third cell, its callout opens, and the cell is no longer the last
child: it loses the span and halves. Close the callout and it comes back. The
grid reserved nothing — the rule simply stopped matching. What makes this one
nasty is that it is invisible from the app: the CSS is right, the JSX is right,
and the trap only springs on an interaction, after the layout was reviewed.

### Say which children the rule means

A counting pseudo-class takes what to count: `:nth-child(An+B of S)` and
`:nth-last-child(An+B of S)` walk only the children matching `S`, so name your
own — either by what they are, or by what navi's out-of-flow elements all carry
(`navi-out-of-flow`, the same marker navi's own `Group` reads):

```css
.grid > .cell:nth-last-child(1 of .cell):nth-child(odd of .cell) {
  grid-column: 1 / -1;
}
```

`:last-child` and `:first-child` take no such argument — spell them
`:nth-last-child(1 of S)` and `:nth-child(1 of S)` when you need one. A sibling
combinator is the other shape, and there the marker goes between the compounds:

```css
.stack > *:not([navi-out-of-flow]) + *:not([navi-out-of-flow]) {
  margin-block-start: 8px;
}
```

The third way is to stop asking a structural question at all: put a class on the
cell you mean and style that. It is the most robust of the three — it survives
anything else landing in that container later.

In dev, navi warns when opening a callout moves the element it is anchored on,
or that element's container: a callout has no layout box, so anything moving
means a rule like the one above just changed subject. The warning names both
elements and the boxes before and after.

---

## Summary

| What you want to change                                       | How to do it                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| One component instance                                        | Component prop or `style` attribute                                                                                            |
| All instances of a component                                  | `--component-*` in unlayered app CSS, on a selector matching the component                                                     |
| A global design token                                         | `--navi-*` on `:root`                                                                                                          |
| The share of ink in `secondary`/`emphasis`/`discrete`/`hint`  | `--navi-color-*-mix` on `:root` — never on a container                                                                         |
| A container's own paper (a dark card)                         | `color` on the container, plus a `--navi-color-*` keyword pinned if its formula reads wrong there; both stop at the next popup |
| How wide popups may ever get                                  | `--navi-app-max-width` on `:root`                                                                                              |
| A structural layout rule                                      | Expose a new CSS variable (contribute)                                                                                         |
| A rule counting children of a container holding navi controls | `:nth-child(… of S)`, `:not([navi-out-of-flow])`, or a class — a popup or a callout is a child too                             |
| What a variant decided                                        | A prop — a variant only ever moves defaults, so props keep winning                                                             |
