# A surface under the hand: `pan` and `zoom`

A plan drawn over an aerial photo, a map, a floor: one box the hand drags to
look elsewhere on, pinches or rolls a wheel over to look closer at, with things
carried across it that must not drag the surface along. What a carried thing is
and how it shares the press with the surface is
[drag_interactions.md](./drag_interactions.md); the prop itself is
[interactions.md](./interactions.md).

- [The two streams](#the-two-streams)
  - [A surface that scrolls past: `data-pan-after-hold`](#a-surface-that-scrolls-past-data-pan-after-hold)
  - [A wheel that does not steal the page's scroll](#a-wheel-that-does-not-steal-the-pages-scroll)
  - [When the surface has the hand: `grab`, `release`, `[data-grabbed]`](#when-the-surface-has-the-hand-grab-release-data-grabbed)
- [Reference](#reference)

## The two streams

```jsx
<Box
  interactions={{
    pan: (event) => moveCenterBy(event.detail), // { x, y } since the last one
    zoom: (event) => zoomBy(event.detail), // { factor, x, y }
  }}
>
  {markers.map((marker) => (
    <Marker interactions={{ move: (event) => place(marker, event.detail) }} />
  ))}
</Box>
```

Both are a **stream**, reported on every frame: `pan` says how far the hand has
moved since the previous `pan`, in px; `zoom` by what factor (above 1 is in) and
around which point of the surface, measured inside its border — the point between
the fingers, or under the wheel. Two fingers are one gesture, the point between
them panning and the distance between them zooming, and a finger lifting
re-anchors on what is left. What a pixel of pan means in your coordinates, and
whether the zoom is continuous or stepped, is yours: the numbers are the numbers.

Everything else is settled before the press, and there is nothing to wire: the
pan steps back for what is carried across the surface (a `move`, a handle, a
field, a popover — the same list a travelling box steps back for), the pinch does
not begin as a pan under its first finger, the wheel and the pinch write one
`zoom`, the click the release leaves behind is swallowed, and the next tap's is
kept — Chrome on Android drops it after a touch drag whose `touchmove`s nobody
refused (see
[mobile_touch.md](./mobile_touch.md#a-tap-dropped-after-a-touch-drag)). A pointer
pans only once it has travelled a few px (`data-drag-threshold`), so a tap stays
a tap: a `longpress` declared beside `pan` still gets its hold, and a
`double_click` its two presses. A press that does pan is the surface's: a
`longpress` waiting on it gives up the moment the pan begins, even inside its own
slop.

Declared alone, `zoom` takes two fingers and the wheel and leaves one pointer to
whatever else reads it: nothing captures it, waits on it or swallows its click
until a second finger lands, so a `click` or a `longpress` declared beside `zoom`
answers it as it would anywhere. From the second finger on, both are the pinch's,
and a `longpress` waiting on the first gives up. `pan` alone leaves the wheel to
the page.

### A surface that scrolls past: `data-pan-after-hold`

A surface takes every touch that lands on it, which is right for a map filling
the screen — there is no page left behind it to scroll. A plan shown as a
thumbnail on a page is the other case: a finger there usually means to scroll,
and a surface answering every one makes the page unreadable past it.

```jsx
<Box data-pan-after-hold interactions={{ pan, zoom }} />
```

The finger then says it means THIS surface the way it says it means to carry a
drag source — by standing still. Until the hold the page keeps its scroll, and
the pan starts where the finger already is. The pinch is not given away with it:
two fingers on a surface that answers `zoom` are its own. A mouse travelling is
untouched — a button held down over a surface could never have meant a scroll.
It is read off the element or any ancestor, like `data-drag-on-contact`.

Opt-in, for the same reason its opposite
[`data-drag-on-contact`](./drag_interactions.md#a-finger-that-does-not-have-to-wait-data-drag-on-contact)
is: navi cannot see whether anything behind the surface scrolls. You know; say
so. It spends the hold: a `longpress` declared beside a `pan` that waits asks one
finger to answer two waits, and the surface's — the shorter one — is the one
answered. On a surface that only zooms there is no pan to wait for: one finger is
the page's, two are the surface's, and `"kept"` (below) has nothing to keep.

The wait is then asked before every pan, which is right while each finger
landing there is genuinely ambiguous. Once the user has settled into the plan it
is not, and asking again is asking three times for one sentence:

```jsx
<Box data-pan-after-hold="kept" interactions={{ pan, zoom }} />
```

From the moment the surface is given the hand — the hold, a pinch, a mouse
travelling — it pans on contact, the way the same plan does opened full screen,
until a press lands away from it; navi watches for that press itself, so nothing
on your side listens to the window. The paid wait is a state to draw, and only a
`"kept"` surface carries it: `[data-hand-kept]`, for as long as it holds the
hand, a finger on it or not.

```css
.plan[data-hand-kept] {
  box-shadow: 0 0 0 100vmax rgb(9 12 20 / 22%);
}
```

`[data-grabbed]` is the narrower word — a hand on it at this instant — so
`[data-hand-kept]:not([data-grabbed])` is the surface waiting, held, for the
next finger.

### A wheel that does not steal the page's scroll

A wheel over a surface in a page means to scroll that page just as often as a
finger does, and is settled the other way for one reason: what a TOUCH may do is
decided before it lands, from `touch-action`, so only the caller can say it; a
WHEEL is read, and by the time the event is there, what scrolls around the
surface can simply be looked up. So nothing is declared: a bare wheel zooms only
where nothing around the surface would have scrolled — a map filling the screen,
a board in a modal (the walk stops at a modal) — and where something would, the
page keeps its scroll and the zoom is one key away:

| wheel over the surface | in a page that scrolls | where nothing scrolls |
| ---------------------- | ---------------------- | --------------------- |
| bare                   | the page scrolls       | zooms                 |
| `ctrl` / `meta` held   | zooms                  | zooms                 |
| trackpad pinch         | zooms                  | zooms                 |

A refused wheel is not a wheel that did nothing: navi says what it is waiting for
(`⌘ + scroll to zoom`, `Ctrl` off a Mac) in a callout over the surface, which
goes away with the gesture — navi's own text, `interaction.zoom.needs_modifier`,
overridden through `naviI18n` like any other (see [i18n.md](./i18n.md)). The
trackpad pinch arrives as a wheel with `ctrl` held, which is why it zooms
everywhere: it is the desk's version of two fingers on a phone.

```jsx
<Box data-zoom-on-contact interactions={{ pan, zoom }} />
```

`data-zoom-on-contact` takes the bare wheel back, for a surface that owns it
whatever stands around it — a map whose page happens to scroll a little, an
editor where the wheel is a tool. Read off the element or any ancestor.

### When the surface has the hand: `grab`, `release`, `[data-grabbed]`

A surface that is asked for — by a hold, by the first few pixels of travel, or
by a second finger — has an instant where it becomes the hand's, and nothing on
screen says it: the hand moves too early and scrolls the page, or waits long past
the moment out of doubt. So the surface says it with the two words and the
attribute a carried element uses (see
[drag_interactions.md](./drag_interactions.md#saying-the-grab-is-acquired-grab)).

```css
.plan[data-grabbed] {
  border-color: var(--accent);
}
```

`[data-grabbed]` is on the element for as long as a hand is on the surface (on
one that only zooms, from the second finger landing to the last one lifting), so
a contour, a veil or a raised shadow needs no listener. `grab` and `release`,
declared beside `pan`/`zoom`, are for the rest — a vibration on the touch that
took the surface, a state kept elsewhere. Their detail is `{ pointerType }`; they
report and do not ask, and declared without `pan` or `zoom` they are a drag's
words again, which the dev warning says.

**Do not read the pointer capture instead.** The browser announces it just
before the NEXT pointer event, so a finger held still is announced nothing and a
finger that moves is told when the surface is already moving under it (see
[mobile_touch.md](./mobile_touch.md#a-finger-is-captured-to-what-it-touched-inside-shadow-trees-too)).
`grab` is told where it happens, before the first `pan`.

## Reference

- `src/control/interaction/interaction_surface.js` — `pan` and `zoom`, their
  `grab`/`release` moments, and the word said when a bare wheel went to the
  page, on `installPanZoom` from `@jsenv/dom`.
- `@jsenv/dom` — `src/interaction/drag/pan_zoom.js`: the pointers, the pinch,
  the wheel and what it is given to.
- `src/control/demos/38_interactions_demo.html` — a surface panned and zoomed,
  after a hold, and kept.
