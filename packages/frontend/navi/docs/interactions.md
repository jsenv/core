# `interactions` — a component that answers more than a click

- [What we want](#what-we-want)
- [The prop](#the-prop)
  - [The four values](#the-four-values)
  - [The interactions navi detects](#the-interactions-navi-detects)
- [Which interaction asked](#which-interaction-asked)
- [Reaching the control](#reaching-the-control)
- [What a swipe draws, and what it leaves to you](#what-a-swipe-draws-and-what-it-leaves-to-you)
- [Twice, whichever hand it is](#twice-whichever-hand-it-is)
  - [The click on the way there](#the-click-on-the-way-there)
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

`interactions` adds, it does not replace: a control keeps its own wiring for
`action` — a click on a button, a change on a field — and `interactions` is
everything else. One thing moves. A control asking for its action on the press
(`actionEvent="mousedown"`, `actionOnMouseDown`) waits for the `click` instead
as soon as a gesture disputing that press is declared — a swipe, a `longpress`,
the two counted taps, the drag family, `pan`/`zoom` — because the press is not
known to be a press until the gesture gives it up. `single_click` goes further
and takes the element's click itself (see
[The click on the way there](#the-click-on-the-way-there)).

A plain `Box` has no such wiring: it does nothing with `action` (dev warns), and
a click on it is declared like any other interaction,
`interactions={{ click: onSelect }}` — beside `move` or `grab` too, the click a
drag leaves behind being already suppressed.

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

| Key                                                | Read from                                                   |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `mousedown` `mouseup` `click` `contextmenu`        | the browser's own events                                    |
| `swipe_left` `swipe_right` `swipe_up` `swipe_down` | a press that travels                                        |
| `longpress`                                        | a press held still                                          |
| `double_click` `single_click`                      | two presses in a row, or one that stayed alone              |
| `move` `reorder` `land` `toss` `leave`             | the element carried, and what letting go means              |
| `moving`                                           | the same carry, told on every frame                         |
| `grab` `release` `refuse`                          | the instants a drag takes hold, lets go, or does not happen |
| `pan` `zoom`                                       | a surface under the hand, or under a wheel                  |
| `"keyboard:<shortcut>"`                            | keys, e.g. `"keyboard:ctrl+backspace"`                      |

Two holds on one press — a `longpress` declared inside an element that declares
one too — are answered by the nearer one, the way a click is the innermost
target's (with equal delays; an outer hold made shorter fires first), and dev
says so once per element: the outer hold is a declaration that never fires. One
hold has one meaning — two things on one card want a hold and a click, not two
holds. A press on something carried inside the element (`move`, `moving`,
`reorder`…) is that thing's the same way, whether it drags by holding or by
distance — unless it says `"refuse"` for this press, and then it carries nothing.

There is no `dblclick`, on purpose (see
[Twice, whichever hand it is](#twice-whichever-hand-it-is)). A name nothing knows
how to detect gets a dev warning naming the detectors that exist. The carrying
family and the surface have a file each:
[drag_interactions.md](./drag_interactions.md) and [pan_zoom.md](./pan_zoom.md).

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

The lower-level event is reachable too: `interactionEvent.detail.event` is the
`pointerdown` a hold was made of, and the `pointerup` that ended a swipe or a
tap — which is how a menu is opened at the point the press happened. A drag's
is its `pointerdown`, release included, with one exception (see
[drag_interactions.md](./drag_interactions.md)).

## Reaching the control

Everything goes through the interaction gate of the **nearest control** — itself,
an ancestor, or the one control it wraps, in that order. So a disabled, read-only
or busy control answers a swipe the way it answers a click: it says why, where the
interaction happened, and nothing runs. A `Box` with no control anywhere near it
still answers a callback; only the two requests (`"request_action"`,
`"request_ui_action"`) have nothing to ask, and say so in dev.

A `Box` that lays out **several** controls — a row of badges, a toolbar — belongs
to none of them: its interactions are its own, answered with no gate. A click on
one of the controls reaches the box too, the way any click bubbles; the callback
reads `event.target` when it has to tell them apart.

**The gate takes every declared interaction for a write.** Letting a read through
a read-only or busy control is navi's to grant inside its own controls, and
`interactions` cannot ask for it: a callback on a read-only control is refused, a
`longpress` included. So a plain press opens a read-only or busy `<Picker>` — its
popup is where its answer is drawn, held read-only in turn — while a read-only
one opened by `openOn="longpress"` refuses, whatever `openWhileReadOnly` says.
Disabled refuses everything. Which pickers open, and `openWhileReadOnly={false}`,
are in the Picker's JSDoc.

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
`--swipe-pulled`: both values inherit, so a child reads them and a sibling
cannot — and the child travels with the row, since what navi translates is the
element that declares the gesture.

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
comes back once it settles — a failure leaves the row in place to be tried
again. What a success does to it is yours (a list that redemands its rows, a row
that leaves): navi does not make it disappear.

## Twice, whichever hand it is

At the finger there is no `dblclick`, and not even a second `click`: two taps in
the same place are the browser's own zoom gesture, so it withholds them (see
[mobile_touch.md](./mobile_touch.md#the-click-is-the-browsers-call-as-much-as-ours)).
An element declaring `dblclick` would answer half the hands that reach it.
Anything that means "twice" therefore counts presses, which is what
`double_click` is — one name for the mouse and the finger:

```jsx
<Box interactions={{ pan, zoom, double_click: (event) => open(event) }} />
```

The rhythm is one window, opened by the FIRST press: the second has to land
inside it (`data-double-click-delay`) and near enough to it
(`data-double-click-slop`, a fingertip rather than a pixel, because between the
two the finger leaves the glass and lands again — see [Tuning](#tuning)). The
window is shorter than the hold's wait, so a press slow enough to be a hold
cannot start a double click, and a hold answered on the second press takes that
press back.

### The click on the way there

By default both happen, the way they do in a browser: the first press is a
`click`, and the second is answered by the `double_click` alone — the click it
would have left behind is swallowed, the way every gesture swallows the one it
leaves.

`single_click` is for two answers that exclude each other — a plan that opens on
the double must not do whatever a lone tap does on the way there. It is the same
window read the other way, the tap that STAYED alone, said once the window has
closed on it:

```jsx
<Box
  interactions={{
    single_click: (event) => select(event),
    double_click: (event) => open(event),
  }}
/>
```

It costs that wait, which is why it is a name a caller picks rather than
something a declared `double_click` imposes on `click`. And it hands the
element's click over: the click each tap leaves behind is swallowed, so a
control that wants its action on a lone click asks for it there —
`single_click: "request_action"`, not `action` reached by a click that no longer
arrives. A keyboard activation is not held: nothing can double it, so it is said
at once.

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
that claimed every gesture at once would be a HOLE in whatever it sits in, at
precisely the edge one grabs to carry it. So the claim names its interactions,
and what it does not name stays the zone's: `"click"` takes the press and leaves
the grab — the card is still carried by it — `"click drag"` takes both, and
`"*"` takes every gesture, now and later. `"*"` is there for the case where it
is true, not as a shorthand: it is the one value that will silently swallow a
gesture navi has not shipped yet.

`data-drag-ignore` says a different thing, to the gesture alone and for all of
them at once: the press there is none of the gesture's business, and the element
keeps both its cursor and its text selection.

### Where the zone blocks: does it write to the control it sits in?

That question, and nothing else, picks `whenSelfInteractionsBlocked` — what
becomes of the affordance where the zone around it is disabled or read-only. Only
the claimed interactions are its subject: the ones left to the zone were never
this element's to block.

| what it does                                                 | `whenSelfInteractionsBlocked` | on a blocked zone                   |
| ------------------------------------------------------------ | ----------------------------- | ----------------------------------- |
| writes to it (a cross that removes, a stepper)               | `"hide"`, the default         | it goes                             |
| writes to it, and its presence says there is something there | `"refuse"`                    | it stays and refuses with a callout |
| never touches it (a diskette saving into MY address book)    | `"ignore"`                    | still lit, still pressed            |

A greyed cross that still removes is worse than no cross — hence the default.
`"ignore"` is the other extreme and the caller owns it: answering "read-only" to
a gesture that was never going to write says nothing true, so use it only when
that is really the case. navi's `<Dialog.Close />` is one — leaving what a
read-only picker opened writes nothing to it — and a hand-written cross must say
the same, or it refuses the way out (see
[popup_open.md](./popup_open.md#the-close-cross)).

Busy is not on the list because busy does not block: it is the read-only a
running action sets on its way that does.

### The third question: whose value is it?

`selfInteractions` and `whenSelfInteractionsBlocked` are about the **gesture**.
Whose **value** an element carries is a separate question, and `standalone`
answers it: the control does not register with the form, picker or group around
it (see [form_changed.md](./form_changed.md#a-control-that-answers-for-itself)).
They come apart, which is why they are separate props:

| the element                                      | says                                                   |
| ------------------------------------------------ | ------------------------------------------------------ |
| a chip's cross                                   | `selfInteractions` — it never carried a value          |
| a door opening a sheet that writes into the form | `standalone` — but a read-only form must still shut it |
| the diskette above                               | all three: own press, block not about it, own value    |

### The fourth question: whose wait is it?

A running action says two things at once. To the control: I am mid-action —
busy, a second press refused, the error callout if it fails. To everything
around it: nothing here moves on — the form does not submit, the popup does not
close. `actionStandalone` keeps the first and drops the second: the wait is the
control's own, which is why it is `action` plus a word rather than the three
re-implemented by hand, and no ancestor is told.

What picks it is what closing over the run would lose. Something the app watches
from somewhere else — a service worker update being activated — loses nothing.
An answer being sent loses everything: the popup is the only place its failure
can be read. That hold, and `actionAbortable` for a run whose answer may never
come, are [popup_open.md](./popup_open.md#the-popup-owns-its-open-state)'s.

### On something you draw yourself

`selfInteractions` is a `Box` prop too, so an affordance does not have to become
a control to claim its interactions — a pastille positioned in a card's corner
by its own class stays what it was drawn as:

```jsx
<Box as="button" selfInteractions="click" className="court_side" onClick={explain}>
```

On a box the prop does one thing: it writes `data-self-interactions`, the claim
itself — read by the controls above and by the gesture readers
(`data-drag-handle`, `data-drag-ignore` and friends are the same vocabulary).
Writing it by hand on an element navi does not render is the last resort: a typo
there is silent, whereas the prop is checked. `whenSelfInteractionsBlocked`
belongs to controls — a gate, a callout, a read-only of its own, none of which a
box has — so put the affordance on a control when what it does about a held zone
matters.

### When the affordance should sit OUTSIDE instead

`selfInteractions` says a façade CAN yield a zone; it does not say it should. An
affordance that acts on what it sits in (a chip's cross, a stepper, an eye on a
row) belongs inside, and takes its press back with `selfInteractions`. One that
swaps what is being shown belongs outside both controls, at a fixed place, so the
pixel that opened the search is the one that closes it: `<ControlSwap>` is that
row.

Either way the control must be told, or it draws a second affordance of its
own: inside a field it goes in an `Input.UI` slot, and outside, `icon={null}`
takes away the icon the type would have drawn.

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

| Attribute                 | Default | Meaning                                        |
| ------------------------- | ------- | ---------------------------------------------- |
| `data-swipe-threshold`    | `0.33`  | fraction of the element to pull to commit      |
| `data-longpress-delay`    | `450`   | ms the press must be held                      |
| `data-longpress-slop`     | `8`     | px the pointer may drift during the wait       |
| `data-double-click-delay` | `400`   | ms the window stays open, from the first press |
| `data-double-click-slop`  | `30`    | px the second press may land from the first    |

A threshold is a **fraction and never a distance**: the same gesture must mean
the same thing on a phone and on a wide screen. Speed answers on its own on top
of it — a brief flick counts whatever the distance covered.

## Registering an interaction navi does not have

The registry holds no detector of its own: navi's swipes, holds and shortcuts go
through the same door an application uses, `defineInteractionDetector`. Its
JSDoc is the contract — `setup` once per element and its teardown, what
`trigger` returns (`null` when nothing ran, else a promise that rejects when
the effect failed), `implies`, `refusable`, `disputesPress` — and
`38_interactions_demo.html` registers a `triple_click` from the page. A detector
claims a **set** of names rather than one, because interactions sharing an input
have to be arbitrated together: a swipe, a hold and a click dispute the same
press, and read apart they walk over each other. An event handed to `trigger`
that already bears the interaction's name (a native one) IS the interaction, and
no second one is dispatched.

A detector that reads the pointer says two more things: `disputesPress`, so a
control asking for its action on the press waits for the click (see
[The prop](#the-prop)); and `data-no-drag-travel` on the element, undone in the
teardown, so a travelling container above it does not take the gesture (see
[drag_to_travel.md](./drag_to_travel.md#a-navi-component-that-reads-the-pointer-marks-itself)).

## Things worth knowing before guessing

- **A drag says its axes to whoever else answers the press.** A list reordered
  vertically inside a row of slides swiped sideways leaves the sideways gesture
  alone, and a piece carried both ways inside a bottom sheet takes the press
  whole (see [drag_to_travel.md](./drag_to_travel.md#who-owns-a-gesture), grips
  included).
- **A hold does not take the context menu.** Declaring `longpress` says what a
  held finger does; a right click comes from the other button and keeps opening
  the browser's menu — declare `contextmenu` beside it to make it do the same.
  (A held _finger_ is the system's own context-menu gesture, and that one is
  refused for the length of the press, not just of the wait.)
- **Where the press already means something, text is not selected.** An element
  declaring `longpress`, a swipe or a counted tap, and a drag source in a
  `data-drag-on-contact` place, keep their text unselectable, for every pointer:
  the browser answers that same press with a selection of its own (the word
  under the thumb, blue, with handles) that nothing takes back, and a mouse
  cannot finish a selection begun where the press is a gesture. What never
  answered that press keeps its text: a field, a popover or a dialog opened from
  inside, anything marked `data-drag-ignore`. Any other drag source has the
  selection refused only for the length of its gesture — in time for a mouse,
  too late for a finger held still — so it says `user-select: none` itself (see
  [drag_interactions.md](./drag_interactions.md#the-text-inside-user-select-none)).
- **A swipe cannot also be dragged out of the page.** An element declaring a
  swipe gets `draggable={false}` and its `dragstart` refused — a native drag _is_
  press-and-move, and a link or an image is draggable without anyone asking. One
  gesture cannot mean both.
- **A popup can open while the finger is still down** — a menu under a waiting
  finger is the native gesture (see
  [popup_open.md](./popup_open.md#opening-while-the-finger-is-still-down), and
  [the anchor](./popup_open.md#the-anchor) to place it at the press point).
- **A swipe has no keyboard equivalent, and neither has a double click.** Either
  is only reachable if something else on the element offers the same thing — a
  `"keyboard:<shortcut>"`, a `contextmenu`, or the control's own action.

## Reference

- `src/control/interaction/interaction_registry.js` — the prop, the four values,
  the registry.
- `src/control/interaction/interaction_press.js` — swipes, holds and the two
  taps, and what a swipe writes on the element.
- `src/control/interaction/interaction_keyboard.js`,
  `interaction_native.js` — shortcuts, and the browser's own events.
- `src/control/demos/38_interactions_demo.html` — every case above, plus a
  mailbox, a board, a surface, and a custom gesture registered from the page.
