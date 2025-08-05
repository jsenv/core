# Transition System

The transition system provides a unified, framework-agnostic approach to animations and value interpolation over time. It's built around the concept of "transitions" - smooth changes from one value to another with complete lifecycle control.

## What is a Transition?

A transition is a self-contained object that manages the smooth change of a value from a starting point to an ending point over a specified duration. Unlike traditional animation libraries that separate data and control, transitions integrate both aspects into a single, coherent API.

```js
import { createTransition } from "./transition_playback.js";

const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
  easing: EASING.EASE_OUT,
});

transition.play(); // Start the transition
```

## Core Concepts

### Unified Object Model

Each transition contains both **data properties** and **control methods**:

**Data Properties:**

- `from`, `to`: Start and end values
- `value`: Current interpolated value
- `progress`: Current progress (0 to 1)
- `duration`: Duration in milliseconds
- `playState`: Current state ("idle", "running", "paused", "finished")

**Control Methods:**

- `play()`: Start or resume the transition
- `pause()`: Pause the transition
- `cancel()`: Cancel and restore original state
- `finish()`: Jump to completion
- `update(progress)`: Manually update progress
- `updateTarget(newValue)`: Change the target value mid-transition

### Lifecycle Management

Transitions have two types of lifecycle methods:

#### Configuration Lifecycle

Handles transition setup and state management:

- `setup()`: Initialize the transition and return execution methods
- `pause()`: Handle pause logic and return resume function
- `cancel()`: Handle cancellation cleanup
- `finish()`: Handle completion cleanup
- `updateTarget()`: Handle target value changes

#### Execution Lifecycle

Returned by setup for runtime control:

- `update(value)`: Apply the current value (e.g., update DOM)
- `teardown()`: Clean up resources
- `restore()`: Restore original state

```js
const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
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
```

## Why Transitions?

### 1. **Unified API**

No more juggling separate animation objects, controllers, and data. Everything you need is in one place.

### 2. **Predictable State Management**

Clear state transitions with built-in state checking and warnings for invalid operations.

### 3. **Performance Control**

Built-in FPS capping for performance optimization:

```js
const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
  fps: 30, // Limit to 30 FPS for better performance
});
```

### 4. **Timeline Integration**

Automatic browser timeline management for optimal performance:

```js
const transition = createTimelineTransition({
  from: 0,
  to: 100,
  duration: 1000,
  isVisual: true, // Uses requestAnimationFrame
  setup: () => ({
    update: (value) => (element.style.left = `${value}px`),
  }),
});
```

### 5. **Reactive Programming**

Built-in event channels for reactive updates:

```js
transition.channels.progress.add((transition) => {
  console.log(`Progress: ${transition.progress}`);
});

transition.channels.finish.add(() => {
  console.log("Animation complete!");
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

### Value Interpolation

```js
// Animate any numeric value
const volumeTransition = createTransition({
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

### Progressive Enhancement

```js
// Graceful fallback for reduced motion
const transition = createTransition({
  from: 0,
  to: 100,
  duration: window.matchMedia("(prefers-reduced-motion)").matches ? 0 : 500,
});
```

## Advanced Features

### Target Updates Mid-Transition

```js
const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
});

transition.play();

// Change target while running
setTimeout(() => {
  transition.updateTarget(200); // Smoothly redirect to new target
}, 300);
```

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

### Performance Monitoring

```js
const transition = createTransition({
  from: 0,
  to: 100,
  duration: 1000,
  onProgress: (transition) => {
    if (transition.timing === "start") {
      console.time("transition-duration");
    } else if (transition.timing === "end") {
      console.timeEnd("transition-duration");
    }
  },
});
```

## Best Practices

### 1. **Use Timeline Transitions for DOM**

For DOM animations, prefer `createTimelineTransition` for optimal performance.

### 2. **Implement Proper Cleanup**

Always provide teardown and restore methods in your execution lifecycle.

### 3. **Batch DOM Updates**

Group multiple DOM changes in a single update function to minimize reflows.

### 4. **Consider FPS Limits**

Use FPS capping for non-critical animations to preserve performance.

### 5. **Handle Edge Cases**

Check for zero-duration transitions and very small value differences.

## Integration with jsenv

The transition system is designed to integrate seamlessly with other jsenv packages:

- **@jsenv/navi**: Transitions in navigation and UI state changes
- **Form validation**: Smooth validation message appearances
- **Component lifecycle**: Smooth mounting/unmounting transitions
- **Responsive design**: Smooth breakpoint transitions

The system prioritizes web standards, performance, and developer experience while providing the flexibility needed for complex animation scenarios.
