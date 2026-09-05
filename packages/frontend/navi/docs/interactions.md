# `interactions` — a component that answers more than a click

## What we want

An element should be able to answer a gesture — a row swiped aside to archive it,
a card held down to open a menu, a shortcut that sends a form — and the person
writing that element should only have to **name** the gesture and say what it
does.

Everything hard about a gesture is not the detection. It is the four things
around it:

- **who owns the press** when boxes are nested (a row swiped sideways inside a
  container that travels sideways);
- **which of several gestures a single press turns out to be** (a swipe, a hold, a
  click — one press, one arbiter);
- **the click the browser fires afterwards**, which would follow the link the
  gesture started from;
- **whether the element is allowed to be interacted with at all** (disabled,
  read-only, waiting on something).

navi owns those four. An application that reads the pointer itself gets two of
them wrong by construction, because two of them can only be decided from inside
navi and before the first pixel moves.

## The prop

`interactions` is a prop of `Box`, so it is available on anything built from
one — `Box`, `List.Item`, `Button`, `Link`, the field components. Its keys are
**event types**, its values say what that interaction does.

```jsx
<Box
  interactions={{
    "swipe_right": "request_action",
    "swipe_left": (event) => markUnread(event),
    "longpress": (event) => openMenu(event),
    "keyboard:ctrl+backspace": "request_action",
  }}
/>
```

`action` is a control's prop and is untouched by this: a control keeps its own
wiring — a click on a button, a change on a field — and `interactions` is the
other half, everything that is not that natural one. A plain `Box` has no such
wiring: it does nothing with `action` (dev warns), and a click on it is declared
like any other interaction, `interactions={{ click: onSelect }}`. The click the
browser fires after a drag is already suppressed, so `click` sits next to `move`
or `grab` without fighting them.

### The three values

| Value                 | Meaning                                              |
| --------------------- | ---------------------------------------------------- |
| `"request_action"`    | ask the nearest control for its `action` prop        |
| `"request_ui_action"` | ask it for a ui action (what says "the user acted")  |
| a function            | do this, with the interaction event as only argument |

A falsy value means "not this one", so an interaction can be declared under a
condition: `{ swipe_right: canArchive && archive }`.

### The interactions navi detects

| Key                                                    | Read from                                      |
| ------------------------------------------------------ | ---------------------------------------------- |
| `mousedown` `mouseup` `click` `dblclick` `contextmenu` | the browser's own events                       |
| `swipe_left` `swipe_right` `swipe_up` `swipe_down`     | a press that travels                           |
| `longpress`                                            | a press held still                             |
| `move` `reorder` `land` `toss` `leave`                 | the element carried, and what letting go means |
| `grab` `release`                                       | the instants a drag takes hold, and lets go    |
| `pan` `zoom`                                           | a surface under the hand, or under a wheel     |
| `"keyboard:<shortcut>"`                                | keys, e.g. `"keyboard:ctrl+backspace"`         |

A name nothing knows how to detect produces a dev warning naming the detectors
that exist.

## Which interaction asked

An interaction navi makes is **dispatched as an event of its own name** —
bubbling, cancelable, chained onto the event it was read from. So an action does
not need to be told which interaction asked for it: it reads the event it already
receives.

```jsx
<Button
  action={(value, { event }) => {
    const swipe = findEvent(event, "swipe_right");
    if (swipe) {
      const { axis, sign, pulled, size, progress } = swipe.detail;
    }
  }}
  interactions={{ swipe_right: "request_action" }}
/>
```

`findEvent` is exported from `@jsenv/navi`. Because these are real events, an
ancestor can also listen for one, and `preventDefault()` on it means "not this
time".

The lower-level event the interaction was read from is reachable too:
`interactionEvent.detail.event` is the `pointerdown` a swipe or a hold was made
of — which is how a menu is opened at the point the press happened.

## Reaching the control

