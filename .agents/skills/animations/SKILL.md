---
name: animations
description: How movement is written in @jsenv/navi — who owns the state while something animates, how a travel that is interrupted picks up, how an animation keeps up with a user who is faster than it, and where view transitions may and may not live. Use when adding or changing any animated behaviour (slides, wheel, list add/remove/reorder, drag).
---

## The one rule: the state is already there, the animation catches up

A control answers about the value it is **heading to**, never about the pixels
currently on screen. Ask a wheel mid-glide what it holds and it answers the row
it is gliding to; ask a slide container mid-travel which slide is current and it
answers the one arriving. Everything else follows from that:

- a second press is measured against the target, not against what is on screen —
  so N quick presses land N steps away (see `stepTarget` in wheel.jsx,
  `pendingRollsRef` in slide_container.jsx);
- code reading the state during a move never sees a half-value;
- an animation can be cut short at any moment without the state being wrong. The
  wheel does exactly that when something outside needs a stable surface:
  `commitIfAnimating` settles the value on the spot when a press lands elsewhere,
  because a coasting list re-rendering under a finger swallows the tap that
  follows.

The opposite arrangement — the animation owning the state, the way a physics
engine owns a position — is a different design, and not this one. Do not mix
them: an animation here never decides a value, it only shows it arriving.

## An interrupted movement starts from where it IS

Never from where the previous one was heading. Reading the previous _target_
makes the thing jump to the end of a move that never finished and only then
travel back.

```js
// slide_container.jsx
const travelInFlight = trackAnimationRef.current?.playState === "running";
const offsetOnScreen = travelInFlight
  ? getComputedStyle(track).translate // where it is, right now
  : undefined;
```

Two traps:

- **Do not** leave the "from" keyframe implicit hoping the browser will use the
  current position. An animation with only a "to" keyframe starts from the
  _underlying_ value — the resting style — because the animation being replaced
  does not contribute to it. The position on screen is a thing to go and fetch.
- Read it **before** cancelling the running animation, and before writing the
  new resting value.

## The pace is the distance, and then the user

Two multipliers, in this order:

1. **Distance.** The duration is scaled by how much of the travel is actually
   left: interrupted a fifth of the way and sent back, it covers a fifth of the
   distance in a fifth of the time. That keeps the speed constant instead of
   crawling back over a short distance for a full duration. Only ever shortens
   — a longer-than-usual move is not made slower.
2. **The input rate.** When presses are waiting (a queue, a target that keeps
   moving), what is left is divided again: someone pressing → four times is
   asking to be four slides further, not to watch four travels. The wheel does
   the same with a spring whose stiffness grows with the distance to the target,
   so a second press mid-glide reads as accelerating rather than restarting.

An already-moving element gets `ease-out` rather than `ease`: an ease-in from a
moving state stalls it for an instant right where the eye is following it.

## Presses during a movement are kept, not refused

A container that cannot travel yet (a looping window whose content has not
rolled) **queues** the press and takes it when it can, one per settle. Refusing
it is what makes a carousel feel stuck. The queue is a list, not a single slot:
three presses are three steps.

## View transitions

`document.startViewTransition` takes a callback that **makes the DOM change**,
so it can only be called by whoever owns the state. That has three consequences,
and they are not negotiable:

- **navi never starts one.** A component sees the change only once the DOM
  already holds it — too late to capture the "before". So `List` declares what a
  row does (`itemTransition` names each row and ships the keyframes) and the
  application wraps its own `setState` in the transition. Same for a dismissed
  error row: the row calls `onErrorDismiss`, the caller animates.
- **Call it through `ensureDocumentStartViewTransition()`** (navi/src/transition):
  it installs the API where the browser has none and returns a function that runs
  the update whatever happens and swallows the rejection a _skipped_ transition
  produces. Two updates close together are normal; the raw API turns the second
  into an unhandled error (a full error overlay in dev).
- **Keep the page out of it**: `:root { view-transition-name: none }`. The UA
  names the root `root`, so by default the whole document is captured and
  replaced by a picture for the duration — separators stop being drawn, sibling
  lists sit on a stale image, and the page jumps as it scrolls under its own
  frozen photograph. Opted out, only the named elements are captured and the
  rest of the page keeps rendering live.

Two more facts worth knowing before reaching for one:

- **A name must be unique in the document.** Two elements sharing one aborts the
  transition ("duplicate view-transition-name"). Scope names by list, by picker,
  by whatever makes them unique.
- **Pass `viewTransitionName` as a Box prop, never through `style`.** The prop
  wires `usePartiallyHidden`, which drops the name while the element is clipped
  or off-screen — otherwise it animates from a partial snapshot.
- **The layout changes at once.** A view transition animates snapshots, not
  layout: the document height jumps the moment the callback runs, and no scroll
  follows a row shrinking. Wanting the scroll to follow means animating the real
  height (WAAPI), not a snapshot.

## Which tool for which movement

| What moves                             | Tool                        | Why                                                                                                                     |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A track between two positions (slides) | `element.animate()`         | Needs to be interruptible, and to report when it is over (`finished`) — a CSS transition has to be watched from outside |
| A wheel gliding to a row               | rAF loop + spring           | The target moves while it plays; a fixed-duration animation cannot be re-aimed                                          |
| Rows appearing/leaving/reordering      | View transitions            | The change is a DOM mutation; nothing else animates a row that stops existing                                           |
| A dragged clone                        | `position: fixed` + popover | The top layer puts it over everything without bidding on z-index                                                        |
| A state flip (colour, opacity, frost)  | CSS transition              | Nothing to interrupt, nothing to await                                                                                  |

## First paint

Transitions and animations play on change, never on mount. The techniques
(`@starting-style`, the reflow trick, gating on displayed) are in
[.agents/instructions.md](../../instructions.md#css) — that rule applies
everywhere, not only here.

## Verifying

Movement is measured, not eyeballed. Drive the demo with Playwright and read the
numbers: `getComputedStyle(track).translate` mid-travel,
`element.getAnimations()[0].effect.getTiming().duration` for the pace, the
`data-current` attribute for what the state says while the pixels are still
moving. A screenshot taken at a chosen moment says what a description cannot —
and a duration that is wrong by a factor of two is invisible to the eye but
obvious in the number.
