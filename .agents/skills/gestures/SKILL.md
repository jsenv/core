---
name: gestures
description: The spec of the travel gesture — a pointer or a wheel pushing a screen aside, a swipe, a popup pushed back — shared by @jsenv/dom and navi. Who owns a press, when it becomes a gesture, how its axis is read, what letting go means, how a wheel stream is cut into pushes, what a travel in hand must never lose. Read before changing anything under packages/frontend/dom/src/interaction/ or a component that travels or swipes (SlideContainer, RouteTravel, swipe_to_close, SidePanel, interactions swipes).
---

# What we want, before how

A travel is a hand pushing a whole screen aside to bring in the next one. Four
feelings, and every rule below serves one of them:

1. **The screen is where the hand puts it.** From the moment a press becomes a
   gesture, every pixel the hand covers moves the picture: nothing jumps, and a
   flick is never refused for having been fast.
2. **One gesture, one answer.** A press is this box's, another box's, or the
   browser's — decided once, at the press, before the browser has answered it.
   Half of each is a page rocking under a travel that is already moving.
3. **A hand's movement is read as a movement.** Where it lets go is only the last
   witness; which way and how fast it went says more, and a tie goes to the
   likelier hand.
4. **Nothing a hand does may leave the page frozen.** A travel ends whatever
   happened on the way, and whoever took a hold gives it back.

One module answers what such a gesture IS — @jsenv/dom's `drag_to_travel.js` —
and every consumer reads it, so a hand never learns two sets of numbers. A
consumer says geometry (how big a box is, what lies one step that way, what to
paint), never policy: a number deciding when a press is a travel, or what
letting go means, belongs in the module.

What an application sees of this is
[packages/frontend/navi/docs/drag_to_travel.md](../../../packages/frontend/navi/docs/drag_to_travel.md);
what the engines do with a finger, measured, is
[packages/frontend/navi/docs/mobile_touch.md](../../../packages/frontend/navi/docs/mobile_touch.md);
who owns state while something animates, and the view-transition and compositor
traps, are in [the animations skill](../animations/SKILL.md).

## When a press becomes a travel

**By distance, for every pointer: 10px with a mouse, 6px with a finger or a
pen** — a distance (`Math.hypot`), the way the browser measures its own slop.
Not by a hold: a long press means "pick this up", and here it would mean holding
still before being allowed to swipe.

**A finger's number is a deadline, not a feel.** About 8px in, the browser
commits the touch to its own pan — on the axis `touch-action` leaves it, and on
every axis over a scroller inside the box — and refusing after that changes
nothing: the pointer is cancelled, the swipe dies or the travel under way goes
back. The other way round too: one `touchmove` refused before it keeps the whole
touch from scrolling, and nothing can be un-refused. Hence 6px, under 8 with a
margin, because Safari does not wait for the answer to a report that jumps over
its decision. Its price is the click of a tap that shook more than 6px.

**The axis is decided by the first movement report after the threshold, never
revisited** — a diagonal would ask for two travels when one screen can arrive —
**and read with a bias.** A thumb swiping sideways moves along an ARC whose
first pixels lean off-axis far more than the swipe does; read even, the lean
hands the press to an axis nobody meant, and a press given up is given up WHOLE:
the hand's remaining hundred pixels are read by no one. So on a box that travels
one axis, the cross axis takes the press only when it dominates the first report
twice over (`AXIS_CROSS_DOMINANCE`); a scroll, near-pure from its first pixel
(4-6×), still leaves whole, at once. A box travelling both axes reads even.

**Deferring the decision is not available** — physics, not caution. Past the
browser's 8px a frame spent gathering evidence is a lost gesture: waiting for
the arc to prove itself makes every vertical swipe over the box a dead gesture,
the bug mirrored onto the page. The bias only works because it is read before
the browser reads the same pixels evenly; a first report steeper than it is
ambiguous with a scroll and goes to the page, which at least answers visibly.

**On something already moving the axis is not read**: the consumer gives it
(`inFlight.axis`) — the first pixel of a hand landing on a moving thing is a
tremor as often as a direction.

**Of the way covered when the gesture forms, only the threshold is withheld.**
Reports are coalesced to frames, so a fast flick may arrive in one: charged
whole, it has nothing left to have pulled, moves nothing, and is refused at the
release. A caught travel is the exception: stopped where it stands, what the
hand did before holding it moved nothing.

## What letting go means

- **Towards what it was bringing in, still moving, it carries on** — however
  slowly (above 0.03 px/ms), once it has pulled more than 8px: an intention
  still being acted on at the lift.
