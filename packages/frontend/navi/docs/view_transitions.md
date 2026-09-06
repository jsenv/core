# View transitions: what navi animates, and what stays the app's

navi components animate their own changes — `itemTransition` on `List`, the
pictures of a `RouteTravel`, the bar of a `Nav` — and never decide for the whole
document. An app that starts a transition of its own runs into a handful of
browser facts no component can absorb for it; they are collected here so that
they are met once.

- [A name is unique per document](#a-name-is-unique-per-document)
- [Nested groups, and the fallback fade](#nested-groups-and-the-fallback-fade)
- [Rendering is suspended for the whole callback](#rendering-is-suspended-for-the-whole-callback)
- [`finished` rejects when another transition replaces it](#finished-rejects-when-another-transition-replaces-it)

## A name is unique per document

A `view-transition-name` must be unique per document: a duplicate aborts the
transition, silently. Scope any name the app adds — per item id, per screen.

The other half of the same fact is a bonus that costs nothing: any element given
its own name (a tab underline, a header, a stamp) is animated by the browser
from where it was to where it is during **any** transition, whoever started it.
`Nav` does this for its current-tab indicator (`currentIndicator`), which is why
the bar follows a `RouteTravel` swipe with no wiring between the two.

## Nested groups, and the fallback fade

List and grid transitions rely on nested groups (`view-transition-group:
contain`, Chrome/Edge 140+). On a browser without it nothing is named, so an
unconditional `startViewTransition` falls back to a full-page cross-fade. If
that fade is unwanted, the app — not a component — writes:

```css
@supports not (view-transition-group: contain) {
  :root {
    view-transition-name: none;
  }
}
```

Only the application knows whether a page-wide fade is a decent default or a
glitch there.

## Rendering is suspended for the whole callback

The document's rendering is suspended for the whole update callback, from the
capture of the old state to the capture of the new one. Nothing paints, and
`requestAnimationFrame` does not tick in there: awaiting a frame inside the
callback awaits something that cannot happen, until the browser gives up on the
transition entirely (`Transition was aborted because of timeout in DOM update`).
Await a microtask, a task or a render — never a frame.

That suspension lasts exactly as long as the callback, and **in a sub-document
it takes the scrollbar with it**: an iframe's scrollbar is painted by the framed
document, so it goes and comes back, shifting the layout by its width. A
top-level page is spared — its root scrollbar is the compositor's. So a callback
that waits on the network flickers every demo shown in an iframe while the same
app, opened on its own, shows nothing. Keep the callback short, and suspect the
frame before the code when a scrollbar blinks.

## `finished` rejects when another transition replaces it

There is only ever one transition per document, so `viewTransition.finished`
REJECTS when another one replaces this one. `.finally()` does not handle a
rejection — an unhandled one is what it leaves behind — and `.then(done, done)`
is the shape that ends a transition whichever way it went.

## See also

- [route_transitions.md](./route_transitions.md) — pages moving against each
  other on navigation
- [drag_to_travel.md](./drag_to_travel.md) — a transition held under a finger,
  and what the main thread cannot read of it
- [drag_interactions.md](./drag_interactions.md#naming-what-travels) — naming
  what moves when something is dropped on a place
