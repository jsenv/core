# View transitions: what navi animates, and what stays the app's

navi components animate their own changes — `itemTransition` on `List`, the
pictures of a `RouteTravel`, the bar of a `Nav` — and never decide for the whole
document. An app that starts a transition of its own runs into a handful of
browser facts no component can absorb for it; they are collected here so that
they are met once.

- [A name is unique per document](#a-name-is-unique-per-document)
- [Nested groups, and the fallback fade](#nested-groups-and-the-fallback-fade)
- [Rendering is suspended for the whole callback](#rendering-is-suspended-for-the-whole-callback)
- [`ready` rejects when the transition is skipped, `finished` when the update fails](#ready-rejects-when-the-transition-is-skipped-finished-when-the-update-fails)
- [The top layer is painted through the root's picture](#the-top-layer-is-painted-through-the-roots-picture)
- [Two frames show the live document](#two-frames-show-the-live-document)
- [What makes a transition restyle the whole document](#what-makes-a-transition-restyle-the-whole-document)
- [A hidden element is not photographed, even in the top layer](#a-hidden-element-is-not-photographed-even-in-the-top-layer)

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

## `ready` rejects when the transition is skipped, `finished` when the update fails

There is only ever one transition per document, so another one starting SKIPS
this one — as does the document going hidden or its snapshot containing block
changing size mid-movement (a phone's address bar folding, its keyboard
opening). A skip rejects `viewTransition.ready`, with a stackless DOMException
(`AbortError` "skipped", or `InvalidStateError` "aborted because of invalid
state"). `viewTransition.finished` still FULFILLS on a skip: the end state is
reached, only the animation is not. `finished` (and `updateCallbackDone`)
reject for one reason only, the update callback throwing.

So ending a transition means handling both ways of `finished` — `.finally()`
does not handle a rejection, an unhandled one is what it leaves behind, and
`.then(done, done)` is the shape that ends it whichever way it went — while a
`ready` waiter must expect the skip: `ready.then(onPictures, () => {})`.

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

## What makes a transition restyle the whole document

Starting a transition restyles what changed and nothing more: in a bare page,
the capture of the old state restyles a handful of elements, however long the
page is. Two things make it restyle every one of them, in the frame the old
state is photographed — on a page of ~4,700 elements, 17–21 ms at full speed
and 60–90 ms with the CPU throttled 4×, added to every transition before
anything moves:

- **A `::highlight()` rule every element matches.** Written for the whole
  document, `::highlight(x) { … }` makes Chrome restyle every element when a
  view transition starts (Chrome 153, bare page: 10,009 of 10,009 elements; 6
  once the rule is scoped). Scope it to the elements that hold the ranges —
  `.results::highlight(x), .results ::highlight(x)` (both: a browser without
  highlight inheritance only paints what the rule matches). navi's own search
  highlight is scoped to list rows.
- **A custom property changed on `:root`.** Every element inherits it, so
  changing one restyles the document — and a movement changes its values as it
  starts. What the pictures read belongs on `::view-transition` instead: the
  pseudo-element tree inherits from it, and no element of the document does.

  ```css
  :root[data-my-movement] {
    &::view-transition {
      --my-distance: 120px;
    }
  }
  ```

  A value computed in JS cannot get there through an inline style, which
  cannot target a pseudo-element: it goes in a rule of a sheet of its own,
  `:root::view-transition {}`, set with `rule.style.setProperty()` (navi does
  this in `nav/transition_values.js`).

  A value JS has to read back is the exception: what JS reads off
  `::view-transition` is not reliable outside a live transition —
  `getComputedStyle(root, "::view-transition")` answers while none runs, but
  in Chrome and WebKit alike it went on answering empty for rules added after
  its first read. Such a value stays on `:root`, registered with `@property`
  and `inherits: false` so that the document does not inherit it, and is
  handed to the pictures explicitly: `--x: inherit` on `::view-transition` and
  on the pseudo-elements below it.

Whatever does depend on the root is paid once, by the frame of the capture —
unless a style read follows a write on the root, which forces the restyle on
the spot, in the click. Read what the transition needs (names, rectangles)
before writing anything on the root.

## A hidden element is not photographed, even in the top layer

A popover or a modal `<dialog>` whose ancestor is `display: none` still matches
`:popover-open` or `:modal`, but it is not rendered: `checkVisibility()` is
false, its rectangle is empty, and a transition taking its pictures then has it
on the old side only — it leaves, as if it were gone. `isConnected` says
nothing about it; `checkVisibility()` is what tells which of the two states an
element is part of. navi relies on it to keep the page left by a route
transition mounted but out of the second picture (see
[route_transitions.md](./route_transitions.md#the-page-being-left-stays-until-its-movement-is-over)).

## See also

- [route_transitions.md](./route_transitions.md) — pages moving against each
  other on navigation
- [drag_to_travel.md](./drag_to_travel.md) — a transition held under a finger,
  and what the main thread cannot read of it
- [drag_interactions.md](./drag_interactions.md#naming-what-travels) — naming
  what moves when something is dropped on a place
