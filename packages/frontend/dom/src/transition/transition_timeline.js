const visualTransitionSet = new Set();
const backgroundTransitionSet = new Set();
export const addOnTimeline = (transition, isVisual) => {
  if (isVisual) {
    visualTransitionSet.add(transition);
  } else {
    backgroundTransitionSet.add(transition);
  }
};
export const removeFromTimeline = (transition, isVisual) => {
  if (isVisual) {
    visualTransitionSet.delete(transition);
  } else {
    backgroundTransitionSet.delete(transition);
  }
};
const updateTransition = (transition) => {
  const { startTime } = transition;
  const msElapsedSinceStart = document.timeline.currentTime - startTime;
  transition.update(msElapsedSinceStart);
};
// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundTransition of backgroundTransitionSet) {
      updateTransition(backgroundTransition);
    }
    timeout = setTimeout(update, 16); // roughly 60fps
  };
  return {
    start: () => {
      timeout = setTimeout(update, 16);
    },
    stop: () => {
      clearTimeout(timeout);
    },
  };
};
// For visual things we use animation frame which is more performant and made for this
const createAnimationFrameLoop = () => {
  let animationFrame = null;
  const update = () => {
    for (const visualTransition of visualTransitionSet) {
      updateTransition(visualTransition);
    }
    animationFrame = requestAnimationFrame(update);
  };
  return {
    start: () => {
      animationFrame = requestAnimationFrame(update);
    },
    stop: () => {
      cancelAnimationFrame(animationFrame);
    },
  };
};
const backgroundUpdateLoop = createBackgroundUpdateLoop();
const animationUpdateLoop = createAnimationFrameLoop();

let timelineIsRunning = false;
export const stopTimeline = () => {
  if (!timelineIsRunning) {
    return;
  }
  timelineIsRunning = false;
  backgroundUpdateLoop.stop();
  animationUpdateLoop.stop();
};
export const startTimeline = () => {
  if (timelineIsRunning) {
    return;
  }
  timelineIsRunning = true;
  backgroundUpdateLoop.start();
  animationUpdateLoop.start();
};
startTimeline();
