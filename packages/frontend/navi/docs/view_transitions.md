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
- [The top layer is painted through the root's picture](#the-top-layer-is-painted-through-the-roots-picture)
- [Two frames show the live document](#two-frames-show-the-live-document)

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

## The top layer is painted through the root's picture

A modal `<dialog>`, its `::backdrop`, a popover: the browser paints the top
layer during a transition only as part of the root's picture. With `:root {
view-transition-name: none }`, the wall and the dialog go unpainted for the
length of the movement, and a named element inside the dialog is photographed
empty (Chrome 153, reproduced in a bare page; in a long page it showed only
past a few thousand pixels of scroll, which is how it hid). A transition that
opens or closes a top-layer surface keeps the root's default name and pays the
frozen page — under a modal wall that costs nothing. navi's own lift
(`popup_lift.md`) does exactly that.

When the root cannot be kept — a route transition splits the bars from the
pages, which only works with the root opted out — the top layer has to be
**stood in for**. A dialog's box is an element, so it can be named and
photographed on its own. Its wall cannot: `::backdrop` wears no name. What
works is painting what the wall paints into the pictures themselves: a plain
element appended inside each photographed box (the pages, each bar) before
each capture, and one `position: fixed` element in the live document for what
no picture covers, with a hole cut where each picture stands. The live one is
not a picture, so nothing cross-fades it: it is animated on the movement's own
clock. Where a picture stands changes over the movement — the frame the first
picture is taken on shows the leaving state, the last frame the arriving one,
and in between only the intersection of the two states' rectangles is under a
picture at every moment — so the holes are cut three times. Reference:
`paintTransitionWalls` and `paintRestWalls` in `nav/transition_furniture.js`;
the measured story is in [route_transitions.md](./route_transitions.md#pages-between-fixed-bars-the-transition-area).

## Two frames show the live document

A view transition is not pictures from the call to `finished`. **The frame the
first picture is taken on is rendered and shown**, with the top layer painted
as usual, and `:active-view-transition` already matches on it (it matches from
the `startViewTransition` call). **The frame after the pictures are dropped is
shown too**, before the `finished` callbacks run — they are a frame late.
Whatever is switched on for the movement is therefore on screen one frame
before the pictures and one frame after; anything it stands in for must be
switched off for exactly the same span, or that frame shows both (measured: a
wall twice as dark under the press, read as a flash).

Two consequences for the switch itself:

- **Switch both on the same DOM write**, at the same moment: an attribute set
  before the call and removed in `finished`. The late frame then shows the
  stand-in alone, which is what the real thing looked like — one frame nobody
  can see.
- **`:active-view-transition` is the only same-frame signal at the end**: it
  stops matching in the rendering step that drops the pictures, before that
  frame is painted. It is what to use when the last frame must differ from the
  movement (see the holes above). It is NOT what to gate a stand-in's
  `display` on: hidden before the call, a stand-in measures as a zero rect and
  lands in the wrong place; and on the capture frame it is displayed while the
  real thing is still there.
