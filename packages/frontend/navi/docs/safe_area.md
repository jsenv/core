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
uneven writes `--navi-app-inset-left` / `-right` directly instead.

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

Two ways NOT to get this:

- mounting empty `FixedBar area="left"/"right"`: they would reserve the room,
  but the app's rectangle would still be the whole window, so dialogs and
  popovers would keep sizing themselves against 1500px;
- setting `--dialog-max-width` on `.navi_dialog` from the app. It is a
  `--component-*` token, declared on the element (see
  [css_architecture.md](./css_architecture.md#--navi--vs---component--where-the-override-has-to-go)),
  so components that write it themselves outrank an app rule of lower
  specificity — `.navi_picker[aria-haspopup="dialog"] .navi_dialog` does exactly
  that, and the app's cap silently disappears for every picker. It is also the
  knob a single popup uses to ask for a specific size, not a ceiling:
  `--navi-app-max-width` feeds `--dialog-maxmax-width`, the hard ceiling _under_
  that knob, so a popup that genuinely needs its own `maxWidth` can still say
  so without escaping the app's screen.

An app can also get all of it by rendering itself in an iframe of the target
width: the viewport then genuinely _is_ the app's screen and no token is needed.
`--navi-app-max-width` is the answer for an app that does not want to pay that
price.

#### Placement follows the same rectangle

`--navi-app-max-width` moves where a popup is placed, not only how big it may
get. Placement is computed against the visual viewport narrowed to the level-1
bands: `getAppInsets` (`src/layout/responsive.js`) is the JS reading of them,
navi hands them to `@jsenv/dom` once (`setPlacementViewportInsets`, wired in
`navi_css_vars.js`), and `pickPositionRelativeTo` reads them on every
placement. Invisible for anything centered on its cross axis — `center`,
`bottom`, `top`, which is what a dialog does nearly always — but it is what puts
anything anchored to an edge (a `positionArea` like `bottom-start`, a
`SidePanel`) flush against the app column's edge rather than the window's.
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