Everything goes through the interaction gate of the **nearest control** — itself,
an ancestor, or a descendant, in that order. So a disabled, read-only or busy
control answers a swipe the way it answers a click: it says why, where the
interaction happened, and nothing runs. A `Box` with no control anywhere near it
still answers a callback; only `"request_action"` has nothing to ask, and says so
in dev.

The one thing the gate weighs besides the control's state is what the
interaction would do to it. Everything writes unless it says otherwise; an
interaction that only shows what is already there declares `intent: "read"`, and
a control held read-only lets that one through. That is how a read-only
`<Picker>` still opens: the popup is where its answer is really drawn, so it
opens and everything inside it is held read-only in turn. Disabled and busy go
on refusing either way — one is out of service, the other is mid-operation, and
neither has anything to show.

Which controls let a read through is theirs to say, not the caller's: a picker
with no popup of its own opens the browser's, which cannot be held read-only, so
that one refuses. `openWhileReadOnly={false}` is how a caller says the popup is
a form with nothing to read.

## What a swipe draws, and what it leaves to you

navi makes the element follow the finger — there is nothing to decide about
that — and says where the gesture is up to:

| Written on the element                   | Meaning                                 |
| ---------------------------------------- | --------------------------------------- |
| `--swipe-pulled`                         | how far it has come, signed, in px      |
| `--swipe-progress`                       | the same as a fraction, signed          |
| `[data-swiping="left\|right\|up\|down"]` | which way, while a finger holds it      |
| `[data-swipe-past-threshold]`            | letting go now would go through with it |

WHAT is revealed behind is yours: navi does not know what putting a row away
looks like. A trail is usually a child of the swiped element sized off
`--swipe-pulled`. Both values inherit, so a child reads them; a sibling cannot,
which is why the trail goes inside — and it travels with the row, since what
navi translates is the element that declares the gesture.

```css
.trail {
  position: absolute;
  top: 0;
  right: 100%; /* the strip the row just left */
  bottom: 0;
  width: var(--swipe-pulled);
  opacity: calc(var(--swipe-progress) * 3);
}
[data-swipe-past-threshold] .trail {
  background: var(--ok-color);
}
```

While the answer takes time, the element **stays where the gesture left it**, and
comes back once it settles — a failure leaves the row in place so it can be tried
again. What a success does to the element is yours (a list that redemands its
rows, a row that leaves): navi does not make it disappear.

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

### An affordance inside somebody else's box: `selfInteractions`

A chip's cross inside a carried piece, an eye on a row that travels, a diskette
on a picker's façade. It is aimed AT, not merely inside — but aimed at for
WHAT, which is the whole of the prop:

```jsx
<Badge.Button selfInteractions="click" onClick={() => remove(id)}>
  ×
</Badge.Button>
```

The press is now this cross's alone: no navi control above it answers the
mousedown or the click, and its `onClick` waits for its own interaction gate
instead of firing from the DOM.

#### Why it is a list, and why it is required

A press is not a drag. A drag announces itself — a few pixels of travel with a
mouse, a long hold with a finger — and a click is the absence of both, so the
two can be told apart without anyone guessing at pointerdown. An affordance
that claimed every gesture at once would be a HOLE in whatever it sits in: a
badge drawn against the edge of a card is a seventh of that card, and precisely
the edge one grabs to carry it.

So the claim names its interactions, and what it does not name stays the zone's:

| written                         | takes                        | leaves                                     |
| ------------------------------- | ---------------------------- | ------------------------------------------ |
| `selfInteractions="click"`      | the press                    | the grab — the card is still carried by it |
| `selfInteractions="click drag"` | both                         | —                                          |
| `selfInteractions="*"`          | every gesture, now and later | —                                          |

`"*"` is there for the case where it is true, not as a shorthand: it is the one
value that will silently swallow a gesture navi has not shipped yet.

