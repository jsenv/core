import {
  createPlaybackController,
  exposePlaybackControllerProps,
} from "oto/src/playback/playback_controller.js";
import { visualContentPlaybackIsPreventedSignal } from "oto/src/playback/visual_content_playback.js";

export const animateRatio = ({
  type = "ratio_animation",
  effect,
  duration = 300,
  fps,
  easing,
  props,
  loop = false,
  isAudio = false,
  onprogress = () => {},
  autoplay = true,
  onstart,
  onpause,
  onremove,
  onfinish,
}) => {
  const ratioAnimation = {
    duration,
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const ratioAnimationContent = {
    type,
    start: ({ finished }) => {
      const requestNext = isAudio
        ? requestAudioAnimationCallback
        : requestVisualAnimationCallback;

      let progressRatio;
      let ratio;
      let cancelNext;
      let msRemaining;
      let previousStepMs;
      const setProgressRatio = (value) => {
        progressRatio = value;
        ratio = easing ? easing(progressRatio) : progressRatio;
        effect(ratio);
        onprogress(progressRatio);
      };
      const stepMinDuration = fps ? 1000 / fps : 0;

      const next = () => {
        const stepMs = Date.now();
        const msEllapsedSincePreviousStep = stepMs - previousStepMs;
        const msRemainingAfterThisStep =
          msRemaining - msEllapsedSincePreviousStep;
        if (
          // we reach the end, round progress to 1
          msRemainingAfterThisStep <= 0 ||
          // we are very close from the end, round progress to 1
          msRemainingAfterThisStep <= 16.6
        ) {
          if (loop) {
            setProgressRatio(1);
            msRemaining = ratioAnimation.duration;
            progressRatio = 0;
            ratio = 0;
            previousStepMs = stepMs;
            cancelNext = requestNext(next);
            return;
          }
          setProgressRatio(1);
          finished();
          return;
        }
        if (msEllapsedSincePreviousStep < stepMinDuration) {
          cancelNext = requestNext(next);
          return;
        }
        previousStepMs = stepMs;
        msRemaining = msRemainingAfterThisStep;
        setProgressRatio(
          progressRatio + msEllapsedSincePreviousStep / ratioAnimation.duration,
        );
        cancelNext = requestNext(next);
      };

      progressRatio = 0;
      ratio = 0;
      msRemaining = ratioAnimation.duration;
      previousStepMs = Date.now();
      effect(0);
      cancelNext = requestNext(next);

      return {
        pause: () => {
          cancelNext();
          cancelNext = undefined;
          return () => {
            previousStepMs = Date.now();
            cancelNext = requestNext(next);
          };
        },
        finish: () => {
          if (cancelNext) {
            // cancelNext is undefined when "idle" or "paused"
            cancelNext();
            cancelNext = undefined;
          }
          setProgressRatio(1);
          finished();
        },
        stop: () => {
          if (cancelNext) {
            // cancelNext is undefined when "idle", "paused" or "finished"
            cancelNext();
            cancelNext = undefined;
          }
          previousStepMs = undefined;
          progressRatio = undefined;
          ratio = undefined;
        },
        remove: () => {
          // nothing to cleanup?
        },
      };
    },
  };
  const playbackController = createPlaybackController(ratioAnimationContent, {
    playbackPreventedSignal: isAudio
      ? undefined
      : visualContentPlaybackIsPreventedSignal,
  });
  exposePlaybackControllerProps(playbackController, ratioAnimation);
  Object.assign(ratioAnimation, props);
  if (autoplay) {
    ratioAnimation.play();
  }
  return ratioAnimation;
};
const requestAudioAnimationCallback = (callback) => {
  let timeout = setTimeout(callback, 1000 / 60);
  return () => {
    clearTimeout(timeout);
    timeout = null;
  };
};
const requestVisualAnimationCallback = (callback) => {
  let frame = requestAnimationFrame(callback);
  return () => {
    cancelAnimationFrame(frame);
    frame = null;
  };
};
