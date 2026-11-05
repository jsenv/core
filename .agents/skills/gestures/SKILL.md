---
name: gestures
description: The spec of a hand pushing a screen aside, shared by @jsenv/dom and navi. A row of screens is a scroller the browser moves; a box pushed aside reads the press itself: who owns it, when it becomes a gesture, how its axis is read, what letting go means. Read before changing anything under packages/frontend/dom/src/interaction/ or a component that travels or swipes (SlideContainer, RouteTravel, swipe_to_close, SidePanel, interactions swipes).
---

# What we want, before how

A travel is a hand pushing a whole screen aside to bring in the next one. What we
want is what the web already does: **a hand is the browser's whenever it can be.**
The browser reads what no page is told (a notch from a trackpad, the end of a stroke
from its momentum, which scroller a stream is latched on) and answers on the
compositor, whatever the main thread is doing. Anything we read ourselves is a guess
at those things, and a guess that is wrong leaves someone on another page.

So two families, and the first question is which one a gesture belongs to:

- **There is something to scroll to** (`SlideContainer`, `RouteTravel`): it IS a
  scroller. See [A row the browser scrolls](#a-row-the-browser-scrolls).
- **There is nothing to scroll to** (a docked `Dialog` or a `SidePanel` pushed back
  to close it, a row swiped aside): the press is read here, by one module,
  @jsenv/dom's `drag_to_travel.js`, and every consumer reads it, so a hand never
  learns two sets of numbers. A consumer says geometry (how big a box is, what to
  paint), never policy: a number deciding when a press is a travel, or what letting
  go means, belongs in the module.

Do not bring a gesture back into JS to get a behaviour the browser does not have:
stepping one screen per push of a wheel, chaining into the next box mid-stroke,
catching a travel in flight. All of that was built, and each piece was a guess the
next report found wrong. Under-delivering what the web also under-delivers is the
side to be wrong on.

What an application sees of this is
[packages/frontend/navi/docs/drag_to_travel.md](../../../packages/frontend/navi/docs/drag_to_travel.md);
what the engines do with a finger, measured, is
[packages/frontend/navi/docs/mobile_touch.md](../../../packages/frontend/navi/docs/mobile_touch.md);
who owns state while something animates is in
[the animations skill](../animations/SKILL.md).

## A row the browser scrolls

**The structure.** One scroller, `scroll-snap-type: mandatory`, one snap area per
screen with `scroll-snap-stop: always`, scrollbars hidden, `overscroll-behavior`
contained on the axis it scrolls. Reading it is `layout/native_row_scroll.js`.

**A row is read, never told, under a hand.** A scroll event paints what follows
(the trait under a tab bar, `--slide-travel-progress`, `route_row_follow.js`), a
landing changes what is current (a row of routes moves it earlier, see below). A
render during a hand must not write the scroll position, or the row is taken away
from under the finger.

**A landing is not `scrollend`.** Measured on real events (macOS, CGEvent): Firefox
fires `scrollend` once, when the wheel goes quiet, about 220ms before its snap has
finished, and never again; Safari before 26.2 has none. A landing is also heard on
150ms of silence, so it runs twice and must find nothing to do the second time. It
only counts when the row rests on a page: a hand pausing midway is no landing.

**Past the next screen.** A finger carries the row past `scroll-snap-stop`, which
only stops momentum, so what follows is painted between the two screens the row
stands between, never clamped to one box off the current one (it froze, then
teleported). What is built on demand is asked for on the way.

**A travel asked for and a hand are two mechanisms.** In `SlideContainer`, one
asked for plays over the track (`duration`, one box long), with the scroll position
still and snapping off (Firefox re-snaps under a moving track, and the two cancel
out), and writes the position in one go when it lands. Native smooth scroll has no
duration and flies past every slide in between. A row's scroll position while a
travel plays belongs to the travel: a finger landing finishes it first.

**Places are offsets, not transforms** (`left`/`top` on slides in one grid cell): the
scroll range and the snap points are laid-out places in every engine, and the box
still measures itself on its largest slide. A direction refused takes what lies
beyond off the row (`data-off-row`, stacked under the current slide): a scroll range
cannot be refused otherwise. The range starts at the first reachable slide.

**Never under `data-drag-travel`.** On Gecko and WebKit that sheet tells everything
inside a box to contain its overscroll, and that is exactly what cuts the chain from
a page's vertical scroller to the row: nothing moves sideways over it. Blink does
not show it, and neither does a synthetic wheel (Playwright's has no phases and
misleads on latching): measure a row with real input.

**What the native row costs, and it is the web's own.** A stroke opening on a
sideways crumb is latched on the row, and its vertical scroll is dead until the hand
lifts. A sideways push within about 100ms of a scroll is ignored by WebKit and
Firefox. A big swipe can cross several screens. A mouse does not drag.

### A row of routes

**One page per route, kept.** The router mounts what matches, and a route's actions
ask only while it does, so a page cannot be built ahead of its address. In a row of
`<Route>` children each leaf gets a pane (`RouteRowContainer`), built on first match
and kept: the hand brings back the page itself. A page not on screen is treated like
one kept while leaving, except that it can come back: `isShown()` false (it does not
re-render), `leavingSignal` true (it steps out of slots), no `hasLeft()`. Its
`position: fixed` content would stand over the page shown, so at rest it paints
nothing.

**One route, several params: one component.** A `routes` window has one live page
and a picture (a clone) of what the hand leaves behind. The address leads there:
16px of pull moves it, which is what builds the neighbour under the finger, and
`routeTravelSettledPageSignal` tells where the reader still is. A `routes` given
anew around the page on screen is held while the row moves, then taken at rest
with the scroll position written in the same commit.

**What is current follows the hand, not the address, and letting go decides.** While
a hand holds the row nothing is decided, past half the box included: a link to a page
of the row answers for the page held, even when the address ran ahead to build its
neighbour. A row moving after a finger has lifted is going where it moves (snapping
does not turn round, observed in Chrome only), so that first scroll moves the address
and the tabs. The landing stays as the safety net, and is all a trackpad has: nothing
says when its fingers leave.

**The document keeps scrolling.** `overflow-x: auto` forces `overflow-y` off
`visible`, so the row is a scroll container that never moves vertically and grows
with the page on screen: everything the root scroller gives (a collapsing URL bar,
pull to refresh, a tap to the top) stays, `position: sticky` inside the row does
not. A row with fewer than two pages is not a scroller. A page brought in is pinned
where the reader is looking, with `top` (a transform would capture what it holds in
`position: fixed`). The document's offset is written on arrival
(`arriveAtScrollPosition`), with recording suspended for the movement: clamps are
not the reader scrolling.

## A box pushed aside: when a press becomes a travel

**By distance, for every pointer: 10px with a mouse, 6px with a finger or a pen** — a
distance (`Math.hypot`), the way the browser measures its own slop. Not by a hold: a
long press means "pick this up", and here it would mean holding still before being
allowed to swipe.

**A finger's number is a deadline, not a feel.** About 8px in, the browser commits
the touch to its own pan — on the axis `touch-action` leaves it, and on every axis
over a scroller inside the box — and refusing after that changes nothing: the pointer
is cancelled and the swipe dies. The other way round too: one `touchmove` refused
before it keeps the whole touch from scrolling, and nothing can be un-refused. Hence
6px, under 8 with a margin, because Safari does not wait for the answer to a report
that jumps over its decision. Its price is the click of a tap that shook more than
6px.

**The axis is decided by the first movement report after the threshold, never
revisited** — a diagonal would ask for two travels when one screen can arrive —
**and read with a bias.** A thumb swiping sideways moves along an ARC whose
first pixels lean off-axis far more than the swipe does; read even, the lean
hands the press to an axis nobody meant, and a press given up is given up WHOLE:
the hand's remaining hundred pixels are read by no one. So on a box that travels
one axis, the cross axis takes the press only when it dominates the first report
twice over (`AXIS_CROSS_DOMINANCE`). A box travelling both axes reads even. A
drag source taken on contact along one axis reads its press the same way, with
the same number (`dragAfterDistance`): the same two hands.

**The bias is for where nothing else wants the cross axis.** Where something
under a finger or a pen scrolls on it, the page included, somebody does mean that
axis, and the first report is read even, exactly as the browser reads it. Twice
over would hand a scroll to the travel for 2.7px of sideways wobble out of 6px,
while the pad of a thumb is still settling. Which way the finger goes and how
much room is left are not asked, or a thumb flicking towards the end of a list
leaves the page. The price is a swipe whose first pixels are steeper than 45°
over something that scrolls: it scrolls. **Nothing softer than even**: past 45°
over `pan-y` Chrome has dropped its pan for the whole touch, so a press given up
there scrolls nothing and travels nowhere.

**The browser's reading is taken on the browser's pixels.** A press reading as
that pan at 6px is not given up there: a thumb's arc can bend flat before 8px,
and given up early, it is then refused by the browser too. It goes on being
measured, with nothing refused, and both read the same report. A press reading
as a travel takes the touch at 6px: it needs the margin under the deadline.

**Deferring the decision is not available** — physics, not caution. Past the
browser's 8px a frame spent gathering evidence is a lost gesture: waiting for
the arc to prove itself makes every vertical swipe over the box a dead gesture,
the bug mirrored onto the page. The bias only works because it is read before
the browser reads the same pixels evenly; a first report steeper than it is
ambiguous with a scroll and goes to the page, which at least answers visibly.

**Of the way covered when the gesture forms, only the threshold is withheld.**
Reports are coalesced to frames, so a fast flick may arrive in one: charged whole, it
has nothing left to have pulled, moves nothing, and is refused at the release.

## What letting go means

**One question, where the hand is about to put things**: where the picture stands
plus 500ms at the speed the fingertip has at the lift (`DRAG_LANDING_MS`, iOS's
projection), against `commitRatio` of the box (0.5, a fraction, so a gesture
means the same on a phone and a wide screen). That one number answers all three
hands: thrown back lands short and everything goes back; a short flick lands far and goes; a hand at rest leaves
the picture alone to answer. Around it:

- **Speed counts from 25px of finger** (`DRAG_FLICK_REACH`, Android's
  `MIN_DISTANCE_FOR_FLING`). Under it, a tap that slipped: the picture answers.
- **Past 0.4 px/ms speed answers alone, both ways** (`DRAG_FLICK_VELOCITY`,
  Android's 400dp/s). A thumb flicks no faster on a tablet than on a phone, and
  half a wide box is out of reach of any landing. On a phone it changes nothing:
  that speed lands past half the box anyway.

**The speed read is the fingertip's, not the mean's.** The trailing 100ms mean
lags a hand slowing down by its whole window, so a hand that has stopped still
reads as moving: `liftVelocityX`/`Y` read the last 50ms of moves that went
somewhere, zero after 40ms without moving (Android's
`ASSUME_POINTER_STOPPED_TIME`), and a thumb rolling back up to 8px as it lifts is
read up to where it got to: a 34ms window weighs those pixels heavily, and read
whole they refuse a real swipe. Stamps are the events' own, not the handling's:
behind a busy main thread they would read a thumb's last roll as a throw back.

**The half is the platforms'** (iOS paging snaps to the nearest page, Compose's
`Pager` and Chrome's scroll snap stop at 50%). A "short swipe goes back" report is
almost never the ratio: a short swipe is a moving release, judged by speed, so look
first at how the speed was read.

**Towards nothing, the picture follows at 0.3 and comes back**: a wall one can
lean on, never walk through. A direction with nothing there resists; it is not
refused.

**A direction that will be refused is a wall from the first pixel.** `onStart`
answers `travelBack`/`travelOn` with the question the consumer's release gate asks —
"may I go there", not "is there something that way" — where the gesture is armed, so
the rubber band and a release with nothing to refuse follow for free.

**The extra pixels are not owed back**: at an end with nothing beyond, the gesture
is re-measured from where the finger IS, so turning around moves the picture at once
instead of first walking back over the overshoot.

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
  (`data-travel-by-drag`, a row of screens included), drag sources theirs
  (`data-drag-source`), and the innermost takes what it walks. **Read at the
  press and nowhere else**: from the first pixel the pointer belongs to whoever
  asked for it last, the outermost box, and the inner one is told nothing more —
  so the box that does not own the gesture must never ask, and nothing hands
  over mid-drag. A source that stood down from this press walks no axis; a
  top-layer element on the way up (`:popover-open`, `dialog:modal`,
  `:fullscreen`) takes everything.
- **A scroller with room left that way** (`scrollRoomTowards`, which also stops
  at the top layer): the consumer's `onStart` asks it (the `interactions` swipes do
  not).
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
  `overscroll-behavior-<axis>: contain !important` on the travelling axis (`data-drag-travel`),
  **written once and for all, never while a finger is down** — a browser decides what
  a gesture may do when it BEGINS, and a property written later is too late for it;
- **the bounce and the history swipe**: `overscroll-behavior: none` on `:root`
  (`data-drag-travel-gesture`) once the press has become a gesture. Same lateness: a
  last resort behind the rule above;
- **the selection**: `user-select: none` (`data-drag-travel-walking`) once the press
  has become a travel — a press on text IS how one selects it — and what its first
  pixels selected is collapsed then.

The last two are taken back when the gesture ends, so a page that bounces the rest of
the time goes on bouncing; refusing each `touchmove` says the same for what the
properties do not cover.

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

On Blink that leaves the boxes that are not scroll containers, never asked: a swiped
row. So navi contains what it KNOWS scrolls: `[data-drag-travel*=<axis>]
[data-scrollable]` in `box.jsx`, worn only by a `Box` that asked for `overflow:
auto|scroll` — never one that merely clips, so no dead zone. An undeclared scroller
under such a box still leaks on Blink; that fix is Blink's.

**Firefox cannot be measured with a synthetic wheel from Playwright**: it is
dispatched outside APZ, which is where Gecko enforces `overscroll-behavior`. Real
events posted through the OS (CGEvent on macOS) do reach it.

## What a box pushed aside owes the gesture

- **Its axes in the DOM, from its render**: `data-travel-by-drag` (read by the
  boxes above),
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

## The consumers

`SlideContainer` and `RouteTravel` are rows the browser scrolls. `swipe_to_close.js`
pushes a docked `Dialog` (from its grip) or a `SidePanel` (from its whole surface)
back towards its edge: one box, one way (a press pushing it further in gives the
gesture up). The `interactions` swipes (`startSwipe`) differ most: no scroller-room
check, a `commitRatio` of 0.33 tuned by `data-swipe-threshold`, a side nothing is
declared for resisting, and `--swipe-pulled` / `--swipe-progress` painted for the
caller to draw with.

## Verifying a gesture

A gesture is verified the way movement is (the animations skill, "Verifying"): driven,
and read as numbers per frame, because what no end-state check sees is the frozen
trait and the teleport. What has to be synthesized is the HAND'S imperfection, where
gesture bugs live.

**A row**: real input, or nothing that decides about latching. Playwright's wheel has
no phases, and reads wrong about what a scroll stays on in WebKit and Firefox. Real
events: `CGEvent(scrollWheelEvent2Source:)` posted at `.cghidEventTap` on macOS, with
`IsContinuous`, `ScrollPhase` and `MomentumPhase` for a trackpad, `FixedPtDelta` for a
notch (Chromium: 0.1 per slow tick, times 40); guard on the PID of the window under the
point. Touch in Chrome: `Input.synthesizeScrollGesture` with `gestureSourceType:
"touch"` under CPU throttling. Sample per frame: the scroll position, what follows it,
what is current.

**A press**: coalesce (a whole flick in one or two moves), arc (first points leaning
off-axis, then the axis). Read the `navi_drag_*` events and the position across frames.
The touch race shows only through the two paths in
[mobile_touch.md](../../../packages/frontend/navi/docs/mobile_touch.md#verifying-without-a-device).

A real finger's lift, a device's timing and iOS stay device questions.

## Reference

- navi: `src/layout/native_row_scroll.js`, `src/layout/slide_container.jsx`,
  `src/nav/route_travel.jsx`, `RouteRowContainer` in `src/nav/route.jsx`,
  `src/nav/route_row_follow.js`, `src/layout/swipe_to_close.js`, `startSwipe` in
  `src/control/interaction/interaction_press.js`, `[data-scrollable]` in
  `src/box/box.jsx`. Demos: `src/nav/demos/route_travel/`,
  `src/layout/demos/8_slide_container_demo.html`.
- @jsenv/dom: `src/interaction/drag/drag_to_travel.js` (`startDragToTravel`,
  `travelsAfter`, `axesLeftBy`, `scrollRoomTowards`, `DRAG_EXCLUDED_SELECTOR`, the
  containment stylesheet), `src/interaction/drag/drag_gesture.js`,
  `src/interaction/drag/drag_after_intent.js` (`keepTouchRefusable`,
  `AXIS_CROSS_DOMINANCE`).
