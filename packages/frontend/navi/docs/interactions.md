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

| Key                                                    | Read from                              |
| ------------------------------------------------------ | -------------------------------------- |
| `mousedown` `mouseup` `click` `dblclick` `contextmenu` | the browser's own events               |
| `swipe_left` `swipe_right` `swipe_up` `swipe_down`     | a press that travels                   |
| `longpress`                                            | a press held still                     |
| `"keyboard:<shortcut>"`                                | keys, e.g. `"keyboard:ctrl+backspace"` |

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
  setup: ({ request, state }) => ({
    onClick: (clickEvent) => {
      state.count = (state.count || 0) + 1;
      clearTimeout(state.timeout);
      state.timeout = setTimeout(() => {
        state.count = 0;
      }, 1000);
      if (state.count < 3) {
        return;
      }
      state.count = 0;
      request("triple_click", {}, clickEvent);
    },
  }),
});
```

`claims` takes a **set** of names rather than one, because interactions sharing an
input have to be arbitrated together — a swipe, a hold and a click dispute the
same press, and read apart they walk over each other.

`setup` runs on **every render** and returns props to put on the element (event
handlers, attributes). It must not call hooks, and anything counted between two
events lives in `state` — a closure variable would go back to its initial value
under a component that re-rendered mid-gesture, which is most of them.

What `setup` receives:

- `types` — the claimed names actually declared;
- `state` — this detector's own object, the same one across renders of that
  element;
- `request(type, detail, originalEvent)` — dispatch the interaction as an event of
  its own name, then answer it;
- `perform(type, event)` — answer an interaction whose event already exists (a
  native one);
- `readConfig(attribute, defaultValue)` — a number read off the element or any
  ancestor;
- `ref` — the element.

`request`/`perform` return **`null` when nothing ran** (the gate refused, no
control to ask, the event was prevented) and otherwise a **promise**: resolved
once the effect worked, rejected when it did not. Those two answers are not the
same and a detector usually treats them differently — a row pulled out comes back
either way, something thrown off the screen only comes back if the throw failed.

A detector that reads the pointer must mark itself in the DOM so a travelling
container above it does not take the gesture: return `"data-no-drag-travel": ""`
among its props (see `docs/drag_to_travel.md`). navi's own swipes do the
equivalent with `data-travel-by-drag`.

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
