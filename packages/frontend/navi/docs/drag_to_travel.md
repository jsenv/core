# Travelling by drag, and who owns the gesture

A drag-travel is a pointer pushing a whole screen aside to bring in the next
one: slides inside a box (`SlideContainer`), pages that are URLs
(`RouteTravel`). One module answers what such a gesture IS —
[@jsenv/dom's drag_to_travel.js](../../dom/src/interaction/drag/drag_to_travel.js) — and both read it, so
a hand never has to learn two sets of numbers.

This file is the spec of the travel gesture and of what its two consumers do
with it. The general rules it leans on — who owns state while something
animates, the view-transition pitfalls, the compositor traps — live in the
animations skill
([.agents/skills/animations/SKILL.md](../../../../.agents/skills/animations/SKILL.md))
and are referenced from here rather than restated.

## What the rules are

- A press is not a gesture until it has wandered ~10px, and the axis it leans on
  then is the axis it walks, for good. **Except on something already moving**:
  there the hand said what it wanted by reaching for it, so the gesture answers
  from its first pixel and owes it every one of them — asking it to cross a
  threshold is asking twice, and over those pixels the thing it is holding
  answers to nobody. A diagonal would ask for two travels at
  once and only one screen can arrive.
- Letting go carries on when about a third of a box has been pulled, or on a
  flick, whatever the distance — a gesture that has clearly begun is an
  intention, and asking for a screen to be dragged all the way across turns a
  travel into work.
- **A hand still moving says where it is going, and it says it both ways.** Away
  from what was being brought in, it means "put it back" whatever the distance
  already covered — otherwise a screen caught in flight and thrown back still
  arrives, because the picture alone decided. A slow nudge is not a throw: there
  the distance decides, as usual.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.
- A hand can go further than one box, and those extra pixels are not owed back:
  once the end is reached the gesture is measured from where the finger IS, so
  turning around moves the picture at once. Measured from the origin instead, a
  hand that came in fast would push against a screen that does not answer for as
  many pixels as it went too far.

## Two inputs, one travel

A thumb dragging the page and a wheel pushing it sideways both ask to travel,
and both consumers take both. But they do not ask for the same thing, and this
is the one place where the two really part:

- **a hand HOLDS a screen** and says where to put it. It is owed every pixel, it
  may change its mind halfway, and letting go is a question with an answer
  (`onStart`/`onPull`/`onEnd`);
- **a wheel POINTS at the next screen** and says "that one". What travels is a
  row of slides, not a long strip one stops in the middle of, so one push moves
  one slide — `onStep`, and the travel that follows plays at its own pace,
  exactly as it would from a tab pressed or an arrow key.

A wheel gesture also has **no press and no release**: it is a stream that begins
with its first event and ends in silence — a gap long enough to mean the hand is
gone, and long enough to survive the busiest frames of a travel (a navigation, a
render, a picture being taken).

Cutting that stream into pushes is the whole difficulty, because momentum keeps
arriving with the fingers gone, and counted it turns one flick into five slides.
Two things say "the hand asked again", and a stream only ever has one of them:

- **a gap.** A mouse spends tens of milliseconds between two notches; a
  trackpad, which sends whether or not the fingers are still there, never does.
  So a notch is a step, however fast the wheel is spun;
- **a number that grows after having shrunk.** Momentum only ever weakens, so a
  trackpad picking up again is a hand pushing again. One flick — rise, peak,
  decay — is therefore one step, and a second flick over the tail of the first
  is heard as its own.

Taking it is also the only way to stop the browser from answering it: on a
laptop a horizontal two-finger swipe IS the back-navigation gesture, and a
region that neither takes it nor lets it go is the worst of the three — the page
rocks and nothing happens.

Not the same thing as the drag gesture it sits beside
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

**Touching it stops it, at the press** — in both consumers — and not at the first
pixels that decide an axis. A hand landing on something that is moving expects it to obey at once;
waiting for a threshold lets the pages travel on under a finger already resting
on them, which is the one moment a gesture must not ask for proof. A press that
turns out to be nothing lets go again and the travel carries on from where it
was caught, over what is left of it.

Position alone does not say it is working: caught late, the picture is already
where the finger is and nothing looks wrong. What gives it away is SPEED — a
travel that keeps its pace under a resting finger, then is pinned to a hand
moving at another one. Measure the position frame by frame across the press: it
must stop on the frame the finger lands, not on the one where the axis is
decided.

Taking over means the pictures stop where they are and answer the finger again,
from where they stand (`slack`) rather than from zero. Only one box is in hand,
and walking out of either of its ends is a travel of its own — see below.

### A hand that does not stop at the end of a page is asking for the next one

One travel brings in one neighbour, but a gesture is not over because a travel
is: reaching an end and carrying on says "and the one after that", and being
made to let go and press again to say it is a wall in the middle of a movement.
So the gesture asks for another box at the end it reached (`onEdge`), and the
pixels past that end are the new box's first ones — nothing is spent twice.

The two ends cost differently, and it is worth knowing which one is being felt:

- **out the far end** — the page arrived, and the page it was leaving is gone:
  there is no pair left to travel with, so the next travel wants pictures of its
  own. A navigation, a render, a snapshot — and over those frames nothing
  follows the finger before catching up with it. At the start of a gesture that
  gap is invisible, the hand has barely moved; here the hand is at full speed;
- **back out of the start** — the pair in hand is already the right one: the
  still it starts from is the same page, and what is being brought in is LIVE,
  so pointing the router at the other neighbour is enough for it to show that
  one instead. The travel turns around where it stands, on the same transition,
  and there is no gap at all.

What the browser will not turn around with it is everything ELSE the
transition carries — see "One gesture that bar cannot follow" at the end of
this file.

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
- **the hold belongs to a travel, not to the page.** Only the travel that took
  it may give it back — and it must give it back even when it ends after
  something else has replaced it, or the hold survives its owner;
- **a gesture must hear its own end wherever it is delivered.** A pointer can be
  cancelled somewhere the box is not on the path (the document root, during a
  transition): missed, the gesture never ends, and whatever it was holding stays
  held. The end is listened for on the window too, filtered by pointer id;
- **a box's own navigations are not somebody changing the route.** Routing is
  asynchronous: a travel's navigation lands well after the travel decided
  anything about it — sometimes after it was undone. Read back as "the route
  changed", it starts a second travel nobody asked for, over pictures already
  showing something else. So the box remembers what it asked for and recognises
  its own answer when it arrives;
- **a travel ENDS, whatever happened on the way.** Whoever set the hold lifts it,
  and the "a travel is playing" state is cleared in a `finally`. A travel left in
  flight is not a small leak: it freezes the page under its own pictures, and
  every gesture after it finds the box busy.

One browser fact makes this harder than it reads: **an element captured in a
view transition cannot be pointed at.** It is not painted where it stands
anymore, so nothing hit-tests to it — the press falls through to the nearest
ancestor still being painted, whatever the pseudo-elements are told about
`pointer-events`. Both readings answer it the same way: the event is caught at
the document and handed to the box when it fell inside its rectangle, which is
where the hand thinks it is.

### Two ways of holding a render still, and why only one is global

Nothing may reach the DOM between the moment a transition is asked for and the
moment the browser photographs the page — the photograph is taken a frame later,
and Preact renders sooner than that. So a navigation holds rendering from its
very first write until the transition's own callback: **all of it**, because a
view transition photographs the whole document. Hold only the routes and the tab
row updates first — the bar is then photographed already under the tab one is
going to, and it has nowhere to slide from. It lasts one frame.

The other hold is the revert above, and it can last a whole travel. There
nothing is being photographed: the pictures exist, and the only thing that must
not change is what the LIVE one shows. So only the pages are held
(`freezeRouteRender`), by the containers themselves — a route container keeps
returning the branch it returned last time — and the rest of the document goes
on rendering.

The same browser fact decides something bigger: **`RouteTravel` opts the page
OUT of the transition** (`view-transition-name: none` on the root, against the browser's
default). Captured, the whole page would be unpointable for the length of every
travel — a tab row beside the box stops highlighting, the cursor goes back to an
arrow, and a press on the tab one has just changed one's mind about goes
nowhere. Left live it answers as it always did, and nothing shows through where
the pages are: the box itself IS captured, so it paints nothing, and the two
pictures cover its rectangle between them at every moment of the travel.

It costs more for a wheel than for a press, because a press is one event and a
wheel gesture is a stream: heard on the box alone, a wheel that sets a travel
off loses every event after the first. What one sees then is a page nudged a
few pixels, going quiet, being put back — and scrolling behind the travel with
everything that was not taken.

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
| what one wheel push is  | `move(±1)`, as an arrow key        | one travel, as a tab pressed       |

Both expose how far the travel has come, and the way to read it differs because
what draws an indicator differs: `SlideContainer` writes
`--slide-travel-progress` on its box (a number, declared with `@property`, so it
interpolates) for anything drawn inside it; `RouteTravel` leaves it to the
browser — give the indicator a `view-transition-name` of its own and it is
animated from where it was to where it is, even from outside the box.

A `<Nav>` does that for its own bar without being told anything about the box
below it, which is why a tab row put beside a `RouteTravel` follows the thumb
with no wiring at all: the bar is named, so the browser recognises it from one
page to the next, and any transition moves it on the same clock as everything
else in that transition.

### Asking for a page while one is on its way

A travel is not a queue: a tab pressed while another page is arriving does not
wait its turn, and it does not start a second travel on top of the first either
— there is one pair of pictures, and a second transition would drop them
mid-slide. The travel in flight is simply aimed somewhere else, and where it is
aimed decides what that costs:

- **back where it set off from** — that is not another travel, it is this one
  undone: the same pictures, run backwards. Nothing has to be asked of the
  router (the press already put the page back), and that is exactly what makes
  this the delicate one — three things at once:
  - the picture being brought in is LIVE, and the page it shows is now the
    page one is going back TO: both sides show the same thing and the way back
    is invisible — one presses, and one is simply there. So the PAGES are held
    where they are (`freezeRouteRender`) until the pictures are back at their
    start; only the pages, because nothing is being photographed here and
    everything else may keep rendering. The page being left stays on screen
    while it is brought back — the rule this file states about reverts,
    applied one step earlier;
  - the way back is paid for in DISTANCE, not in time: the way in is eased, so
    at half of its time a travel has covered ~80% of its distance, and rewound
    at `-1` the visible way home collapses into the steep end of the curve — a
    snap, not a return. The pictures walk home over how far they visibly are
    from home, at the travel's own pace (`revertWalkTime`);
  - both of the above run straight into the compositor traps: the distance is
    computed from the clock through the easing curve (the pseudo-elements'
    animated position cannot be read), and the rate is handed over with
    `updatePlaybackRate`, never the `playbackRate` setter. The traps
    themselves — including why no JS reading and no ordinary screenshot will
    ever show this class of bug — are in the animations skill, "The main
    thread lies about a running transition";
- **further the same way** — the picture being brought in is LIVE, so pointing
  the router at another page is all it takes for it to show that one instead.
  Nothing moves, and it costs nothing. Two tabs along or five makes no
  difference: a travel goes from where it left to where it is going, never
  through what lies between — which is just as well here, since the pages in
  between are not mounted and there is nothing to show of them;
- **the other way** — the pictures have to change places, so the pair starts
  again from the beginning. A travel barely begun turns around unnoticed; one
  nearly arrived snaps back first. That is the price of changing one's mind
  late, and there is no picture that could have covered it.

### One gesture that bar cannot follow

A travel that turns around mid-gesture (out of the start of the box it was
holding, into the page the other way) keeps its pages by pointing the router
elsewhere while the same transition plays — that is what makes it seamless. But
everything ELSE the transition carries was photographed when it began: where it
stood, and where it was going to stand. That second place is now one nobody is
going to, and the thing itself has already moved on in the live page — so the
picture and the thing are in two places at once, and one sees two bars.

So on that one gesture the pictures of everything that is not the pages are
dropped, and those things are left where they are, live: the bar jumps to the
tab one is heading for instead of sliding to a tab one is not. A slide would be
nicer, and it is not available — the browser measured both of its ends before
the hand changed its mind, and neither can be asked for again.
