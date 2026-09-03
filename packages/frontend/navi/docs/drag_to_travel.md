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
  then is the axis it walks, for good — how that axis is read, and why the
  reading is biased, has [a section of its own
  below](#the-axis-is-read-once-and-read-with-a-bias). **Except on something
  already moving**: there the hand said what it wanted by reaching for it, so
  the gesture answers from its first pixel and owes it every one of them —
  asking it to cross a threshold is asking twice, and over those pixels the
  thing it is holding answers to nobody. A diagonal would ask for two travels at
  once and only one screen can arrive.
- **Of the way covered when the gesture forms, only the threshold is withheld**
  — never the whole first report. Movement reports are coalesced to frames, so
  the faster the gesture the bigger its first report is: charged whole, a flick
  delivered in one report sets off with nothing left of itself to have pulled —
  it moves nothing on screen and is refused at the release for it, and what the
  hand feels is a swipe that did strictly nothing.
- **A hand still moving when it lets go says where this goes, and it says it
  both ways.** Towards what it was bringing in, the travel carries on — however
  slowly and whatever the distance: an intention still being acted on at the
  lift. Away from it, fast, everything goes back whatever the distance already
  covered — otherwise a screen caught in flight and thrown back still arrives,
  because the picture alone decided. Only a release at rest, or a slow retreat,
  is judged by the picture — about a third of a box — because there the
  position is the only witness left.
- **The bars those verdicts compare against sit well below the speed the
  fingertip actually has, and they must.** Velocity is averaged over a trailing
  window (pointer events arrive irregularly, and the last one before a release
  often repeats its coordinates — measured on that pair alone, every throw ends
  at zero), and the release itself adds one more sample at the same place a
  moment later. Both pull the measure down from the hand's peak: a threshold
  sized against the hand refuses the hand.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.
- **A direction that will be refused is one of those walls, and it must be a
  wall from the first pixel.** Whatever holds the user where they are — a slide
  waiting for its answer, a step reachable only by finishing the one before —
  the gesture has to read it where it is ARMED, not only when it is let go of.
  Read at the release alone, the hold does half its job: it forbids the arrival
  and allows the whole journey, so the screen one may not reach is walked to,
  read on the way, and then taken back. A wall that shows what is behind it and
  pushes you back reads as a bug even when it is a rule. What the consumer owes
  the gesture is therefore not "is there a screen that way" but "may I go
  there" — the same question its release gate asks, asked earlier. Said `false`
  there, the direction is simply a dead end like any other, and everything else
  follows for free: the rubber band, the screen kept off stage, and a release
  with nothing left to refuse.
- A hand can go further than one box, and those extra pixels are not owed back:
  once the end is reached the gesture is measured from where the finger IS, so
  turning around moves the picture at once. Measured from the origin instead, a
  hand that came in fast would push against a screen that does not answer for as
  many pixels as it went too far.

## The axis is read once, and read with a bias

The axis is decided on the first movement report after the threshold and never
revisited. That report is ~10-25px of movement, and for a thumb those pixels
misstate the gesture: a thumb swiping sideways moves along an ARC, and the
start of the arc leans off-axis far more than the swipe does. Read even
(whichever axis covered more), the lean hands the whole press to an axis
nobody meant — and a press given up is given up WHOLE: the hand's remaining
hundred pixels are read by no one, and what it feels is a swipe that did
nothing at all.

So on a box that travels one axis, the reading is biased towards that axis:
the cross axis takes the press only when it clearly dominates the first
report (2×, `AXIS_CROSS_DOMINANCE`). A gesture that really belongs to the
other axis — a scroll — is near-pure on its axis from the first pixel (4-6×),
so it still leaves whole, at once, in the same tick. A box that travels both
axes keeps the even reading: every answer is a travel there, and there is
nothing to protect.

Why the decision cannot simply wait for more evidence — this boundary is
physics, not caution:

- the browser is racing for the same press, on the axis `touch-action` leaves
  it, and it holds off only while the touchmoves are being refused;
- refusing a touchmove is **irreversible for that touch**: whether the stream
  can scroll is decided at its first refusable move, and un-refusing later
  resurrects nothing;
- so every frame spent gathering evidence is a frame of the page's scroll
  spent, for good. A decision deferred until the arc has proven itself would
  make every genuinely vertical swipe over the box a dead gesture — the exact
  bug, mirrored onto the page.

The bias moves the frame-one boundary to where the two hands actually
separate; nothing can remove the boundary. A first report steeper than the
bias (a start more than twice off-axis) is genuinely ambiguous with a scroll
and goes to the page — which at least answers it visibly.

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

Both are read against a stream that never announces itself: the browser sees
one unbroken burst (the tail of the first push never went silent), so "the
hand asked again" is reconstructed, never received. Two consequences are easy
to get wrong from there:

- **a second push is answered like a first event — a screen, now** — never with
  credit towards one. The price a screen after the first costs (an accumulated
  delta, deliberately steep) exists to keep momentum from walking slides on its
  own; charged to a hand that pushed again over the tail, it reads as "my
  swipes are ignored until I wait for silence". The stream itself says which is
  which: once it has faded into a recognized tail, growing **twice in a row**
  is a hand (`WHEEL_REGROW_RUN`) — decay jitter bumps up in isolated events and
  never twice consecutively.
- **the other axis, over a faded stream, is not ours to swallow.** Within a
  push, cross-axis events are the push's own wobble and are eaten with the
  rest — a hand is never perfectly straight. But once our axis is momentum
  only, a hand pushing the other way is a NEW gesture, and on an axis the box
  does not travel it is not ours at all: it is handed back to whatever scrolls
  under the pointer, untouched, and it does not renew the claim either. Renewed
  by what it swallows, the gesture would be kept alive by the very scroll it
  ignores — every attempt extending the silence it was waiting for.

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

Five things can claim a pointer that landed on a travelling box, and all five
are read before the box moves:

1. **What says so itself.** A field, a `contenteditable`, a dedicated drag
   handle (`data-drag-handle`), or anything carrying `data-no-drag-travel`.
2. **A scroller in between with room left that way.** It keeps the gesture until
   it has no room left, and only then hands the travel over — so a row that
   scrolls sideways inside a page still scrolls sideways.
3. **Another travelling box in between.** The innermost one takes the axes it
   walks, and leaves the ones it does not to whoever is above it.
4. **Something in between that is picked up and carried.** A row taken out of a
   list, a card carried across a board: it takes the axes it is dragged on and
   leaves the others — see [Something being carried inside a
   box](#something-being-carried-inside-a-box).
5. **A surface in the top layer in between.** Nothing above it gets the gesture
   at all — see [A surface in the top layer](#a-surface-in-the-top-layer).

And one thing narrows it from the other end: a popup that names a **grip** reads
the press only there — see [A popup pushed back the way it
came](#a-popup-pushed-back-the-way-it-came).

### Boxes inside boxes

A row of slides inside a page that walks between pages, a carousel inside a
carousel, a `SlideContainer` inside a `RouteTravel`: they all get the same
press, and the innermost is the one the hand is pointing at. So it takes the
gesture on the axis it walks, and the boxes above it are left with whatever axis
it does not — a row swiped sideways inside a column of screens keeps the
sideways gesture, and the column still answers a finger going down. Nothing has
to be declared for this: each box says which axes it travels in the DOM
(`data-travel-by-drag`, `data-travel-by-wheel`), and that is what the boxes above
read.

Decided at the press, once and for all: from the first pixel the gesture belongs
to whoever asked the browser for the pointer last, which is the outermost box —
so the arbitration has to happen before anyone asks, and the box that does not
own the gesture never does. The consequence is that an inner box sitting on its
last slide does not hand the gesture over mid-drag: it leans on its wall, the way
it does when it is alone. Travelling the box around it means starting the gesture
outside it.

### Something being carried inside a box

A drag reads the same press a travel does and holds the pointer from it, so the
two share a finger exactly as two travelling boxes do: what is picked up says
which axes it walks (`data-drag-source`, written from `data-drag-axis` by
`interactions={{ move, reorder, land, toss }}` — see `docs/interactions.md`), and
the box above keeps what is left. A list reordered along its own line inside a
row of slides swiped sideways: both gestures live, and neither had to be told
about the other.

When the two want the same axes — a piece carried both ways inside a sheet
pushed down to close it — nothing is left and the press is the piece's, whole.
That is the right way round: the box above is a surface, and the thing in it is
what the hand came for.

The exception is a **dedicated handle** (`data-drag-handle`), which has no axis:
it is a place whose only purpose is to be taken hold of, from the first pixel,
so it takes the press outright.

### A popup pushed back the way it came

A `Dialog` docked to the bottom edge (`dockedOnSmallTouchScreen`) and a
`SidePanel` close by being pushed back the way they came in — a third consumer
of this same travel, `swipe_to_close.js`. A popup that names a **grip** reads the
press only there: for a `Dialog` that is its header, plus anything carrying
`data-swipe-grip`. Everything else it holds is content the finger came to operate
— a board a piece is dragged across, a map, a list — and a press there never
reaches the travel at all, whatever it is made of.

So a sheet with no header and nothing marked is not pushed down; it closes by
its own controls, the backdrop and Escape. A `SidePanel` names no grip and is
pushed from its whole surface, which suits a panel made of nothing else.

### A surface in the top layer

A popover, a modal `<dialog>`, an element gone fullscreen: it is written inside
whatever opened it — a slide, a page that travels — and the browser paints it
over the whole screen. The DOM says "inside", the eye says "on top of", and the
gesture belongs to what the eye sees: a drag across a full-screen dialog opened
from a slide is not a drag on the slides, and nothing about it should reach
them.

So every walk up from the pointer stops there. The boxes above the surface get
no axis, and a scroller above it gets nothing either — it is painted behind the
surface, and behind is not under the finger. `showModal()` does not do this on
its own: the rest of the document is made inert, but the press still bubbles out
of the (not inert) dialog to a listener that sits above it.

### The browser also wants to answer the gesture

A gesture that is already answered — something is being dragged — must not be
answered a second time by the browser. Two of its answers show up as "the whole
page moved a little, and it looked wrong":

- **the leftovers of a scroll**, handed up the chain until something moves: a
  list inside the box reaches its end and the page scrolls behind the travel.
  `overscroll-behavior-<axis>: contain !important`, **written once and for all,
  never while the finger is down**: a browser decides what a gesture may do when
  the gesture BEGINS (at the touchstart, at the first wheel event), so a
  property written after that decision arrives too late for the gesture it was
  meant for. That is what "usually it does not move, sometimes it does" is made
  of — and it is why none of this can be done in JS at the moment it is needed.
  On the travelling axis only — the other one is the content's own scrolling,
  and containing does not stop scrolling anyway, it stops spilling. WHERE that
  property is written is a question of its own, and the engines do not answer it
  the same way: see [What is contained, and what still
  leaks](#what-is-contained-and-what-still-leaks);
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

### What is contained, and what still leaks

Containing is only ever read on a **scroll container** — an element that clips,
in the browser's sense, whether or not it has anything to scroll. Three places
could carry it: the travelling box, everything inside it, or the scrollers
themselves. Which of the three works is an engine question, and the answer
splits in two:

- **Blink** asks every scroll container between the pointer and the page whether
  the gesture may go past it, _even one with nothing to scroll_. Containing the
  travelling box is therefore the whole answer — and saying it to everything
  inside is actively harmful: anything that happens to clip (a line with an
  ellipsis, a rounded card, the invisible checkbox that covers a selectable row)
  becomes a **dead zone under the wheel**, a container that stops the gesture
  and has nothing to move with it. This is the bug that made a list refuse the
  wheel inside a popup and only answer its scrollbar.
- **Gecko and WebKit** ask only the containers that actually scroll. The
  travelling box is walked past — it travels, it does not scroll — so the
  scroller itself has to be told, and saying it to everything is harmless there.

So `drag_to_travel.js` writes it on the box for everyone, and on everything
inside only outside Blink (`@supports not (-webkit-app-region: none)`, one of
the few properties that names an engine rather than a user agent string).

It also names the scrollers a browser makes on its own — `textarea`,
`select[multiple]`, `select[size]` — wherever they are inside the box. Nobody
declared those, so nothing can find them by looking; being native is exactly
what makes them nameable. `input` is deliberately not among them: it has
nothing to scroll on the axis anything travels on, and containing it is how a
row-wide invisible checkbox becomes a hole under the wheel. The cost of naming
them is that an empty `textarea` is contained too — a browser cannot be asked
"only if it scrolls" — so on Blink a wheel over one moves nothing rather than
the list around it.

On Blink this leaves the boxes that **do not clip**, since those are never
asked. Of navi's own: `SlideContainer` clips (`overflow: hidden`) and a
`SidePanel` is a `Dialog`, which scrolls (`overflow: auto`) — both are asked. A
`RouteTravel` box does not clip and must not be made to: a scroll container
there would become the nearest one for every `position: sticky` inside the pages
it holds. A row marked swipeable by `interactions` does not clip either.

Which is why navi contains what it KNOWS scrolls, in `box.jsx`:

```css
[data-drag-travel*="y"] [data-scrollable] {
  overscroll-behavior-y: contain !important;
}
```

`[data-scrollable]` is worn by a `Box` that ASKED for `overflow: auto|scroll`,
never by one that merely clips — so this cannot make a dead zone the way `*`
does, and it puts the containment exactly where every engine reads it. A list, a
dialog body, a scrolling panel inside a travelling page are covered on Blink
again.

What still leaks, and only on Blink, and only under a box that does not clip: a
scroller **nobody declared and no tag names** — a bare
`<div style="overflow: auto">`, a widget from elsewhere. Its leftovers reach the
page, which is the old symptom in a much smaller corner. Two ways out, per case:
give the scroller a `Box` with an `overflow` (it is then declared), or contain it
by hand. The general fix belongs to Blink.

A note for whoever tests this: **Firefox cannot be measured with a synthetic
wheel**. Playwright dispatches one outside APZ, where Gecko enforces
`overscroll-behavior`, so containment never shows up there — inline, from a
stylesheet, headless or headed alike. The non-Blink branch is therefore left
exactly as it always was rather than tuned against a measurement that does not
exist.

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
- **a capture that goes while the pointer is still down was taken, not given.**
  The ends a gesture has are the pointer going up and the pointer being
  cancelled; a `lostpointercapture` before either means someone else asked for
  the pointer (or the element it was held on left the document). What was being
  carried goes back rather than landing wherever the hand happened to be, and a
  travel comes home rather than committing;
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
- the pointer is captured on the BOX rather than on what the finger landed on,
  for the same reason: what the caller does may take that target away, and a
  capture whose element leaves the document is a capture the browser drops;
- and it is captured only once the travel has been ACCEPTED — not when the press
  crossed its threshold. There is one capture per pointer for the whole document,
  so taking it is taking it from whoever had it, who is then told the very thing
  it is told when its own gesture ends. A travel that gives itself up one event
  later (an axis this box does not walk, an `onStart` that refuses) would have
  killed a gesture already carrying something. Until the capture is claimed the
  moves are read from the window, filtered by pointer id, so nothing is missed
  for not owning the pointer.

And the refusal has to be _listenable_ **before the finger lands**, even though
it only refuses later: whether a touchmove can be refused at all is decided
when the touch begins, from the non-passive listeners present at that moment.
Registered at the pointerdown it is already too late — the events arrive
`cancelable: false`, the listener runs, calls `preventDefault`, and nothing
happens. What that costs is not the start of the gesture but its middle: the
travel takes the press fine (the axis the browser was left never moved), and
then the thumb's arc bends towards the axis `touch-action` leaves to the page —
the browser starts the page's own scroll and CANCELS the pointer stream, and
the screen the hand was carrying snaps back with the finger still down.

So every box that travels says it from its own render, next to the attribute
naming its axes: `onTouchMove={keepTouchRefusable}` — a no-op listener whose
being registered is the whole of it (the same function everything picked up
and carried registers, see `keepTouchRefusable` in drag_after_intent.js). A
JSX prop is enough because the passive-by-default intervention only covers
`window`, `document` and `document.body`: on any other element a plain
listener is non-passive already — which matters, because a framework's event
prop cannot say `passive: false`. The one place the explicit option is
load-bearing is a listener that goes down on the document root (see
drag_to.js). And a surface whose swipe starts only from a grip carrying
`touch-action: none` needs none of this: the browser was never offered
anything there to take back.

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

## The two consumers that travel between screens

A popup being pushed back towards its edge is a travel too, and it is the simple
one: one box, one direction, no neighbour to bring in (see [A popup pushed back
the way it came](#a-popup-pushed-back-the-way-it-came)). The two below carry
screens, and everything the rest of this file weighs is about them.

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

## Verifying a gesture

A gesture is verified the way movement is (see the animations skill,
"Verifying") — driven synthetically, read as numbers — but what has to be
synthesized is the HAND'S imperfection, because that is where gesture bugs
live. A gesture simulated as clean, evenly-spaced points along one axis passes
forever and proves nothing:

- **coalesce**: deliver a whole flick in one or two moves — that is what a
  fast thumb looks like to the main thread;
- **arc**: lean the first points off-axis the way a thumb does, and only then
  commit to the axis;
- **interleave**: start the second gesture while the first one's travel — or
  its momentum tail — is still playing, and sweep the delay between the two;
- **for a wheel**: a swipe is a ramp, a peak and a decaying tail at frame
  rate, and the interesting cases live in the tail — a second swipe over it, a
  cross-axis scroll into it, decay jitter that must not step.

The reading side has traps of its own:

- coordinates measured off an element that is mid-travel are stale by dispatch
  time — aim at where the CONTAINER is, never at where the content was;
- a scripted gesture's wall-clock is diluted by driver round-trips, so
  measured velocities come out below the numbers written in the script — read
  the measured ones, not the intended ones;
- what the real browser does with an unclaimed touch — take it for a pan and
  cancel the stream, kill a momentum tail the moment a finger lands — does not
  exist in emulation at all. Claims about it are only ever settled on a
  device (and the Firefox wheel limitation above is the same kind of fact).

What to read while it runs: the `navi_drag_*` events (grab, start, release)
say which stage a press reached and with what velocity; the box's state
attribute (`data-slide-current`, the URL) says what came of it; the track's
measured position, sampled across frames, says what the screen did in
between — including the mini-movements and stalls no end-state check ever
sees.
