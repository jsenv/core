/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990
 */

import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { performTabNavigation } from "./tab_navigation.js";

// WeakMap to store focus group metadata
const focusGroupRegistry = new WeakMap();

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
  if (event.defaultPrevented) {
    // If the keydown was prevented by another handler, do not interfere
    // Also arrow key withing nested focus group to be handled twice
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
    } else {
      if (DEBUG) {
        console.debug(
          `Arrow navigation: "backward" from`,
          activeElement,
          ": try to delegate to parent group or loop to last focusable`,",
        );
      }
      if (
        // Try to delegate to parent focus group (works for named or unnamed groups)
        tryDelegate(event, element, { direction, loop, name })
      ) {
      } else if (loop) {
        // No previous element, wrap to last focusable in group
        elementToFocus = findLastDescendant(element, elementIsFocusable);
      }
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
    } // Try to delegate to parent focus group (works for named or unnamed groups)
    else {
      if (DEBUG) {
        console.debug(
          `Arrow navigation: "forward" from`,
          activeElement,
          ": try to delegate to parent group or loop to first focusable",
        );
      }
      if (tryDelegate(event, element, { direction, loop, name })) {
      } else if (loop) {
        // No next element, wrap to first focusable in group
        elementToFocus = findDescendant(element, elementIsFocusable);
        if (DEBUG) {
          console.debug(
            `Arrow navigation: "forward" looping to`,
            elementToFocus,
          );
        }
      }
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
    name, // Can be undefined for implicit ancestor-descendant grouping
  } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };

  // Store focus group data in registry
  focusGroupRegistry.set(element, {
    direction,
    loop,
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(() => {
    focusGroupRegistry.delete(element);
  });

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      performTabNavigation(event, { outsideOfElement: element });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      capture: true,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: true,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  arrow_keys: {
    const handleArrowKeyDown = (event) => {
      performArrowKeyNavigation(event, element, { direction, loop, name });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      capture: true,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: true,
        passive: false,
      });
    });
  }

  return { cleanup };
};