- **Away from it, fast (above 0.3 px/ms), everything goes back**, whatever the
  distance — or a screen caught at two thirds and thrown back still arrives.
- **At rest, or retreating slowly, the picture decides**: `commitRatio` of the
  box (0.3), a fraction, so a gesture means the same on a phone and a wide
  screen.

**The bars sit well below the fingertip's speed, and they must.** Velocity is
averaged over a trailing 100ms (the last event before a release often repeats
its coordinates: measured on that pair, every throw ends at zero), and the
release adds a sample at the same place. Both pull the measure down from the
hand's peak: a bar sized against the hand refuses the hand.

**Towards nothing, the picture follows at 0.3 and comes back**: a wall one can
lean on, never walk through. A direction with nothing there resists; it is not
refused.

**A direction that will be refused is a wall from the first pixel.** `onStart`
answers `travelBack`/`travelOn` with the question the consumer's release gate
asks — "may I go there", not "is there a screen that way" — where the gesture is
ARMED. Asked at the release alone, the hold forbids the arrival and allows the
journey: the screen one may not reach is walked to, read, then taken back. Said
`false` at the start, the rubber band, the screen kept off stage and a release
with nothing to refuse follow for free. The consumer's `onEdge` asks the gate
again of the box walked into.

**The extra pixels are not owed back**: at an end with nothing beyond, the
gesture is re-measured from where the finger IS, so turning around moves the
picture at once instead of first walking back over the overshoot.

**A hand that does not stop at an end is asking for the next box** — made to let
go and press again, it would meet a wall mid-movement. The gesture asks the
consumer for the box that way (`onEdge`), and the pixels past the end are its
first ones: nothing is spent twice. A `SlideContainer` only re-stages mounted
slides, and nothing moves. A `RouteTravel` pays a gap out of the far end (no pair
of pages is left: the next travel needs a navigation, a render and a snapshot
while the hand is at full speed) and none back out of the start (the pair in
hand is already right, and the live picture shows whichever neighbour the router
points at).

## A wheel points, a hand holds

**A hand HOLDS a screen and is owed every pixel; a wheel POINTS at the next
one**: one push, one screen (`onStep`), played at its own pace like a tab or an
arrow key (the `watchWheelTravel` JSDoc).

A wheel gesture has no press, no release and no target — each event lands on
whatever is under the pointer then. So it is **claimed at its first event and
answered to the end wherever the pointer wanders** (`wheel_gesture.js`);
unclaimed, a hand drifting off a nested carousel walks a slide, then the box
around it, on one push. Silence is its only end: the claim lapses 150ms after
the last event **on its axis**, long enough to survive a travel's busiest
frames. Who owns it is asked once, at the first event, against the same claims
as a press, all answered by giving it up whole.

Cutting the stream into pushes is the whole difficulty — momentum keeps arriving
with the fingers gone, and counted, one flick is five slides:

- **the first event of a gesture moves a screen**, whatever it is worth: a hand
  that moved and saw nothing happen pushes harder rather than waiting;
- **every screen after it costs a lot**: later events add up to 600 per screen
  (`WHEEL_NEXT_STEP_DELTA`, steep on purpose: an overshoot leaves someone three
  screens away, an undershoot costs one more push), and a stream weakening
  twice in a row is momentum and adds nothing. A mouse wheel spun faster than
  the silence is therefore ONE gesture — ten 100px notches 40 to 120ms apart
  are two screens; 160ms apart, ten;
- **a faded stream that grows twice in a row is a hand pushing again**
  (`WHEEL_REGROW_RUN`; decay jitter bumps up alone, never twice running), and
  it is answered like a first event — a screen, now, never credit towards one:
  charged the second screen's price, it reads as "my swipes are ignored";
- **a sign that flips restarts the ledger, not the gesture**: a tail rocking to
  zero read as a first event walks a slide per event;
- **cross-axis events are swallowed absolutely, and renew nothing.** No
  per-event reading tells a scroll's onset from the gesture's wobble, and one
  crumb let through scrolls the slide's content under the travel. **Do not
  re-attempt a cross-axis "hand it back when it is really a scroll" heuristic:
  every filter leaks.** The honest boundary is the claim: renewed by what it
  eats, the gesture would outlive its stream, so it lapses once its own axis
  goes quiet and the browser answers the rest of the scroll.

