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

One line, and nothing names a component:

```css
:root {
  --navi-app-max-width: 600px;
}
```

The bands fall out of it (centered), `--navi-app-width` follows, and `FixedBar`
pins itself to the column's edges rather than the glass. An app wanting them
uneven writes `--navi-app-inset-left` / `-right` directly instead.

Do **not** get this by mounting empty `FixedBar area="left"/"right"`: they would
reserve the room, but the app's rectangle would still be the whole window, so
dialogs and popovers would keep sizing themselves against 1500px.

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
in the common case.

Beware of making that container scrollable by accident — see
`MOBILE_LAYOUT_PITFALLS.md`.

### Reading it yourself

`var(--navi-safe-area-inset-bottom)` in any rule. It is always declared, whether
or not the app ever mounts a bar.

Reading it from **JS** takes a probe: an unregistered custom property keeps its
`calc()` unresolved through `getComputedStyle`. Give a hidden box
`height: var(--navi-safe-area-inset-bottom)` and measure it — see
`src/layout/demos/fixed_bar/keyboard.html`.

### Putting something new into it

Publish what you take on one edge, into that edge's slot. That is the whole
contract — a native banner, an OS strip, anything an app invents joins the sum
without a single component learning it exists. `FixedBar` is the worked example:
it measures its own border box (notch included) and writes
`--navi-fixed-bar-space-*` (`src/layout/fixed_bar/fixed_bar_space.js`).

## What already reads it

Pointers, not a list to keep in sync — grep `--navi-safe-area-inset` for the
truth:

- `FixedBar` pins itself to `--navi-app-inset-*`.
- `List` offsets its sticky group labels when `scroller="document"`, so a label
  comes to rest in front of the bar and not behind it.
- `RouteTravel` clips the pictures of a travel to the safe area. It has to: a
  view transition paints in the top layer, where no `overflow` of the document
  reaches it, and the box pages travel in runs _under_ the bars by design — so
  a page scrolled by one pixel would be watched painting over them.

## The trap: which viewport

Three heights are in play and they are not the same one.

| what                             | shrinks when the keyboard opens |
| -------------------------------- | ------------------------------- |
| `window.innerHeight` / `100dvh`  | no                              |
| `visualViewport.height`          | yes                             |
| `--navi-vvh` (tracks the visual) | yes                             |

`position: fixed` — so every `FixedBar` — is laid out against the **layout**
viewport. A bottom bar therefore stays at the bottom of a window the keyboard is
covering: it ends up _behind_ the keyboard, and no inset says so, because
nothing reduced the layout viewport.

The consequence for anything measuring against the insets: mix the two families
and you get a drift that only appears with a keyboard open. `getBoundingClientRect`
is in layout-viewport coordinates, so what is compared to it must be too
(`100dvh`), while `--navi-app-*` derives from `--navi-vvh` because what navi
_sizes_ must fit what is actually visible.

`src/layout/demos/fixed_bar/keyboard.html` puts all of these on screen at once
and turns the bottom bar's number red when it goes under the keyboard. On a
phone; a desktop has no keyboard to open.

## Current limitation

Popup **placement** does not follow level 1 yet: `pickPositionRelativeTo` (in
`@jsenv/dom`) still computes against the real viewport. Invisible for anything
centered on its cross axis — which is what a dialog does nearly always — but a
`positionArea` like `bottom-start` or a `SidePanel` sits against the window's
edge rather than the app column's. See "Current limitations" in
`css_architecture.md`.
