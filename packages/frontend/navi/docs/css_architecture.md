# Navi CSS Architecture

Navi components are styled through CSS custom properties and scoped rules. The
rules that paint and lay a component out are unlayered, so **navi wins by
default**; the defaults those rules read sit in `@layer navi`, so **any
unlayered app rule beats them** without `!important`; and the preferred
override surface is a **component prop**.

- [Where CSS lives: `import.meta.css`](#where-css-lives-importmetacss)
  - [`${}` blinds the whole stylesheet](#-blinds-the-whole-stylesheet)
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

The build reads the css where it is written: **an inline template, or a
`const` declared at the top level of the module doing the assignment.** It
follows nothing else — not a `let`, not a name imported from another module,
and not a `const` declared inside the component next to an assignment made in
render: that one ships unparsed, and without a warning.

**Keep the assignment in a render, not at module scope.** The sheet is adopted
when the assignment runs: from a render, a page that never renders the
component never carries it, and a bundler that sees no caller drops the css
along with the code; at module scope, it lands on every page importing the
module, and nothing can shake it out. Assign at module scope only for a module
that is a side effect by design — an app's tokens, say.

The setter is keyed by module: **two assignments in one module do not add up**,
the second replaces the first. A stylesheet shared between components is
therefore a module of its own, exposing an install function its callers run
from their render:

```js
// input_css.js
const inputCss = /* css */ `
  @layer navi {
    .navi_input {
      /* ... */
    }
  }
`;
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

Extracting a shared sheet changes **cascade order**: the install call runs
before the component's own assignment, so the extracted rules come _before_ the
component's sheet rather than where they were written. That matters only for
the same selector at the same specificity in the same layer — check for that
before splitting.

A module reached by `import()` carries its sheet in its chunk, adopted when the
chunk runs: see
[dynamic_import.md](./dynamic_import.md#importmetacss-on-the-far-side-of-a-split).

### `${}` blinds the whole stylesheet

A substitution the build cannot read makes the **entire** template opaque, not
just its line, and the stylesheet then ships verbatim: comments and whitespace
included, nothing lowered for the browsers the app targets, a
`url("./icon.svg")` neither copied nor hashed and resolved against the
document — a silent 404 in production — nothing checked, nothing minified.

The one substitution the build reads stands exactly **where a css value
stands**: inside a rule block, after the `:` of a declaration — not in a
string, in `url()`, in an at-rule prelude, in a selector or a property name —
and it must come out of the build's css transformation exactly once (a
declaration duplicated under a vendor prefix makes it twice). Anything else
ships the template as written, and the build warns
(`import.meta.css shipped as written`, naming the file and the `${}`). When
there is genuinely no way around it, a css comment containing
`jsenv-css-opaque` inside the template silences that one template — keep it
short: an opaque template ships its comments.

So write css without a `${}`:

- a value the JS knows → a custom property the css reads
  (`width: var(--panel-width, 300px)`), set with `element.style.setProperty`;
- a class or attribute name held in a JS constant → written out literally in
  the css, the constant staying on the JS side; a name you did not want to
  repeat → css nesting (`&[data-loading]`);
- a variant → a data attribute, both branches written out in the css;
- an asset → a literal `url()`, which the build follows, copies and versions (a
  truly dynamic url goes in a custom property);
- a block of declarations repeated in several rules → a selector list;
- a sheet shared between modules → a module exposing an install function, as
  above.

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

### Browser support: navi's css and your target

navi's css is written for current browsers — css nesting, `light-dark()`,
`color-mix()` on `currentColor` — and `dist/` ships it as authored, built for
Chrome 123.

An app built with jsenv reads navi's stylesheets like its own and lowers them
to the target it declares. jsenv's default target is recent and touches
nothing; an app that must support older browsers says so once, and both its
dev server and its build follow — the declaration and what each step down
costs are in
[jsenv's browser support](https://github.com/jsenv/core/blob/main/docs/users/c_build/c_build.md#21-browser-support).
Most of navi's css then comes out lowered, not all of it:

- the `color-mix()` formulas built on `currentColor` or a `var()` are kept as
  written — the color keywords and the hover, read-only and disabled shades
  are made of them — and a browser without `color-mix()` drops them;
- a few of navi's stylesheets (`Dialog`'s, `Popover`'s, the callout's) are
  opaque templates, shipped as written: they need native nesting;
- a lowered `light-dark()` is a switch keyed on `prefers-color-scheme`: navi's
  tokens, resolved on `:root`, no longer follow a `color-scheme` set on one
  element (the dark panel a `Wheel` relies on).

Under another bundler nothing is lowered: the css runs as navi's own build
wrote it.

The same holds for the app's own sheets, with one hard stop: **an opaque
template is never lowered**, whatever the target. It silently requires the
browsers its own css requires, and no declaration can change that — the
strongest reason not to write a `${}`.

---

## Layer structure

```
@layer navi {
  /* CSS variable defaults — and, when navi says so, a rule it offers back */
  .navi_thing {
    --thing-border-radius: var(--navi-control-border-radius);
  }
}

/* The rules that paint and lay out — outside any layer */
.navi_thing {
  box-sizing: border-box;
  border-radius: var(--thing-border-radius);
}
```

### Why defaults go inside `@layer navi`

Cascade layers are ordered below unlayered styles: anything declared in
`@layer navi` is beaten by any unlayered rule from the page or a design system,
without `!important`, as long as that rule targets the element the default was
declared on:

```css
/* App CSS — no layer needed, automatically wins over @layer navi */
.navi_button {
  --button-font-size: 16px;
}
```

Targeting the same element is not a detail — see
[`--navi-*` vs `--component-*`](#--navi--vs---component--where-the-override-has-to-go)
below.

### Why actual rules stay outside any layer

A component enforces values that global resets and utility libraries clobber —
`box-sizing: content-box`, `white-space: nowrap`, `display: inline-flex`.
Inside `@layer navi`, any unlayered global style
(`* { box-sizing: border-box }`) would silently override them and break the
layout. Unlayered, navi wins by default without `!important`; an app that needs
to change a structural rule does it through the CSS variable that feeds it, not
by overriding the rule.

### The exception: a rule navi offers back

Some rules are not structure: they are what navi puts there when nothing else
says anything, and an app (or another navi component) is meant to win over them
plainly. Those go **inside** `@layer navi`, rules and all, and each carries a
comment naming who is supposed to win — `[data-navi-safe-area]`'s padding, a
suggestion for an element the **app** owns; a button's `display`, font and
line, so an app's own button typography wins without going through the
`--button-*` variables.

| In `@layer navi`                                 | Unlayered                        |
| ------------------------------------------------ | -------------------------------- |
| every CSS variable default                       | the rules that paint and lay out |
| a rule navi offers back (commented, on the rule) | navi's own structure             |

Either way an app never has to inflate a selector: a layered rule loses to any
unlayered rule of the app's, and an unlayered one is reached through the
variable that feeds it (`--picker-border-radius` for a picker's corners,
`--navi-control-border-radius` for every control's).

---

## Override surfaces

### 1. Component props (preferred)

Props are the primary way to customize appearance. They translate to an inline
`style`, which outranks any selector, or to a `data-*` attribute navi's own
rules read (an attribute selector weighs what a class does).

```jsx
// Size and color via props
<Button size="l" color="secondary" />

// Custom CSS variable via style prop
<Button style={{ "--button-font-size": "18px" }} />
```

A variant (`icon`, `discrete`, `bare`, `border`, `headless`…) describes what
the caller did not say: it only moves defaults, so a prop given next to it
always wins.

### 2. CSS variables (for global or theme-level changes)

When the same change applies to many components (e.g. a design token update),
set the variable at a higher scope:

```css
/* Override Navi's default at the page or theme level */
:root {
  --navi-s: 6px; /* spacing token */
}
```

Navi's `--navi-*` defaults are themselves declared on `:root` inside
`@layer navi`, so this unlayered `:root` rule targets the same element and wins
automatically.

How wide popups may ever get is the app's own screen, stated once on `:root`
with `--navi-app-max-width` — never `--dialog-max-width`, a `--component-*`
token every dialog resets on itself: see
[safe_area.md](./safe_area.md#an-app-that-is-narrower-than-the-window).

#### `--navi-*` vs `--component-*`: where the override has to go

The two families are **not** interchangeable, and layers have nothing to do
with it:

| Token           | Declared on             | Overridable from `:root`?                                                    |
| --------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `--navi-*`      | `:root` (`@layer navi`) | Yes — but the five color keywords stop at each popup and callout (see below) |
| `--component-*` | `.navi_<component>`     | **No** — must match the element                                              |

For a custom property, a declaration made **on the element itself** always
beats the same property **inherited** from an ancestor. The cascade
(specificity, layers, `!important`) only arbitrates between declarations
targeting the same element — it never lets an ancestor win over the element's
own declaration.

So this does nothing, because `.navi_link` declares `--link-color-pressed` on
itself:

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

Scoping to an ancestor is not enough: `.my-sidebar { --link-color-pressed: blue }`
fails for the same reason `:root` does. The selector has to reach the link
element itself.

When a component default deserves to be themed globally, promote it: declare a
`--navi-<component>-<thing>` in [navi_css_vars.js](../src/navi_css_vars.js) and
make the component default read `var(--navi-…)`.

#### Two planes: the paper and the frame

The frame around a screen — a top bar, a side menu, a toolbar:
`--navi-chrome-color`, `<Box background="chrome" />` — is derived from the
paper content sits on (`--navi-surface-color`), never written as a literal: a
literal on a bar stops being a bar in dark mode. An app that wants another
frame sets the one token on `:root`.

#### A surface is a new paper: what reaches a popup from its opener

A popup (`Dialog`, `Popover`, everything built on them) and a callout are
painted in the top layer but live in the DOM subtree of what opened them — on
purpose: they inherit the opener's fonts, colors and custom properties, and
they leave with the screen that opened them. For the cascade they are
descendants of that element, the top layer changing nothing about it: a dark
card that writes in white, declared on the card, is the color a dialog opened
from that card starts with.

Navi takes back what it knows a surface needs of its own — declared on the
surface element itself, so it beats whatever an ancestor declared, whatever
the layer:

| taken back                                                                                  | how                                                                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| the ink (`color`)                                                                           | `--navi-popup-color` on a popup; the UA's `CanvasText` on a callout                  |
| text properties that belong to the opener (alignment, transform, shadow, spacing, wrapping) | reset in `@layer navi`, so an app that wants one of them back says so on the surface |
| the five color keywords `--navi-color-primary/secondary/emphasis/discrete/hint`             | re-declared on each surface, so a `:root` value of one stops there                   |

Everything else declared on a container reaches the popup it opens. That is the
shape of the bug to expect: a token an app pinned on a container for that
container's paper — a background, a border color, a spacing, one of its own
`--app-*` — arriving on a popup that has a different paper. The answers, in
order:

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

The ratio is a `:root` knob only. A `var()` inside a custom property is
substituted where **that** property is declared, not where it is read:
`--navi-color-secondary` is declared on `:root` (and on each surface), so the
`80%` is baked in there and a card inherits the already-mixed formula. A ratio
set on a container changes nothing for the container's own text — and it _is_
read by the next surface opened from it, which re-declares the formula and
resolves the `var()` against the inherited ratio:

```css
.card {
  /* ❌ the card stays at 80%; the dialog it opens goes to 88% */
  --navi-color-secondary-mix: 88%;
  /* ✅ the card's paper — stops at the next surface */
  --navi-color-secondary: rgb(255 255 255 / 88%);
}
```

So a theme is a number on `:root`; a paper is a color, pinned on the container,
and it stops at the surface. Declaring the formulas on `*` to make container
ratios work is the thing not to do: it would overwrite the pinned keyword on
each of the card's children, and a paper could no longer say anything.

### 3. Direct rule override (avoid unless necessary)

Overriding the actual CSS rules (not the variables) is intentionally hard. If
you find yourself needing to, a CSS variable should usually be exposed for that
property: open an issue, or add the variable and contribute it back.

---

## Counting children: what navi puts in your tree

Some of what navi shows is rendered inside the tree you wrote (see
[A surface is a new paper](#a-surface-is-a-new-paper-what-reaches-a-popup-from-its-opener)):
a `Dialog` or `Popover` written next to the button that opens it is a sibling
of that button, and a callout — the speech bubble a control pops to explain
itself — is mounted on what it explains, or beside it when that element cannot
hold it (a `<button>`, an `<input>`, anything inside a `<label>`).

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
child: it loses the span and halves. Close the callout and it comes back.

### Say which children the rule means

A counting pseudo-class takes what to count: `:nth-child(An+B of S)` and
`:nth-last-child(An+B of S)` walk only the children matching `S`, so name your
own — either by what they are, or by what navi's out-of-flow elements all carry
(`navi-out-of-flow`, the same marker navi's own [`Group`](./group.md) reads):

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

| What you want to change                                       | How to do it                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| One component instance                                        | Component prop or `style` attribute                                                                |
| All instances of a component                                  | `--component-*` in unlayered app CSS, on a selector matching the component                         |
| A global design token                                         | `--navi-*` on `:root`                                                                              |
| The share of ink in `secondary`/`emphasis`/`discrete`/`hint`  | `--navi-color-*-mix` on `:root` — never on a container                                             |
| A container's own paper (a dark card)                         | `color` on it, plus a keyword pinned if its formula reads wrong; both stop at the next popup       |
| How wide popups may ever get                                  | `--navi-app-max-width` on `:root`                                                                  |
| A structural layout rule                                      | Expose a new CSS variable (contribute)                                                             |
| A rule counting children of a container holding navi controls | `:nth-child(… of S)`, `:not([navi-out-of-flow])`, or a class — a popup or a callout is a child too |
| What a variant decided                                        | A prop — a variant only ever moves defaults, so props keep winning                                 |
