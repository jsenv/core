# Travelling by drag, and who owns the gesture

A drag-travel is a pointer pushing a whole screen aside to bring in the next
one: slides inside a box (`SlideContainer`), pages that are URLs
(`RouteTravel`). One module answers what such a gesture IS —
[src/layout/drag_travel.js](../src/layout/drag_travel.js) — and both read it, so
a hand never has to learn two sets of numbers.

## What the rules are

- A press is not a gesture until it has wandered ~10px, and the axis it leans on
  then is the axis it walks, for good. A diagonal would ask for two travels at
  once and only one screen can arrive.
- Letting go carries on when about a third of a box has been pulled, or on a
  flick, whatever the distance — a gesture that has clearly begun is an
  intention, and asking for a screen to be dragged all the way across turns a
  travel into work.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.
- A hand can go further than one box, and those extra pixels are not owed back:
  once the end is reached the gesture is measured from where the finger IS, so
  turning around moves the picture at once. Measured from the origin instead, a
  hand that came in fast would push against a screen that does not answer for as
  many pixels as it went too far.

## Two inputs, one travel

A thumb dragging the page and two fingers pushing it sideways on a trackpad ask
for the same thing, so they are read by the same module and answered by the same
three callbacks (`onStart`/`onPull`/`onEnd`) — a caller drives one travel, not
two.

They are not read the same way, because a trackpad gesture has **no press and no
release**: it is a stream of `wheel` events that begins with its first event and
ends in silence — a gap long enough to mean the fingers are gone, and long
enough to survive the busiest frames of the travel (a navigation, a render, a
picture being taken), or one gesture is cut into several travels.

Taking it is also the only way to stop the browser from answering it: on a
laptop a horizontal two-finger swipe IS the back-navigation gesture, and a
region that neither takes it nor lets it go is the worst of the three — the page
rocks and nothing happens.

Not the same thing as `@jsenv/dom`'s drag gesture
([drag_gesture.js](../../dom/src/interaction/drag/drag_gesture.js)): that one is
for **carrying an object** across the page — it lays a backdrop over the
document, makes everything else `inert`, takes the focus and blocks the scroll
keys. Here nothing is picked up and the page must keep its focus and its
scrolling while a screen slides. Same word, other gesture.

## Who owns a gesture

Two things can claim a pointer that landed on a travelling box, and both are
read before the box moves:

1. **What says so itself.** A field, a `contenteditable`, or anything carrying
   `data-no-drag-travel`.
2. **A scroller in between with room left that way.** It keeps the gesture until
   it has no room left, and only then hands the travel over — so a row that
   scrolls sideways inside a page still scrolls sideways.

### The browser also wants to answer the gesture

A gesture that is already answered — something is being dragged — must not be
answered a second time by the browser. Two of its answers show up as "the whole
page moved a little, and it looked wrong":

- **the leftovers of a scroll**, handed up the chain until something moves: a
  list inside the box reaches its end and the page scrolls behind the travel.
  `overscroll-behavior-<axis>: contain !important` on the travelling box and
  everything inside it — and **written once and for all, never while the finger
  is down**: a browser decides what a gesture may do when the gesture BEGINS (at
  the touchstart, at the first wheel event), so a property written after that
  decision arrives too late for the gesture it was meant for. That is what
  "usually it does not move, sometimes it does" is made of. On the travelling
  axis only — the other one is the content's own scrolling, and containing does
  not stop scrolling anyway, it stops spilling;
- **the elastic bounce** at the end of a page, and the swipe that goes back in
  history with it: `overscroll-behavior: none` on the document while a finger is
  down. Same lateness applies, so this is a last resort behind the rule above
  rather than the thing that does the work;
- **the selection** a drag paints across the text it crosses: `user-select:
none`, but only once the press has become a travel — a press on text IS how
  one selects it, and nothing has said otherwise yet.

Both are written by the gesture itself (`data-drag-travel-gesture` and
`data-drag-travel-walking` on `:root`), so a page that bounces the rest of the
time goes on bouncing. `preventDefault()` on each move says the same thing to
the browser for what those two properties do not cover.

### A hand reaching for something still moving is reaching for THAT thing

