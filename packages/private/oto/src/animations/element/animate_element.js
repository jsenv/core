import { EASING } from "../utils/easing.js";
import {
  createPlaybackController,
  exposePlaybackControllerProps,
} from "/playback/playback_controller.js";
import { visualContentPlaybackIsPreventedSignal } from "/playback/visual_content_playback.js";

export const animateElement = (
  element,
  {
    id,
    from,
    to,
    duration = 500,
    iterations = 1,
    fill = "forwards",
    commit,
    playbackRate = 1,
    easing,
    delay,
    autoplay = true,
    onstart,
    onpause,
    onremove,
    onfinish,
  },
) => {
  const elementAnimation = {
    onstart,
    onpause,
    onremove,
    onfinish,
  };
  const elementAnimationContent = {
    type: "element_animation",
    start: ({ finished }) => {
      const fromStep = stepFromAnimationDescription(from);
      const toStep = stepFromAnimationDescription(to);
      const steps = [];
      if (fromStep) {
        steps.push(fromStep);
      }
      if (toStep) {
        steps.push(toStep);
      }

      if (easing) {
        element.style.animationTimingFunction =
          createAnimationTimingFunction(easing);
      } else {
        element.style.animationTimingFunction = "";
      }
      let keyFrames = new KeyframeEffect(element, steps, {
        id,
        duration,
        delay,
        fill,
        iterations,
      });
      let webAnimation = new Animation(keyFrames, document.timeline);
      webAnimation.playbackRate = playbackRate;

      let stopObservingElementRemoved = onceElementRemoved(element, () => {
        playbackController.remove();
      });
      const computedStyle = getComputedStyle(element);
      const shouldDisplay = computedStyle.display === "none";
      if (shouldDisplay) {
        element.style.display = null;
      }
      webAnimation.onfinish = () => {
        if (toStep) {
          if (commit) {
            try {
              webAnimation.commitStyles();
            } catch (e) {
              console.error(
                `Error during "commitStyles" on animation "${id}"`,
                element.style.display,
              );
              console.error(e);
            }
          }
        }
        if (shouldDisplay) {
          element.style.display = "none";
        }
        finished();
      };
      webAnimation.play();
      return {
        pause: () => {
          webAnimation.pause();
          return () => {
            webAnimation.play();
          };
        },
        finish: () => {
          webAnimation.finish();
        },
        stop: () => {
          if (stopObservingElementRemoved) {
            stopObservingElementRemoved();
            stopObservingElementRemoved = undefined;
          }
        },
        remove: () => {
          webAnimation.cancel();
          keyFrames = undefined;
          webAnimation = undefined;
        },
      };
    },
  };
  const playbackController = createPlaybackController(elementAnimationContent, {
    playbackPreventedSignal: visualContentPlaybackIsPreventedSignal,
  });
  exposePlaybackControllerProps(playbackController, elementAnimation);
  if (autoplay) {
    elementAnimation.play();
  }
  return elementAnimation;
};

export const stepFromAnimationDescription = (animationDescription) => {
  if (!animationDescription) {
    return null;
  }
  const step = {};
  transform: {
    const transforms = [];
    let x = animationDescription.x;
    let y = animationDescription.y;
    let angleX = animationDescription.angleX;
    let angleY = animationDescription.angleY;
    let scaleX = animationDescription.scaleX;
    if (animationDescription.mirrorX) {
      angleY = typeof angleY === "number" ? angleY + 180 : 180;
    }
    if (typeof x === "number") {
      transforms.push(`translateX(${x}px)`);
    }
    if (typeof y === "number") {
      transforms.push(`translateY(${y}px)`);
    }
    if (typeof angleX === "number") {
      transforms.push(`rotateX(${angleX}deg)`);
    }
    if (typeof angleY === "number") {
      transforms.push(`rotateY(${angleY}deg)`);
    }
    if (typeof scaleX === "number") {
      transforms.push(`scaleX(${scaleX})`);
    }
    if (transforms.length) {
      step.transform = transforms.join(" ");
    }
  }
  opacity: {
    let opacity = animationDescription.opacity;
    if (opacity !== undefined) {
      step.opacity = opacity;
    }
  }
  if (Object.keys(step).length === 0) {
    return null;
  }
  return step;
};

const createAnimationTimingFunction = (easing, steps = 10) => {
  if (easing === EASING.linear) {
    return "linear";
  }
  if (easing === EASING.EASE) {
    return "ease";
  }
  let i = 0;
  const values = [];
  const stepRatio = 1 / steps;
  let progress = 0;
  while (i < steps) {
    i++;
    const value = easing(progress);
    values.push(value);
    progress += stepRatio;
  }
  return `linear(${values.join(", ")});`;
};
const onceElementRemoved = (element, callback) => {
  const observer = new MutationObserver(function (mutations) {
    let mutationForRemoval;
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      const { removedNodes } = mutation;
      if (removedNodes.length === 0) {
        continue;
      }
      for (const removedNode of removedNodes) {
        if (removedNode === element) {
          mutationForRemoval = mutation;
          break;
        }
      }
      if (mutationForRemoval) {
        break;
      }
    }
    if (mutationForRemoval) {
      observer.disconnect();
      callback();
    }
  });
  observer.observe(element.parentNode, { childList: true });
  return () => {
    observer.disconnect();
  };
};