Taking the wheel is also the only way to keep the browser from answering it: on
a laptop a horizontal two-finger swipe IS the back navigation, and a region that
neither takes it nor lets it go is the worst of the three — the page rocks and
nothing happens.

## Who owns a press: the mechanics

A promise about a gesture has to be readable before the gesture exists, from
nothing but the DOM under the finger — so every claimant is read there, at the
press:

- **Exclusion** (`DRAG_EXCLUDED_SELECTOR`, each entry argued in place): what the
  browser already answers the pointer on unless it says `data-press-only`;
  `data-drag-handle`; `data-no-drag-travel`; `data-self-interactions` naming
  `drag` or `*`; any `[popover]` or `dialog`. The nearest word wins: excluded
  INSIDE the box takes the press from it, around the box does not — a docked
  dialog IS the box. Buttons, links and the inputs that only read the press stay
  out on purpose: excluding every input is a list of selectable rows (each under
  an invisible radio) that no finger can push.
- **Nested boxes and carried things** (`axesLeftBy`): boxes say their axes
  (`data-travel-by-drag`, `data-travel-by-wheel`), drag sources theirs
  (`data-drag-source`), and the innermost takes what it walks. **Read at the
  press and nowhere else**: from the first pixel the pointer belongs to whoever
  asked for it last, the outermost box, and the inner one is told nothing more —
  so the box that does not own the gesture must never ask, and nothing hands
  over mid-drag. A source that stood down from this press walks no axis; a
  top-layer element on the way up (`:popover-open`, `dialog:modal`,
  `:fullscreen`) takes everything.
- **A scroller with room left that way** (`scrollRoomTowards`, which also stops
  at the top layer): for a press the consumer's `onStart` asks it (the
  `interactions` swipes do not); the module asks it itself only for the wheel.
- **A grip**: `createSwipeToClose(side, { grip })` reads the press only where
  `closest(grip)` finds one inside the popup.

**A travel is not a carry**, though both read the pointer through one loop
(`drag_gesture.js`): nothing is picked up, so no backdrop, nothing `inert`, and
the page keeps its focus, scrolling and keyboard (`documentInteractions:
"manual"`) — and its selection until the press is a travel (`selection:
"manual"`).

## The browser answers too: containment

A gesture already answered must not be answered a second time:

- **the leftovers of a scroll**, handed up the chain until something moves:
  `overscroll-behavior-<axis>: contain !important` on the travelling axis,
  **written once and for all, never while a finger is down** — a browser decides
  what a gesture may do when it BEGINS (the touchstart, the first wheel event),
  and a property written later is too late for it. That is what "usually it does
  not move, sometimes it does" is made of;
- **the bounce and the history swipe**: `overscroll-behavior: none` on `:root`
  (`data-drag-travel-gesture`) once the press has become a gesture — the
  distance crossed, a moving travel grabbed, a first wheel event. Same lateness:
  a last resort behind the rule above;
- **the selection**: `user-select: none` (`data-drag-travel-walking`) once the
  press has become a travel — a press on text IS how one selects it — and what
  its first pixels selected is collapsed then.

The last two are taken back when the gesture ends, so a page that bounces the
rest of the time goes on bouncing; refusing each `touchmove` and wheel event
says the same for what the properties do not cover.

**Where containment is written is an engine question.** It is only read on a
scroll container — `overflow` `hidden`, `auto` or `scroll`, with or without
anything to scroll (`clip` makes none):

- **Blink** asks every scroll container between the pointer and the page, _even
  one with nothing to scroll_. Containing the box is the whole answer, and saying
  it to everything inside (`*`) is harmful: whatever clips — an ellipsis, a
  rounded card, the invisible checkbox over a selectable row — becomes **a dead
  zone under the wheel**, a stop with nothing to move (a list inside a popup that
  answered only its scrollbar).
- **Gecko and WebKit** ask only the containers that actually scroll: the box,
  which travels and does not scroll, is walked past, so the scroller itself has
  to be told — and telling everything is harmless there.

So the box is contained everywhere, and everything inside only outside Blink
(`@supports not (-webkit-app-region: none)`, a property that names an engine).
The scrollers a browser makes on its own (`textarea`, `select[multiple]`,
`select[size]` — never `input`) are named wherever they are, since nothing else
can find them; the stylesheet's comments in `drag_to_travel.js` say why, and
what it costs.

