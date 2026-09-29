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
- [An element captured in a view transition cannot be pointed at](#an-element-captured-in-a-view-transition-cannot-be-pointed-at)
- [The top layer is painted through the root's picture](#the-top-layer-is-painted-through-the-roots-picture)
- [Two frames show the live document](#two-frames-show-the-live-document)
- [What makes a transition restyle the whole document](#what-makes-a-transition-restyle-the-whole-document)
- [A hidden element is not photographed, even in the top layer](#a-hidden-element-is-not-photographed-even-in-the-top-layer)

## A name is unique per document

A `view-transition-name` must be unique per document: a duplicate aborts the
transition, silently. Scope any name the app adds — per item id, per screen.

A named element is photographed on its own and animated by the browser from where
it was to where it is, during any transition, whoever started it. Hence the trap:
**an element named inside a page that moves does not move with it.** The name
lifts it out of its page's picture into a picture of its own, which stands where
it was captured, fading, while the pages slide away under it — right for a morph
between the two pages, wrong for anything that belongs to its page. navi's own
components drop their names for such movements: `Nav` names its current-tab bar
only for a movement between two tabs of its own row (`currentIndicatorSlides`),
and `List` unnames its rows for the length of any route transition or travel. A
name the app puts inside the pages is given only for the gesture it serves, or
dropped while they move: `view-transition-name: none` under
`:root:is([data-navi-route-transition], [data-navi-route-travel])`. Without nested
groups it also escapes the pages' clip, and navi warns about one inside a
transition area.

## Nested groups, and the fallback fade

List and grid transitions rely on nested groups (`view-transition-group:
contain`, Chrome/Edge 140+). On a browser without them nothing is named, so an
unconditional `startViewTransition` falls back to a full-page cross-fade. Whether
that fade is a decent default or a glitch is the application's call, never a
component's, and turning it off is one rule (see `itemTransition` on `List`):

```css
@supports not (view-transition-group: contain) {
  :root {
    view-transition-name: none;
  }
}
```

## Rendering is suspended for the whole callback

The document's rendering is suspended for the whole update callback, from the
capture of the old state to the capture of the new one. Nothing paints, and
`requestAnimationFrame` does not tick in there: awaiting a frame inside the
callback awaits something that cannot happen, until the browser gives up on the
transition entirely (`Transition was aborted because of timeout in DOM update`).
Await a microtask, a task or a render — never a frame.

**In a sub-document the suspension takes the scrollbar with it**: an iframe's
scrollbar is painted by the framed document, so it goes and comes back for the
length of the callback, shifting the layout by its width — a top-level page is
spared, its root scrollbar being the compositor's. Keep the callback short, and
suspect the frame before the code when a scrollbar blinks.

## `ready` rejects when the transition is skipped, `finished` when the update fails

There is only ever one transition per document, so another one starting SKIPS
this one — as does the document going hidden or its snapshot containing block
changing size mid-movement (a phone's address bar folding, its keyboard opening).
A skip rejects `viewTransition.ready`, with a stackless DOMException (`AbortError`
"skipped", or `InvalidStateError` "aborted because of invalid state").
`viewTransition.finished` still FULFILLS on a skip: the end state is reached, only
the animation is not. `finished` (and `updateCallbackDone`) reject for one reason
only, the update callback throwing.

So ending a transition means handling both ways of `finished` — `.finally()` does
not handle a rejection, an unhandled one is what it leaves behind, and
`.then(done, done)` is the shape that ends it whichever way it went — while a
`ready` waiter must expect the skip: `ready.then(onPictures, () => {})`.

## An element captured in a view transition cannot be pointed at

A captured element is not painted where it stands, and nothing hit-tests to it: a
press over it falls through to the nearest ancestor still being painted, whatever
the pseudo-elements are told about `pointer-events`. Under the root's default
name, that is the whole page for the length of the movement. It is why a
`RouteTravel` keeps the root out of its pictures, so the page around the box stays
live, and catches a press on the travelling box at the document, handing it to the
box it fell inside; and why a door in a bar a route transition photographs needs
`pressableDuringRouteTransition` to stay pressable (see
[route_transitions.md](./route_transitions.md#pages-between-fixed-bars-the-transition-area)).

## The top layer is painted through the root's picture

A modal `<dialog>`, its `::backdrop`, a popover: the browser paints the top layer
during a transition only as part of the root's picture. With
`:root { view-transition-name: none }`, the wall and the dialog go unpainted for
the length of the movement, and a named element inside the dialog is photographed
empty. A transition that opens or closes a top-layer surface keeps the root's
default name and pays the frozen page — under a modal wall that costs nothing.
navi's own lift ([popup_lift.md](./popup_lift.md)) does exactly that.

When the root cannot be kept — a route transition splits the bars from the pages,
which only works with the root opted out — the top layer has to be **stood in
for**. A dialog's box is an element, so it can be named and photographed on its
own; its wall cannot, `::backdrop` wears no name. What works is painting what the
wall paints into the pictures themselves, plus a live element in the document for
what no picture covers — not a picture, so animated on the movement's own clock,
and switched on by the same DOM write that switches the real wall off (see
[Two frames show the live document](#two-frames-show-the-live-document)).

## Two frames show the live document

A view transition is not pictures from the call to `finished`. **The frame the
first picture is taken on is rendered and shown**, with the top layer painted as
usual, and `:active-view-transition` already matches on it (it matches from the
`startViewTransition` call). **The frame after the pictures are dropped is shown
too**, before the `finished` callbacks run — they are a frame late. Whatever is
switched on for the movement is therefore on screen one frame before the pictures
and one frame after; anything it stands in for must be switched off for exactly
the same span, or that frame shows both (a wall twice as dark: a flash).

Two consequences for the switch itself:

- **Switch both on the same DOM write**, at the same moment: an attribute set
  before the call and removed in `finished`. The late frame then shows the
  stand-in alone, which is what the real thing looked like — one frame nobody can
  see.
- **`:active-view-transition` is the only same-frame signal at the end**: it stops
  matching in the rendering step that drops the pictures, before that frame is
  painted. It is what to use when the last frame must differ from the movement. It
  is NOT what to gate a stand-in's `display` on: hidden before the call, a
  stand-in measures as a zero rect and lands in the wrong place; and on the
  capture frame it is displayed while the real thing is still there.

## What makes a transition restyle the whole document

Starting a transition restyles what changed and nothing more: in a bare page, the
capture of the old state restyles a handful of elements, however long the page
is. Two things make it restyle every element of the page, in the frame the old
state is photographed — added to every transition before anything moves:

- **A `::highlight()` rule every element matches.** Written for the whole
  document, `::highlight(x) { … }` makes Chrome restyle every element when a view
  transition starts. Scope it to the elements that hold the ranges —
  `.results::highlight(x), .results ::highlight(x)` (both: a browser without
  highlight inheritance only paints what the rule matches). navi's own search
  highlight is scoped to list rows.
- **A custom property changed on `:root`.** Every element inherits it, so changing
  one restyles the document — and a movement changes its values as it starts.
  What the pictures read belongs on `::view-transition` instead: the
  pseudo-element tree inherits from it, and no element of the document does.

  ```css
  :root[data-my-movement] {
    &::view-transition {
      --my-distance: 120px;
    }
  }
  ```

  A value computed in JS cannot get there through an inline style, which cannot
  target a pseudo-element: it goes in a rule of a sheet of its own,
  `:root::view-transition {}`, set with `rule.style.setProperty()`.

  A value JS has to read back is the exception: what JS reads off
  `::view-transition` is not reliable outside a live transition —
  `getComputedStyle(root, "::view-transition")` answers while none runs, but in
  Chrome and WebKit alike it went on answering empty for rules added after its
  first read. Such a value stays on `:root`, registered with `@property` and
  `inherits: false` so that the document does not inherit it, and is handed to the
  pictures explicitly: `--x: inherit` on `::view-transition` and on the
  pseudo-elements below it.

Whatever does depend on the root is paid once, by the frame of the capture —
unless a style read follows a write on the root, which forces the restyle on the
spot, in the click. Read what the transition needs (names, rectangles) before
writing anything on the root.

## A hidden element is not photographed, even in the top layer

A popover or a modal `<dialog>` whose ancestor is `display: none` still matches
`:popover-open` or `:modal`, but it is not rendered: `checkVisibility()` is false,
its rectangle is empty, and a transition taking its pictures then has it on the
old side only — it leaves, as if it were gone. `isConnected` says nothing about
it; `checkVisibility()` is what tells which of the two states an element is part
of. navi relies on it to keep the page left by a route transition mounted but out
of the second picture (see
[route_transitions.md](./route_transitions.md#the-page-being-left-stays-until-its-movement-is-over)).

## See also

- [route_transitions.md](./route_transitions.md) — pages moving against each
  other on navigation
- [drag_to_travel.md](./drag_to_travel.md) — a transition held under a finger
- [drag_interactions.md](./drag_interactions.md#naming-what-travels) — naming what
  moves when something is dropped on a place