A gesture arriving while a travel is playing takes **that travel** over — it does
not ask for a new one, and it is not refused. Refusing it is what makes a page
rock: a gesture given back to the browser is answered by the browser, over a
travel that is already moving.

Taking over means the pictures stop where they are and answer the finger again,
from where they stand (`slack`) rather than from zero. Only one box is in hand:
further along it carries on, back past its start is a wall — leaving that way
would be another travel, and it needs a picture this one is holding.

Two things a travel in hand must never lose:

- **a travel being undone is not up for grabs.** Its end is already decided;
  held again mid-revert, its animations never finish, the wait for them never
  resolves — and the pictures stand where they are, over a page that cannot be
  touched anymore;
- **a held travel is let go of before anything else animates.** A hold is
  written in CSS against whatever transition is running (see the animations
  skill), so a transition starting while a finger holds ours would be born
  paused with nobody holding it — it never finishes, and the page freezes under
  its pictures. Every transition navi starts passes through one funnel, which
  releases the hold first;
- **a travel ENDS, whatever happened on the way.** Whoever set the hold lifts it,
  and the "a travel is playing" state is cleared in a `finally`. A travel left in
  flight is not a small leak: it freezes the page under its own pictures, and
  every gesture after it finds the box busy.

One browser fact makes this harder than it reads: **while a view transition is
playing, a press over the travelling box is delivered to the document root**, not
to the box — whatever the pseudo-elements are told about `pointer-events`. So
while a travel plays, the press is caught at the document and handed to the box
when it fell inside its rectangle, which is where the hand thinks it pressed.

### On a touchscreen, the browser takes the gesture unless it is refused

A `pointermove` is a report; a **`touchmove` is the decision**. Left alone, the
browser consumes the touch to scroll with — it latches on the first move, and a
touch it has taken is a pointer stream it CANCELS. The gesture then dies at its
second pixel: the finger is still down, nothing reads it anymore, and whatever
travel had started finishes without anyone. It is invisible with a mouse, which
is why it survives a whole session of desktop testing.

So a travel that has become ours refuses the `touchmove` (`preventDefault`), and
only then — a finger that means to scroll must still scroll. Two details make it
hold:

- the listener sits on the element the touch LANDED on as well as on the box: a
  touch keeps being dispatched at the node it started on, and a travel may
  replace the DOM under the finger (a page that travels navigates), after which
  that node no longer passes through the box on its way up;
- the pointer is captured **before** the caller is told the gesture started, and
  on the BOX rather than on what the finger landed on, for the same reason: what
  the caller does may take that target away, and a capture whose element leaves
  the document is a capture the browser drops.

And the refusal has to be _listened for_ from the grab, even though it only
refuses later: whether a touchmove can be refused at all is decided when the
touch begins, from the non-passive listeners present at that moment. Registered
afterwards, the listener is handed events that are already `cancelable: false` —
it runs, it calls `preventDefault`, and nothing happens.

### A navi component that reads the pointer marks ITSELF

`data-no-drag-travel` is written by the component that takes the pointer, never
by whoever puts it in a page:

```jsx
<div className="navi_wheel_viewport" data-no-drag-travel="">
```

The caller cannot know — a `Table` whose columns can be dragged, a `Wheel` spun
with a thumb, a canvas one draws on all look like ordinary content from
outside — and will not find out until they watch a page leave under their
finger. The component knows, so the component says it.

_Currently marked: the wheel viewport, the table resize handles, the cells of a
table whose columns can be dragged._

## The two consumers

|                         | `SlideContainer`                   | `RouteTravel`                      |
| ----------------------- | ---------------------------------- | ---------------------------------- |
| what the screens are    | `<Slide>`s in one box, all mounted | routes — one mounted, ever         |
| what says which is here | `current` / a command              | the URL                            |
| what the finger moves   | a translated track                 | the pictures of a view transition  |
| letting go too early    | the track comes back               | the transition is played backwards |
| what says the order     | the layout map                     | the `<Route>` children, in order   |

Both expose how far the travel has come, and the way to read it differs because
what draws an indicator differs: `SlideContainer` writes
`--slide-travel-progress` on its box (a number, declared with `@property`, so it
interpolates) for anything drawn inside it; `RouteTravel` leaves it to the
browser — give the indicator a `view-transition-name` of its own and it is
animated from where it was to where it is, even from outside the box.
