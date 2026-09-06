# Mobile layout pitfalls

## Horizontal overflow on mobile breaks `<dialog>` positioning

### What happens

On Chrome Android, if **any element causes the document to overflow horizontally**,
the browser inflates the layout viewport (`window.innerWidth/innerHeight`) to match
the full content dimensions instead of the visible screen dimensions.

Example on a 412×915px phone with a 2000px-wide grid:

- `window.innerWidth` → `1648` (inflated, ~4× the real width)
- `window.innerHeight` → `3660` (inflated, ~4× the real height)
- `window.visualViewport.width` → `412` (the actual screen)

**This creates a large invisible empty area below the real content** — the browser
has "expanded" the document to a size that doesn't correspond to anything visible.

### Why `<dialog>` breaks

`position: fixed; margin: auto` is supposed to center an element in the viewport.
But for obscure reasons, Chrome Android centers it relative to the inflated **layout
viewport** instead of the visual viewport.

With `innerHeight: 3660`, `margin: auto` places the dialog at ~1830px from the top —
the user scrolls down and finds the dialog sitting far below the visible area, miscentered
or completely invisible.

**To make things worse**, `showModal()` internally calls `.focus()` on the dialog element,
which triggers the browser's native `scrollIntoView`. So after opening, the page automatically
scrolls to bring the dialog into view — scrolling the user away from where they were.

### The fix: clip the horizontal overflow in a wrapper

The root cause is the document overflowing horizontally. The fix is to **never let the
document itself overflow in X** — instead, contain the overflow inside a child wrapper.

```html
<body>
  <!-- This wrapper absorbs the horizontal overflow of the whole app -->
  <div style="overflow-x: clip;">
    <!-- all app content goes here -->
  </div>

  <!-- Dialog is outside the wrapper, directly in body, placed first -->
  <dialog>...</dialog>
</body>
```

With this structure:

- The document never overflows horizontally → layout viewport = visual viewport
- `position: fixed; margin: auto` centers the dialog correctly
- No ghost empty space at the bottom

As a safety net, add `overflow-x: clip` on `html` and `body` to prevent any content
that forgets to use a wrapper from inflating the layout viewport:

```css
html,
body {
  overflow-x: clip;
}
```

What it costs: content wider than the screen is cut off instead of reachable by dragging.
When some element genuinely needs to be scrolled horizontally (a wide table, a carousel),
give **that element** its own `overflow-x: auto` — the wrapper stays `clip`.

### Why `clip` and not `auto` or `hidden`

`clip` is the only value that clips without turning the box into a **scroll container**.
`auto`, `scroll` and `hidden` all create one, and that has two consequences that show up
far from the wrapper:

- **Every `position: sticky` in the app sticks to that wrapper**, because sticky resolves
  against the nearest scroll container in the DOM — not against the box the app considers
  its scroller. The wrapper grows with its content and never scrolls, so nothing sticks
  anymore: sticky headers and `<List groupBy>` group labels just scroll away with the
  content.
- **Worse than not sticking: the sticky element is offset downwards.** The rectangle a
  sticky element sticks within is the scroll container's box shrunk by its
  `scroll-padding` (CSS Position L3), and Chromium applies that for an element scroll
  container. A wrapper carrying `data-navi-safe-area` has
  `scroll-padding-top: var(--navi-safe-area-inset-top)`, so labels come to rest at
  `scroll-padding-top + top` — a group label floating a hundred pixels below the bar,
  covering the content above it.

`overflow-x: clip` also lets `overflow-y` stay `visible`, where `hidden`/`auto` force the
other axis to `auto`.

Note: `overflow: hidden` on `<html>` would additionally create a new containing block,
which could break `position: fixed` in edge cases. Any element that needs correct
`position: fixed` behavior (like `<dialog>`) should be moved to `document.body` directly
anyway (which `dialog.jsx` already does).

### The wrapper is a net, not a fix: find what overflows

Clipping makes the symptom disappear, and with it the signal. Something wider than
the screen is a layout bug wherever it happens — a width in px, a `min-width`, a grid
of fixed columns, an unbreakable string coming from the data. The wrapper only keeps
that bug from taking the whole mobile viewport down with it.

So in dev, ask who overflows:

```js
import { detectHorizontalOverflow } from "@jsenv/navi";

if (import.meta.dev) {
  detectHorizontalOverflow({ root: document.querySelector("#main") });
}
```

It outlines the culprits in red and names them in the console, at load and whenever
the layout changes. It reports the **outermost** box that sticks out (its children
stick out because it does), and stays quiet about what cannot reach the document:
anything inside a box that scrolls or clips on its own — a wide table in its own
`overflow-x: auto` container is doing the right thing — and anything `position: fixed`
or in the top layer.

Measuring against the wrapper matters here: once it is in `clip` there is no scrollable
overflow left to read, so `scrollWidth > clientWidth` reports nothing. The rectangles of
the descendants are what tells.

### Also: place `<dialog>` before content in the DOM

Even with the viewport fix, `showModal()` triggers `scrollIntoView` on the dialog element.
If the `<dialog>` is placed at the end of the DOM (after all the app content), the page
scrolls down to it when it opens.

Fix: **place `<dialog>` as the first child of `<body>`**, before any scrollable content.
`scrollIntoView` on an element already at the top of the document has no effect.

In `dialog.jsx`, `showModal()` moves the dialog to `document.body` (prepending it)
before opening for this reason.

### Summary

| Cause                           | Symptom                                                                                                             | Fix                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Document overflows horizontally | Layout viewport inflated → ghost space below → dialog miscentered                                                   | Wrap app content in `overflow-x: clip` container              |
| `<dialog>` at end of DOM        | Page scrolls to dialog on `showModal()`                                                                             | Place `<dialog>` first in `<body>`                            |
| Wrapper uses `auto`/`hidden`    | It becomes a scroll container: sticky headers and group labels stick to it (and get offset by its `scroll-padding`) | Use `clip`; put `overflow-x: auto` on the wide element itself |
