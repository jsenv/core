import {
  createPlaybackController,
  exposePlaybackControllerProps,
} from "./playback_controller.js";

export const createPlaybackSequenceController = (
  childCallbacks,
  {
    type = "sequence",
    onbeforestart = () => {},
    autoplay = true,
    onstart,
    onpause,
    onremove,
    onfinish,
  } = {},
) => {
  const sequence = {
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const sequenceContent = {
    type,
    start: ({ finished }) => {
      let childIndex;
      const getNextChild = () => {
        const isFirst = childIndex === 0;
        const isLast = childIndex === childCallbacks.length - 1;
        const childCallback = childCallbacks[childIndex];
        const nextChild = childCallback({
          index: childIndex,
          isFirst,
          isLast,
        });
        // nextAnimation.canPlayWhileGloballyPaused = true; // ensure subanimation cannot play/pause on its own
        childIndex++;
        return nextChild;
      };

      let currentChild;
      childIndex = 0;
      const startNext = () => {
        if (childIndex === childCallbacks.length) {
          currentChild = undefined;
          finished();
          return;
        }
        currentChild = getNextChild();
        const state = currentChild.playbackController.stateSignal.peek();
        if (state === "running") {
          playbackController.play();
        } else if (state === "paused") {
          playbackController.pause();
        } else if (state === "finished") {
          startNext();
        }
        overrideEventCallback(currentChild, "onplay", () => {
          playbackController.play();
        });
        overrideEventCallback(currentChild, "onpause", () => {
          playbackController.pause();
        });
        overrideEventCallback(currentChild, "onfinish", () => {
          const state = playbackController.stateSignal.peek();
          if (state === "running") {
            startNext();
          }
        });
        overrideEventCallback(currentChild, "onremove", () => {
          playbackController.remove();
        });
      };
      onbeforestart();
      startNext();
      return {
        pause: () => {
          if (currentChild) {
            currentChild.pause();
            return () => {
              currentChild.play();
            };
          }
          return () => {};
        },
        finish: () => {
          if (currentChild) {
            currentChild.finish();
            while (childIndex < childCallbacks.length) {
              const nextChild = getNextChild();
              nextChild.finish();
            }
            currentChild = null;
          }
        },
        stop: () => {
          if (currentChild) {
            currentChild.stop();
            currentChild = undefined;
          }
        },
        remove: () => {
          if (currentChild) {
            currentChild.remove();
            currentChild = undefined;
          }
        },
      };
    },
  };
  const playbackController = createPlaybackController(sequenceContent);
  exposePlaybackControllerProps(playbackController, sequence);
  if (autoplay) {
    sequence.play();
  }
  return sequence;
};

const overrideEventCallback = (object, property, callback) => {
  const oldValue = object[property];
  object[property] = (...args) => {
    if (oldValue) {
      oldValue(...args);
    }
    callback(...args);
  };
  return () => {
    object[property] = oldValue;
  };
};
