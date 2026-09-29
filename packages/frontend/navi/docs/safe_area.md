# The safe area: where the app is, and what covers it

An app is rarely given the whole window. A bar is pinned over it, the device
eats a corner, the app itself pretends to be a phone inside a desktop window.
Every component that must stay clear of all that would otherwise have to learn
what "all that" is — and each one would learn a different subset.

So navi publishes it, once, as CSS variables on `<html>`. Whoever reduces the
visible region says so; whoever must avoid it reads the sum and never learns
what is covering it.

## The two levels

There are two rectangles, and confusing them is the mistake this file exists to
prevent.

```
┌────────────────────── window ───────────────────────┐
│      │                                     │        │
│ band │ ┌───────── FixedBar top ─────────┐  │  band  │  ← --navi-app-inset-*
│      │ ├────────────────────────────────┤  │        │
│      │ │                                │  │        │
│      │ │       the safe area            │  │        │  ← --navi-safe-area-inset-*
│      │ │                                │  │        │
│      │ └──────── FixedBar bottom ───────┘  │        │
└─────────────────────────────────────────────────────┘
```

**`--navi-app-inset-{top,right,bottom,left}`** — from the window's edges to the
app's own rectangle. What is _pinned to an edge_ is pinned to this.

**`--navi-safe-area-inset-{top,right,bottom,left}`** — from the window's edges
to the band left free _inside_ that rectangle. What _flows, scrolls or gets
painted_ keeps to this.

Two and not one, because a fixed bar is one of the things that reduce the free
band: placed against the band it contributes to, it would push itself off its
own edge. What is anchored and what is anchored-inside cannot be the same
number.

Level 2 is level 1 plus everything on that edge:

```css
--navi-safe-area-inset-top: calc(
  var(--navi-app-inset-top) +
    max(env(safe-area-inset-top), var(--navi-fixed-bar-space-top))
);
```

`max()` and not a sum between the notch and the bars: a bar pinned to an edge
already reaches under the notch and counts it in its own height, so adding both
would reserve it twice.

Declared in `src/layout/safe_area.js`.

## Using it

### An app that is narrower than the window

An app that never spans the whole window — a phone-shaped column centered in a
wide one, bands on the sides — has one problem with popups: a dialog lives in
the browser's top layer, so it is calibrated on the _viewport_, and would paint
1500px of modal over a 600px app. Popups must not need to be told, or the app
would have to know which components exist.

So the app states its own screen once, and never names a component:

```css
:root {
  --navi-app-max-width: 600px;
  /* --navi-app-max-height too, for an app that also caps its height */
}
```

The bands fall out of it (centered), `--navi-app-width` follows, and `FixedBar`
pins itself to the column's edges rather than the glass. An app wanting them
uneven writes `--navi-app-inset-left` / `-right` directly instead; everything
below follows those the same way.

