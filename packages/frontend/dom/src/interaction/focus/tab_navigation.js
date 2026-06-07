import { getElementSignature } from "../../element_signature.js";
import {
  findAfter,
  findBefore,
  findDescendant,
  findLastDescendant,
} from "../../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";
import { markFocusNav } from "./focus_nav_event_marker.js";

export const performTabNavigation = (
  event,
  {
    rootElement = document.body,
    outsideOfElement = null,
    debug = () => {},
    excludeAriaHidden,
  } = {},
) => {
  if (!isTabEvent(event)) {
    return false;
  }
  const activeElement = document.activeElement;
  if (activeElement.getAttribute("data-focusnav") === "none") {
    event.preventDefault(); // ensure tab cannot move focus
    return true;
  }
  const isForward = !event.shiftKey;
  const onTargetToFocus = (targetToFocus) => {
    debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from`,
      getElementSignature(activeElement),
      "to",
      getElementSignature(targetToFocus),
    );
    event.preventDefault();
    markFocusNav(event);
    targetToFocus.focus();
  };
  const isFocusableByTab = (element) => {
    if (hasNegativeTabIndex(element)) {
      return false;
    }
    return elementIsFocusable(element, { excludeAriaHidden });
  };

  // A focus group "owns" the activeElement when activeElement is inside it.
  // From the inside, Tab should exit the group (skip its remaining children).
  // From the outside, Tab should enter the group normally (first focusable child).
  const activeFocusGroup =
    activeElement.closest?.("[navi-focus-group]") || null;
  const isOwnedByActiveFocusGroup = (el) =>
    activeFocusGroup && activeFocusGroup.contains(el);

  const predicate = (candidate, skip) => {
    if (!isFocusableByTab(candidate)) {
      return false;
    }
    // Focus group roots are composite widgets.
    if (candidate.hasAttribute("navi-focus-group")) {
      if (isFocusableByTab(candidate)) {
        // Root has tabindex="0": it is the single Tab stop for the group.
        // Skip its children — arrow keys handle internal navigation.
        skip?.();
        return true;
      }
      // Root is not focusable by Tab: descend into children to allow Tab entry.
      return false;
    }
    // If candidate is inside the focus group that currently owns focus, skip
    // it — Tab should exit the group. (Going *into* a different focus group
    // is allowed: only one focus group at a time has the activeElement.)
    if (isOwnedByActiveFocusGroup(candidate)) {
      return false;
    }
    return true;
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
    // Wrap around: go back to the first focusable element in root.
    const firstFocusableElement = findDescendant(rootElement, predicate, {
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
    // Wrap around: go back to the last focusable element in root.
    const lastFocusableElement = findLastDescendant(rootElement, predicate, {
      skipRoot: outsideOfElement,
    });
    if (lastFocusableElement) {
      return onTargetToFocus(lastFocusableElement);
    }
    return false;
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};
