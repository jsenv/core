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
  not contribute to it. Go fetch the position on screen
  (`getComputedStyle(el).translate`) — and fetch it **before** cancelling the
  running animation or writing the new resting value.
- An already-moving element gets `ease-out`, not `ease`: an ease-in from a
  moving state stalls it for an instant right where the eye is following it.

## The pace is the distance

Time scales with what is left to cover: a move interrupted a fifth of the way
and sent back covers a fifth of the distance in a fifth of the time, so the
perceived speed stays constant instead of crawling over a short distance for a
full duration. Scale only ever shortens — a longer-than-usual move is not made
slower.

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
- **Call it through `ensureDocumentStartViewTransition()`**
  (navi/src/transition): installs the API where missing, runs the update
  whatever happens, and swallows the rejection a _skipped_ transition produces
  (two updates close together are normal; the raw API turns the second into an
  unhandled error).
- **Keep the page out of it**: `:root { view-transition-name: none }`. The UA
  names the root `root`, so by default the whole document is replaced by a
  picture for the duration — the page stops rendering live under it. Opted
  out, only the named elements are captured. The reverse is true of a
  transition that moves whole screens past each other (below): there the page
  MUST be a picture, or it renders live beside the pictures being moved — so
  such a transition asks for the root back while it plays rather than assuming
  either rule.

Facts worth knowing before reaching for one:

- **A name must be unique in the document** — a duplicate aborts the
  transition. Scope names by list, by picker, by whatever makes them unique.
- **Pass `viewTransitionName` as a Box prop, never through `style`** — the
  prop drops the name while the element is clipped or off-screen, so it never
  animates from a partial snapshot.
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

## A movement a finger drives, when only the state has the second picture

Some movements show two states at once while only one of them can exist in the
DOM: a router mounts the page that matches the URL and nothing else, and a
swipe between two of them needs both. The way out is not to mount what does not
exist — it is to let the **state lead and the picture follow**: change the state
first, and hand the picture the browser kept of the "before" to the finger.

The gesture then drives a transition instead of driving pixels:

- **Scrub, do not translate.** How the two pictures move is written in CSS
  (keyframes on `::view-transition-old/new`); the finger only says how far in.
  Take the animations on the pseudo-elements
  (`document.getAnimations()`, `effect.pseudoElement`), **pause** them once
  `ready` resolves, and set `currentTime = ratio * duration`. Nothing about the
  movement is duplicated in JS, so it stays a CSS concern.
- **Cancelling is the same movement backwards**, not a second one:
  `playbackRate = -1` and play. A second transition would capture a picture of
  the wrong "before".
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
  a header: give it its own `view-transition-name` and the browser animates it
  from where it was to where it is, on the same clock. Nothing measures
  anything, and it works for elements outside the box that travels.
- **A browser with no view transitions has no "before"**, so there is nothing to
  drag: read the gesture anyway and apply the change on release. Detect it
  before `ensureDocumentStartViewTransition()` has installed the polyfill (it
  marks itself `isPolyfill`).

Two ways to lose an afternoon on this, both seen:

- **Never wait for a frame inside the update callback.** The browser has
  stopped rendering while it runs — it is waiting for that very promise before
  taking its picture — so a `requestAnimationFrame` in there waits for a frame
  that cannot come, and the transition hangs with the page frozen. Waiting for
  the state to have rendered means waiting for **microtasks** (which is what a
  signal-driven render costs), never for a frame.
- **Clip on the pseudo-elements, never on your own box.** The pictures are
  drawn in the top layer: no `overflow` anywhere in the document reaches them,
  so a page sliding in is seen crossing whatever sits beside the box until
  `::view-transition-group(name)` (and its `image-pair`) is told to clip.

_Reference: `route_travel.jsx` (whole file), demo
`src/nav/demos/route_travel/route_travel.html`._

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

Transitions and animations play on change, never on mount. The techniques
(`@starting-style`, the reflow trick, gating on displayed) are in
[.agents/instructions.md](../../instructions.md#css) — that rule applies
everywhere, not only here.

## Verifying

Movement is measured, not eyeballed. Drive the demo with Playwright and read
the numbers: the moving property mid-travel (`getComputedStyle`), the pace
(`element.getAnimations()[0].effect.getTiming()`), the state attribute while
the pixels are still moving. Feelings have numbers too: "each press is felt"
is a speed spike in the samples right after the press; "mushy" is its absence.
A duration wrong by a factor of two is invisible to the eye but obvious in the
number.
