# Scroll & layout

Where scrolling happens in a navi app, and how the pieces that live inside a
scrolling area (`Box header/body/footer`, `List`, a popup) are told about it.

- [What makes header/body/footer work: the overflow](#what-makes-headerbodyfooter-work-the-overflow)
- [1. The document scrolls](#1-the-document-scrolls)
- [2. A part of the document scrolls](#2-a-part-of-the-document-scrolls)
- [3. A popup scrolls](#3-a-popup-scrolls)
- [Hover while scrolling](#hover-while-scrolling)
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
- the separating line is a `border-bottom` on the header (`border-top` on the
  footer). Don't add a border of your own — you get two lines. It used to be a
  `box-shadow`, which is drawn outside the box and so lost to whatever was
  painted after it: the body covered the very line meant to separate them.
- header and footer sit in the sticky band
  (`var(--navi-z-index-sticky)`), so everything the box contains passes under
  them — positioned or not. Write `style={{ "--box-header-z-index": "auto" }}`
  (`--box-footer-z-index` likewise) at the call site that needs the opposite: a
  badge or a stamp overflowing a row is otherwise sliced by a header it never
  scrolls under. `isolation: isolate` on the box keeps either value local to it.
  See `docs/z_index.md` and `src/box/demos/9_scrollable_z_index_demo.html`.

Padding belongs on the parts, not on the scrolling box: padding on a scroller
sits inside the scrollbars, and a control flush against the edge of a scrolling
area raises a scrollbar of its own (a focus outline is drawn outside the control
it belongs to).

Reference: `src/box/box.jsx` (the `[data-scrollable]` CSS),
`src/box/demos/8_scrollable_demo.html`,
`src/box/demos/9_scrollable_z_index_demo.html` (sticky parts and stacking).

## 1. The document scrolls

The default case: nothing to do, the document scrolls.

The case that needs wiring is whatever covers the viewport — **fixed bars** (a
top bar, a bottom nav, the normal shape of a mobile app), the device's own
notch, a band an app reserves for itself. Each publishes what it takes, navi
adds them up on `<html>`, and the content reads the sum:

```
--navi-safe-area-inset-top / -right / -bottom / -left
```

See `src/layout/safe_area.js` for the two levels behind it — where the app is
(`--navi-app-inset-*`), and what is left free inside it.

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
<div id="main" data-navi-safe-area>…</div>
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
  `offset` is counted from where the row lands on its own — past the scroller's
  `scroll-padding` (the room a fixed bar publishes) and the row's own
  `scroll-margin` (the sticky header, the group label above it) — so `offset: 0`
  is exactly where `scrollIntoView()` would put it and none of that room has to
  be restated as a number.
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
<Dialog id="…" dockedOnSmallTouchScreen scrollCapture>
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

**The slide IS the body.** This is the one thing to get right, and the shape
everyone writes first gets it wrong: a `Dialog` with a `<Box body>` around the
slides puts a scroller ABOVE them, and that scroller's content is the grid —
measured on the tallest slide. Stand on a short slide and it carries the
scrollbar of a neighbour, scrolling through emptiness.

```jsx
// WRONG — the dialog's body scrolls the tallest slide, on every slide
<Dialog maxHeight="min(80vh, 640px)">
  <Box header>tabs</Box>
  <Box body>
    <SlideContainer>
      <Slide padding="l">…</Slide>
    </SlideContainer>
  </Box>
</Dialog>

// RIGHT — the cap stays a constraint, each slide scrolls its own content
<Dialog maxHeight="min(80vh, 640px)" flex="y">
  <Box header flexShrink="0">tabs</Box>
  <SlideContainer>
    <Slide overflow="auto">
      <Box header padding="m">…</Box>  {/* the slide scrolls: padding on the parts */}
      <Box body padding="l">…</Box>
    </Slide>
  </SlideContainer>
</Dialog>
```

Why it then behaves: the cap on the height comes from above and must reach the
slides as a **constraint**, never as a scroller. `SlideContainer` is
`flex: 0 1 auto` — it shrinks into what is left (growing is the caller's
decision, `expandY`) — the grid hands that height to **every** slide, and a
slide with an `overflow` of its own scrolls only when ITS content is taller than
that. The tall slide scrolls; the short ones are tall boxes with a short content
in them, which is what one wants: they take the height the context imposes and
ignore the height of their neighbour.

So: nothing scrollable between the cap and the slides. A `<Box body>` around
them is a scroller (see the table at the top of this file) — and so is a bare
`overflow="auto"` on a wrapper. The dialog keeps a shared `header` if the tabs
are shared, with an explicit `flexShrink="0"` since the rule that gives it for
free lives inside `[data-scrollable]`.

**Padding goes on the slide** — or on its parts, since the slide is now the
scroller (see the top of this file) — but never on the container nor on
anything above it.
Overflow clips at the _padding_ edge, so a padding on the container is a band
the clipping does not cover: the arriving slide is seen there before it has
reached the frame. And a padding above the slides does not travel — the two
contents cross each other flush, instead of each arriving already inset. On the
slide, the inset travels with what it insets.

Pass `travelByKeyboard={false}` when the arrow keys belong to the content (a list
one walks through, a picker whose slides are steps): otherwise the right arrow
changes screen mid-reading.

Reference: `src/layout/dialog.jsx`, `src/layout/popover.jsx`,
`src/layout/slide_container.jsx`, and the "One slide much taller than the
others" case in `src/layout/demos/8_slide_container_demo.html`.

## Hover while scrolling

A scroll moves the content under a pointer that does not move. The browser
reports that as hover: it fires `mouseleave` + `mouseenter` for **every element
crossing the cursor** — a dozen per wheel tick. None of it was asked for; the
user asked to scroll.

It is free as long as hover only paints a background. It stops being free the
moment hover triggers real work — a highlight somewhere else in the tree, a
prefetch, a map redrawing a layer — because that work then lands on the main
thread exactly while a scroll animation is running, and the scroll stutters.

### The fact is in the DOM: `navi-scrolling`

While an element scrolls it carries `navi-scrolling`, written by one capturing
listener on the document (`scroll` does not bubble, but it does propagate in
the capture phase) and removed once it has been quiet for a moment — scroll
events stop before the movement does. Nothing subscribes to anything: whoever
is concerned says so in CSS.

```css
/* my rows answer the pointer only when nothing is moving them */
[navi-scrolling] .my_row {
  pointer-events: none;
}
```

`pointer-events` is what does the work, and it does the whole of it: enter,
move and leave at once, in the browser, at no cost per element. Hand-written in
JS the same suppression takes three handlers — once `mouseenter` has been
swallowed the pointer is already inside the element, so only `mousemove` can
ever bring the hover back.

The page scroll carries the attribute on `document.scrollingElement`, so an
ancestor rule covers it too. In JS the same fact reads as `isScrolling()` /
`isScrolling(element)`, or `scrollActivitySignal` to react to it.

### In a `List`: nothing to do

`List` rows leave hit-testing while anything scrolling them moves — its own
scroll box, the panel around it, the page.

```jsx
<List hoverWhileScrolling>   {/* opt back in */}
```

The default costs one thing, and it is the honest half of the same trade: right
after a scroll, the row under the pointer lights up only once the pointer moves
by a pixel.

Reference: `src/utils/scroll_activity.js`.

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
