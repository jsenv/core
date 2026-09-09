# `interactions` — a component that answers more than a click

- [What we want](#what-we-want)
- [The prop](#the-prop)
  - [The four values](#the-four-values)
  - [The interactions navi detects](#the-interactions-navi-detects)
- [Which interaction asked](#which-interaction-asked)
- [Reaching the control](#reaching-the-control)
- [What a swipe draws, and what it leaves to you](#what-a-swipe-draws-and-what-it-leaves-to-you)
- [Carrying something, or a surface under the hand](#carrying-something-or-a-surface-under-the-hand)
- [An affordance inside somebody else's box: `selfInteractions`](#an-affordance-inside-somebody-elses-box-selfinteractions)
  - [Why it is a list, and why it is required](#why-it-is-a-list-and-why-it-is-required)
  - [Where the zone blocks: does it write to the control it sits in?](#where-the-zone-blocks-does-it-write-to-the-control-it-sits-in)
  - [The third question: whose value is it?](#the-third-question-whose-value-is-it)
  - [The fourth question: whose wait is it?](#the-fourth-question-whose-wait-is-it)
  - [On something you draw yourself](#on-something-you-draw-yourself)
  - [When the affordance should sit OUTSIDE instead](#when-the-affordance-should-sit-outside-instead)
  - [navi steps back; a plain `onClick` does not](#navi-steps-back-a-plain-onclick-does-not)
- [Tuning](#tuning)
- [Registering an interaction navi does not have](#registering-an-interaction-navi-does-not-have)
- [Things worth knowing before guessing](#things-worth-knowing-before-guessing)
- [Reference](#reference)

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

### The four values

| Value                 | Meaning                                              |
| --------------------- | ---------------------------------------------------- |
| `"request_action"`    | ask the nearest control for its `action` prop        |
| `"request_ui_action"` | ask it for a ui action (what says "the user acted")  |
| a function            | do this, with the interaction event as only argument |
| `"refuse"`            | it does not happen, and the hand is told so          |

A falsy value means "not this one", so an interaction can be declared under a
condition: `{ swipe_right: canArchive && archive }`. `"refuse"` is the other way
of saying no — the interaction stays declared, and what it would have done is
turned down where it is read (see
[`refuse`](./drag_interactions.md#the-hand-pulls-and-nothing-follows-refuse),
which the carrying interactions answer with).

### The interactions navi detects

| Key                                                    | Read from                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `mousedown` `mouseup` `click` `dblclick` `contextmenu` | the browser's own events                                    |
| `swipe_left` `swipe_right` `swipe_up` `swipe_down`     | a press that travels                                        |
| `longpress`                                            | a press held still                                          |
| `move` `reorder` `land` `toss` `leave`                 | the element carried, and what letting go means              |
| `moving`                                               | the same carry, told on every frame                         |
| `grab` `release` `refuse`                              | the instants a drag takes hold, lets go, or does not happen |
| `pan` `zoom`                                           | a surface under the hand, or under a wheel                  |
| `"keyboard:<shortcut>"`                                | keys, e.g. `"keyboard:ctrl+backspace"`                      |

Two holds on one press — a `longpress` declared on something inside an
element that declares one too — are answered by the nearer one, the way a
click is the innermost target's: the inner hold fires, the outer wait is given
up. Delays being equal; an outer hold made shorter than the inner one fires
first.

A name nothing knows how to detect produces a dev warning naming the detectors
that exist. The carrying family and the two surface streams each have a file of
their own — [drag_interactions.md](./drag_interactions.md) and
[pan_zoom.md](./pan_zoom.md).

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

## Carrying something, or a surface under the hand

Two families of interaction have a file of their own, because each is a subject:

- [drag_interactions.md](./drag_interactions.md) — an element picked up and
  carried: `move`, `reorder`, `land`, `toss`, `leave`, the `moving` stream,
  the `grab`/`release`/`refuse` moments, how the copy is dressed, and the
  machinery handed over for a gesture whose product is a value;
- [pan_zoom.md](./pan_zoom.md) — a surface dragged to look elsewhere on and
  pinched or wheeled to look closer at: `pan`, `zoom`, and what a touch and a
  wheel over it may do to the page around it.

## An affordance inside somebody else's box: `selfInteractions`

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

### Why it is a list, and why it is required

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

### Where the zone blocks: does it write to the control it sits in?

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

### The third question: whose value is it?

`selfInteractions` and `whenSelfInteractionsBlocked` are about the **gesture** —
who a pointer event belongs to, and what a block on the box around it does to
that gesture. Whose **value** an element carries is a separate question, and
`standalone` answers it: the control does not register with the form, picker or
group around it, so what it holds never joins that value (see
[form_changed.md](./form_changed.md#a-control-that-answers-for-itself)).

They come apart, which is why they are separate props:

| the element                                             | says                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| a chip's cross                                          | `selfInteractions` — it is a button, it never carried a value               |
| a door opening a sheet that writes into the form        | `standalone` — no value of its own, but a read-only form must still shut it |
| a diskette filing a name into the reader's address book | all three — own press, block is not about it, own value                     |

Reading `standalone` as "ignore everything around me" is the trap: `disabled`,
`readOnly` and `loading` travel on their own contexts and go on reaching it,
because "what do I hold" and "may anything be changed here" are not the same
question.

### The fourth question: whose wait is it?

A running action says two things at once. To the control: I am mid-action —
busy, a second press refused, the error callout if it fails. To everything
around it: nothing here moves on — the form does not submit, and the popup does
not close (see
[popup_open.md](./popup_open.md#the-popup-owns-its-open-state)).

The second half is a promise about an answer: a send holds something neither
committed nor given up, so the screen showing it stays. It is exactly wrong for
a run that was started to be LEFT running — activating a service worker update,
which lands only once the browser switches over and can be held by the page's
own in-flight work for minutes. Waiting is not the point; the app goes on being
used and the feedback is somewhere else entirely. `actionStandalone` says the
wait is the control's own:

```jsx
<Button action={() => activateUpdate()} actionStandalone>
  Activate
</Button>
```

Everything the control does for itself stays: it renders busy, it refuses a
second press, and it raises the error callout — which is why it keeps `action`
rather than re-implementing the three by hand. What changes is that no ancestor
is told: the form around it submits, and the panel it sits in closes on Escape,
on the backdrop and on its cross.

The question that picks it is what closing over the run would lose. An answer
being sent: everything — the popup is the only place its failure can be read,
and `actionStandalone` there is how a save fails behind a closed popup. Something
the app watches from somewhere else: nothing — it was never being watched here.

And when the answer being sent may never arrive at all — a request over a
network that stopped answering — the hold outlives what it was protecting:
nothing can close the popup, ever. `actionAbortable` keeps the hold and gives it
a release, so closing calls the run off rather than being refused. What that
costs, and where it may be said, is
[popup_open.md](./popup_open.md#the-popup-owns-its-open-state).

### On something you draw yourself

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

### When the affordance should sit OUTSIDE instead

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

### navi steps back; a plain `onClick` does not

What the claim stops is navi answering: the controls above it, and the gestures
it named. It does **not** stop the event — the propagation is left whole, so
that everything which is not a navi interaction still sees the press it always
saw. A raw `onClick` on an ancestor is one of those, and still fires; stop it
there yourself if it must not.

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

- `src/control/interaction/interaction_registry.js` — the prop, the four values,
  the registry.
- `src/control/interaction/interaction_press.js` — swipes and holds, and what a
  swipe writes on the element.
- `src/control/interaction/interaction_keyboard.js`,
  `interaction_native.js` — the other two detectors.
- `src/control/demos/38_interactions_demo.html` — every case above, plus a
  mailbox, a board, a surface, and a custom gesture registered from the page.
