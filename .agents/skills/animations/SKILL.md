---
name: animations
description: What movement is for in @jsenv/navi and how to get it right — the feelings the user must have (immediate reaction, continuity, constant pace), who owns the state while something animates, and where view transitions may and may not live. Use when adding or changing any animated behaviour (slides, wheel, list add/remove/reorder, drag).
---

# What we want, before how

Movement in a UI is not decoration: it exists to give the user three feelings.
Every technique below serves one of them — when a technique and a feeling
conflict, the feeling wins.

1. **My input was taken, right now.** Every press shows on screen while the
   finger is still down, and shows with the same strength as the first press.
2. **Nothing teleports.** What moves continues from where it is, at a speed
   that makes sense for the distance.
3. **The interface never lies about its state.** What the code answers and
   what the animation is heading to are the same thing at every instant.

## The state is the truth, the animation catches up

A control answers about the value it is **heading to**, never about the pixels
currently on screen. Ask a wheel mid-glide what it holds and it answers the row
it is gliding to; ask a slide container mid-travel which slide is current and
it answers the one arriving. Everything follows from that:

- a second press is measured against the target, not against what is on
  screen — so N quick presses land N steps away;
- code reading the state during a move never sees a half-value;
- an animation can be cut short at any moment without the state being wrong,
  which is what lets everything below exist.

The opposite arrangement — the animation owning the state, the way a physics
engine owns a position — is a different design, and not this one. An animation
here never decides a value, it only shows it arriving.

_Reference: `stepTarget` in wheel.jsx, `pendingRollsRef` in
slide_container.jsx, `commitIfAnimating` in wheel.jsx (settling on the spot
when something outside needs a stable surface)._

## Every press is answered at full strength

The first press gives a clear sensation: something departs, immediately. Every
following press must give **that same sensation**, even when it lands while the
previous movement is still playing. This is the rule that is easiest to get
wrong, because the tempting fixes all fail the same way:

- _Refusing the press_ (ignored until the movement ends) — feels stuck.
- _Queuing it silently_ (played at its own pace afterwards) — the user watches
  a replay of their inputs instead of being where they asked to be.
- _Accelerating the movement a little_ — **feels mushy**: the thing was
  already moving before the press, so "somewhat faster" is indistinguishable
  from "nothing happened". An answer the user cannot distinguish from silence
  is silence.

What works is an answer of the same magnitude as a fresh press. How to produce
it depends on how the movement is driven:

- **A fixed-duration animation** (a track travelling between two positions)
  cannot be re-aimed, so the press is answered by **finishing what plays
  almost instantly and setting off again** — arriving and leaving is the very
  sensation the first press gave. Finish it fast rather than cancel it: cut
  short, it teleports (want #2). _Reference: `hurryTravel` in
  slide_container.jsx._
- **A spring chasing a target** moves by a fraction of the remaining distance,
  so re-aiming the target one step further **multiplies the speed on the
  spot** — the kick comes for free, at exactly fresh-press strength, because
  the added distance equals what a fresh press adds. Nothing extra to write;
  just make sure a press moves the target and never restarts the loop.
  _Reference: `glideTo` in wheel.jsx._

Whichever mechanism, verify the same two numbers: the speed right after a
mid-movement press should match the speed right after a first press, and N
rapid presses should settle in about the time of one press after the last —
not N times one.

## Presses during a movement are kept, not refused

A container that cannot act yet (a looping window whose content has not rolled)
**queues** the press and takes it when it can. The queue is a list, not a
single slot: three presses are three steps. Combined with the rule above: the
queue holds the _meaning_ of the presses, while the running movement answers
their _feeling_.

## An interrupted movement starts from where it IS

Never from where the previous one was heading — that jumps to the end of a
move that never finished, then travels back. Two traps:

- **Do not** leave the "from" keyframe implicit hoping the browser will use
  the current position. An animation with only a "to" keyframe starts from the
  _underlying_ value (the resting style): the animation being replaced does
  not contribute to it. Go fetch the position on screen — and fetch it
  **before** cancelling the running animation or writing the new resting
  value. Measure it (`getBoundingClientRect()` against the box it moves in)
  rather than reading `getComputedStyle(el).translate`: mid-animation between
  a px keyframe and a % one the computed value is a `calc(-19% - 210px)` that
  no simple parse survives, and a `NaN` duration handed to `animate()` throws.
  And measure against that box's **content box** (subtract its
  `clientLeft`/`clientTop`), which is where the moving element rests: measured
  against the border box, the border reads as that many pixels of translate
  nothing asked for — on BOTH axes — and the error compounds at every
  interruption, since each new "from" carries it again. Rapid back-and-forth
  over a 1px border is a whole track visibly drifting off its axis.
