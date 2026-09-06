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
  - [Dressing the clone](#dressing-the-clone)
  - [What says a thing can be picked up](#what-says-a-thing-can-be-picked-up)
  - [The text inside: `user-select: none`](#the-text-inside-user-select-none)
- [A gesture whose product is a value](#a-gesture-whose-product-is-a-value)
- [Reference](#reference)

## Carrying something: `move`, `reorder`, `land`, `toss`, `leave`

All five are the same gesture — the element is picked up and carried — and what
differs is the release. One detector reads them all, because it is one press.

`toss` and `leave` each **combine** with `reorder` and with `land`: dropped on
another item the element changes places, thrown far and fast it is gotten rid of,
let go of away from every place it leaves. `leave` combines with `move` as well.
`toss` does **not** combine with `move`, and neither do `reorder` and `land` with
each other — one release cannot mean two of those. Declared together, the
copy-carrying one wins and `move` is never answered — the element itself never
travels, and a release that is not the other outcome means nothing at all (a dev
warning says so).

`move` carries the element ITSELF and leaves it where it was put; the others
carry a copy and put the original back. That is the same difference said in layout
terms: something moved has a new place of its own, something reordered had its
place taken by the list.

```jsx
<Box
  id={token.id}
  interactions={{
    move: (event) => remember(event.detail.x, event.detail.y),
  }}
/>
```

`data-drag-free` on the element or a container lets it leave; by default a `move`
stays inside what one can SEE of its container — which requires that container to
be a scroll container at all (`overflow` anything but `visible`), since there is
nothing else for "inside" to mean. A `move` whose answer rejects travels back, because a
place the application would not accept must not stay on screen as if it had.

**Where the position is kept is the answer's.** An element drawn from state —
`left`/`top` computed from a position the application holds — is redrawn by the
handler above, and from then on its layout owns the position: navi sees the
element drawn elsewhere while the answer was given and lets go of its own
translate, so the thing does not land twice as far as the hand went. A handler
that draws nothing (a token on a free canvas) leaves the position to the element,
where it is baked in. Nothing to declare either way — but a handler whose draw
comes later than its answer has to return the promise of that draw.

That is one answer, at the release, with the whole of the gesture in it: `move` is
not told while the hand moves, and until the release navi carries the element with
a translate of its own. A thing that has to change something WHILE it is dragged —
or that must never be translated at all — declares `moving` instead (below).

**A copy that can be thrown frees its own area.** What is dragged is otherwise kept
inside its scroll area — right for a reorder, since a row belongs to its list, and
fatal for a throw: the copy hits the edge of the list, no distance is ever covered,
so no throw can happen and no sideways movement is even visible. So `toss` lifts
that constraint for the copy it carries, and `leave` lifts it for whatever it is
declared on — a thing that can be let go of outside has to be able to get there.
Neither is a way to free a plain `move`, which says `data-drag-free`.

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

The gesture is `startDragTo`'s, whole: `move` carries the element itself, the
others carry a copy above the page while the original keeps its place, with a
drop hint, drop targets found by intersection, no-op drops filtered out, and the
flight of a thrown copy plus its return when the answer refuses. Only what the
declared outcomes need runs — no copy for a move, no hint for something
that can only be thrown away.

Every element declaring `reorder` marks itself, so the set of items IS the set of
elements that declared it — no selector to pass, and an item that must not move
simply does not declare it. An element declaring only `toss` marks nothing: it is
not a place anything lands. Items are named by their `id`.

`toId` is null for a drop at the end. `syncCloneWithDropTarget` must be called
synchronously inside the transition callback, next to the state change, so the copy
is captured where it lands rather than where it was let go of.

**The promise matters in both cases**: the gesture holds its copy until the answer
settles. Returning the transition is what makes a landing continuous; a `toss` that
rejects brings the copy back, because the thing still exists and the screen has to
say so.

A throw is asked about before a landing: a hand that sent something across the
screen has not asked for it to swap places with whatever it flew over.

Starting a document transition is the application's call, not navi's: a
`view-transition-name` must be unique per document, so only the application can
name what moves.

| Attribute                                                | Meaning                                |
| -------------------------------------------------------- | -------------------------------------- |
| `data-drag-axis="x"\|"y"\|"xy"`                          | which axes the drag walks              |
| `data-drag-delay` `data-drag-slop` `data-drag-threshold` | when the press becomes a grab          |
| `data-drag-on-contact`                                   | a finger may drag by travelling too    |
| `data-toss-distance` `data-toss-speed`                   | how far and how fast counts as a throw |
| `data-drop-container`                                    | where the places are looked for        |

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

Declaring it says both things at once: the element is told where the hand has
taken it on every frame, and **navi moves nothing** — no translate while the
gesture runs, nothing to hand back at the release, no reading the element
afterwards to find out who owns its position. The caller draws, from the numbers
it is given.

Its detail is `{ x, y }`: where it is now, counted from the grab — the very
numbers `move` ends with, said all along instead of once. Not steps since the last
frame, which is what `pan` gives (a surface has no grab to count from): a caller
adding up steps drifts, and has nothing to re-read after a frame it missed.

Told, not asked, like `grab` and `release` — a draw that has to be awaited before
the next frame is a draw one frame late. Where it differs from those two is that
it is a gesture of its own: `moving` alone is a complete declaration, and it keeps
everything the drag knows — the axes, the threshold, the hold a finger owes,
`data-drag-free`, `grab`/`release`, `leave`, and `"refuse"` to lock it. Write
`move` beside it only when the release settles something the frames did not.

Nothing travels back, either: a `move` or a `leave` beside it whose answer rejects
normally sends the element home, and there is no home to send it to when navi
never moved it. The state the frames wrote is the caller's to put back.

It carries the element itself, so it goes with `move` and `leave` and not with the
three that carry a copy — for those, the original never goes anywhere, and there
is nothing being moved to tell about (a dev warning says so).

### Let go of away from every place: `leave`

A throw is a **gesture**: far and fast, the flick that gets rid of a row, judged
before any landing. A release outside is a **place**: the hand let go with nothing
under the thing, judged after a landing was looked for. They share the outcome an
application usually attaches to them and nothing else — so `toss` is the throw,
`leave` is the release outside, and neither reads the other's rules. There is no
speed to a release; a fast drag across a plan that ends ON it has not asked for the
thing to go, and a row pulled sideways out of its list and let go is a row put
back, not a row deleted — a list declares `toss`, a surface declares `leave`.

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

`leave` combines with every other outcome. Beside `land` or `reorder`, "outside" is
away from every place. Beside `move` — the element itself travels, and nothing is a
place — it is outside the surface the element stands in: the nearest
`data-droppable` ancestor, or, without one, what can be seen of the scroll
container (a dev warning says which). Either way it is judged on the element's
box no longer overlapping it, not on the pointer, which is still well inside the
frame when a small marker has just left it.

```jsx
<Plan data-droppable>
  <Marker
    interactions={{
      move: (event) => remember(event.detail.x, event.detail.y),
      leave: () => remove(marker.id),
    }}
  />
</Plan>
```

Its detail is `toss`'s — `{ id, x, y }`, the distance travelled being what an exit
is animated with. Picked up and put straight back down stays a cancel: it has to
have gone somewhere to be away from anything.

What the thing does while the answer is asked follows what was carried. A copy
fades where it was let go of; the element itself stays where the hand put it. A
resolve takes the copy away and lets go of the element's position — the
application has removed the thing, or drawn it where it goes back to (the address
point returns to where the geocoder put it) — and a reject brings either back, as
a refused `move` does. A surface that clips its overflow clips the element on its
way out; the copy a `land` carries lives in the top layer and does not.

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
place, swap the two, refuse.

```jsx
<Box
  id={playerId}
  interactions={{
    land: (event) => {
      const { fromId, toId, syncCloneWithDropTarget } = event.detail;
      return document.startViewTransition(() => {
        syncCloneWithDropTarget();
        setLineup((previous) => swapPlaces(previous, fromId, toId));
      }).finished;
    },
  }}
/>
```

`toId` is an element and **never null**: a copy over nothing is a release that
meant nothing, and the interaction does not happen at all.

**Which elements are places: those marked `data-droppable`, and only those.**
Declaring `land` says an element can be CARRIED, which on a board is a different
thing from being somewhere one can be put — a zone receives without ever being
carried, a piece is carried without ever receiving, and both at once is a third
case (dropped on a piece, the two swap, so it says `data-droppable` as well). A
list has no such distinction, every row being both, which is why `reorder` needs
no marker in the markup.

Places are looked for among the carried element's **siblings**, which is what a
board is: pieces drawn beside the places, positioned over them. When what is
carried does not stand among the places — a palette BESIDE the surface it fills, a
marker drawn INSIDE the surface it can be put back on — say what holds both with
`data-drop-container`. It holds the places rather than being one, so it goes on an
ancestor of them: a surface that is itself the place is never found from inside
itself. Missed, nothing lands and nothing says why — so the first press on a
`land` with no place in reach warns, and names the surface it is standing on.

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

It also frees the copy's travel: the places being elsewhere by construction, a
copy kept inside its own scroll area could never reach them.

**When the place is bigger than what stands on it** — a zone holding a smaller
card, a square holding a piece — the copy must not take the place's box, or it
resizes on landing and resizes back when the real element appears.
`syncCloneWithDropTarget` takes an element for that: the copy comes down on THAT
box instead of the target's. Pass whatever occupies the destination — the piece
already standing there, the empty slot waiting.

```jsx
land: (event) => {
  const { fromId, toId, syncCloneWithDropTarget } = event.detail;
  const landingElement = pieceAt(toId) || slotOf(toId);
  return document.startViewTransition(() => {
    syncCloneWithDropTarget(landingElement);
    …
  }).finished;
};
```

#### A place that is a surface

A board's place is an element one can point at. A **surface** — a plan drawn over
an aerial photo, a map, a floor — is one box where every point is a place, and
"which element did it come down on" says nothing there. So the detail says
**where**: `x`, `y`, `width`, `height`, the box the copy came down in, measured
inside the place with its border and its scroll taken out. `toId` still names the
surface it came down on, and nothing changes about the rest — the copy travels,
the original stays where it was.

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
point that was aimed at.

`syncCloneWithDropTarget` is the one thing to leave alone here — called with
nothing it takes the whole surface's box, and there is rarely an element to pass
it either, the thing being created by the answer itself. Not calling it leaves the
copy where the hand put it, over the thing appearing there.

#### Naming what travels

**The copy is already named, and it is the copy that does the visible travel.**
The wrapper carrying it answers to `navi-drag-clone-wrapper`, the copy inside it
to `navi-drag-clone`, and `syncCloneWithDropTarget` moves that box onto the
destination inside the callback — so the piece the hand let go of slides to its
place whether the application names anything or not. What is left to name is the
OTHER one: the piece that was standing there and has to go the other way.

**And the original is hidden for the whole landing**, not only for the drag: it
wears `navi-drag-clone-source` (`visibility: hidden`) until the promise returned
by `land` settles, because the copy stands for it until then. An element that
paints nothing is still captured — the group gets an empty image — so a name put
on the source is a group fading in from nothing, or out into nothing, over the
copy that is doing the real travel. That is what a swap looks like when it fades
instead of sliding.

Both follow from one rule: **a name rides the element that MOVES, and that
element has to be visible at both ends of the transition.** Where the places are
fixed and the pieces are drawn into them, nothing moves — two boxes change
content, and hand-writing a name on each so that it "follows the player" names a
journey whose start or end is the hidden source. Key the piece by WHO it is and
let it be re-parented:

```jsx
{places.map((place) => {
  const playerId = lineupAt(place.id);
  // Keyed by the player: the same DOM node walks from one place to the other,
  // so the browser has something to morph — and the displaced one was visible
  // before and is visible after.
  return <Piece key={playerId} id={playerId} style={boxOf(place)} … />;
})}
```

**The name is written twice, and neither write is redundant.** The old state is
captured the moment `startViewTransition` is called, before any render, so the
name must be on the DOM by then — written by hand, on the element. The render
happening inside the callback would then put the plain name straight back, so
the same name must also come from state. Clear that state when `finished`
resolves: a name left behind is claimed twice by the next transition, and that
one is dropped for it.

```jsx
land: (event) => {
  const { fromId, toId, syncCloneWithDropTarget } = event.detail;
  const displacedId = playerAt(toId);
  const roles = { [fromId]: OVER, [displacedId]: UNDER };
  for (const id of Object.keys(roles)) {
    document.getElementById(id).style.viewTransitionName = roles[id];
  }
  const transition = document.startViewTransition(() => {
    syncCloneWithDropTarget(document.getElementById(displacedId));
    setSwapRoles(roles); // the render inside the callback keeps the names
    setLineup((previous) => swapPlaces(previous, fromId, toId));
  });
  transition.finished.then(() => setSwapRoles(null));
  return transition.finished;
};
```

The roles are names because a `::view-transition` pseudo can be selected by name
and by nothing else — which is also how one of the two is told to pass over the
other, and how the travel is given a length worth a card crossing a board rather
than a menu opening. Both the group and the image pair are addressed: the morph
lives in one, anything a style adds rides in the other.

```css
::view-transition-group(swap_over) {
  z-index: 20;
}
::view-transition-group(swap_over),
::view-transition-image-pair(swap_over) {
  animation-duration: 420ms;
  animation-timing-function: ease-in-out;
}
```

The hint follows what a place is: a line drawn in the gap for `reorder`, the
place itself lit up for `land`. Both are drawn among the places — the carried
element's parent, or the `data-drop-container` when there is one — so the
variables dressing them are read from the list, the board or the surface and reach
them by plain inheritance. The copy goes the other way: it is drawn beside the
thing it copies, and dressed by where that thing stands.

| Variable                                                                                   | Dresses                 |
| ------------------------------------------------------------------------------------------ | ----------------------- |
| `--drop-hint-size` `--drop-hint-background-color` `--drop-hint-border-radius`              | the line of a reorder   |
| `--drop-hint-margin-x` `--drop-hint-margin-y` `--drop-hint-arrow-size`                     | where it sits, its caps |
| `--drop-surface-border-width` `--drop-surface-border-color` `--drop-surface-border-radius` | the lit place of a land |
| `--drop-surface-background-color`                                                          | and its fill            |

### Saying the grab is acquired: `grab`

The interactions above answer the **release**. Between the press and the release there is
one instant that counts for the hand: the one where the object stops being pressed
and starts being held. `grab` is that instant — the same one whichever way the drag
was entered, a finger held still or a mouse travelled a few pixels.

```jsx
<Box
  interactions={{
    toss: (event) => remove(event.detail.id),
    grab: () => navigator.vibrate?.(10),
  }}
/>
```

It matters most where it is least visible. On a screen the held object is under the
thumb that hides it, so the only feedback available is the one that is felt; without
it the hand waits, doubts the press was heard, and lets go too early — the whole
gesture fails, not its decoration. With a mouse the grab is acquired after a few
pixels and the object has visibly moved, so the answer is already there.

Nothing here is about vibration: a sound, a class, a measure are the same moment.

If what the moment is for is **paint**, no listener is needed at all: navi puts
`data-grabbed` on the element for as long as the gesture holds it, and a
stylesheet draws from that. `grab` is for what a stylesheet cannot do — the
vibration above, a state kept elsewhere, a counter.

`grab` **reports, it does not ask**: what it returns is not waited on, and
preventing its event does not call the gesture off. And it is not an interaction on
its own — declared without one of the five above there is no gesture for it to be
the beginning of, and a dev warning says so. Its detail carries `pointerType` and
the `gestureInfo`.

A `longpress` needs none of this: it already happens at the moment the hold is
acquired, not at the release.

### Saying the hold is let go: `release`

The mirror of `grab`, and the only interaction of the family always told. Each of
the five above answers ONE meaning, so a release that means none of them — let go
of over nothing, taken away by the system — reaches nobody, and whatever `grab` set
up stays set up with nothing to take it down.

```jsx
<Chip
  interactions={{
    grab: () => setCarrying(kind),
    land: (event) => add(kind, event.detail),
    release: () => setCarrying(null),
  }}
/>
```

A bank of chips one drags onto a plan is the case: the counter must count what is
in the hand from the moment the copy takes off — « Terrain 4/21 » before it lands —
and something has to say when the hand is empty again, whether the copy landed,
flew off or came home.

Its detail is `{ id, x, y, outcome }`. `outcome` is which of the five is about to
answer — `"move"`, `"reorder"`, `"land"`, `"toss"`, `"leave"` — or `null` when the
release means none of them. It is told **before** that answer runs, so what the grab
put up comes down at the moment the hand lets go, while still knowing whether
something is on its way.

Like `grab`, it **reports, it does not ask**, and it is not an interaction on its
own: a moment of a drag needs a drag to happen in, and a dev warning says so.

### The hand pulls and nothing follows: `refuse`

Something that can be carried is not always free to be: a court whose place on the
plan is settled, a marker pinned by whoever owns it. Taking the interaction away —
`move: false` — makes the element **deaf** rather than locked. The press is then
nobody's, so whatever it stands on answers it (the surface pans under an object the
hand was aiming at), and the pull is told nothing at all — and a thing that does not
move and says nothing reads as a screen that is broken, so the hand insists.

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

So the interaction stays declared and says `"refuse"` in place of what it does. The
threshold is the same one (a mouse travelling, a finger holding still, the first
pixel inside a `data-drag-on-contact`), and at the instant the grab would have been
acquired there is none: nothing translates, no copy is made, no release is
answered. `refuse` is that instant, and the one where feedback is expected.

**It walks no axis, so it takes none.** Everything that reads what a drag source
walks to know what is left for itself — a box that travels, a surface that pans —
steps over an element that is refusing: a swipe starting on a locked row is the
row of slides' swipe, a drag starting on a pinned court pans the plan. A thing
that cannot be taken hold of is exactly the one a hand rests on without thinking,
and a surface with a dead zone the size of an object in the middle of it is wrong
every time. So `move: "refuse"` really is `move: false` plus a word to the hand.

**The press itself stays the element's**, and is settled there like any other
gesture settles one: the pointer is taken, so a `longpress` declared beside the
drag does not answer a hundred milliseconds later, and the click the release
leaves behind is swallowed. What is locked behaves like what is not, up to the
moment it says no. The exception is a box declaring `pan`/`zoom`, the one thing
that takes a press whole and in every direction: there the surface keeps it, and
the refusal is told without taking anything — no pointer, no click, nothing
prevented.

One outcome refusing refuses the whole gesture — the five answer one carry, and
something that must not be carried has none of them. Like `grab` and `release`,
`refuse` **reports, it does not ask**, and it is not an interaction on its own.
Its detail is `{ pointerType }` and nothing more: there is no `gestureInfo`
because there was no gesture, and what feedback wants to know is which hand asked
— a vibration for a finger, nothing extra for a mouse whose cursor has already
said it.

### Dressing the clone

What the pointer carries is a copy, and a copy of a transparent element is
invisible — an element has no background unless something gave it one, and a row
usually gets its own from the list around it, which the copy has left. So the
clone's look is the page's to declare, through the attributes the gesture puts on
it:

| Attribute                 | On                                                     |
| ------------------------- | ------------------------------------------------------ |
| `navi-drag-clone`         | the copy being carried                                 |
| `navi-drag-clone-wrapper` | what positions it (already shadowed, in the top layer) |
| `navi-drag-clone-source`  | the original, still in place (already hidden)          |

```css
.task[navi-drag-clone] {
  background: white;
  border-radius: 6px;
}
```

Reusing the item's own class is the point: the copy is that item, so it is styled
as that item plus whatever being carried changes.

**Which is also the trap, for anything positioned on a board.** The copy is the
same element re-parented into a carrier box, so a geometry written in the style
attribute follows it there — `width: calc(50% - 2 * var(--gap))` then means half
of the copy instead of half of the board, and the piece is carried at the wrong
size. Put what a piece LOOKS like in a class and leave only which place it is
inline (two custom properties will do), then let it fill its carrier:

```css
[navi-drag-clone-wrapper] .piece {
  position: static;
  width: 100%;
  height: 100%;
  translate: none;
}
```

Said of what is inside the wrapper rather than of `[navi-drag-clone]` itself,
because the copy loses that mark as it lands — that is how it drops its lift for
the transition — and it has to keep its size all the way down. The copy is a real element in the
page, in the top layer, and everything about its look is reachable from CSS —
including these, read off the dragged element so a whole list or a single item can
answer:

| Variable              | What it changes                                               |
| --------------------- | ------------------------------------------------------------- |
| `--drag-clone-shadow` | what being lifted casts; `none` for something that flies flat |
| `--drag-clone-scale`  | how much bigger it gets once picked up; `1` to keep its size  |

**What stays behind is the source, not a hole.** The original is never taken out of
the page — it keeps its place in the layout and wears `navi-drag-clone-source`,
which only makes it `visibility: hidden`. So a mark left where the thing was — an
imprint, a dashed outline, the shape a note was pinned on — is drawn ON that
element and not next to it, and its parts have to say `visibility: visible` to come
back from the hidden source:

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

It stays until the answer settles, which is what makes it say where the thing left
from for as long as the question is open — and if the answer refuses, the copy comes
back to it.

`data-drag-axis` says which axes the drag walks, and its default is not the same
for every outcome: `reorder` alone walks the list (`y`, or `x` for a list that runs
sideways), while a `move` goes wherever it is put, a `land` wherever the board has
places, a `toss` wherever it was thrown and a `leave` out by whichever edge (`xy`).
`data-drag-delay`,
`data-drag-slop`, `data-drag-threshold` tune when the press becomes a grab.

### What says a thing can be picked up

Almost nothing, on purpose. A **handle** (`data-drag-handle`) exists only to drag,
so it shows the hand; a **source** does not — it drags only once the intent shows,
a plain click on it stays a click, and it is usually something else FIRST (a link,
a card one opens). The cursor says what an element IS, and the gesture is not the
one who knows, so it leaves it alone (`default`, not an I-beam: with a mouse the
text inside cannot be selected either — a finger is another matter, see below).

So on a board where a piece is also clickable, the cursor is already spoken for and
the affordance has to be said in the piece itself — a grip mark in a corner, a
shadow appearing under the pointer, a handle. It is worth deciding, not defaulting:
a board one may drag on is worth nothing if nobody tries.

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
press is there for the drag: nobody selects the word inside a thing they are
carrying. Keep the selection where the text IS the point (a note one copies from)
and give that one a `data-drag-handle`: the grip drags, the text stays text.

navi says it on its own in one place only, inside `[data-drag-on-contact]`, where
there is no wait left to answer the finger with.

## A gesture whose product is a value

`move`, `reorder`, `land`, `toss` and `leave` answer the same question — where did
the element end up — because all five carry it. A rotation does not: what comes out
of it is an angle, and the handle that produced it stays exactly where it is. Same
for a scale, or a sun dragged around a plan to set the hour.

What navi names is never the value: it does not know that these pixels are an
angle, that the angle snaps to the neighbouring court, or where the result is
kept. What it names is the **arbitration** — a press that could have been a tap, a
scroll, a page travelling, the surface underneath — and once that is settled it
hands the numbers over. `moving` is that for something carried (the deltas from the
grab, every frame, nothing translated), `pan` and `zoom` for a surface under the
hand ([pan_zoom.md](./pan_zoom.md)). A value gesture written on either of those two shapes is `interactions`
work, and the machinery below is not needed for it.

What is left to it is a gesture whose SHAPE is none of navi's: it does not begin on
an element that could be carried, or on a surface — it begins wherever the
application says, on its own rules. Then navi hands over the machinery instead and
leaves the paint alone:

```js
import { createDragGestureController, dragAfterIntent } from "@jsenv/navi";

const onPointerDown = (pointerDownEvent) => {
  dragAfterIntent(pointerDownEvent, () => {
    const controller = createDragGestureController({
      onDrag: (gestureInfo) => {
        const { xDelta, yDelta } = gestureInfo.layout;
        angleSignal.value = snapToNeighbours(angleFromDelta(xDelta, yDelta));
      },
      onRelease: (gestureInfo) => {
        if (gestureInfo.cancelled) {
          return;
        }
        COURT.PUT.run({ angle: angleSignal.peek() });
      },
    });
    return controller.grabViaPointer(pointerDownEvent, {
      element: pointerDownEvent.currentTarget,
    });
  });
};
```

An element that ends up somewhere is NOT this: that one is `move` — or `land` when
what it ends up on is a surface and a copy is what travels — and doing it by hand
gives up the constraint, the commit and the way back when the answer refuses.

Three things come with the machinery, and they are the reason not to write it again:

- **When the press becomes a drag** is `dragAfterIntent`, and the answer is not one
  policy but three: a `data-drag-handle` exists only to drag, so it takes the
  gesture on contact; a mouse resolves it by distance; a finger resolves it by
  TIME, because travel is exactly what a scroll looks like. One timer for every
  pointer makes the mouse wait for something it never had to prove.
- **A touch has to be refusable before it is refused.** `touch-action` must be
  non-`auto` when the finger LANDS: after that the touch is on the compositor's
  fast path, every `preventDefault` is an intervention, and on Android the scroll
  runs away with the object. `markDragSource(element, axes)` says it from a
  stylesheet, on the source itself — which is how what surrounds it keeps
  scrolling. A blanket `touch-action: none` on the container buys the same drag by
  taking the pan away, and the pan then has to be written by hand too.
- **A capture that goes was not necessarily given back.** `lostpointercapture`
  reads the same whether the gesture handed the pointer over or the browser dropped
  it mid-drag, which it does more often than the specification suggests. The loop
  tells the two apart, and `gestureInfo.cancelled` is where it comes out: a release
  nobody asked for must commit nothing.

A gesture driven this way is outside the registry, so it says so itself to whatever
travels above it: `data-no-drag-travel` (see `docs/drag_to_travel.md`).

## Reference

- `src/control/interaction/interaction_drag.js` — `move`, `reorder`, `land`,
  `toss`, `leave` and the `grab`/`release`/`refuse` moments.
- `@jsenv/dom` — `src/interaction/drag/drag_gesture.js` (the loop, its options
  and what `gestureInfo` holds) and `src/interaction/drag/drag_after_intent.js`
  (when a press becomes a drag, and what a source says in the stylesheet).
- `src/control/demos/38_interactions_demo.html` — a board whose places are
  zones and the same board whose places are the pieces.
- `src/control/demos/integration/5_plan_editor_demo.html` — a place that is a
  surface: shapes dragged out of a bank onto a plan, moved on it, and dragged off
  it to go; and an address point that travels itself (`move` + `leave`).
