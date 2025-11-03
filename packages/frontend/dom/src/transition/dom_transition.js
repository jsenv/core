import {
  createStyleController,
  getHeight,
  getOpacity,
  getTranslateX,
  getWidth,
} from "../style/style_controller.js";
import { createTimelineTransition } from "./transition_playback.js";

const transitionStyleController = createStyleController("transition");

export const createHeightTransition = (element, to, options) => {
  const heightTransition = createTimelineTransition({
    ...options,
    constructor: createHeightTransition,
    key: element,
    to,
    isVisual: true,
    minDiff: 10,
    lifecycle: {
      setup: () => {
        return {
          from: getHeight(element),
          update: ({ value }) => {
            transitionStyleController.set(element, { height: value });
          },
          teardown: () => {
            transitionStyleController.delete(element, "height");
          },
          restore: () => {
            transitionStyleController.delete(element, "height");
          },
        };
      },
    },
  });
  return heightTransition;
};
export const createWidthTransition = (element, to, options) => {
  const widthTransition = createTimelineTransition({
    ...options,
    constructor: createWidthTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        return {
          from: getWidth(element),
          update: ({ value }) => {
            transitionStyleController.set(element, { width: value });
          },
          teardown: () => {
            transitionStyleController.delete(element, "width");
          },
          restore: () => {
            transitionStyleController.delete(element, "width");
          },
        };
      },
    },
  });
  return widthTransition;
};
export const createOpacityTransition = (element, to, options = {}) => {
  const opacityTransition = createTimelineTransition({
    ...options,
    constructor: createOpacityTransition,
    key: element,
    to,
    minDiff: 0.1,
    isVisual: true,
    lifecycle: {
      setup: () => {
        return {
          from: getOpacity(element),
          update: ({ value }) => {
            transitionStyleController.set(element, { opacity: value });
          },
          teardown: () => {
            transitionStyleController.delete(element, "opacity");
          },
          restore: () => {
            transitionStyleController.delete(element, "opacity");
          },
        };
      },
    },
  });
  return opacityTransition;
};

export const createTranslateXTransition = (element, to, options) => {
  const translateXTransition = createTimelineTransition({
    ...options,
    constructor: createTranslateXTransition,
    key: element,
    to,
    minDiff: 10,
    isVisual: true,
    lifecycle: {
      setup: () => {
        return {
          from: getTranslateX(element),
          update: ({ value }) => {
            transitionStyleController.set(element, {
              transform: {
                translateX: value,
              },
            });
          },
          teardown: () => {
            transitionStyleController.delete(element, "transform.translateX");
          },
          restore: () => {
            transitionStyleController.delete(element, "transform.translateX");
          },
        };
      },
    },
  });
  return translateXTransition;
};

// Helper functions for getting natural values
export const getOpacityWithoutTransition = (element) =>
  getOpacity(element, transitionStyleController);
export const getTranslateXWithoutTransition = (element) =>
  getTranslateX(element, transitionStyleController);
export const getWidthWithoutTransition = (element) =>
  getWidth(element, transitionStyleController);
export const getHeightWithoutTransition = (element) =>
  getHeight(element, transitionStyleController);
