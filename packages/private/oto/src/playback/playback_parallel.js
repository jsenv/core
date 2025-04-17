export const createParallelPlaybackController = (
  animations,
  { onremove = () => {}, onfinish = () => {} } = {},
) => {
  let resolveFinished;
  let rejectFinished;
  let animationFinishedCounter;
  const parallelAnimation = {
    playState: "idle",
    finished: null,
    onremove,
    onfinish,
    play: () => {
      if (parallelAnimation.playState === "running") {
        return;
      }
      if (
        parallelAnimation.playState === "paused" ||
        parallelAnimation.playState === "finished"
      ) {
        for (const animation of animations) {
          animation.play();
        }
        parallelAnimation.playState = "running";
        return;
      }
      parallelAnimation.finished = new Promise((resolve, reject) => {
        resolveFinished = resolve;
        rejectFinished = reject;
      });
      animationFinishedCounter = 0;
      for (const animation of animations) {
        // eslint-disable-next-line no-loop-func
        animation.onfinish = () => {
          animationFinishedCounter++;
          if (animationFinishedCounter === animations.length) {
            parallelAnimation.onfinish();
            resolveFinished();
          }
        };
        animation.onremove = () => {
          parallelAnimation.remove();
        };
      }
    },
    pause: () => {
      if (parallelAnimation.playState === "paused") {
        return;
      }
      for (const animation of animations) {
        animation.pause();
      }
      parallelAnimation.playState = "paused";
    },
    finish: () => {
      if (parallelAnimation.playState === "finished") {
        return;
      }
      for (const animation of animations) {
        animation.finish();
      }
      parallelAnimation.playState = "finished";
    },
    remove: () => {
      if (parallelAnimation.playState === "removed") {
        return;
      }
      for (const animation of animations) {
        animation.remove();
      }
      parallelAnimation.playState = "removed";
      parallelAnimation.onremove();
      rejectFinished(createAnimationAbortError());
    },
  };
  parallelAnimation.play();
  return parallelAnimation;
};
