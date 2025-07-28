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
const tryDelegate = (event, currentElement, { name }) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = focusGroupRegistry.get(ancestorElement);
    if (!ancestorFocusGroup) {
      ancestorElement = ancestorElement.parentElement;
      continue;
    }

    // Check if groups should delegate to each other
    const shouldDelegate =
      name === undefined && ancestorFocusGroup.name === undefined
        ? true // Both unnamed - delegate based on ancestor relationship
        : ancestorFocusGroup.name === name; // Both have same explicit name

    if (shouldDelegate) {
      if (DEBUG) {
        console.debug(
          `Delegating navigation to parent focus group:`,
          ancestorElement,
          name === undefined ? "(unnamed group)" : `(name: ${name})`,
        );
      }
      // Try navigation in parent focus group
      const handled = performArrowKeyNavigation(event, ancestorElement, {
        direction: ancestorFocusGroup.direction,
        loop: ancestorFocusGroup.loop,
        name: ancestorFocusGroup.name,
      });
      if (handled) {
        return true;
      }
    }
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
    } else {
      // Try to delegate to parent focus group (works for named or unnamed groups)
      return tryDelegate(event, element, { direction, loop, name });
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
    } else {
      // Try to delegate to parent focus group (works for named or unnamed groups)
      return tryDelegate(event, element, { direction, loop, name });
    }
  }

  if (elementToFocus) {
    elementToFocus.focus();
    event.preventDefault();
    event.stopPropagation(); // Prevent parent focus groups from handling this event
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
    name, // Can be undefined for implicit ancestor-descendant grouping
  } = {},
) => {
  if (!elementIsFocusable(element)) {
    console.warn("initFocusGroup: element is not focusable", element);
  }

  // Store focus group data in registry
  focusGroupRegistry.set(element, {
    direction,
    loop,
    name, // Store undefined as-is for implicit grouping
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
