import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { isDiscoverableWithKeyboard } from "./element_is_focusable.js";

const DEBUG = true;

const getElementDebugInfo = (element) => {
  return element;
};

export const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  const activeElement = document.activeElement;
  const isForward = !event.shiftKey;

  if (DEBUG) {
    console.debug(
      `Tab navigation: ${isForward ? "forward" : "backward"} from ${getElementDebugInfo(activeElement)}`,
    );
  }

  const predicate = (candidate) => {
    const isDiscoverable = isDiscoverableWithKeyboard(candidate);
    if (DEBUG) {
      console.debug(
        `Testing ${getElementDebugInfo(candidate)}: ${isDiscoverable ? "✓" : "✗"}`,
      );
    }
    return isDiscoverable;
  };

  let elementToFocus;

  if (activeElement === rootElement) {
    // Starting from root element
    if (DEBUG) {
      console.debug("Starting from root element");
    }
    elementToFocus = isForward
      ? findFirstDescendant(rootElement, predicate, {
          skipRoot: outsideOfElement,
        })
      : findLastDescendant(rootElement, predicate, {
          skipRoot: outsideOfElement,
        });
  } else {
    // Starting from a specific element
    const searchFunction = isForward ? findAfter : findBefore;
    const fallbackFunction = isForward
      ? findFirstDescendant
      : findLastDescendant;

    if (DEBUG) {
      console.debug(
        `Searching ${isForward ? "after" : "before"} current element`,
      );
    }

    const nextElement = searchFunction(activeElement, predicate, {
      root: rootElement,
      skipRoot: outsideOfElement,
    });

    if (nextElement) {
      elementToFocus = nextElement;
    } else {
      if (DEBUG) {
        console.debug(
          `No ${isForward ? "next" : "previous"} element found, wrapping to ${isForward ? "first" : "last"}`,
        );
      }
      elementToFocus = fallbackFunction(rootElement, predicate, {
        skipRoot: outsideOfElement,
      });
    }
  }

  if (elementToFocus) {
    if (DEBUG) {
      console.debug(`Focusing: ${getElementDebugInfo(elementToFocus)}`);
    }
    elementToFocus.focus();
  } else if (DEBUG) {
    console.debug("No focusable element found");
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;
