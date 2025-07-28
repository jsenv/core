/**
 * 
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://github.com/openui/open-ui/issues/990
 */

import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { isTabEvent, performTabNavigation } from "./tab_navigation.js";

// WeakMap to store focus group metadata
const focusGroupRegistry = new WeakMap();

const isArrowEvent = (event, direction = "both") => {
  const arrowKeys = {
    both: ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"],
    vertical: ["ArrowUp", "ArrowDown"],
    horizontal: ["ArrowLeft", "ArrowRight"],
  };
  return arrowKeys[direction]?.includes(event.key) ?? false;
};

const isBackwardArrow = (event, direction = "both") => {
  const backwardKeys = {
    both: ["ArrowLeft", "ArrowUp"],
    vertical: ["ArrowUp"],
    horizontal: ["ArrowLeft"],
  };
  return backwardKeys[direction]?.includes(event.key) ?? false;
};

const isForwardArrow = (event, direction = "both") => {
  const forwardKeys = {
    both: ["ArrowRight", "ArrowDown"],
    vertical: ["ArrowDown"],
    horizontal: ["ArrowRight"],
  };
  return forwardKeys[direction]?.includes(event.key) ?? false;
};

const DEBUG = true;

// Find parent focus group with the same name and try delegation
const tryDelegateToParent = (
  event,
  currentElement,
  { direction, loop, name },
) => {
  let parentElement = currentElement.parentElement;

  while (parentElement) {
    const parentGroupData = focusGroupRegistry.get(parentElement);

    if (parentGroupData && parentGroupData.name === name) {
      if (DEBUG) {
        console.debug(
          `Delegating navigation to parent focus group:`,
          parentElement,
        );
      }

      // Try navigation in parent focus group
      const handled = performArrowKeyNavigation(event, parentElement, {
        direction: parentGroupData.direction,
        loop: parentGroupData.loop,
        name: parentGroupData.name,
      });

      if (handled) {
        return true;
      }
    }

    parentElement = parentElement.parentElement;
  }

  return false;
};

const performArrowKeyNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (!isArrowEvent(event, direction)) {
    return false;
  }

  const activeElement = document.activeElement;
  let elementToFocus;

  if (isBackwardArrow(event, direction)) {
    // Arrow Left/Up: move to previous focusable element in group
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element,
    });

    if (previousElement) {
      elementToFocus = previousElement;
    } else if (loop) {
      // No previous element, wrap to last focusable in group
      elementToFocus = findLastDescendant(element, elementIsFocusable);
    } else if (name) {
      // Try to delegate to parent focus group with same name
      return tryDelegateToParent(event, element, { direction, loop, name });
    }
  } else if (isForwardArrow(event, direction)) {
    // Arrow Right/Down: move to next focusable element in group
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element,
    });

    if (nextElement) {
      elementToFocus = nextElement;
      if (DEBUG) {
        console.debug(
          `Arrow navigation: "forward" from`,
          activeElement,
          "to",
          nextElement,
        );
      }
    } else if (loop) {
      // No next element, wrap to first focusable in group
      elementToFocus = findFirstDescendant(element, elementIsFocusable);
      if (DEBUG) {
        console.debug(`Arrow navigation: "forward" looping to`, elementToFocus);
      }
    } else if (name) {
      // Try to delegate to parent focus group with same name
      return tryDelegateToParent(event, element, { direction, loop, name });
    }
  }

  if (elementToFocus) {
    elementToFocus.focus();
    event.preventDefault();
    return true;
  }

  return false;
};

export const initFocusGroup = (
  element,
  {
    direction = "both",
    // extend = true,
    skipTab = true,
    loop = false,
    name = "default",
  } = {},
) => {
  if (!elementIsFocusable(element)) {
    console.warn("initFocusGroup: element is not focusable", element);
  }

  // Store focus group data in registry
  focusGroupRegistry.set(element, {
    direction,
    loop,
    name,
  });

  if (skipTab) {
    // Handle Tab navigation (exit group)
    element.addEventListener(
      "keydown",
      (event) => {
        if (isTabEvent(event)) {
          performTabNavigation(event, {
            outsideOfElement: element,
          });
        }
      },
      {
        capture: true,
        passive: false,
      },
    );
  }

  // Handle Arrow key navigation (within group)
  element.addEventListener(
    "keydown",
    (event) => {
      performArrowKeyNavigation(event, element, { direction, loop, name });
    },
    {
      capture: true,
      passive: false,
    },
  );
};
