import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { markFocusNav } from "./focus_nav_event_marker.js";

const DEBUG = true;

export const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  if (!isTabEvent(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.hasAttribute("data-no-focusnav")) {
    event.preventDefault(); // ensure tab cannot move focus
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = (targetToFocus) => {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from`,
      activeElement,
      "to",
      targetToFocus,
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };

  if (DEBUG) {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from,`,
      activeElement,
    );
  }

  const predicate = (candidate) => {
    const canBeFocusedByTab = isFocusableByTab(candidate);
    if (DEBUG) {
      console.debug(`Testing`, candidate, `${canBeFocusedByTab ? "✓" : "✗"}`);
    }
    return canBeFocusedByTab;
  };

  const activeElementIsRoot = activeElement === rootElement;
  forward: {
    if (!isForward) {
      break forward;
    }
    if (activeElementIsRoot) {
      const firstFocusableElement = findDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement,
      });
      if (firstFocusableElement) {
        return onTargetToFocus(firstFocusableElement);
      }
      return false;
    }
    const nextFocusableElement = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (nextFocusableElement) {
      return onTargetToFocus(nextFocusableElement);
    }
    const firstFocusableElement = findDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (firstFocusableElement) {
      return onTargetToFocus(firstFocusableElement);
    }
    return false;
  }

  backward: {
    if (activeElementIsRoot) {
      const lastFocusableElement = findLastDescendant(
        activeElement,
        predicate,
        {
          skipRoot: outsideOfElement,
        },
      );
      if (lastFocusableElement) {
        return onTargetToFocus(lastFocusableElement);
      }
      return false;
    }

    const previousFocusableElement = findBefore(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (previousFocusableElement) {
      return onTargetToFocus(previousFocusableElement);
    }
    const lastFocusableElement = findLastDescendant(activeElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const isFocusableByTab = (element) => {
  if (hasNegativeTabIndex(element)) {
    return false;
  }
  return elementIsFocusable(element);
};
const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};
