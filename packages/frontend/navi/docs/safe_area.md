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

The bands fall out of it (centered), `--navi-app-width` follows, and `FixedBar`
pins itself to the column's edges rather than the glass. An app wanting them
uneven writes `--navi-app-inset-left` / `-right` directly instead; everything
below follows those the same way, popup placement included.

Every popup follows: `Dialog`, `Popover`, and everything built on them
(`Picker`, `Select`…). It is a ceiling and nothing more — on a screen narrower
than the app it never binds, and each popup still subtracts its own
`marginWithContainer` from it, so the gap with the edges is kept either way.
That gap is itself a share of the app's screen, not of the window (`"3appw"`,
navi's own unit alongside `vvw`/`vvh`) — otherwise a 3% margin measured on a
1500px window would eat 90px out of a 600px app.

Two ways NOT to get this:

- mounting empty `FixedBar area="left"/"right"`: they would reserve the room,
  but the app's rectangle would still be the whole window, so dialogs and
  popovers would keep sizing themselves against 1500px;
- setting `--dialog-max-width` on `.navi_dialog` from the app. It is a
  `--component-*` token, declared on the element (see
  [css_architecture.md](./css_architecture.md#--navi--vs---component--where-the-override-has-to-go)):
  every dialog resets it on itself in an unlayered rule, so that a nested
  dialog does not inherit its parent's size, and a `maxWidth` prop writes it
  inline (a `Picker` under `dialogSizeFromAnchor` does) — an app rule of the
  same specificity does not reliably win, and the cap silently disappears. It
  is also the knob a single popup uses to ask for a specific size, not a
  ceiling:
  `--navi-app-max-width` feeds `--dialog-maxmax-width`, the hard ceiling _under_
  that knob, so a popup that genuinely needs its own `maxWidth` can still say
  so without escaping the app's screen.

An app can also get all of it by rendering itself in an iframe of the target
width: the viewport then genuinely _is_ the app's screen and no token is needed.
`--navi-app-max-width` is the answer for an app that does not want to pay that
price.

#### Placement follows the same rectangle

The app's rectangle moves where a popup is placed, not only how big it may
get. Placement is computed against the visual viewport narrowed to the level-1
bands: `getAppInsets` (`src/layout/responsive.js`) reads `--navi-app-inset-*`
back off the computed style — the bands `--navi-app-max-width` centers and the
ones an app writes by hand alike, in any length unit — navi hands them to
`@jsenv/dom` once (`setPlacementViewportInsets`, wired in
`navi_css_vars.js`), and `pickPositionRelativeTo` reads them on every
placement. With centered bands it is invisible for anything centered on its
cross axis — `center`, `bottom`, `top`, which is what a dialog does nearly
always — and with uneven ones it is what centers that dialog on the app column
rather than on the window. Either way it is what puts anything anchored to an
edge (a `positionArea` like `bottom-start`, a `SidePanel`) flush against the
app column's edge rather than the window's.
`FixedBar` reads the same description through CSS instead: it is pinned to
`--navi-app-inset-*`, which says where the app's rectangle is in the window
rather than how wide it may be.

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
[mobile_layout_pitfalls.md](./mobile_layout_pitfalls.md).

### Reading it yourself

`var(--navi-safe-area-inset-bottom)` in any rule. It is always declared, whether
or not the app ever mounts a bar.

From **JS**, both levels are registered as lengths (`@property`, in
`safe_area.js`), so
`getComputedStyle(document.documentElement).getPropertyValue("--navi-safe-area-inset-bottom")`
gives pixels, and so does `--navi-app-inset-*`.

### Putting something new into it

Level 2 has one slot per edge, `--navi-fixed-bar-space-*`, and it belongs to
`FixedBar`: each bar measures its own border box (notch included), and navi
writes the largest one on that edge inline on `<html>`
(`src/layout/fixed_bar/fixed_bar_space.js`). The slot is combined with
`env(safe-area-inset-*)` through `max()`, not added to it, since a bar measured
with its notch already covers the notch.

Something else taking an edge — a native banner, an OS strip — is published by
being drawn as a `FixedBar`; every component reading the safe area then clears
it without learning it exists. Writing the slot by hand holds only while no bar
takes that edge: the first bar mounting there replaces the value rather than
adding to it.

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

Three heights are in play and they are not the same one — and which of them
the keyboard moves depends on the browser.

| what                             | shrinks when the keyboard opens                 |
| -------------------------------- | ----------------------------------------------- |
| `window.innerHeight` / `100dvh`  | no                                              |
| `visualViewport.height`          | yes, except where the keyboard overlays (below) |
| `--navi-vvh` (tracks the visual) | same as `visualViewport.height`                 |

Wherever the browser has the VirtualKeyboard API (Chromium), navi makes the
keyboard overlay the page rather than shrink it (`src/layout/virtual_keyboard.js`):
no viewport shrinks, and the keyboard arrives as `--navi-keyboard-inset-bottom`
(`env(keyboard-inset-height)`), which `--navi-app-inset-bottom` adds. Firefox,
Safari, and an app that called `disableVirtualKeyboardOverlay()` shrink the
visual viewport instead, and `--navi-keyboard-inset-bottom` stays 0. Either way
`--navi-app-height` and the popup ceilings answer the part of the screen left
visible.

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
