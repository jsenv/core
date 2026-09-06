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

What navi holds is what has to be settled **before** the press: `touch-action` on
the surface, said from a stylesheet because a browser decides what a touch may do
when it lands; the pan stepping back for what is carried across the surface (a
`move`, a handle, a field, a popover — the same list a travelling box steps back
for); the pinch not beginning as a pan under its first finger; the wheel and the
pinch writing one `zoom`; the capture, the pointer the browser drops, the click
the release leaves behind. A pointer pans only once it has travelled a few px
(`data-drag-threshold`), so a tap stays a tap and a `longpress` declared beside
`pan` still gets its hold.

Declared alone, `zoom` takes two fingers and the wheel and leaves one pointer to
whatever else reads it; `pan` alone leaves the wheel to the page.

### A surface that scrolls past: `data-pan-after-hold`

A surface takes every touch that lands on it, which is right for a map filling
the screen — there is no page left behind it to scroll. A plan shown as a
thumbnail on a page is the other case: a finger there means to scroll nine times
out of ten, and a surface answering all of them makes the page unreadable past
it.

```jsx
<Box data-pan-after-hold interactions={{ pan, zoom }} />
```

The finger then says it means THIS surface the way it says it means to carry a
drag source — by standing still. Until the hold the page keeps its scroll, and
the pan starts where the finger already is. The pinch is not given away with it:
two fingers on a surface that answers `zoom` are its own. A mouse travelling is
untouched — a button held down over a surface could never have meant a scroll,
and its wheel is settled on its own (see below) — and it is read off the element
or any ancestor, the same place `data-drag-on-contact` is said.

Opt-in, and for the same reason its opposite is (see
[`data-drag-on-contact`](./drag_interactions.md#a-finger-that-does-not-have-to-wait-data-drag-on-contact)):
navi cannot see whether anything behind the surface scrolls. You know;
say so. It spends the hold, though: a `longpress` declared beside a `pan` that
waits asks one finger to answer two waits of the same length, and only one of
them is answered.

### A wheel that does not steal the page's scroll

A wheel over a surface in a page means to scroll that page nine times out of ten
— it is what a wheel means everywhere else on it, and a surface that answers all
of them makes the page unreadable past it, the same way a finger taking every
touch does.

So a bare wheel zooms only where nothing around the surface would have scrolled:
a map filling the screen, a board in a modal. Where something would — a plan
shown in the middle of a page — the page keeps its scroll and the zoom is one
key away:

| wheel over the surface | in a page that scrolls | where nothing scrolls |
| ---------------------- | ---------------------- | --------------------- |
| bare                   | the page scrolls       | zooms                 |
| `ctrl` / `meta` held   | zooms                  | zooms                 |
| trackpad pinch         | zooms                  | zooms                 |

Nothing is declared for this, unlike `data-pan-after-hold` right above — and the
difference is worth knowing, because it is the same question asked twice. What a
TOUCH may do is settled before it lands, from `touch-action`, so nothing can be
read at that point and only the caller knows. A WHEEL is read: by the time the
event is there, what scrolls around the surface can simply be looked up, so navi
looks it up instead of asking. The walk stops at a modal, whose page behind is
not what a wheel over it is for.

A refused wheel is not a wheel that did nothing: navi says what it is waiting for
(`⌘ + scroll to zoom`, `Ctrl` off a Mac) in a callout over the surface, which
goes away with the gesture. It is navi's own text, `interaction.zoom.needs_modifier`
— override it through `naviI18n` like any other (see `docs/i18n.md`).

The trackpad pinch arrives as a wheel with `ctrl` held, which is why it goes on
zooming everywhere: it is the desk's version of two fingers on a phone, and it
was never the page's.

```jsx
<Box data-zoom-on-contact interactions={{ pan, zoom }} />
```

`data-zoom-on-contact` takes the bare wheel back, for a surface that owns it
whatever stands around it — a map whose page happens to scroll a little, an
editor where the wheel is a tool. Read off the element or any ancestor, the same
place `data-pan-after-hold` is.

### When the surface has the hand: `grab`, `release`, `[data-grabbed]`

A surface that is asked for — by a hold, or by the first few pixels of travel —
has an instant where it becomes the hand's, and nothing on screen says it. The
hand then moves too early and scrolls the page instead, or waits long past the
moment out of doubt. So the surface says it, the same two words a carried element
says (`grab`, `release`) and the same attribute:

```jsx
<Box
  data-pan-after-hold
  interactions={{
    pan,
    zoom,
    grab: (event) => {
      if (event.detail.pointerType === "touch") {
        navigator.vibrate?.(10);
      }
    },
    release: () => {},
  }}
/>
```

```css
.plan[data-grabbed] {
  border-color: var(--accent);
}
```

`[data-grabbed]` is on the element for as long as the surface holds the hand, so
a contour, a veil or a raised shadow needs no listener — which is what this is
usually for. `grab` and `release` are for the rest: a vibration, a state kept
elsewhere. Their detail is `{ pointerType }`; like a drag's, they **report and do
not ask**, and declared without `pan` or `zoom` they are a drag's words again,
which is what the dev warning says.

**Do not read the capture instead.** `setPointerCapture` is what the gesture takes
at that same instant, and it is the wrong signal twice over: the browser does not
announce a capture when it is taken but just before the NEXT pointer event for
that pointer, so a finger that holds still and then keeps still is announced
nothing at all, and a finger that moves is told at the very moment the surface is
already moving under it. With a mouse it lands mid-travel. `grab` is told where it
happens, before the first `pan`.

## Reference

- `src/control/interaction/interaction_surface.js` — `pan` and `zoom`, their
  `grab`/`release` moments, and the word said when a bare wheel went to the
  page, on `installPanZoom` from `@jsenv/dom`.
- `@jsenv/dom` — `src/interaction/drag/pan_zoom.js`: the pointers, the pinch,
  the wheel and what it is given to.
- `src/control/demos/38_interactions_demo.html` — a surface panned and zoomed.
- `src/control/demos/integration/5_plan_editor_demo.html` — a plan editor.
