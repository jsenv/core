export const getTimelineCurrentTime = () => {
  return document.timeline.currentTime;
};

const visualCallbackSet = new Set();
const backgroundCallbackSet = new Set();
export const addOnTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.add(callback);
  } else {
    backgroundCallbackSet.add(callback);
  }
};
export const removeFromTimeline = (callback, isVisual) => {
  if (isVisual) {
    visualCallbackSet.delete(callback);
  } else {
    backgroundCallbackSet.delete(callback);
  }
};

// We need setTimeout to animate things like volume because requestAnimationFrame would be killed when tab is not visible
// while we might want to fadeout volumn when leaving the page for instance
const createBackgroundUpdateLoop = () => {
  let timeout;
  const update = () => {
    for (const backgroundCallback of backgroundCallbackSet) {
      backgroundCallback();
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
    for (const visualCallback of visualCallbackSet) {
      visualCallback();
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
if (typeof document === "object") {
  startTimeline();
}
