import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { isDiscoverableWithKeyboard } from "./element_is_focusable.js";

const DEBUG = true;

export const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  const activeElement = document.activeElement;

  if (DEBUG) {
    console.debug("performTabNavigation:", {
      activeElement,
      shiftKey: event.shiftKey,
      rootElement,
      outsideOfElement,
    });
  }

  const predicate = (candidate) => {
    const isDiscoverable = isDiscoverableWithKeyboard(candidate);
    if (DEBUG) {
      console.debug("Testing element:", {
        element: candidate,
        isDiscoverable,
      });
    }
    return isDiscoverable;
  };

  if (event.shiftKey) {
    let elementToFocus;
    if (DEBUG) console.debug("Shift+Tab navigation");
    if (activeElement === rootElement) {
      elementToFocus = findLastDescendant(activeElement, predicate, {
        skipRoot: outsideOfElement,
      });
    } else {
      const prevTabbable = findBefore(activeElement, predicate, {
        root: rootElement,
        skipRoot: outsideOfElement,
      });
      if (prevTabbable) {
        elementToFocus = prevTabbable;
      } else {
        if (DEBUG)
          console.debug("No previous tabbable found, wrapping to last");
        elementToFocus = findLastDescendant(activeElement, predicate, {
          skipRoot: outsideOfElement,
        });
      }
    }
    if (elementToFocus) {
      if (DEBUG) console.debug("Focusing element (shift):", elementToFocus);
      elementToFocus.focus();
    }
    return;
  }

  if (DEBUG) console.debug("Forward Tab navigation");
  let elementToFocus;
  if (activeElement === rootElement) {
    if (DEBUG)
      console.debug("Active element is root, finding first descendant");
    elementToFocus = findFirstDescendant(rootElement, predicate, {
      skipRoot: outsideOfElement,
    });
  } else {
    if (DEBUG) console.debug("Finding next tabbable after current element");
    const nextTabbable = findAfter(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });
    if (nextTabbable) {
      elementToFocus = nextTabbable;
    } else {
      if (DEBUG) console.debug("No next tabbable found, wrapping to first");
      const firstTabbable = findFirstDescendant(rootElement, predicate, {
        skipRoot: outsideOfElement,
      });
      elementToFocus = firstTabbable;
    }
  }
  if (elementToFocus) {
    if (DEBUG) console.debug("Focusing element:", elementToFocus);
    elementToFocus.focus();
  } else if (DEBUG) {
    console.debug("No element to focus found");
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;
