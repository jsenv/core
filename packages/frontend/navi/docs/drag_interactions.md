# Carrying something: the drag interactions

An element picked up and carried, and what letting go means. It is one gesture
— one press, one detector — and what differs between `move`, `reorder`,
`land`, `toss` and `leave` is the release. The prop these are declared in,
the gate they go through and how a control learns which of them asked are in
[interactions.md](./interactions.md); who owns a press when the carried thing
stands in a box that travels is in [drag_to_travel.md](./drag_to_travel.md).

- [Carrying something: `move`, `reorder`, `land`, `toss`, `leave`](#carrying-something-move-reorder-land-toss-leave)
  - [While it is being moved: `moving`](#while-it-is-being-moved-moving)
  - [Let go of away from every place: `leave`](#let-go-of-away-from-every-place-leave)
  - [A finger that does not have to wait: `data-drag-on-contact`](#a-finger-that-does-not-have-to-wait-data-drag-on-contact)
  - [Landing on a place: `land`](#landing-on-a-place-land)
  - [Saying the grab is acquired: `grab`](#saying-the-grab-is-acquired-grab)
  - [Saying the hold is let go: `release`](#saying-the-hold-is-let-go-release)
  - [The hand pulls and nothing follows: `refuse`](#the-hand-pulls-and-nothing-follows-refuse)
  - [A press made elsewhere: `--navi-grab`](#a-press-made-elsewhere---navi-grab)
  - [Dressing the clone](#dressing-the-clone)
  - [What says a thing can be picked up](#what-says-a-thing-can-be-picked-up)
  - [The text inside: `user-select: none`](#the-text-inside-user-select-none)
- [A gesture whose product is a value](#a-gesture-whose-product-is-a-value)
- [Reference](#reference)

## Carrying something: `move`, `reorder`, `land`, `toss`, `leave`

`move` carries the element ITSELF and leaves it where it was put; `reorder`,
`land` and `toss` carry a copy and put the original back; `leave` carries the
element beside `move` or `moving`, a copy otherwise. Something moved has a new
place of its own; something reordered had its place taken by the list.

`toss` and `leave` each **combine** with `reorder` and with `land`: dropped on
another item the element changes places, thrown far and fast it is gotten rid of,
let go of away from every place it leaves. `leave` combines with `move` as well.
`move` does **not** combine with the three that carry a copy, and neither do
`reorder` and `land` with each other — one release cannot mean two of those.
Declared together, the copy-carrying one wins and the element itself never
travels; of `reorder` and `land`, `land` wins. `moving` goes with `move` and
`leave`, never with a copy. A dev warning says so in each case.

```jsx
<Box
  id={token.id}
  interactions={{
    move: (event) => remember(event.detail.x, event.detail.y),
  }}
/>
```

What each one is told, in `event.detail` beside `event` — the `pointerdown` the
carry began with, for the release as well (unlike a swipe's), except for
[a press handed over](#a-press-made-elsewhere---navi-grab):

| interaction      | `event.detail`                                                   |
| ---------------- | ---------------------------------------------------------------- |
| `move`, `moving` | `{ x, y }`, how far from the grab: once, or on every frame       |
| `reorder`        | `{ fromId, toId, syncCloneWithDropTarget }`                      |
| `land`           | `{ fromId, toId, x, y, width, height, syncCloneWithDropTarget }` |
| `toss`           | `{ id, velocity, x, y }`                                         |
| `leave`          | `{ id, x, y }`                                                   |
| `grab`           | `{ pointerType, gestureInfo }`                                   |
| `release`        | `{ id, x, y, outcome }`                                          |
| `refuse`         | `{ pointerType }`                                                |

Items and places are named by their `id`. **What an outcome returns is waited
on**: the gesture holds what it carries until that promise settles, and a
rejection sends it home — a place the application would not accept must not stay
on screen as if it had. `moving`, `grab`, `release` and `refuse` **report, they
do not ask**: what they return is not waited on, and preventing their event
calls nothing off.

**Where the position is kept is the answer's.** Until the release navi carries
the element with a translate of its own. An element drawn from state
(`left`/`top` computed from a position the application holds) is redrawn by the
`move` handler, and its layout owns the position from then on: navi sees it drawn
elsewhere and drops its translate, or it would land twice as far as the hand
went. A handler that draws nothing (a token on a free canvas) leaves the position
baked into the element; one whose draw comes later than its answer returns the
promise of that draw. Something that changes WHILE it is dragged, or must never
be translated, is [`moving`](#while-it-is-being-moved-moving).

**Where it may go.** A `move` stays inside what one can SEE of its scroll
container — the nearest ancestor whose `overflow` is `auto` or `scroll`, the
viewport when there is none — so a board that only cuts its content (`hidden`,
`clip`) does not hold it; a copy stays inside its scroll area, as a row belongs
to its list. `data-drag-free` on the element or a container lets it out, and
three things do on their own, each needing to get somewhere: a `toss` for the
copy it throws (kept inside its list, it covers no distance), a `leave` for
whatever it is declared on, and a `data-drop-container` (a place outside is only
reached from outside).

```jsx
<List.Item
  id={task.id}
  data-view-transition-name={`task_${task.id}`}
  interactions={{
    reorder: (event) => {
      const { fromId, toId, syncCloneWithDropTarget } = event.detail;
      return document.startViewTransition(() => {
        syncCloneWithDropTarget();
        setOrder(moveBefore(order, fromId, toId));
      }).finished;
    },
    toss: (event) => remove(event.detail.id),
  }}
/>
```

Every element declaring `reorder` marks itself, so the set of items IS the set of
elements that declared it — no selector to pass, and an item that must not move
simply does not declare it; one declaring only `toss` is not a place anything
lands. `toId` is null for a drop at the end. `syncCloneWithDropTarget` must be
called synchronously inside the transition callback, next to the state change,
so the copy is captured where it lands rather than where it was let go of;
returning the transition is what makes the landing continuous. Starting that
transition is the application's call, not navi's: a `view-transition-name` must
be unique per document (see
[view_transitions.md](./view_transitions.md#a-name-is-unique-per-document)), so
only the application can name what moves.

A throw is asked about before a landing: a hand that sent something across the
screen has not asked for it to swap places with whatever it flew over.

| Attribute                                                | Meaning                                |
| -------------------------------------------------------- | -------------------------------------- |
| `data-drag-axis="x"\|"y"\|"xy"`                          | which axes the drag walks              |
| `data-drag-delay` `data-drag-slop` `data-drag-threshold` | when the press becomes a grab          |
| `data-drag-on-contact`                                   | a finger may drag by travelling too    |
| `data-drag-free`                                         | it may leave its scroll area           |
| `data-toss-distance` `data-toss-speed`                   | how far and how fast counts as a throw |
| `data-drop-container`                                    | where the places are looked for        |

`data-drag-axis` is `y` for a `reorder` with no `land`, `toss` or `leave` beside
it — it walks the list; a list that runs sideways says `x` — and `xy` for
everything else, which goes wherever the hand takes it.

### While it is being moved: `moving`

`move` says where the element ended up, once. That is the answer for something
whose position is its own — a marker put down on a plan, remembered as it lies. It
is not the answer for something whose position is **state**: a disc pushed along
the course of the sun sets the hour, the shadows turn as it goes, and the disc
itself may never leave its course by a pixel. Such a thing needs the gesture told
all along, and needs to be the one drawing.

```jsx
<Box
  data-drag-free
  interactions={{
    moving: (event) => setHourFrom(event.detail), // { x, y } from the grab
  }}
/>
```

Declaring it says both at once: the element is told where the hand has taken it
on every frame, and **navi moves nothing** — no translate, nothing to hand back
at the release. The numbers are counted from the grab, not steps since the last
frame (what `pan` gives, a surface having no grab to count from): a caller adding
up steps drifts, and has nothing to re-read after a frame it missed.

Told, not asked — a draw awaited before the next frame is a draw one frame late —
yet a complete declaration on its own, keeping everything the drag knows: the
axes, the threshold, the hold a finger owes, `data-drag-free`,
`grab`/`release`, `leave`, `"refuse"` to lock it. Write `move` beside it only
when the release settles something the frames did not. Nothing travels back: a
refused `move` or `leave` beside it has no home to send the element to, so what
the frames wrote is the caller's to put back.

### Let go of away from every place: `leave`

A throw is a **gesture** — far and fast, judged before any landing. A release
outside is a **place** — nothing under the thing, judged after a landing was
looked for. Neither reads the other's rules: there is no speed to a release, a
fast drag that ends ON a plan has not asked for the thing to go, and a row pulled
sideways out of its list and let go is a row put back, not a row deleted — a list
declares `toss`, a surface declares `leave`.

```jsx
<div data-drop-container>
  <Plan id="plan" data-droppable>
    {markers.map((marker) => (
      <Marker
        id={marker.id}
        interactions={{
          land: (event) => moveTo(marker.id, event.detail),
          leave: () => remove(marker.id),
        }}
      />
    ))}
  </Plan>
</div>
```

`leave` combines with every other outcome. Beside `land` or `reorder`, "outside"
is away from every place. Where nothing is a place — beside `move`, beside
`toss`, or alone — it is outside the surface the element stands in: the nearest
`data-droppable` ancestor, or, without one, what can be seen of the scroll
container (a dev warning says which). Either way it is judged on the element's
box no longer overlapping it, not on the pointer, which is still well inside the
frame when a small marker has just left it. Picked up and put straight back down
stays a cancel: it has to have gone somewhere to be away from anything. Its
`x`/`y` are what an exit is animated with.

While the answer is asked, a copy fades where it was let go of and the element
itself stays where the hand put it; a resolve takes the copy away and lets go of
the element's position (the application removed the thing, or drew it where it
goes back to). A surface that clips its overflow clips the element on its way
out; the copy lives in the top layer and does not.

### A finger that does not have to wait: `data-drag-on-contact`

A finger is asked to hold still because travel is exactly what a scroll looks
like, and the two have to be told apart. Where nothing scrolls there is nothing
to tell apart, and the wait asks the hand to prove something nothing else could
have meant — a dialog holding the page still, a board that fills the screen.

```jsx
<Dialog data-drag-on-contact>
  {pieces.map((piece) => (
    <Piece id={piece.id} interactions={{ land: swapPlaces }} />
  ))}
</Dialog>
```

It says a **place**, not an element: put on what holds the page still, every
source inside it reads by distance — the same few pixels a mouse travels, so the
gesture is the desktop one. A tap is untouched by that, so a piece that is also a
link or a card stays one; only `pinch-zoom` is left of the browser's own touch,
because zoom belongs to the reader and two fingers are never a drag.

Opt-in and nothing else: navi cannot see whether the surroundings scroll — a page
scrolls by default and an `overflow` is one property away — and guessing it wrong
this way means the list runs away under the finger that meant to reorder it. You
know you took the scroll away; say so.

### Landing on a place: `land`

`reorder` and `land` both come down on an item, and what separates them is **what
a place is**. A row of a list is a place BETWEEN two others — free by
construction, so the answer is an insertion and putting a row back where it
already was is a no-op. A place of a board is a place of its own, which may
already be taken — so nothing is inserted, nothing is a no-op, and the answer is
simply "this one came down on that one". What that means is yours: take the
place, swap the two, refuse. It is answered in the shape of a `reorder` (the
transition returned, `syncCloneWithDropTarget` inside it), and `toId` always names
an element — **never null**: a copy over nothing is a release that meant nothing,
and the interaction does not happen at all.

**Which elements are places: those marked `data-droppable`, and only those.**
Declaring `land` says an element can be CARRIED, which on a board is a different
thing from being somewhere one can be put — a zone receives without ever being
carried, a piece is carried without ever receiving, and both at once is a third
case (dropped on a piece, the two swap, so it says `data-droppable` as well). A
list has no such distinction, which is why `reorder` needs no marker.

Places are looked for among the carried element's **siblings**, which is what a
board is. When what is carried does not stand among the places — a palette
BESIDE the surface it fills, a marker drawn INSIDE the surface it can be put back
on — say what holds both with `data-drop-container`, on an ancestor of the
places: a surface that is itself the place is never found from inside itself.
Missed, nothing lands, so the first press on a `land` with no place in reach
warns, and names the surface it is standing on.

```jsx
<div data-drop-container>
  <aside class="palette">
    {shapes.map((shape) => (
      <Shape interactions={{ land: (event) => add(shape, event.detail) }} />
    ))}
  </aside>
  <Plan id="plan" data-droppable />
</div>
```

**When the place is bigger than what stands on it** — a zone holding a smaller
card, a square holding a piece — the copy must not take the place's box, or it
resizes on landing and resizes back when the real element appears. Pass
`syncCloneWithDropTarget` whatever occupies the destination — the piece already
standing there, the empty slot waiting — and the copy comes down on THAT box:
`syncCloneWithDropTarget(pieceAt(toId) || slotOf(toId))`.

#### A place that is a surface

A **surface** — a plan drawn over an aerial photo, a map, a floor — is one box
where every point is a place, and "which element did it come down on" says
nothing there. So the detail says **where**: `x`, `y`, `width`, `height`, the box
the copy came down in, measured inside the place with its border and its scroll
taken out. `toId` names the surface.

```jsx
<Shape
  interactions={{
    land: (event) => {
      const { x, y, width, height } = event.detail;
      addCourt(kind, { x: x + width / 2, y: y + height / 2 });
    },
  }}
/>
```

The size comes along because the anchor is yours: a chip dragged out of a palette
is not the shape it becomes, so the middle of what the hand carried is usually the
point that was aimed at. Leave `syncCloneWithDropTarget` alone here — called with
nothing it takes the whole surface's box, and the thing is created by the answer
itself — so the copy stays where the hand put it, over the thing appearing there.

#### Naming what travels

**The copy is already named, and it does the visible travel**:
`syncCloneWithDropTarget` moves it onto the destination inside the callback. Each
copy has a name of its own, two being on screen at once while a `toss` is
answered, and all share the class `navi-drag-clone`, so
`::view-transition-group(.navi-drag-clone)` styles the landing (read from Chrome
125 on; before that only a rule written against the class goes unread).

What is left to name is the OTHER piece, the one standing there that goes the
other way. **A name rides the element that MOVES, and that element has to be
visible at both ends of the transition.** Never the source: it is
`visibility: hidden` until the promise `land` returned settles, which still gets
it captured, as an empty image — a name on it is a group fading in from nothing,
or out into nothing, over the copy doing the real travel. Where the places are
fixed and the pieces drawn into them, key each piece by WHO it is, so the same
node walks from one place to the other.

The name is written twice, and neither write is redundant: by hand on the DOM
before `startViewTransition` is called, because the old state is captured right
then, and from state, because the render inside the callback would put the plain
name straight back. Clear that state when `finished` resolves — a name left
behind is claimed twice by the next transition, and that one is dropped for it.
The names are roles (the piece passing over, the one passing under) because a
`::view-transition` pseudo is selected by name and by nothing else; address both
its group and its image pair — the morph lives in one, anything a style adds
rides in the other. The padel board in `38_interactions_demo.html` does all of
it.

The drop hint follows what a place is: a line drawn in the gap for `reorder`, the
place itself lit up for `land`. Both are drawn among the places — the parent, or
the `data-drop-container` — so the variables dressing them are set on the list,
the board or the surface and reach them by inheritance:

| Variable                                                                                   | Dresses                 |
| ------------------------------------------------------------------------------------------ | ----------------------- |
| `--drop-hint-size` `--drop-hint-background-color` `--drop-hint-border-radius`              | the line of a reorder   |
| `--drop-hint-margin-x` `--drop-hint-margin-y` `--drop-hint-arrow-size`                     | where it sits, its caps |
| `--drop-surface-border-width` `--drop-surface-border-color` `--drop-surface-border-radius` | the lit place of a land |
| `--drop-surface-background-color`                                                          | and its fill            |

### Saying the grab is acquired: `grab`

The outcomes answer the **release**. Between the press and the release there is
one instant that counts for the hand — the object stops being pressed and starts
being held, whichever way the drag was entered — and `grab` is that instant:
`grab: () => navigator.vibrate?.(10)` beside the outcome. On a screen the held
object is under the thumb that hides it, so the only feedback available is the
one that is felt; without it the hand doubts the press was heard and lets go too
early — the whole gesture fails, not its decoration. For **paint** no listener
is needed: navi puts `data-grabbed` on the element for as long as the gesture
holds it. `grab` is for what a stylesheet cannot do — a vibration, a state kept
elsewhere, a counter.

It is not an interaction on its own: declared without an outcome or `moving`
there is no gesture for it to begin, and a dev warning says so — unless the
element declares `pan` or `zoom`, whose moment it then is
([pan_zoom.md](./pan_zoom.md)). A `longpress` needs none of this: it already
happens at the moment the hold is acquired.

### Saying the hold is let go: `release`

The mirror of `grab`, and the only interaction of the family always told. Each
outcome answers ONE meaning, so a release that means none of them — let go of
over nothing, taken away by the system — reaches nobody, and whatever `grab` set
up (a counter of what is in the hand) stays set up with nothing to take it down.

```jsx
<Chip
  interactions={{
    grab: () => setCarrying(kind),
    land: (event) => add(kind, event.detail),
    release: () => setCarrying(null),
  }}
/>
```

`outcome` is which one is about to answer — `"move"`, `"reorder"`, `"land"`,
`"toss"`, `"leave"` — or `null` when the release means none of them. It is told
**before** that answer runs, so what the grab put up comes down the moment the
hand lets go, while still knowing whether something is on its way. Like `grab`,
it needs a drag to happen in, and a dev warning says so.

### The hand pulls and nothing follows: `refuse`

Something that can be carried is not always free to be: a court whose place on the
plan is settled, a marker pinned by whoever owns it. Taking the interaction away —
`move: false` — makes the element **deaf** rather than locked: the press is
nobody's, so whatever it stands on answers it (the surface pans under an object
the hand was aiming at), and the pull is told nothing — a thing that does not move
and says nothing reads as a broken screen, so the hand insists.

```jsx
<Court
  interactions={{
    move: locked ? "refuse" : (event) => remember(event.detail),
    refuse: (event) => {
      shake();
      if (event.detail.pointerType === "touch") {
        navigator.vibrate?.(20);
      }
    },
  }}
/>
```

So the interaction stays declared and says `"refuse"` in place of what it does.
The threshold is the same — a mouse travelling, a finger holding still, a mouse's
few pixels inside a `data-drag-on-contact` — and at the instant the grab would
have been acquired there is none: nothing translates, no copy is made, no release
is answered. `refuse` is told then, where feedback is expected, with no
`gestureInfo` (there was no gesture) and the `pointerType` that says which hand
asked — a vibration for a finger, nothing extra for a mouse whose cursor has
already said it. One outcome refusing refuses the whole carry.

**It walks no axis, so it takes none.** Whatever reads what a drag source walks
to know what is left for itself — a box that travels, a surface that pans — steps
over an element that is refusing: a swipe starting on a locked row is the row of
slides' swipe, a drag starting on a pinned court pans the plan. A thing that
cannot be taken hold of is exactly the one a hand rests on without thinking, and
a surface with a dead zone the size of an object in the middle of it is wrong
every time. For the axes, `move: "refuse"` is `move: false`; for the press it is
not.

**The press itself stays the element's**, settled there like any gesture settles
one: the pointer is taken, so a `longpress` declared beside the drag does not
answer afterwards, and the click the release leaves behind is swallowed. The
exception is a box declaring `pan`/`zoom`, the one thing that takes a press whole
and in every direction: there the surface keeps it, and the refusal is told
without taking anything — no pointer, no click, nothing prevented.

### A press made elsewhere: `--navi-grab`

A hold opens a popup, and something in it is what the hand meant to take:
`triggerNaviCommand(element, "--navi-grab", openEvent)` hands the press still
down to that element (or the drag source around it), so the finger carries it
without lifting and pressing again. It brings **a copy only**, to the finger,
once the popup has settled: `move` and `moving` carry nothing there (a dev
warning says so), and let go of before it has travelled — the hold only meant to
open the popup — the copy goes back and nothing is answered. Its interactions
are chained to that request rather than to a press on the element, so
`event.detail.event` is the request: reach the `pointerdown` with
`findEvent(event, "pointerdown")`.

### Dressing the clone

A copy of a transparent element is invisible — a row usually gets its background
from the list around it, which the copy has left. So the clone's look is the
page's to declare, through the attributes the gesture puts on it:

| Attribute                 | On                                                   |
| ------------------------- | ---------------------------------------------------- |
| `navi-drag-clone`         | the copy being carried (already shadowed and scaled) |
| `navi-drag-clone-wrapper` | what positions it, in the top layer                  |
| `navi-drag-clone-source`  | the original, still in place (already hidden)        |

```css
.task[navi-drag-clone] {
  background: white;
  border-radius: 6px;
}
```

Reusing the item's own class is the point: the copy is that item, styled as that
item plus whatever being carried changes.

**Which is also the trap, for anything positioned on a board.** The copy is a
deep clone put in a carrier box, so a geometry written in the style attribute
comes with it. navi resets where it stands (`position`, `inset`, `margin`,
`translate`) but not its size: `width: calc(50% - 2 * var(--gap))` then means
half of the carrier, and the piece is carried at the wrong size. Put what a piece
LOOKS like in a class, leave only which place it is inline (two custom properties
will do), and let it fill its carrier — said of what is inside the wrapper, not
of `[navi-drag-clone]`, which the copy loses as it lands (that is how it drops
its lift for the transition) while it has to keep its size all the way down:

```css
[navi-drag-clone-wrapper] .piece {
  width: 100%;
  height: 100%;
}
```

Read off the dragged element, so a whole list or a single item can answer:

| Variable              | What it changes                                               |
| --------------------- | ------------------------------------------------------------- |
| `--drag-clone-shadow` | what being lifted casts; `none` for something that flies flat |
| `--drag-clone-scale`  | how much bigger it gets once picked up; `1` to keep its size  |

**What stays behind is the source, not a hole.** The original keeps its place in
the layout, only `visibility: hidden`, until the answer settles — it says where
the thing left from for as long as the question is open. A mark left there (an
imprint, a dashed outline) is drawn ON that element, and its parts say
`visibility: visible` to come back from the hidden source:

```css
.paper[navi-drag-clone-source]::after {
  position: absolute;
  inset: 0;
  border: 1px dashed currentColor;
  opacity: 0.35;
  visibility: visible;
  content: "";
}
```

### What says a thing can be picked up

Almost nothing, on purpose. A **handle** (`data-drag-handle`) exists only to drag,
so it shows the hand; a **source** does not — it drags only once the intent shows,
a plain click on it stays a click, and it is usually something else FIRST (a link,
a card one opens). The cursor says what an element IS, and the gesture is not the
one who knows, so it leaves it alone (`default`, not an I-beam: with a mouse the
text inside cannot be selected either — a finger is another matter, see below).

So on a board where a piece is also clickable, the cursor is already spoken for and
the affordance has to be said in the piece itself — a grip mark in a corner, a
shadow appearing under the pointer, a handle. Decide it rather than default it: a
board one may drag on is worth nothing if nobody tries.

### The text inside: `user-select: none`

A press on a source belongs to the drag, and the selection that press would have
made is refused for as long as it lasts — so with a mouse, dragging across the
label of a card never paints it blue.

A finger is another matter. It is asked to hold still, and the browser answers
that same held finger a moment later with a gesture of its own: it picks out the
word under the thumb and keeps the touch for the handles it puts around it. The
grab is then lost, and nothing done at the end of the wait takes it back —
whether a finger MAY select is settled when it lands. Like the iOS callout, it is
a stylesheet, and it has to be true before the press:

```css
.token {
  user-select: none;
  -webkit-user-select: none; /* Safari only took it unprefixed at 17 */
}
```

**Most of the time that is what you want.** What can be picked up carries a
label rather than a text to read — a token, a row, a card one moves — and the
press is there for the drag. Keep the selection where the text IS the point (a
note one copies from) and give that one a `data-drag-handle`: the grip drags, the
text stays text.

navi says it on its own in one place only, inside `[data-drag-on-contact]`, where
there is no wait left to answer the finger with.

## A gesture whose product is a value

`move`, `reorder`, `land`, `toss` and `leave` answer the same question — where did
the element end up. A rotation does not: what comes out of it is an angle, and
the handle that produced it stays exactly where it is. Same for a scale, or a sun
dragged around a plan to set the hour.

What navi names is never the value — it does not know that these pixels are an
angle, that the angle snaps to the neighbouring court, or where the result is
kept — but the **arbitration**: a press that could have been a tap, a scroll, a
page travelling, the surface underneath. Once that is settled it hands the
numbers over. **A value computed from how far a handle was taken is `moving`**:
the deltas from the grab, every frame, nothing translated, and `move` beside it
when the release commits something. A value read off a surface is `pan` and
`zoom` ([pan_zoom.md](./pan_zoom.md)). Both are `interactions` work.

What is left is a gesture whose SHAPE is none of navi's: it does not begin on an
element that could be carried, or on a surface — it begins wherever the
application says, on its own rules. Then navi hands over the machinery and leaves
the paint alone; the options are in the JSDoc of `dragAfterIntent`,
`markDragSource` and `createDragGestureController`:

```js
import {
  createDragGestureController,
  dragAfterIntent,
  markDragSource,
} from "@jsenv/navi";

// At mount, not in the pointerdown.
const unmarkDragSource = markDragSource(element, "xy");

const onPointerDown = (pointerDownEvent) => {
  // `element`, not `pointerDownEvent.currentTarget`: the callback runs once the
  // intent shows, after dispatch, when `currentTarget` is null.
  dragAfterIntent(pointerDownEvent, () => {
    const controller = createDragGestureController({
      onDrag: (gestureInfo) => {
        const { xDelta, yDelta } = gestureInfo.layout;
        valueSignal.value = valueFrom(xDelta, yDelta);
      },
      onRelease: (gestureInfo) => {
        if (gestureInfo.cancelled) {
          return;
        }
        commit(valueSignal.peek());
      },
    });
    return controller.grabViaPointer(pointerDownEvent, { element });
  });
};
```

An element that ends up somewhere is NOT this: that one is `move` — or `land`
when what it ends up on is a surface — and doing it by hand gives up the
constraint, the commit and the way back when the answer refuses.

**A touch has to be refusable before it is refused**, so `markDragSource` goes
down at mount, on the source itself, and what surrounds it keeps scrolling (the
two conditions are in
[mobile_touch.md](./mobile_touch.md#the-browser-decides-about-8px-in-and-does-not-wait)).
A blanket `touch-action: none` on the container buys the same drag by taking the
pan away, and the pan then has to be written by hand too. **A capture that goes
was not necessarily given back**: `lostpointercapture` reads the same whether the
gesture handed the pointer over or the browser dropped it mid-drag, which it does
more often than the specification suggests. The loop tells the two apart, and
`gestureInfo.cancelled` is where it comes out — a release nobody asked for must
commit nothing.

A gesture driven this way is outside the registry, so it says so itself to
whatever travels above it: `data-no-drag-travel` (see
[drag_to_travel.md](./drag_to_travel.md#a-navi-component-that-reads-the-pointer-marks-itself)).

## Reference

- `src/control/interaction/interaction_drag.js` — the outcomes, `moving`, the
  `grab`/`release`/`refuse` moments and `--navi-grab`.
- `@jsenv/dom` — `src/interaction/drag/drag_to.js` (`startDragTo`,
  `refuseDragTo`), `drag_gesture.js` (the loop and what `gestureInfo` holds),
  `drag_after_intent.js` (when a press becomes a drag, and what a source says in
  the stylesheet).
- `src/control/demos/38_interactions_demo.html` — a board whose places are
  zones and the same board whose places are the pieces.
- `src/control/demos/integration/5_plan_editor_demo.html` — a place that is a
  surface: shapes dragged out of a bank onto a plan, moved on it, and dragged off
  it to go; and an address point that travels itself (`move` + `leave`).
