# Scroll & layout

Where scrolling happens in a navi app, and how the pieces that live inside a
scrolling area (`Box header/body/footer`, `List`, a popup) are told about it.

- [What makes header/body/footer work: the overflow](#what-makes-headerbodyfooter-work-the-overflow)
- [1. The document scrolls](#1-the-document-scrolls)
- [2. A part of the document scrolls](#2-a-part-of-the-document-scrolls)
- [3. A popup scrolls](#3-a-popup-scrolls)
- [The list border](#the-list-border)

## What makes header/body/footer work: the overflow

`header`, `footer` and `body` are roles inside a scrolling area. What turns
them on is an `overflow: auto | scroll` on the box that contains them — there
is no second prop for the same fact.

```jsx
// header/body do NOTHING here: nothing scrolls
<Box flex="y">
  <Box header>…</Box>
  <Box body>…</Box>
</Box>

// here they do
<Box overflow="auto" maxHeight="60vh">
  <Box header>…</Box>   {/* stays put */}
  <Box body>…</Box>     {/* the only thing that scrolls */}
  <Box footer>…</Box>   {/* stays put */}
</Box>
```

`Dialog` and `Popover` get their own `header`/`body`/`footer` by that exact
same path: they ask `Box` for `overflow: auto` on themselves.

Two shapes, and they do not behave the same:

| what is inside            | behaviour                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header` / `footer` alone | the container itself scrolls, and they are `position: sticky` at its edges — the content scrolls under them                                                                                       |
| a `body` as well          | the container becomes a flex column, its own overflow turns to `hidden`, and the **body is the only thing that scrolls**; header and footer sit outside it (`position: static`, `flex-shrink: 0`) |

Two consequences worth knowing before fighting them:

- the body is `flex: 0 1 auto` — **it shrinks, it never grows**. A short body
  leaves the footer right under it rather than pushed to the bottom of a box it
  does not fill. Adding `expandY` to "fix" that is undoing a deliberate default.
- the separating line is a `box-shadow`, not a `border`: it draws without taking
  part in layout, so nothing shifts by a pixel when it appears. Don't add a
  border of your own — you get two lines.

Padding belongs on the parts, not on the scrolling box: padding on a scroller
sits inside the scrollbars, and a control flush against the edge of a scrolling
area raises a scrollbar of its own (a focus outline is drawn outside the control
it belongs to).

Reference: `src/box/box.jsx` (the `[data-scrollable]` CSS),
`src/box/demos/8_scrollable_demo.html`.

## 1. The document scrolls

The default case: nothing to do, the document scrolls.

The case that needs wiring is **fixed bars** — a top bar, a bottom nav, the
normal shape of a mobile app. `FixedBar` measures its own height (safe area
included) and publishes it on `<html>`:

```
--navi-fixed-bar-space-top / -bottom / -left / -right
```

Two distinct things must be given back to the content, and forgetting the
second one is the classic bug:

1. **padding**, or the last screenful of content stays under the bar,
   unreachable;
2. **`scroll-padding`**, or everything the browser scrolls _to_ (an anchor,
   `scrollIntoView()`, a field taking focus, a restored scroll position) lands
   _behind_ the bar. The padding does not help here: it moves the content, not
   the place the browser brings its target to.

`:root` gets the `scroll-padding` unconditionally. The padding goes on whatever
scrolls — which element that is, is the app's business, so navi does not pick:

```html
<!-- on the container that scrolls under the bars -->
<div id="main" data-navi-fixed-bar-space>…</div>
```

**Do not make that container scrollable by accident.** An `overflow-x: auto`
forces the other axis to `auto` too: the container becomes a scrollport, and
every `position: sticky` inside it sticks to _it_ instead of to the page. To
merely clip, use `overflow-x: clip` — it clips without creating a scroll
container.

A `List` in this case takes `scroller="document"` (in dev it warns when it finds
itself inside a scrollport anyway, and names the element).

Reference: `src/layout/fixed_bar/fixed_bar_space.js`,
`docs/MOBILE_LAYOUT_PITFALLS.md`.

## 2. A part of the document scrolls

```jsx
<Box overflow="auto" maxHeight="60vh">
  <Box header>…</Box>
  <Box body>…</Box>
</Box>
```

### `List` and its `scroller`

`List` has a `scroller` prop, and the default is not the one most call sites
want:

| value                   | which box scrolls                                          |
| ----------------------- | ---------------------------------------------------------- |
| `"self"` _(default)_    | the list gets a scroll box **of its own**                  |
| `"parent"`              | it virtualizes against the scrollable ancestor it lives in |
| `"document"`            | the page                                                   |
| `Element` / `{current}` | that element, nothing is guessed                           |

> If the list already lives in a box that scrolls (a dialog's `body`, a panel),
> it is `scroller="parent"`. `"self"` is for the list that IS the scrolling
> area.

With `"self"` the list nests a scroll box inside the surrounding one and sizes
itself independently of it — its `maxHeight` then decides how tall that inner
box is allowed to get, and a virtualized run holds the room of the rows it
stands for (see `List.Items count` below), so the surrounding popup or panel
ends up sized on that rather than on the rows actually drawn. With anything
other than `"self"`, the list's own scroll box is made transparent to layout
(`max-height: none; overflow: visible`) — there is no nested scrollport and no
height to compute.

`"parent"` finds the ancestor **by measuring**: the nearest one whose content
actually overflows it, the page if none does. Declaring an `overflow` is not
enough to be picked (a box with `overflow-x: auto` that grows with its content
computes `overflow-y: auto` without ever scrolling). The answer is taken again
as the geometry moves, so an ancestor that starts scrolling once it fills up is
picked up then. When it is still not the box you mean, say so explicitly with
`"document"` or the element itself.

### Where the list opens, and where it is

- **`defaultScrolled`** — `"start"` (default), `"end"`, an index, or
  `{id, offset}`. The `{id, offset}` form is what `onScrolledChange` hands out:
  it asks for the row BY NAME, then puts it back by MEASURING it, so it lands
  where it was even if rows were inserted before it, and whatever the screen it
  was saved on. That is "reopen a thread where I left it", already provided.
- **`scrolled`** is the controlled form of the same thing — same pair as
  `open`/`defaultOpen` elsewhere in navi. The list goes back there every time it
  changes, even after the user scrolled.
- **`onScrolledChange`** gives `{id, index, offset}` as the user scrolls.

### Sticky rows inside the list

`<List.Item header>` / `<List.Item footer>` are sticky rows inside the list.
They publish their measured size as `--list-header-height` /
`--list-footer-height`, which feeds the `scroll-margin` of the rows — this is
what keeps a `scrollIntoView()` on a row from landing under the sticky header.

### Loading: two different situations

- **`loading` / `loadingFallback` / `loadingSkeletonCount` / `renderSkeleton`**
  — "I have nothing at all to show yet". Placeholder rows (or a `"loader"`
  spinner) stand in for the whole list.
- **`<List.Items count>`** — "I know how many rows are coming". The rows not
  held yet are drawn as skeletons _in their own place_, virtualized like the
  rest, and asked for as they enter the render window.

A list that knows its count has no use for the first one.

Reference: `src/control/list/list.jsx` (JSDoc on `List` and `List.Items`).

## 3. A popup scrolls

### Structure

A popup does nothing special: it obtains `header`/`body`/`footer` the same way
everyone else does, by asking for the overflow — and it already asks, on itself.
So the parts are direct children of the `Dialog`:

```jsx
<Dialog id="…" dockedOnTouch scrollCapture>
  <Box header>title + close</Box>
  <Box body>
    <List scroller="parent" /> {/* NOT "self" */}
  </Box>
  <Box footer>…</Box>
</Dialog>
```

A dialog is already bounded by the room its container leaves it
(`--dialog-maxmax-height`), so a `maxHeight` is only for making it smaller than
that.

`dialog.jsx` deliberately declares no `overflow` of its own: a modal dialog
would inherit `auto` from the UA stylesheet and a `layer="local"` one gets
nothing, so without a scrolling rule its `max-height` would only decide how big
the box looks while the content kept painting straight through it.

### `scrollCapture`

```jsx
<Dialog scrollCapture>
```

Traps wheel/touch gestures inside the popup so the page behind it cannot
scroll. **Without it, on mobile, reaching the end of the content keeps going and
the screen underneath scrolls** — the sheet stays put while the content it
covers changes. It does not look like a scroll bug, and it is one.

Two details:

- a `layer="local"` dialog **always** locks its own positioned ancestor's scroll
  while open (its backdrop only covers the scrollport, so scrolling there would
  reveal uncovered content); `scrollCapture` extends the lock to the whole page;
- `Popover` has the same prop, plus `focusCapture` for Tab.

### `SlideContainer` inside a popup

All slides live in **the same grid cell**, so the box measures itself on the
**largest** of them. That is what guarantees nothing resizes as one moves
between slides — and it also means a short slide shows empty room below it. It
is a trade, not a leak.

`SlideContainer` is `flex: 0 1 auto`: it shrinks (the slides then scroll their
own body) but never grows on its own. Growing is the caller's decision —
`expandY`.

Pass `travelByKeyboard={false}` when the arrow keys belong to the content (a list
one walks through, a picker whose slides are steps): otherwise the right arrow
changes screen mid-reading.

Reference: `src/layout/dialog.jsx`, `src/layout/popover.jsx`,
`src/layout/slide_container.jsx`.

## The list border

Not scroll, but the same family of problem — a reasonable default nobody knows
can be removed.

A `<List>` frames itself (`--list-border-width-default: 1px`): "a list is a box
with rows in it, it says where it starts and where it ends". Inside a popup or a
card, that frame is already the container's, and two frames around the same rows
read as a box in a box. `borderWidth="0"` removes it — the prop writes
`--list-border-width` inline, which wins over the `-default`. A list that is
itself the content of a `[popover]`/`<dialog>` already drops the default on its
own.
