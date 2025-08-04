const animationToUpdateSet = new Set();
const animationCleanupMap = new Map();
export const addOnTimeline = (animation) => {
  animationToUpdateSet.add(animation);
  animation.startTime = document.timeline.currentTime;
  const startReturnValue = animation.onStart();
  if (typeof startReturnValue === "function") {
    animationCleanupMap.set(animation, startReturnValue);
  }
};
export const removeFromTimeline = (animation) => {
  animationToUpdateSet.delete(animation);
};

let paused = true;
let animationFrame = null;
const draw = () => {
  for (const animationToUpdate of animationToUpdateSet) {
    if (animationToUpdate.paused) {
      continue;
    }
    const elapsed = document.timeline.currentTime - animationToUpdate.startTime;
    const progress = Math.min(elapsed / animationToUpdate.duration, 1);
    const from = animationToUpdate.from;
    const to = animationToUpdate.to;
    if (progress < 1) {
      const easedProgress = animationToUpdate.easing(progress);
      const animatedValue = from + (to - from) * easedProgress;
      animationToUpdate.onUpdate(animatedValue, { timing: "progress" });
      continue;
    }
    animationToUpdateSet.delete(animationToUpdate);
    animationToUpdate.onUpdate(to, { timing: "end" });
    const cleanup = animationCleanupMap.get(animationToUpdate);
    if (cleanup) {
      animationCleanupMap.delete(animationToUpdate);
      cleanup();
    }
    animationToUpdate.onFinish();

    continue;
  }
  animationFrame = requestAnimationFrame(draw);
};

export const pause = () => {
  if (paused) {
    return;
  }
  paused = true;
  cancelAnimationFrame(animationFrame);
};
const play = () => {
  if (!paused) {
    return;
  }
  animationFrame = requestAnimationFrame(draw);
};

play();