Every popup follows — `Dialog`, `Popover`, and everything built on them
(`Picker`, `Select`…) — as a ceiling and nothing more: on a screen narrower
than the app it never binds. A `Dialog` keeps its `marginWithContainer` inside
that screen, and its default gap is a share of the app's screen, not of the
window (see
[dialog_shape.md](./dialog_shape.md#marginwithcontainer-decides-the-gap-and-the-ceiling));
a `Popover` is capped at 95% of it. Placement uses the same rectangle: a dialog
centers on the app column, and anything anchored to an edge (a `positionArea`
like `bottom-start`, a `SidePanel`) sits flush with the column's edge rather
than the window's.

Two ways NOT to get this: empty `FixedBar area="left"/"right"` reserve the
room, but the app's rectangle stays the whole window and popups keep sizing
themselves against it; and `--dialog-max-width` set from the app is a
`--component-*` token every dialog resets on itself (a `maxWidth` prop writes it
inline), so the cap silently disappears — see
[css_architecture.md](./css_architecture.md#--navi--vs---component--where-the-override-has-to-go).
`--navi-app-max-width` feeds the hard ceiling _under_ that knob, so a popup that
genuinely needs its own `maxWidth` can still say so without escaping the app's
screen.

### Something that scrolls under the furniture

Mark it, and it gets both paddings:

```html
<div id="main" data-navi-safe-area>…</div>
```

Two distinct things must be given back, and forgetting the second is the classic
bug — `padding`, or the last screenful stays unreachable under the bar; and
`scroll-padding`, or everything the browser scrolls _to_ (an anchor,
`scrollIntoView()`, a field taking focus, a restored position) lands _behind_ it.
The padding does not help there: it moves the content, not the place the browser
brings its target to.

Which element scrolls is the app's business, so navi never picks one. `:root`
gets the `scroll-padding` unconditionally, since the document is the scrollport
in the common case — and, while nothing is marked, the keyboard's room at its
end (see below).

Beware of making that container a scroller by accident — see
[A document wider than the screen](#a-document-wider-than-the-screen).

### Reading it yourself

`var(--navi-safe-area-inset-bottom)` in any rule. It is always declared, whether
or not the app ever mounts a bar.

From **JS**, both levels are registered as lengths (`@property`), so
`getComputedStyle(document.documentElement).getPropertyValue("--navi-safe-area-inset-bottom")`
gives pixels, and so does `--navi-app-inset-*`.

### Putting something new into it

Level 2 has one slot per edge, `--navi-fixed-bar-space-*`, and it belongs to
`FixedBar`: each bar measures its own border box (notch included), and navi
writes the largest one on that edge inline on `<html>`.

Something else taking an edge — a native banner, an OS strip — is published by
being drawn as a `FixedBar`; every component reading the safe area then clears
it without learning it exists. Writing the slot by hand holds only while no bar
takes that edge: the first bar mounting there replaces the value rather than
adding to it.

## The trap: which viewport

Three heights are in play and they are not the same one — and which of them
the keyboard moves depends on the browser.

| what                             | shrinks when the keyboard opens                 |
| -------------------------------- | ----------------------------------------------- |
| `window.innerHeight` / `100dvh`  | no                                              |
| `visualViewport.height`          | yes, except where the keyboard overlays (below) |
| `--navi-vvh` (tracks the visual) | same as `visualViewport.height`                 |

By default the keyboard shrinks the visual viewport, on every browser, and
`--navi-keyboard-inset-bottom` stays 0. Where the browser has the VirtualKeyboard
API (Chromium), an app can call `enableVirtualKeyboardOverlay()` to make the
keyboard overlay the page instead: no viewport shrinks, and the keyboard arrives
as `--navi-keyboard-inset-bottom` (`env(keyboard-inset-height)`), which
`--navi-app-inset-bottom` adds. Either way `--navi-app-height` and the popup
ceilings answer the part of the screen left visible.

An overlaying keyboard is one the browser no longer scrolls the focused field
out from under, so navi does: when the keyboard rises or resizes, and when focus
moves to another field with the keyboard up, a focused field that is not fully
inside the document's `scroll-padding` box is centered in it.
`scroll-padding-bottom` also adds `--navi-keyboard-strip-allowance`, for the
suggestion strip Chrome paints above the keyboard and no inset counts. The room
to scroll into comes from the marked element's `padding-bottom`, or, on a page
that marked nothing, from a block navi adds at the end of the document while
the keyboard is up.

`position: fixed` — so every `FixedBar` — is laid out against the **layout**
viewport. Where the visual viewport is what shrinks, a bottom bar therefore
stays at the bottom of a window the keyboard is covering: it ends up _behind_
the keyboard, and no inset says so, because nothing reduced the layout viewport.
Where the keyboard overlays, the bar is pinned to `--navi-app-inset-bottom`,
which counts it, and sits above it.

The consequence for anything measuring against the insets: mix the two families
and you get a drift that only appears with a keyboard open. `getBoundingClientRect`
is in layout-viewport coordinates, so what is compared to it must be too
(`100dvh`), while `--navi-app-*` derives from `--navi-vvh` (plus the keyboard
inset) because what navi _sizes_ must fit what is actually visible.

`src/layout/demos/fixed_bar/keyboard.html` puts all of these on screen at once
and turns the bottom bar's number red when it goes under the keyboard. On a
phone; a desktop has no keyboard to open.

## A document wider than the screen

On Chrome Android, **anything that makes the document overflow horizontally
inflates the layout viewport** to the size of the content: a 2000px-wide grid
on a 412px phone takes `window.innerWidth` and `innerHeight` to about four times
the screen, while `visualViewport.width` still says 412. The document grows a
large empty area below the real content, and what is centered in the layout
viewport — a `<dialog>`'s `position: fixed; margin: auto` — lands far below the
visible area, miscentered or out of sight.

So the document itself never overflows in x. Wrap the app in a box that clips,
and clip `html` and `body` as a net for anything that escapes the wrapper:

```html
<body>
  <div style="overflow-x: clip">
    <!-- all app content goes here -->
  </div>
</body>
```

```css
html,
body {
  overflow-x: clip;
}
```

What it costs: content wider than the screen is cut off instead of reachable by
dragging. An element that genuinely needs to scroll horizontally (a wide table,
a carousel) gets its own `overflow-x: auto` — the wrapper stays `clip`.

**`clip`, never `auto`, `hidden` or `scroll`.** `clip` is the only value that
clips without turning the box into a scroll container (and it leaves
`overflow-y` at `visible`, where the others force it to `auto`). A wrapper that
scrolls, even by accident, takes every `position: sticky` in the app with it:
sticky resolves against the nearest scroll container, and this one grows with
its content and never scrolls, so sticky headers and `<List groupBy>` labels
scroll away with the content. Worse, a sticky element sticks within its scroll
container's box shrunk by that container's `scroll-padding`: a wrapper carrying
`data-navi-safe-area` has `scroll-padding-top: var(--navi-safe-area-inset-top)`,
so the labels come to rest that far below the bar, covering the content above
them.

**The wrapper is a net, not a fix.** Clipping makes the symptom disappear, and
with it the signal: something wider than the screen — a width in px, a
`min-width`, a grid of fixed columns, an unbreakable string coming from the
data — is still a layout bug. In dev, ask who overflows:

```js
import { detectHorizontalOverflow } from "@jsenv/navi";

if (import.meta.dev) {
  detectHorizontalOverflow({ root: document.querySelector("#main") });
}
```

It outlines the culprits in red and names them in the console, at load and
whenever the layout changes. It reports the **outermost** box that sticks out
(its children stick out because it does), and stays quiet about what cannot
reach the document: anything inside a box that scrolls or clips on its own — a
wide table in its own `overflow-x: auto` container is doing the right thing —
and anything `position: fixed` or in the top layer.