On Blink that leaves the boxes that are not scroll containers, never asked: a
`SlideContainer` (`overflow: clip` — `hidden` would let the slides off stage be
scrolled to), a `RouteTravel` (which must not become one: it would be the
nearest scroll container of every `position: sticky` in its pages), a swiped
row. So navi contains what it KNOWS scrolls: `[data-drag-travel*=<axis>]
[data-scrollable]` in `box.jsx`, worn only by a `Box` that asked for
`overflow: auto|scroll` — never one that merely clips, so no dead zone. An
undeclared scroller under such a box still leaks on Blink; that fix is Blink's.

**Firefox cannot be measured with a synthetic wheel**: Playwright dispatches it
outside APZ, which is where Gecko enforces `overscroll-behavior`, so containment
never shows. The non-Blink branch is left as it is rather than tuned against a
measurement that does not exist.

## A hand landing on a moving travel is the next swipe, until it says otherwise

A gesture arriving while a travel plays is **not refused** — given back, the
browser answers it over a travel already moving — and **the travel is not
stopped at the press**. The likelier hand is not reaching for it: it is the next
swipe, thrown while the last one plays. Stopping at the press answers the rarer
hand and makes the likelier one feel a stall: the screen stops dead, then crawls
at the finger's speed. **A stop at the press was tried and reversed for exactly
this; it must not come back.**

So the hand is listened to first (`inFlight`), the touch refused from its first
pixel meanwhile — the gesture starts from the grab, since the browser's deadline
does not wait. A step the travel's way is the next swipe (`onPushOn`: one screen
further, never stopped); a step against it, or 100ms of nothing
(`DRAG_CATCH_HOLD_MS`), is a catch (`onStart` with `caught: true`, when the
consumer stops it where it stands); let go before either, nothing was touched —
details in the `inFlight` JSDoc. The rarer hand pays: a catch lands up to 100ms
late, and a slow hand stepping the travel's way before stopping reads as the
next swipe. Both are the right side to be wrong on.

A `SlideContainer` answers the next swipe with a new travel from where the track
is to the slide after, so it speeds up; a `RouteTravel` keeps its transition and
points the router one page further, so the pace holds. Caught, the pictures
answer the finger from where they stand (`slack`), and letting go is read three
ways (`travelsAfter`, `thrownOn`):

