# Transition System

The transition system provides a unified, framework-agnostic approach to animations and value interpolation over time. It's built around the concept of "transitions" - smooth changes from one value to another with fine-grained control over when they start, pause, cancel, or redirect to new targets.

## What is a Transition?

A transition is a self-contained object that manages the smooth change of a value from a starting point to an ending point over a specified duration. You can control exactly how the transition behaves at any point during its lifecycle.

```js
import { createTransition } from "./transition_playback.js";

const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
  easing: EASING.EASE_OUT,
  lifecycle: {
    setup: (transition) => {
      const element = document.getElementById("box");
      const originalWidth = element.style.width;

      return {
        update: (value) => {
          element.style.width = `${value}px`;
        },
        teardown: () => {
          element.removeAttribute("data-animating");
        },
        restore: () => {
          element.style.width = originalWidth;
        },
      };
    },
  },
});

transition.play(); // Start the transition
// Later: transition.pause(), transition.cancel(), or transition.updateTarget(150)
```

## Core Concepts

### Control Methods

- `play()`: Start or resume the transition
- `pause()`: Pause the transition
- `cancel()`: Cancel and restore original state
- `finish()`: Jump to completion
- `updateTarget(newValue)`: Change the target value mid-transition

### Data Properties

- `from`, `to`: Start and end values
- `value`: Current interpolated value
- `progress`: Current progress (0 to 1)
- `duration`: Duration in milliseconds
- `playState`: Current state ("idle", "running", "paused", "finished")

## Why Transitions?

### Timeline Integration

All transitions are managed by a centralized timeline that coordinates their execution. Visual transitions (DOM animations) use `requestAnimationFrame` for optimal performance, while background transitions (like audio volume) use `setTimeout` to continue running even when the tab is not visible.

```js
const transition = createTimelineTransition({
  from: 0,
  to: 100,
  duration: 1000,
  isVisual: true, // Uses requestAnimationFrame with other visual transitions
  lifecycle: {
    setup: () => ({
      update: (value) => (element.style.left = `${value}px`),
    }),
  },
});
```

### Beyond Visual Animations

Unlike `requestAnimationFrame`-only solutions, the transition system can animate any value, including audio properties that need to continue running when the page is not visible:

```js
// Audio volume fade - continues even when tab is inactive
const volumeTransition = createTimelineTransition({
  from: 1.0,
  to: 0.0,
  duration: 2000,
  lifecycle: {
    setup: () => ({
      update: (value) => {
        audioElement.volume = value;
      },
    }),
  },
});
```

## Common Use Cases

### DOM Animations

```js
import { createHeightAnimation } from "./transition_dom.js";

// Animate element height
const heightTransition = createHeightAnimation(element, 200, {
  duration: 500,
  easing: EASING.EASE_OUT,
});

heightTransition.play();
```

### Group Coordination

```js
import { createGroupTransition } from "./transition_group.js";

// Coordinate multiple transitions
const group = createGroupTransition([
  heightTransition,
  widthTransition,
  opacityTransition,
]);

group.play(); // Start all transitions together
```

## Advanced Features

### Target Updates Mid-Transition

The most powerful feature is the ability to smoothly redirect a running transition to a new target. This enables natural back-and-forth transitions that respond to user interaction without jarring stops and restarts:

```js
const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
});

transition.play();

// User changes their mind - smoothly redirect to new target
setTimeout(() => {
  transition.updateTarget(200); // Seamlessly changes direction
}, 300);

// Can redirect again while running
setTimeout(() => {
  transition.updateTarget(50); // Goes back towards start
}, 600);
```

This creates fluid, responsive animations that feel natural to users - like a drawer that can smoothly change direction based on gesture input, or a progress bar that updates its target without visual discontinuity.

### Custom Easing Functions

```js
const bounceTransition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
  easing: (t) => {
    // Custom bounce easing
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
});
```

## Integration with jsenv

The transition system is a core component of the jsenv ecosystem, particularly in **@jsenv/navi** where it powers smooth UI transitions:

### Navigation Transitions

- **Page transitions**: Smooth fade-ins and slide-outs when navigating between routes
- **Loading states**: Progress indicators and skeleton animations during data fetching
- **Menu animations**: Drawer openings, dropdown expansions, and overlay appearances

### Interactive Elements

- **Form validation**: Smooth error message appearances and field highlighting
- **Modal dialogs**: Backdrop fades and modal scaling animations
- **Collapsible content**: Details elements that expand and contract smoothly

The transition system ensures that all these UI changes feel cohesive and responsive, creating a polished user experience where interface elements flow naturally from one state to another. When you navigate in @jsenv/navi applications, the smooth page transitions and responsive UI elements are all powered by this transition system working behind the scenes.
