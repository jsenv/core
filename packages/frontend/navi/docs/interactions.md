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

`action` is untouched by this and keeps its own wiring — a click on a button, a
change on a field. `interactions` is the other half: everything that is not that
natural one.

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
| `move` `reorder` `toss`                                | the element carried, and what letting go means |
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

## What a swipe draws, and what it leaves to you

navi makes the element follow the finger — there is nothing to decide about
that — and says where the gesture is up to:

| Written on the element                   | Meaning                                   |
| ---------------------------------------- | ----------------------------------------- |
| `--swipe-pulled`                         | how far it has come, signed, in px        |
| `--swipe-progress`                       | the same as a fraction, signed, inherited |
| `[data-swiping="left\|right\|up\|down"]` | which way, while a finger holds it        |
| `[data-swipe-past-threshold]`            | letting go now would go through with it   |

WHAT is revealed behind is yours: navi does not know what putting a row away
looks like. A trail is usually a child of the swiped element sized off
`--swipe-pulled` — which is what makes those values reachable from CSS at all, a
sibling could not read them.

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

## Carrying something: `move`, `reorder`, `toss`

All three are the same gesture — the element is picked up and carried — and what
differs is the release. One detector reads them all, because it is one press.

`reorder` and `toss` **combine**: dropped on another item the element changes
places, thrown far and fast it is gotten rid of. `move` does **not** combine with
`reorder` — an element either goes where it is put or takes a place in a list,
and one release cannot mean both (a dev warning says so).

`move` carries the element ITSELF and leaves it where it was put; the other two
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

**Declaring `toss` frees the area by itself.** What is dragged is otherwise kept
inside its scroll area — right for a reorder, since a row belongs to its list, and
fatal for a throw: the copy hits the edge of the list, no distance is ever covered,
so no throw can happen and no sideways movement is even visible. So the two
together let it leave.

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
other two carry a copy above the page while the original keeps its place, with a
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
| `data-toss-distance` `data-toss-speed`                   | how far and how fast counts as a throw |

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

`data-drag-axis` says which axes the drag walks, and its default is not the same
for every outcome: `reorder` alone walks the list (`y`, or `x` for a list that runs
sideways), while a `move` goes wherever it is put and a `toss` wherever it was
thrown (`xy`). `data-drag-delay`, `data-drag-slop`, `data-drag-threshold` tune when
the press becomes a grab.

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

## Things worth knowing before guessing

- **A hold does not take the context menu.** Declaring `longpress` says what a
  held finger does; a right click comes from the other button and keeps opening
  the browser's menu. Declare `contextmenu` beside it to make the right click do
  the same thing. (A held _finger_ is the system's own context-menu gesture, and
  that one is refused while the wait runs.)
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
- `src/control/interaction/interaction_keyboard.js`,
  `interaction_native.js` — the other two detectors.
- `src/control/demos/38_interactions_demo.html` — every case above, plus a
  mailbox and a custom `swipe_out` gesture registered from the page.
