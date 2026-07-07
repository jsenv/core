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
    // When reaching the edge of rootElement would normally wrap back
    // around inside it, escapeRoot changes that: Tab instead continues
    // past escapeRoot's *entire* subtree (not just rootElement's), landing
    // on the next/previous focusable element in the document beyond it.
    // Used by focus_trap.js when boundaryElement is a real container
    // (not document) — a trapped element nested inside a bigger container
    // (e.g. a local-layer Dialog) shouldn't just wrap on itself; Tab should
    // exit the whole container, skipping over any other focusable
    // siblings inside it (they're not part of what's actually trapped).
    escapeRoot = null,
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
  //
  // Smart mode (navi-focus-group="[role=radio]"):
  //   - activeElement directly matches the selector (IS a radio):
  //     Tab skips ALL elements in the group → exits to next focusable outside.
  //   - activeElement is inside a managed element but doesn't match (e.g. an
  //     input inside a custom radio widget): Tab navigates freely within the
  //     group, only skipping elements that directly match the managed selector.
  //
  // Strict mode (navi-focus-group with no value, or navi-focus-group-strict):
  //   Tab always exits the group regardless of where focus is inside it.
  const activeFocusGroup =
    activeElement.closest?.("[navi-focus-group]") || null;
  const activeFocusGroupManages = activeFocusGroup
    ? activeFocusGroup.getAttribute("navi-focus-group") || null
    : null;
  const activeFocusGroupIsStrict = activeFocusGroup
    ? !activeFocusGroupManages ||
      activeFocusGroup.hasAttribute("navi-focus-group-strict")
    : false;
  const activeElementIsManaged =
    activeFocusGroup && activeFocusGroupManages
      ? activeElement.matches(activeFocusGroupManages)
      : false;
  const isOwnedByActiveFocusGroup = (el) => {
    if (!activeFocusGroup || !activeFocusGroup.contains(el)) {
      return false;
    }
    if (activeFocusGroupIsStrict || activeElementIsManaged) {
      // Strict: skip everything inside the group so Tab exits.
      return true;
    }
    // Smart: only skip elements that are themselves managed items.
    return el.matches(activeFocusGroupManages);
  };

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
    if (escapeRoot) {
      // Skip escapeRoot's own children entirely — anything else still
      // inside it (a sibling of rootElement) isn't part of what's
      // trapped, so it must never become the next Tab stop either.
      const nextOutsideEscapeRoot = findAfter(escapeRoot, predicate, {
        skipChildren: true,
      });
      if (nextOutsideEscapeRoot) {
        return onTargetToFocus(nextOutsideEscapeRoot);
      }
      return false;
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
    if (escapeRoot) {
      // findBefore already searches strictly *before* escapeRoot's own
      // position (previous sibling / ancestor's previous sibling), never
      // descending into its children — exactly "outside its subtree".
      const previousOutsideEscapeRoot = findBefore(escapeRoot, predicate);
      if (previousOutsideEscapeRoot) {
        return onTargetToFocus(previousOutsideEscapeRoot);
      }
      return false;
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