- An already-moving element gets `ease-out`, not `ease`: an ease-in from a
  moving state stalls it for an instant right where the eye is following it.

## The pace is the distance

Time scales with what is left to cover: a move interrupted a fifth of the way
and sent back covers a fifth of the distance in a fifth of the time, so the
perceived speed stays constant instead of crawling over a short distance for a
full duration. Scale only ever shortens — a longer-than-usual move is not made
slower.

## One clock per movement

A movement whose look depends on two properties agreeing at every instant
must have both on the same clock. `transform` and `opacity` are animated by
the compositor; `clip-path`, `height`, `inset`, `background-position` and
nearly everything else are painted by the main thread. Pair one of each and
they agree only while the main thread keeps up — and the frame it does not
keep up on is exactly the one that opens a full-screen panel, because that
frame also mounts the panel's content. What the viewer then gets is not a
stutter but a **different animation**: the composited half plays, the painted
half stands still, and when the thread catches up it runs its remaining
course over a box already at rest. A cut meant to hold a viewport line still
while the box travels under it reveals the box from the wrong edge instead.

So:

- A geometry that needs two properties in lockstep is a bug waiting for a
  busy frame. Redesign it so that only composited properties move: let the
  window's own edge, or a static ancestor's `overflow`, do the cutting; put
  the travel on an inner element and keep the cut on a box that does not
  move; counter-translate an inner element rather than animating a clip.
- Where a painted property must animate alongside a composited one, say so
  in a comment, name the case that makes it necessary, and keep that case
  rare — the drift is accepted there, not unknown.
- `getComputedStyle`, hit-testing, `getBoundingClientRect`: all answer from
  the main thread, where the two properties are ALWAYS in step. They cannot
  see this bug (see "Verifying" below for what can).

_Reference: the slide family's cut in `layout/popup_css.js`, taken only
where a band of glass lies past the area's edge, and the top comment there
for the restructuring that would remove the last animated cut._

## View transitions

`document.startViewTransition` takes a callback that **makes the DOM change**,
so it can only be called by whoever owns the change:

- **A component that does not own the change never starts one.** It sees the
  change only once the DOM already holds it — too late to capture the "before".
  It declares instead what an element does in a transition (names, keyframes),
  and the application wraps its own state change. That is most of navi.
  _Reference: `itemTransition` on List._
- **A component that DOES own the change starts it itself**, and that is not an
  exception to the rule above but the same rule read the other way. A component
  that navigates — it is the one calling the router — holds the "before" until
  it decides to leave it. _Reference: `beginTravel` in route_travel.jsx._
- **Start it with the function `ensureDocumentStartViewTransition()` returns**
  (navi/src/transition): it installs the API where missing, runs the update
  whatever happens, swallows the rejection a _skipped_ transition produces (two
  updates close together are normal; the raw API turns the second into an
  unhandled error), and releases a transition a finger is holding first (see
  "A hold is not yours" below).
