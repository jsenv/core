import { signal } from "@preact/signals";
import {
  createPlaybackController,
  exposePlaybackControllerProps,
} from "/playback/playback_controller.js";
import { visualContentPlaybackIsPreventedSignal } from "/playback/visual_content_playback.js";

export const animateFrames = (
  frames,
  {
    msBetweenFrames = 350,
    loop = true,
    autoplay = true,
    onstart,
    onpause,
    onremove,
    onfinish,
  } = {},
) => {
  const frameSignal = signal();
  const frameAnimation = {
    frameSignal,
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const frameContent = {
    type: "frame_animation",
    start: ({ finished }) => {
      let index;
      let lastIndex = frames.length - 1;
      let paused;

      const setFrameIndex = (value) => {
        index = value;
        frameSignal.value = frames[index];
      };

      setFrameIndex(0);
      let interval = setInterval(() => {
        if (paused) {
          return;
        }
        if (index === lastIndex) {
          if (!loop) {
            clearInterval(interval);
            finished();
            return;
          }
          setFrameIndex(0);
          return;
        }
        setFrameIndex(index + 1);
      }, msBetweenFrames);

      return {
        pause: () => {
          paused = true;
          return () => {
            paused = false;
          };
        },
        finish: () => {
          setFrameIndex(lastIndex);
          clearInterval(interval);
          finished();
        },
        stop: () => {
          index = undefined;
          clearInterval(interval);
          interval = undefined;
          paused = false;
        },
      };
    },
  };
  const playbackController = createPlaybackController(frameContent, {
    playbackPreventedSignal: visualContentPlaybackIsPreventedSignal,
  });
  exposePlaybackControllerProps(playbackController, frameAnimation);
  if (autoplay) {
    frameAnimation.play();
  }
  return frameAnimation;
};