- **merely touched** — less than 10px since the catch (`DRAG_START_THRESHOLD`,
  the mouse's number, for every pointer): it was asked to wait, not to stop, and
  carries on to where it was going;
- **thrown back**, fast: everything goes back;
- **thrown on**, fast, the way it was going, by more than a tremor: a second
  push, asking for the screen AFTER the one arriving — the wheel's rule said for
  a hand; read as a verdict on the box in hand, the second swipe would be
  swallowed. It is asked for at the release (`onEdge` with `thrown`, see its
  JSDoc): a `SlideContainer` re-stages, a `RouteTravel` aims the travel one page
  further and hands nothing over. A slow hand stopping before it lets go is not
  thrown: the picture decides.

**Verify it by speed, not position**: sample the position frame by frame across
the press (for a `RouteTravel`, the `currentTime` and `playState` of the
transition's animations). A next swipe must not change the pace until the travel
takes its new target, then only keep it or speed up; a catch must stop on the
frame the hold is decided.

## A travel aimed elsewhere while it plays

A travel is not a queue — a second transition would drop the pictures
mid-slide — so the one in flight is aimed elsewhere (the three cases an app sees
are in the app-facing doc). **Back where it set off from** is the delicate one:
the picture being brought in is LIVE and now shows the page one goes back TO, so
both sides match and the way back is invisible. The PAGES are held
(`freezeRouteRender`) until the pictures are home, and they walk home over how
far they visibly are, at the travel's pace, the rate handed over with
`updatePlaybackRate`. **Rewinding at `-1` collapses the eased way home into a
snap** (the animations skill: "Cancelling is the same movement backwards", "What
JS reads of a running transition, and what the screen shows").

Turned around or aimed further, everything ELSE the transition carries was
photographed on its way to a place nobody is going to: those pictures are
dropped and the things left live, so the bar jumps. **A slide of the bar there
is not available**: the browser measured both its ends before the hand changed
its mind.

## What a travel in hand must never lose

- **A travel being undone is not up for grabs.** Held again mid-revert, its
  animations never finish, the wait for them never resolves, and the pictures
  stand over a page that cannot be touched.
- **A held travel is let go of before anything else animates**: the hold is
  written in CSS against whatever transition runs, and one started under it is
  born paused, held by nobody. Every transition navi starts goes through one
  funnel that releases it first (`holdViewTransition`; the animations skill, "A
  hold is not yours, it is the document's").
- **The hold belongs to a travel, not to the page.** Only the travel that took it
  gives it back — even when it ends after something else replaced it.
- **A gesture taken away commits nothing, and a capture that goes is not always
  taken.** A `pointercancel`, or a capture handed over — another gesture took
  the pointer, or its element left the document — ends the gesture `cancelled`:
  what was carried goes back, and a travel goes home, home being where it was
  going BEFORE the press (one this gesture began goes back, one it caught
  carries on to its decided end). A capture the browser merely let go of —
  nobody took it, the element is still there — is no end: the gesture carries
  on. On a touchscreen the cancel is common: a finger reaching for a playing
  `RouteTravel` lands on the document root, where neither the box's
  `touch-action` nor its listener is on the touch's path — so while a travel
  plays, `RouteTravel` keeps the touch refusable from the root, and the gesture
  that catches it refuses every `touchmove` of that press.
- **A gesture hears its end wherever it is delivered**: a pointer can be
  cancelled where the box is not on the path (the root, during a transition), so
  the end is also heard on the window, filtered by pointer id.
- **A box's own navigations are not somebody changing the route.** Routing lands
  after the travel decided, sometimes after it was undone; read as "the route
  changed", it starts a second travel nobody asked for. The box remembers what it
  asked for and recognises its answer.
- **A travel ENDS, whatever happened.** Whoever set the hold lifts it, and "a
  travel is playing" is cleared in a `finally`: left in flight, a travel freezes
  the page under its pictures, and every later gesture finds the box busy.

## Holding a render still: two holds, one global

Nothing may reach the DOM between a transition asked for and the browser
photographing the page, a frame later — and Preact renders sooner. So a
navigation holds **all** rendering from its first write until the update
callback: a view transition photographs the whole document, and with only the
routes held the tab row updates first — the bar is photographed already under
the tab one is going to, with nowhere to slide from. It lasts one frame, and
there is one per document (`rendering_hold.js`). A revert's hold can last a whole
travel and photographs nothing: only what the LIVE picture shows must not
change, so only the pages are held (`freezeRouteRender`) and the rest of the
document goes on rendering.

## A captured element cannot be pointed at

An element captured in a view transition is not painted where it stands, so
nothing hit-tests to it: a press, and a wheel, fall through to the nearest
ancestor still painted, whatever the pseudo-elements say about `pointer-events`.
Both readings catch the event at the document and hand it to the box when it
fell inside its rectangle, where the hand thinks it is. A wheel costs more:
heard on the box alone, a gesture that sets a travel off loses every event after
the first — a page nudged, quiet, put back, scrolling behind the travel with
everything not taken.

Hence **`RouteTravel` opts the page OUT of the transition**
(`view-transition-name: none` on `:root`, against the browser's default):
captured, the whole page would be unpointable for every travel — the tab row
stops highlighting, the cursor is an arrow, a press on the tab one changed one's
mind about goes nowhere. Left live, nothing shows through: the box is captured
and paints nothing, and the two pictures cover its rectangle.

## What every consumer owes the gesture

- **Its axes in the DOM, from its render**: `data-travel-by-drag` (read by the
  boxes above), `data-travel-by-wheel` if it takes the wheel,
  `data-drag-travel` (the containment stylesheet), and a `touch-action` leaving
  the page only the other axis (`pan-y` for `x`, `pan-x` for `y`, `none` for
  both) — unless it travels the way its own content scrolls (a top or bottom
  `SidePanel`), which cannot give that axis away. Written during the gesture,
  all of it is too late.
- **A touch kept refusable, from the same render**:
  `onTouchMove={keepTouchRefusable}` (its JSDoc in `drag_after_intent.js`; the
  engine rule in
  [mobile_touch.md](../../../packages/frontend/navi/docs/mobile_touch.md#the-browser-decides-about-8px-in-and-does-not-wait)).
  Without it the travel takes the press, the thumb's arc bends towards the axis
  `touch-action` leaves, the browser starts the page's scroll and cancels the
  pointer, and the screen snaps back under a finger still down. Except a grip
  carrying `touch-action: none` (a docked `Dialog`'s header, `data-swipe-grip`):
  nothing was offered there to take back.
- **`scrollRoomTowards` in its `onStart`**, answering `false` when a scroller
  between the finger and the box has room that way — and "may I go there" for
  each direction, its release gate asked early.
- **The BOX as `element`**, where the pointer is captured: the consumer's answer
  may take away what the finger landed on (a page that travels navigates), and a
  capture whose element leaves the document is dropped. The capture is deferred
  until the travel is ACCEPTED (`pointerCaptureDeferred`, argued where
  `startDragToTravel` grabs): there is one per pointer for the whole document,
  and a travel giving itself up one event later would have taken it from a
  gesture already carrying something. Nothing is missed meanwhile: moves and the
  release are always read at the window, filtered by pointer id, and the
  refusing `touchmove` listener sits on the element the touch landed on as well
  as on the window (`preventTouchScroll` in `drag_gesture.js`).

## The four consumers

`SlideContainer` and `RouteTravel` carry screens: both read the press and the
wheel, answer a press on a moving travel (`inFlight`, `onPushOn`) and walk on
into the next box (`onEdge`). `swipe_to_close.js` pushes a docked `Dialog` (from
its grip) or a `SidePanel` (from its whole surface) back towards its edge: one
box, one way (a press pushing it further in gives the gesture up), no wheel,
nothing in flight, no edge. The `interactions` swipes (`startSwipe`) differ
most: no wheel, no `inFlight`, no `onEdge`, no scroller-room check, a
`commitRatio` of 0.33 tuned by `data-swipe-threshold`, a side nothing is declared
for resisting, and `--swipe-pulled` / `--swipe-progress` painted for the caller
to draw with. The other three check scroller room and keep the default ratio.

## Verifying a gesture

A gesture is verified the way movement is (the animations skill, "Verifying"):
driven synthetically, read as numbers. What has to be synthesized is the HAND'S
imperfection, where gesture bugs live — clean, evenly spaced points along one
axis pass forever and prove nothing:

- **coalesce**: a whole flick in one or two moves, as a fast thumb reaches the
  main thread;
- **arc**: first points leaning off-axis the way a thumb does, then the axis;
- **interleave**: the second gesture started while the first one's travel, or
  its momentum tail, still plays — sweeping the delay between the two;
- **a wheel**: a ramp, a peak and a decaying tail at frame rate; the cases live
  in the tail — a second swipe over it, a cross-axis scroll into it, decay
  jitter that must not step.

Reading has traps: coordinates measured off an element mid-travel are stale by
dispatch time (aim at where the CONTAINER is), and driver round-trips dilute a
scripted gesture's wall-clock, so velocities come out below the script's — read
the measured ones. Read the `navi_drag_*` events (grab, start, release: the
stage a press reached, with its velocity), the box's state
(`data-slide-current`, the URL), and the track's position sampled across frames,
which shows the mini-movements and stalls no end-state check sees.

The touch race shows only through the two paths in
[mobile_touch.md](../../../packages/frontend/navi/docs/mobile_touch.md#verifying-without-a-device):
Playwright's `touchscreen` runs Chrome's desktop slop (15px), where a travel
reading a finger at 6px always wins. A real finger's lift, a device's timing, a
momentum tail killed by a landing finger and Firefox's wheel stay device
questions.

## Reference

- @jsenv/dom `src/interaction/drag/drag_to_travel.js`: `startDragToTravel` (its
  JSDoc: every option, the `inFlight` readings, `onEdge` and `thrown`),
  `watchWheelTravel`, `travelsAfter`/`thrownOn`, `axesLeftBy`,
  `scrollRoomTowards`, `DRAG_EXCLUDED_SELECTOR`, the containment stylesheet, each
  constant with its rationale; `src/interaction/scroll/wheel_gesture.js` (the
  claim); `src/interaction/drag/drag_gesture.js` (the loop,
  `captureHolderByPointerId`, `preventTouchScroll`, the velocity window);
  `src/interaction/drag/drag_after_intent.js` (`keepTouchRefusable`).
- navi: `src/layout/slide_container.jsx`, `src/nav/route_travel.jsx`,
  `src/layout/swipe_to_close.js` (`DOCKED_SWIPE_GRIP` in `dialog.jsx`,
  `closeByDrag` in `side_panel.jsx`), `startSwipe` in
  `src/control/interaction/interaction_press.js`, `[data-scrollable]` in
  `src/box/box.jsx`, `freezeRouteRender` in `src/nav/route.jsx`,
  `src/nav/rendering_hold.js`, `holdViewTransition` in
  `src/transition/start_view_transition_polyfill.js`, `walkPicturesHome` in
  `src/transition/view_transition_revert.js`. Demos:
  `src/nav/demos/route_travel/route_travel.html`,
  `src/layout/demos/lab/slide_container_touch_race.html`.
