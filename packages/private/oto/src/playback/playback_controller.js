import { effect, signal } from "@preact/signals";
import { createPlaybackAbortError } from "./playback_abort_error.js";

const NOOP = () => {};

export const createPlaybackController = (
  content,
  { playbackPreventedSignal = signal(false) } = {},
) => {
  // "idle", "running", "paused", "removed", "finished"
  const stateSignal = signal("idle");
  let resolveFinished;
  let rejectFinished;
  const createFinishedPromise = () => {
    return new Promise((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });
  };
  const cleanupCallbackSet = new Set();
  const playRequestedSignal = signal(false);
  let resumeMethod;
  const goToState = (newState) => {
    stateSignal.value = newState;
    if (newState === "running") {
      playbackController.onstart();
    } else if (newState === "paused") {
      playbackController.onpause();
    } else if (newState === "finished") {
      playbackController.onfinish();
    } else if (newState === "removed") {
      playbackController.onremove();
    }
  };
  let contentPlaying = null;

  const playbackController = {
    stateSignal,
    onstart: NOOP,
    onpause: NOOP,
    onremove: NOOP,
    onfinish: NOOP,
    finished: createFinishedPromise(),

    play: () => {
      playRequestedSignal.value = true;
    },
    pause: () => {
      const state = stateSignal.peek();
      if (state === "running" || state === "finished") {
        playRequestedSignal.value = false;
        resumeMethod = contentPlaying.pause?.();
        goToState("paused");
      }
    },
    remove: () => {
      const state = stateSignal.peek();
      if (state === "removed") {
        return;
      }
      if (state === "running" || state === "paused" || state === "finished") {
        contentPlaying.stop?.();
        contentPlaying.remove?.();
      }
      resumeMethod = undefined;
      if (rejectFinished) {
        rejectFinished(createPlaybackAbortError());
        rejectFinished = undefined;
      }
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      playbackController.finished = undefined;
      cleanupCallbackSet.clear();
      content = undefined;
      contentPlaying = undefined;
      goToState("removed");
    },
    finish: () => {
      const state = stateSignal.peek();
      if (state === "running" || state === "paused") {
        contentPlaying.finish?.();
        return;
      }
    },
  };

  cleanupCallbackSet.add(
    effect(() => {
      const playRequested = playRequestedSignal.value;
      const playbackPrevented = playbackPreventedSignal.value;
      if (!playRequested) {
        return;
      }
      if (playbackPrevented) {
        return;
      }
      const state = stateSignal.peek();
      if (state === "running" || state === "removed") {
        return;
      }
      if (state === "idle" || state === "finished") {
        if (state === "finished") {
          playbackController.finished = createFinishedPromise();
        }
        contentPlaying = content.start({
          playbackController,
          finished: () => {
            resolveFinished();
            resolveFinished = undefined;
            goToState("finished");
            playRequestedSignal.value = false;
          },
        });
        goToState("running");
        return;
      }
      if (state === "paused") {
        resumeMethod();
        resumeMethod = undefined;
        goToState("running");
        return;
      }
    }),
  );

  return playbackController;
};

export const exposePlaybackControllerProps = (playbackController, object) => {
  Object.assign(object, {
    playbackController,
    play: playbackController.play,
    pause: playbackController.pause,
    finish: playbackController.finish,
    remove: playbackController.remove,
    get finished() {
      return playbackController.finished;
    },
  });
  playbackController.onstart = () => {
    object.onstart?.();
  };
  playbackController.onpause = () => {
    object.onpause?.();
  };
  playbackController.onremove = () => {
    object.onremove?.();
  };
  playbackController.onfinish = () => {
    object.onfinish?.();
  };
};

window.addEventListener("unhandledrejection", (event) => {
  const { reason } = event;
  if (reason && reason.name === "AbortError" && reason.isPlaybackAbortError) {
    event.preventDefault();
  }
});