`data-drag-ignore` says a different thing, to the gesture alone and for all of
them at once: the press there is none of the gesture's business, and the element
keeps both its cursor and its text selection.

#### Where the zone blocks: does it write to the control it sits in?

That question, and nothing else, picks `whenSelfInteractionsBlocked` — what
becomes of the affordance where the zone around it is disabled or read-only.
The claimed interactions are its subject, and only them: the ones left to the
zone were never this element's to block.

| what it does                                                 | written                                | on a blocked zone                         |
| ------------------------------------------------------------ | -------------------------------------- | ----------------------------------------- |
| writes to it (a cross that removes, a stepper)               | nothing — `"hide"` is the default      | it goes                                   |
| writes to it, and its presence says there is something there | `whenSelfInteractionsBlocked="refuse"` | it stays and refuses with a callout       |
| never touches it (a diskette saving into MY address book)    | `whenSelfInteractionsBlocked="ignore"` | nothing changes: still lit, still pressed |

A greyed cross that still removes is worse than no cross — hence the default.
`"ignore"` is the other extreme and the caller owns it: the zone's read-only is
about a value the affordance does not write, so answering "read-only" to a
gesture that was never going to write anything says nothing true. Use it only
when that is really the case.

navi's own `<Dialog.Close />` is the second canonical case: a read-only picker
still opens, and leaving what it opened writes nothing to it — so the cross is
`"ignore"` and a hand-written one must say the same, or it refuses the press
aimed at the way out (see
[popup_open.md](./popup_open.md#the-close-cross)).

Busy is not on the list because busy does not block: it is the read-only a
running action sets on its way that does.

#### The third question: whose value is it?

`selfInteractions` and `whenSelfInteractionsBlocked` are about the **gesture** —
who a pointer event belongs to, and what a block on the box around it does to
that gesture. Whose **value** an element carries is a separate question, and
`standalone` answers it: the control does not register with the form, picker or
group around it, so what it holds never joins that value (see
[form_changed.md](./form_changed.md#a-control-that-answers-for-itself)).

The three come apart, which is why they are three props:

| the element                                             | says                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| a chip's cross                                          | `selfInteractions` — it is a button, it never carried a value               |
| a door opening a sheet that writes into the form        | `standalone` — no value of its own, but a read-only form must still shut it |
| a diskette filing a name into the reader's address book | all three — own press, block is not about it, own value                     |

Reading `standalone` as "ignore everything around me" is the trap: `disabled`,
`readOnly` and `loading` travel on their own contexts and go on reaching it,
because "what do I hold" and "may anything be changed here" are not the same
question.

#### On something you draw yourself

`selfInteractions` is a `Box` prop too, so an affordance does not have to become
a control to claim its interactions — a pastille positioned in a card's corner
by its own class stays exactly what it was drawn as:

```jsx
<Box as="button" selfInteractions="click" className="court_side" onClick={explain}>
```

On a box the prop does exactly one thing: it writes `data-self-interactions`.
That attribute is the claim — it is what the controls above read, and what the
gesture readers read (`data-drag-handle`, `data-drag-ignore` and friends are the
same vocabulary), each picking its own word out of it. Writing it by hand on an
element navi does not render works and is the last resort: a typo there is
silent, whereas the prop is spelled once and checked.

`whenSelfInteractionsBlocked` is the other half, and it belongs to controls: it
is about a gate, a callout and a control's own read-only, none of which a box
has. A box claims interactions and nothing more; put the affordance on a control
when what it does about a held zone matters.

#### When the affordance should sit OUTSIDE instead

`selfInteractions` says a façade CAN yield a zone; it does not say it should.
What decides is whether the affordance stays where the finger left it.

An icon that lives inside its control while that control is showing, and
becomes a pill of its own once it is not, is a switch that moves when you flip
it: the finger that opened the search has to travel somewhere else to close it.
Draw it outside both controls, at a fixed place, and the same pixel does both —
which is the whole gesture on a phone. `<ControlSwap>` is that row: two
controls taking turns in the middle, a fixed cap at each end.

So: an affordance that acts on what it sits in (a chip's cross, a stepper, an
eye on a row) belongs inside, and takes its press back with `selfInteractions`.
One that swaps what is being shown belongs outside it, where it can stay put.

Whichever side of the frame it ends up on, the control must be told, because a
control draws affordances of its own and will otherwise draw a second one:

- **inside** — a field has slots for it, `Input.UI.LeftSlot`,
  `Input.UI.RightSlot`, `Input.UI.IconSlot` (an icon sized on the line rather
  than on a character) and `Input.UI.UnitSlot`. They label the field, so a
  press lands on it rather than blurring it — except when the field is not
  focused yet, where the slot may take the focus itself, which is what a clear
  cross or a reveal-password eye needs.
- **outside** — the icon the type would have drawn has to go, or it sits two
  centimetres from yours: `icon={null}`. It is the same prop that replaces it
  (`icon={<MySvg />}`) and that leaves it alone (left out). A `search` field
  still swaps that slot for its clear cross once it holds a value, whatever
  `icon` says — the cross is about the value, not about the decoration.

```jsx
<Input type="search" icon={null} /> // the row draws the magnifier
```

#### navi steps back; a plain `onClick` does not

What the claim stops is navi answering: the controls above it, and the gestures
it named. It does **not** stop the event — the propagation is left whole, so
that everything which is not a navi interaction still sees the press it always
saw. A raw `onClick` on an ancestor is one of those, and still fires; stop it
there yourself if it must not.

### What says a thing can be picked up

Almost nothing, on purpose. A **handle** (`data-drag-handle`) exists only to drag,
so it shows the hand; a **source** does not — it drags only once the intent shows,
a plain click on it stays a click, and it is usually something else FIRST (a link,
a card one opens). The cursor says what an element IS, and the gesture is not the
one who knows, so it leaves it alone (`default`, not an I-beam: the text inside
cannot be selected either).

So on a board where a piece is also clickable, the cursor is already spoken for and
the affordance has to be said in the piece itself — a grip mark in a corner, a
shadow appearing under the pointer, a handle. It is worth deciding, not defaulting:
a board one may drag on is worth nothing if nobody tries.

## Tuning

Read off the element or any ancestor carrying the attribute, so a whole list is
tuned in one place and a stylesheet can read the same value.

| Attribute              | Default | Meaning                                   |
| ---------------------- | ------- | ----------------------------------------- |
| `data-swipe-threshold` | `0.33`  | fraction of the element to pull to commit |
| `data-longpress-delay` | `450`   | ms the press must be held                 |
| `data-longpress-slop`  | `8`     | px the pointer may drift during the wait  |

A threshold is a **fraction and never a distance**: the same gesture must mean
the same thing on a phone and on a wide screen. Speed answers on its own on top
of it — a brief flick counts whatever the distance covered.

## Registering an interaction navi does not have

The registry holds no detector of its own: navi's swipes, holds and shortcuts go
through the same door an application uses.

```js
import { defineInteractionDetector } from "@jsenv/navi";

defineInteractionDetector({
  name: "triple_click",
  claims: (type) => type === "triple_click",
  setup: (element, trigger) => {
    let count = 0;
    let timeout = null;
    const onClick = (clickEvent) => {
      count++;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        count = 0;
      }, 1000);
      if (count < 3) {
        return;
      }
      count = 0;
      trigger(clickEvent);
    };
    element.addEventListener("click", onClick);
    return () => {
      clearTimeout(timeout);
      element.removeEventListener("click", onClick);
    };
  },
});
```

`setup(element, trigger, { types, readConfig })` runs **once per element** and
returns how to undo whatever it did. Listeners, attributes, anything: it is a
plain setup and teardown, so a detector counts what it needs in its own closure
and nothing has to hold state on its behalf.

`claims` takes a **set** of names rather than one, because interactions sharing an
input have to be arbitrated together — a swipe, a hold and a click dispute the
same press, and read apart they walk over each other. `types` (third argument) is
which of them were actually declared here.

`trigger(type, originalEvent, detail)` says the interaction happened. Called with
a single event — `trigger(event)` — the type is the detector's own, which only
works when exactly one of its names is declared. When `originalEvent.type` is
already the interaction's name (a native one), that event IS the interaction and
no second one is dispatched.

It returns **`null` when nothing ran** (the gate refused, no control to ask, the
interaction event was prevented) and otherwise a **promise**: resolved once the
effect worked, rejected when it did not. Those two answers are not the same and a
detector usually treats them differently — a row pulled out comes back either
way, something thrown off the screen only comes back if the throw failed.

`readConfig(attribute, defaultValue)` reads a number off the element or any
ancestor carrying that attribute, so a whole list is tuned in one place.

A detector that reads the pointer must mark itself in the DOM so a travelling
container above it does not take the gesture:
`element.setAttribute("data-no-drag-travel", "")`, undone in the teardown (see
`docs/drag_to_travel.md`). navi's own swipes do the equivalent with
`data-travel-by-drag`.

## A surface under the hand: `pan`, `zoom`

A plan drawn over an aerial photo, a map, a floor: one box the hand drags to look
elsewhere on, pinches or rolls a wheel over to look closer at, with things carried
across it that must not drag the surface along.

```jsx
<Box
  interactions={{
    pan: (event) => moveCenterBy(event.detail), // { x, y } since the last one
    zoom: (event) => zoomBy(event.detail), // { factor, x, y }
  }}
>
  {markers.map((marker) => (
    <Marker interactions={{ move: (event) => place(marker, event.detail) }} />
  ))}
</Box>
```

Both are a **stream**, reported on every frame: `pan` says how far the hand has
moved since the previous `pan`, in px; `zoom` by what factor (above 1 is in) and
around which point of the surface, measured inside its border — the point between
the fingers, or under the wheel. Two fingers are one gesture, the point between
them panning and the distance between them zooming, and a finger lifting
re-anchors on what is left. What a pixel of pan means in your coordinates, and
whether the zoom is continuous or stepped, is yours: the numbers are the numbers.

What navi holds is what has to be settled **before** the press: `touch-action` on
the surface, said from a stylesheet because a browser decides what a touch may do
when it lands; the pan stepping back for what is carried across the surface (a
`move`, a handle, a field, a popover — the same list a travelling box steps back
for); the pinch not beginning as a pan under its first finger; the wheel and the
pinch writing one `zoom`; the capture, the pointer the browser drops, the click
the release leaves behind. A pointer pans only once it has travelled a few px
(`data-drag-threshold`), so a tap stays a tap and a `longpress` declared beside
`pan` still gets its hold.

Declared alone, `zoom` takes two fingers and the wheel and leaves one pointer to
whatever else reads it; `pan` alone leaves the wheel to the page.

## A gesture whose product is a value

`move`, `reorder`, `land`, `toss` and `leave` answer the same question — where did
the element end up — because all five carry it. A rotation does not: what comes out of
it is an angle, and the handle that produced it stays exactly where it is. Same for
a scale, or a sun dragged around a plan to set the hour.

navi names none of those, and it is not an oversight: an interaction names an
**outcome** — something that happened once, that can be told, refused, awaited.
There is no outcome here, only a number read while the hand is still moving, and
what to do with it (snap it to the neighbouring court, draw it, keep it in a
signal) is knowledge navi does not have. `pan` and `zoom` above are the one
exception, and not for the number: a surface has an arbitration to settle before
the press — what it yields to, what a touch on it may do — and arbitration is
what `interactions` is for. A handle has none; it is the whole surface of its own
gesture. So for those navi hands over the machinery instead and leaves the paint
alone:

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

## Things worth knowing before guessing

- **A drag says its axes to whoever else answers the press.** `data-drag-axis`
  is written into the DOM as `data-drag-source`, and a box above that travels
  under the same finger reads it before answering: a list reordered vertically
  inside a row of slides swiped sideways leaves the sideways gesture alone, and a
  piece carried both ways inside a bottom sheet takes the press whole. Nothing to
  wire — see `docs/drag_to_travel.md`. A `Dialog` docked to the bottom edge goes
  further and reads the press only on its header (plus anything carrying
  `data-swipe-grip`), so its body is free whatever is in it.
- **A hold does not take the context menu.** Declaring `longpress` says what a
  held finger does; a right click comes from the other button and keeps opening
  the browser's menu. Declare `contextmenu` beside it to make the right click do
  the same thing. (A held _finger_ is the system's own context-menu gesture, and
  that one is refused while the wait runs.)
- **Where the press already means something, text is not selected.** An element
  declaring `longpress` or a swipe, and a drag source standing in a
  `data-drag-on-contact` place, keep their text unselectable: the browser answers
  that same press with a selection of its own — the word under the thumb, blue,
  with handles — and nothing takes it back once the press is over. For every
  pointer, mouse included, which cannot finish a selection begun where the press
  is a gesture. What never answered that press keeps its text: a field, a popover
  or a dialog opened from inside, and anything marked `data-drag-ignore`. A drag
  source taken by long press is not concerned — the grab happens first, and the
  gesture refuses the selection for its own length.
- **A swipe cannot also be dragged out of the page.** An element declaring a
  swipe gets `draggable={false}` and its `dragstart` refused — a native drag _is_
  press-and-move, and a link or an image is draggable without anyone asking. One
  gesture cannot mean both.
- **`interactions` adds, it does not replace.** A control's own wiring stays:
  `actionEvent` / `actionOnMouseDown` are still how you change what triggers
  `action` by default.
- **A popup can open while the finger is still down.** navi's `Popover` is
  `popover="manual"` and owns its dismissal, so the `pointerup` ending a hold is
  not read as an interaction outside it — a menu can appear under a waiting
  finger, which is the native gesture. To place it at the press point rather than
  on the element:
  `triggerNaviCommand(target, "--navi-open", interactionEvent, { anchor })`.
- **A swipe has no keyboard equivalent.** There is nothing to press that means
  "swipe right", so a swipe is only reachable if something else on the element
  offers the same thing — a `"keyboard:<shortcut>"`, a `contextmenu`, or the
  control's own action.

## Reference

- `src/control/interaction/interaction_registry.js` — the prop, the three values,
  the registry.
- `src/control/interaction/interaction_press.js` — swipes and holds, and what a
  swipe writes on the element.
- `src/control/interaction/interaction_drag.js` — `move`, `reorder`, `land`,
  `toss`, `leave` and the `grab`/`release` moments.
- `src/control/interaction/interaction_surface.js` — `pan` and `zoom`, on
  `installPanZoom` from `@jsenv/dom`.
- `src/control/interaction/interaction_keyboard.js`,
  `interaction_native.js` — the other two detectors.
- `@jsenv/dom` — `src/interaction/drag/drag_gesture.js` (the loop, its options and
  what `gestureInfo` holds) and `src/interaction/drag/drag_after_intent.js` (when a
  press becomes a drag, and what a source says in the stylesheet).
- `src/control/demos/38_interactions_demo.html` — every case above, plus a
  mailbox, a board whose places are zones and the same board whose places are the
  pieces, a surface panned and zoomed, and a custom gesture registered from the
  page.
- `src/control/demos/integration/5_plan_editor_demo.html` — a place that is a
  surface: shapes dragged out of a bank onto a plan, moved on it, and dragged off
  it to go; and an address point that travels itself (`move` + `leave`).
