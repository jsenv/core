import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { createEventMarker } from "./event_marker.js";
import { getFocusGroup } from "./focus_group_registry.js";

const DEBUG = false;

const arrowFocusNavEventMarker = createEventMarker("arrow_focus_nav");
export const performArrowNavigation = (
  event,
  element,
  { direction = "both", loop, name } = {},
) => {
  if (arrowFocusNavEventMarker.isMarked(event)) {
    // Prevent double handling of the same event
    return false;
  }

  const activeElement = document.activeElement;
  const isForward = isForwardArrow(event, direction);
  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Arrow navigation: ${isForward ? "forward" : "backward"} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    arrowFocusNavEventMarker.mark(event);
    targetToFocus.focus();
  };

  // Arrow Left/Up: move to previous focusable element in group
  backward: {
    if (!isBackwardArrow(event, direction)) {
      break backward;
    }
    const previousElement = findBefore(activeElement, elementIsFocusable, {
      root: element,
    });
    if (previousElement) {
      return onTargetToFocus(previousElement);
    }
    if (delegateArrowNavigation(event, element, { direction, loop, name })) {
      return true;
    }
    if (loop) {
      const lastFocusableElement = findLastDescendant(
        element,
        elementIsFocusable,
      );
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
    }
    return false;
  }

  // Arrow Right/Down: move to next focusable element in group
  forward: {
    if (!isForward) {
      break forward;
    }
    const nextElement = findAfter(activeElement, elementIsFocusable, {
      root: element,
    });
    if (nextElement) {
      return onTargetToFocus(nextElement);
    }

    if (delegateArrowNavigation(event, element, { direction, loop, name })) {
      return true;
    }
    if (loop) {
      // No next element, wrap to first focusable in group
      const firstFocusableElement = findDescendant(element, elementIsFocusable);
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
    }
    return false;
  }

  return false;
};
// Find parent focus group with the same name and try delegation
const delegateArrowNavigation = (event, currentElement, { name }) => {
  let ancestorElement = currentElement.parentElement;
  while (ancestorElement) {
    const ancestorFocusGroup = getFocusGroup(ancestorElement);
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
      const handled = performArrowNavigation(event, ancestorElement, {
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