- **Keep the page out of it**: `:root { view-transition-name: none }`. The UA
  names the root `root`, so by default the whole document is replaced by a
  picture for the duration — and a captured element stops rendering live and
  cannot be pointed at
  ([view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#an-element-captured-in-a-view-transition-cannot-be-pointed-at)).
  Opted out, only the named elements are captured and the rest of the page keeps
  answering. Even a transition that slides whole screens past each other does
  not need the root: the travelling box is itself captured, and its two pictures
  cover its rectangle between them at every moment. _Reference: the
  `TRAVEL_ATTRIBUTE` CSS in route_travel.jsx._
  - **Unless the top layer is part of the movement**: it is painted only through
    the root's picture
    ([view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#the-top-layer-is-painted-through-the-roots-picture)).
    A movement that opens or closes a top-layer surface keeps the root's name and
    pays the frozen page — under a modal wall it costs nothing (_Reference:
    `popup_lift.js`_). A movement that NEEDS the root out (pages split from their
    bars) stands the top layer in, with the real wall switched off for exactly the
    same span (_Reference: `transition_furniture.js`, and
    [the two live frames](../../../packages/frontend/navi/docs/view_transitions.md#two-frames-show-the-live-document)
    every stand-in must reckon with_).

Facts worth knowing before reaching for one:

- **A name is unique in the document, and never inside a page that moves** —
  a duplicate aborts the transition, and a named element inside a moving page
  stands still while the pages slide
  ([view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#a-name-is-unique-per-document)).
- **A name that depends on browser support is written in CSS, not in JS** — see
  "Where a browser cannot nest, it must not animate" below. Box's
  `viewTransitionName` prop (and inline styles in general) cannot be put behind
  an `@supports`, so it only fits a name every browser may have.
- **The layout changes at once.** A transition animates snapshots, not layout:
  the document height jumps the moment the callback runs. Wanting the layout
  itself to be seen moving means animating the real property (WAAPI), not a
  snapshot.
- **It holds the frame, so nothing else may move during it.** A transition and
  another movement asked for in the same breath do not run side by side: the
  other one is stalled for the transition's whole duration, showing the new
  layout on the old picture. The gap is measurable — sample the moving
  property against the changed layout across frames; the frames between "the
  layout changed" and "the movement started" are the glitch the user sees.
- **Do not transition a change nobody is looking at.** A change happening on a
  screen that is off screen animates nothing — and can cost a movement the
  user IS looking at (the rule above). Start one only when what changes is
  what the user is watching.
- **Its start restyles what changed — or the whole document.** A capture in a
  bare page restyles a handful of elements. A `::highlight()` rule every
  element matches, or a value inherited from `:root` changing as the movement
  starts, makes it every element, in the frame the old state is photographed:
  a flat tax on every transition, proportional to the page being left (see
  [view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#what-makes-a-transition-restyle-the-whole-document)).
  A new rule on the root, or a new `::highlight()`, is checked against that
  before it ships.
- **What the update callback does delays the first frame.** Everything in it
  runs between the two pictures with the screen frozen: build the state
  arriving, and nothing else. Taking the state being left down is not part of
  it when that state can be hidden instead — hidden, it is out of the second
  picture, and it is taken down once the movement is over (see
  `keepLeavingPages` in navi/src/nav/route.jsx, and what a page kept that way
  must tolerate in
  [route_transitions.md](../../../packages/frontend/navi/docs/route_transitions.md#the-page-being-left-stays-until-its-movement-is-over)).
  Re-rendering it is not part of it either: a hook that re-renders from a
  subscription asks `RoutePageContext`'s `isShown()` first, as `useAsyncData`
  does (navi/src/nav/route_page_context.js) — Preact renders a dirty component
  whatever its ancestors, so nothing above the page can hold that render back.

### Several elements in one movement: name them by role

A stylesheet reaches a captured element by its NAME and by nothing else. There is
no selector for "the one that was dragged", and no attribute of the original
element is readable from the pseudo. So when a movement has parts to distribute —
this one passes in front, that one dips behind, each steps to its own side — the
role has to BE the name: the participants take a role name for the length of the
transition and give their own back afterwards, everything else keeping its own.

- The name is written **before** the transition starts, because that is when the
  old state is captured. A name arriving with the new state pairs nothing: the old
  picture disappears and a new one appears, instead of one moving.
- It is written **through the render as well**, not only on the DOM — the render
  that happens inside the callback would put the plain name straight back.

### Add to the movement the browser already makes

The group's morph from the old box to the new one is the UA's own animation, and
it is the part worth keeping: setting `animation-name` on
`::view-transition-group` replaces it, and the element stops travelling. What a
style adds rides on `::view-transition-image-pair` INSIDE that group, where a
`translate` or a `scale` composes with the morph rather than replacing it.
`z-index` on the group is what decides which of two crossing elements passes in
front.

A value that differs per occurrence — how far to step aside, which way, measured
between the two boxes at that moment — cannot be written in the rule. Set it on
**`::view-transition`**, the root of the pseudo-element tree, through a rule of
a sheet of its own (an inline style cannot target a pseudo-element):
`setTransitionValue` in navi/src/nav/transition_values.js. The pictures inherit
from there, and no element of the document does. The document element reaches
them too, but every element inherits what is written there, and changing it
restyles the whole document — at the start of a movement, in the very frame the
old state is photographed (see
[view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#what-makes-a-transition-restyle-the-whole-document)).
The one exception is a value JS has to read back, since what JS reads off
`::view-transition` outside a live transition is not reliable: it stays on the
root, registered `inherits: false`, and is handed down with `--x: inherit`
(the `--navi-route-transition-leave/-enter/-covered` of route_transition.jsx).

Which leaves the choice itself in one word — an attribute on the root, one rule
per way of moving — so trying another is changing that word, not rewriting the
movement. Two elements exchanging places is the case that asks for all of this:
morphed straight, they cross THROUGH each other, and the whole question is what
they do about it.

### What JS reads of a running transition, and what the screen shows

A composited animation is two things: the `Animation` object on the main
thread, and the picture the compositor draws. While the main thread is free
they agree. Everything JS reads — `currentTime`, `getComputedStyle` — describes
the `Animation`, and the cases below are where the screen parts from it.
Measured on Chromium 153 and WebKit 26.6 (2026-09-29).

- **`getComputedStyle` on a `::view-transition-*` pseudo returns the animated
  value**, running or pinned, in both engines (WebKit's can be a frame older
  than a `currentTime` read in the same task). It reports the `Animation`: where
  the screen parts from it, it follows the `Animation`. How far a travel
  visibly is, as a fraction whatever the property, is computed from the clock
  THROUGH the easing curve: the easing of a CSS animation sits on its keyframes
  (`effect.getKeyframes()[0].easing`), and CSS `ease` is parametric — solve it
  numerically. _Reference: `visibleProgress` in
  src/transition/view_transition_revert.js._
- **A negative rate goes through `updatePlaybackRate()`.** In Chromium, the
  `playbackRate` setter with a negative rate puts a composited picture — an
  element's or a pseudo's — at keyframe 0, where the rewind ends, and leaves
  it there while `currentTime` counts down (a one-frame flash instead, when
  something else makes the main thread commit every frame).
  `updatePlaybackRate(-1)` is seamless; WebKit takes both seamlessly. A
  positive rate — `hurryTravel`'s ×5 — changes pace on the next frame without
  a jump, in both engines, whichever way it is handed over.
- **A rate changed just before the main thread blocks jumps, whichever way it
  is handed over.** The picture keeps the old pace for the whole block, then:
  - with the setter it jumps to where the `Animation` is — its end, if it
    finished meanwhile;
  - `updatePlaybackRate` is no cure. Chromium applies it with a stale frame
    time: the picture jumps BACK to where it stood at the call, trails the
    `Animation` by block × rate, and snaps when it finishes. WebKit is
    usually seamless, and sometimes jumps like the setter.
- **Not every pseudo animation is composited.** WebKit runs the browser's own
  `::view-transition-group` animation on the main thread: it never parts from
  the `Animation`, and it stops when the thread does.
- **Screenshots.** Chromium's (`page.screenshot()`, CDP
  `Page.captureScreenshot`) show the screen — the picture a screencast shows at
  that moment, even where it disagrees with the `Animation` — and neither
  resolves while the main thread is blocked. WebKit's leaves the
  `::view-transition-*` pictures out of a view transition entirely: named
  elements vanish, the root shows un-transitioned. The screencast shows the
  movement in both: CDP `Page.startScreencast` in Chromium, `page.screencast`
  in WebKit (~21 fps, too slow for a one-frame event).

When a human reports a snap that every number says cannot happen, believe the
human: the numbers describe the `Animation`. Look for a rate changed around a
blocked frame, or a negative setter, and reach for the screencast.

## What moves inside a box stays inside the box

The pictures a transition takes are drawn in the top layer, all of them side by
side under `::view-transition`, a flat tree that has forgotten which element was
inside which. **No `overflow` anywhere in the document reaches them.** So the
moment something moves further than the box it lives in — a row travelling to a
position scrolled out of the list, a page pulled in from beside the container —
it is seen crossing the page, over whatever sits next to that box. Nothing about
it looks like a bug in the animation; it looks like the layout broke.

What we want is simply the box's edge, kept during the transition. Two ways to
get it, and the choice is not a matter of taste:

- **The box IS what moves** (its own pictures are bigger than it, the way two
  pages sliding past each other are): clip the box's own group —
  `::view-transition-group(name)` and `::view-transition-image-pair(name)`,
  `overflow: clip`. _Reference: route_travel.jsx._
- **Things move INSIDE the box** (rows of a list, slides of a container): the
  box needs a picture of its own and the pictures of its contents must be drawn
  inside it. That is a nested group:

  1. the box gets a `view-transition-name` (`match-element` will do) and
     `view-transition-group: contain`, which makes it the group everything named
     inside it hangs under;
  2. `::view-transition-group-children(name)` — the box's edge — is told
     `overflow: clip`;
  3. the box's own `::view-transition-old/new` are given `animation: none` and
     `mix-blend-mode: normal`: only its contents moved, and cross-fading the box
     onto itself is a flicker.

  The rows themselves say nothing. `view-transition-group: nearest` on a child
  is the other half of the same feature — the child chooses its ancestor instead
  of the ancestor claiming every name inside it — and is what to reach for when
  the box must contain _these_ elements and not everything an application may
  have named under it.

  _Reference: `itemTransition` in list.jsx (`.navi_list_transition`), demo
  `src/control/demos/12_list_demo.html`; the same CSS written by hand in
  `src/control/demos/many/4_reorderable_list_demo.html`._

Clipping is not the only thing nesting restores: a group drawn inside another
also follows it. A row moving while the list itself moves is one movement, not
two that must be kept in step by hand.

### Where a browser cannot nest, it must not animate

Nesting is **Chrome/Edge 140+, and nothing else** (no Safari, no Firefox). Where
a movement is only correct BECAUSE of the clipping, a browser without it gets
**no transition at all** — the change just happens. What it would play instead is
not a lesser animation, it is content flying across the page, and that is worse
than no animation. A pretty movement on recent browsers, bought with simpler code
and better performance, is the deal being taken here — the others will follow.

**The support test belongs in the CSS, not in the JS.** The whole movement is
written in CSS already; a flag read in JS to decide whether to call
`startViewTransition`, or to decide whether to pass a name, splits one decision
across two languages and leaves JS knowing about browsers. Put the names
themselves inside `@supports (view-transition-group: contain)`: nothing is named,
so nothing is captured, so the call — made unconditionally — animates nothing.

```css
@supports (view-transition-group: contain) {
  .box[data-item-transition] {
    view-transition-name: match-element; /* a name it does not have to choose */
    view-transition-class: my_box;
    view-transition-group: contain;

    [data-view-transition-name] {
      view-transition-name: attr(
        data-view-transition-name type(<custom-ident>)
      );
    }
  }
}
::view-transition-group-children(.my_box) {
  overflow: clip;
}
```

The two ways a name gets written from a stylesheet, and when each is right:

- **`match-element`** — the browser makes up a name, unique by construction, and
  pairs old with new by the ELEMENT. For a box that is still itself across the
  change (the list, the container), where the name is only needed so a group
  exists, and where inventing a unique one in JS is pure ceremony.
- **`attr(data-… type(<custom-ident>))`** — pairs by whatever the attribute says.
  For anything whose identity is its data and not its element: rows are recycled
  as a list scrolls, so `match-element` there pairs the wrong two. JS writes the
  attribute (an id, always, on every browser) and stays out of the decision.

**"Nothing is named" is not "nothing happens": the UA still names the root.** So
on a browser left out, an unconditional `startViewTransition` cross-fades the
whole page — the change is not seen travelling anywhere, it is seen fading. It is
a decent default and it is why the call can stay unconditional. Where it is not
wanted, what turns it off is one line:

```css
@supports not (view-transition-group: contain) {
  :root {
    view-transition-name: none;
  }
}
```

**That line belongs to the application, never to a component.** It speaks for the
whole document, and only whoever owns the page knows whether a fade is a
downgrade or a glitch there — a list or a route travel writing it would be
deciding for every other transition on the page. So navi documents it where the
transition is turned on (`itemTransition`'s JSDoc) and leaves it to the caller,
case by case.

What is left in JS is the `startViewTransition` call and an attribute. Nothing
tests a browser.

## A movement a finger drives, when only the state has the second picture

Some movements show two states at once while only one of them can exist in the
DOM: a router mounts the page that matches the URL and nothing else, and a
swipe between two of them needs both. The way out is not to mount what does not
exist — it is to let the **state lead and the picture follow**: change the state
first, and hand the picture the browser kept of the "before" to the finger.

The gesture then drives a transition instead of driving pixels:

- **Scrub, do not translate.** How the two pictures move is written in CSS
  (keyframes on `::view-transition-old/new`); the finger only says how far in.
  Take the animations on the pseudo-elements (`document.getAnimations()`,
  `effect.pseudoElement`) and set `currentTime = ratio * duration`. Nothing
  about the movement is duplicated in JS, so it stays a CSS concern.
- **Hold them from the first frame, in CSS** — `animation-play-state: paused`
  under an attribute set before the transition starts — and NOT by pausing them
  in JS when `ready` resolves. JS cannot pause what does not exist: the
  animations appear with the transition, a navigation and a render after it was
  asked for, and those frames are the beginning of the gesture. Played at their
  own pace meanwhile, a quick swipe is over before it is ever taken in hand —
  the page arriving lands at once, and the only thing the finger still does is
  cancel it. Ask again for the animations on each move until there are some,
  rather than once at `ready`.
- **Under a finger, the keyframes are linear.** The curve belongs to the hand
  and is already in the pull: an eased scrub runs ahead of the finger through
  the middle of the gesture and lags at the ends, and what one feels is the
  page leaving on its own rather than being pushed — "I did not even see it
  start". Keep it linear for what plays out after the release too: changing the
  curve of an animation that is halfway through moves the picture without
  anything having moved. An eased curve is for a travel nobody is holding.
- **Write the keyframes with longhands, never the `animation` shorthand.** The
  shorthand also writes `animation-play-state`, so a rule using it resets the
  hold above to running and the pictures leave without the finger — the same
  symptom as no hold at all, from a rule that looks unrelated.
- **Cancelling is the same movement backwards**, not a second one — a second
  transition would capture a picture of the wrong "before". Backwards over the
  DISTANCE, not the time: the way in is eased, so at half of its time a travel
  has covered ~80% of its distance, and rewound at `-1` the whole visible way
  back collapses into the steep end of the curve — a snap, not a return. Walk
  the pictures home over how far they visibly are from home, at the travel's
  own pace, and hand the rate over with `updatePlaybackRate()`: in Chromium the
  setter parks a rewinding picture at its start (see "What JS reads of a
  running transition, and what the screen shows").
- **Put the state back UNDER the picture before dropping the picture.** When a
  cancelled gesture has run the animations back to 0, what is on screen is the
  old state; undo the state change, let it render, and only then skip the
  transition. The two are identical at the instant they are swapped, so nothing
  is seen changing. Dropping the picture first shows the state nobody asked for,
  for one frame.
- **The change is a `replace`, not a `push`.** A gesture browses; three swipes
  back and forth must not bury the way out of the page under six history
  entries. What is aimed at (a tab pressed) is the one that pushes.
- **What must follow the gesture is NAMED, not told.** A trait under a tab row,
  a header — outside the pages that travel: give it its own
  `view-transition-name` and the browser animates it from where it was to where
  it is, on the same clock. Nothing measures anything.
- **A browser with no view transitions has no "before"**, so there is nothing to
  drag: read the gesture anyway and apply the change on release. Detect it
  before `ensureDocumentStartViewTransition()` has installed the polyfill (it
  marks itself `isPolyfill`).

Traps:

- **Never wait for a frame inside the update callback.** The browser has
  stopped rendering while it runs — it is waiting for that very promise before
  taking its picture — so a `requestAnimationFrame` in there waits for a frame
  that cannot come, and the transition hangs with the page frozen. And do not
  count microtasks either: how many passes a render takes is the renderer's
  own business, and a count that works today under-waits after the next
  refactor. The component that swaps the DOM is the only one that knows when
  it has — have it say so, and await that. _Reference: `observeRouteRender` in
  route_render.js, armed by `armRouteRenderWait` and awaited by
  `whilePageRenders` in route_travel.jsx._
- **Clip on the pseudo-elements, never on your own box** — see "What moves
  inside a box stays inside the box" above; a travel between pages is the first
  of the two cases described there.
- **A hold is not yours, it is the document's.** Pausing a transition from CSS
  means pausing whatever transition is running — there is no way to name "mine",
  and naming only your own elements would leave everything else the gesture
  carries (a trait under a tab row) playing on its own. So a held transition
  MUST be let go of before any other one starts: only one exists per document,
  starting a second skips the first, and the second is then born paused with
  nobody holding it. It never finishes, its pictures stand over the page, and
  the page cannot be touched again. Release at the single place that knows a
  transition is about to start — for navi, the function
  `ensureDocumentStartViewTransition()` returns, which every transition navi
  starts goes through and which releases what `holdViewTransition` registered
  (`start_view_transition_polyfill.js`).
- **The pictures are not on screen from the call to `finished`**: the capture
  frame and the frame after the pictures drop are live
  ([view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#two-frames-show-the-live-document)).
  Doubt a flash under the press before doubting the movement; a CDP screencast
  shows it, a paused animation never does. _Reference: the "rest" wall in
  `transition_furniture.js`._
- **A press during a transition does not reach a captured element** (see "Keep
  the page out of it" above). A gesture meant to grab what is still moving is
  caught at the document and matched against the travelling box's rectangle —
  how, and why a wheel costs more than a press there, is in the
  [gestures skill](../gestures/SKILL.md).

_Reference: `route_travel.jsx` (whole file), demo
`src/nav/demos/route_travel/route_travel.html`. The full spec of the travel
gesture — who owns it, the wheel reading, the retargeting rules — is the
[gestures skill](../gestures/SKILL.md)._

## Which tool for which movement

| What moves                                           | Tool                        | Why                                                                                                                     |
| ---------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A track between two positions (slides)               | `element.animate()`         | Needs to be interruptible, and to report when it is over (`finished`) — a CSS transition has to be watched from outside |
| A wheel gliding to a row                             | rAF loop + spring           | The target moves while it plays; a fixed-duration animation cannot be re-aimed                                          |
| Rows appearing/leaving/reordering                    | View transitions            | The change is a DOM mutation; nothing else animates a row that stops existing                                           |
| A dragged clone                                      | `position: fixed` + popover | The top layer puts it over everything without bidding on z-index                                                        |
| Two states only one of which can be mounted (routes) | Scrubbed view transition    | The picture of the "before" is the only place the second state exists                                                   |
| A state flip (colour, opacity, frost)                | CSS transition              | Nothing to interrupt, nothing to await                                                                                  |

## First paint

Transitions and animations play on change, never on mount: a user never sees
an element animate into its initial state just because the page appeared, and
an already-open element re-rendering replays nothing. This holds for
color/opacity/transform transitions and keyframe animations alike. The
techniques, roughly in order of preference:

- **No transition at all**: when the emphasis can be positional (a fixed
  overlay the content moves under) rather than a per-element state flip, there
  is nothing to animate on mount by construction.
- **`@starting-style`**: declare the "from" state in a `@starting-style` block
  so the browser interpolates from it _only_ the first time the element is
  displayed. Pair it with `transition-behavior: allow-discrete` when animating
  `display`/`overlay` (a popover or a dialog entering). No JS, no flags — the
  choice whenever the from-state is a fixed style.
- **The reflow trick**, when `@starting-style` cannot express the from-state —
  it depends on a layout box that only exists once shown: set
  `transition-property: none`, apply the "closed" state, force a layout read
  (`getBoundingClientRect()`) so that closed frame is genuinely rendered, then
  flip to the target state and restore `transition-property`. _Reference:
  `navi/src/layout/popover.jsx` (search `transitionProperty = "none"`), and the top
  comment of `navi/src/layout/popup_css.js` for why `@starting-style` does not work
  there._
- **Gate on displayed, not mounted**: arm the entrance transition only when the
  element becomes displayed, so it does not replay when something already open
  re-renders. _Reference: `useDisplayedLayoutEffect`
  (`navi/src/utils/use_displayed_layout_effect.js`)._

## Verifying

Movement is measured, not eyeballed — once verification is asked for or has
been earned (see the constraints in
[.agents/instructions.md](../../instructions.md#constraints)). Drive the demo
with Playwright and read the numbers: the moving property mid-travel (`getComputedStyle`), the pace
(`element.getAnimations()[0].effect.getTiming()`), the state attribute while
the pixels are still moving. Feelings have numbers too: "each press is felt"
is a speed spike in the samples right after the press; "mushy" is its absence.
A duration wrong by a factor of two is invisible to the eye but obvious in the
number.

One family of exceptions: anything composited — the pseudo-elements of a view
transition first of all. There the numbers describe the `Animation`, and the
screen can play something else (see "What JS reads of a running transition,
and what the screen shows"). A screenshot does not settle it: Chromium's
cannot be taken while the thread is blocked, and WebKit's leaves the
view-transition pictures out. Verify those on a screencast, or an eye.

When a change must leave a movement exactly as it was — a performance change
above all — compare what defines it with the animations **pinned at the same
time** (`animation.pause(); animation.currentTime = t` on every
`::view-transition-*` animation), then read the pseudo-elements' computed
styles, the attributes on the root, and the list of running animations.
Sampled "N ms after it started" instead, the numbers also move with how busy
the main thread was, and a real difference cannot be told from a timing one.
Do it in Chrome and in WebKit.

A second family: two properties that must agree, one composited and one
painted (see "One clock per movement"). Every number JS reads shows them in
step; the bug only exists when the main thread is late. Make it late on
purpose: in `page.evaluate`, trigger the movement and then spin the thread
for 400ms without awaiting, and read the screencast frames that arrive during
the block — a frame drawn while the thread is blocked can only be the
compositor's (a screenshot waits for the block to end). Compare with
the same movement slowed to 2s, where the lag is a fraction of the animation
instead of the whole of it: a bug that shows at 300ms and vanishes at 2s is
this one.
