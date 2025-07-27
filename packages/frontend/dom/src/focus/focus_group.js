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
import { isDiscoverableWithKeyboard } from "./element_is_focusable.js";
import { isTabEvent, performTabNavigation } from "./tab_navigation.js";

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

const performArrowKeyNavigation = (event, element, direction = "both") => {
  if (!isArrowEvent(event, direction)) {
    return false;
  }

  const activeElement = document.activeElement;
  let elementToFocus;

  if (isBackwardArrow(event, direction)) {
    // Arrow Left/Up: move to previous focusable element in group
    const previousElement = findBefore(
      activeElement,
      isDiscoverableWithKeyboard,
      {
        root: element,
      },
    );

    if (previousElement) {
      elementToFocus = previousElement;
    } else {
      // No previous element, wrap to last focusable in group
      elementToFocus = findLastDescendant(element, isDiscoverableWithKeyboard);
    }
  } else if (isForwardArrow(event, direction)) {
    // Arrow Right/Down: move to next focusable element in group
    const nextElement = findAfter(activeElement, isDiscoverableWithKeyboard, {
      root: element,
    });

    if (nextElement) {
      elementToFocus = nextElement;
    } else {
      // No next element, wrap to first focusable in group
      elementToFocus = findFirstDescendant(element, isDiscoverableWithKeyboard);
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
  } = {},
) => {
  if (skipTab) {
    // Handle Tab navigation (exit group)
    element.addEventListener(
      "keydown",
      (event) => {
        if (isTabEvent(event)) {
          performTabNavigation(event, {
            outsideOfElement: element,
          });
          event.preventDefault();
        }
      },
      {
        capture: true,
        passive: false,
      },
    );

    // Handle Arrow key navigation (within group)
    element.addEventListener(
      "keydown",
      (event) => {
        performArrowKeyNavigation(event, element, direction);
      },
      {
        capture: true,
        passive: false,
      },
    );
  }
};
