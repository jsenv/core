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

### The fix: wrap the app content in a scroll container

The root cause is the document overflowing horizontally. The fix is to **never let the
document itself overflow in X** — instead, contain horizontal scroll inside a child wrapper.

```html
<body>
  <!-- This wrapper is the scroll container for the whole app -->
  <div style="overflow-x: auto;">
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

As a safety net, add `overflow-x: hidden` on `html` and `body` to prevent any content
that forgets to use a wrapper from inflating the layout viewport:

```css
html,
body {
  overflow-x: hidden;
}
```

Note: `overflow: hidden` on `<html>` does create a new containing block, which could
break `position: fixed` in edge cases — but in practice this safety net is worth having,
and any element that needs correct `position: fixed` behavior (like `<dialog>`) should
be moved to `document.body` directly anyway (which `dialog.jsx` already does).

### Also: place `<dialog>` before content in the DOM

Even with the viewport fix, `showModal()` triggers `scrollIntoView` on the dialog element.
If the `<dialog>` is placed at the end of the DOM (after all the app content), the page
scrolls down to it when it opens.

Fix: **place `<dialog>` as the first child of `<body>`**, before any scrollable content.
`scrollIntoView` on an element already at the top of the document has no effect.

In `dialog.jsx`, `showModal()` moves the dialog to `document.body` (prepending it)
before opening for this reason.

### Summary

| Cause                           | Symptom                                                           | Fix                                              |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Document overflows horizontally | Layout viewport inflated → ghost space below → dialog miscentered | Wrap app content in `overflow-x: auto` container |
| `<dialog>` at end of DOM        | Page scrolls to dialog on `showModal()`                           | Place `<dialog>` first in `<body>`               |
