import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { isDiscoverableWithKeyboard } from "./element_is_focusable.js";

export const performTabNavigation = (
  event,
  { rootElement = document.body, outsideOfElement = null } = {},
) => {
  const activeElement = document.activeElement;
  const activeElementIsBody = activeElement === document.body;
  const predicate = (candidate) => {
    if (!isDiscoverableWithKeyboard(candidate)) {
      return false;
    }
    if (outsideOfElement && outsideOfElement.contains(candidate)) {
      return false;
    }
    return true;
  };

  if (event.shiftKey) {
    const elementToFocus = activeElementIsBody
      ? getLastTabbable(rootElement, predicate)
      : getPreviousTabbableOrLast(activeElement, predicate);
    if (elementToFocus) {
      elementToFocus.focus();
    }
    return;
  }

  let elementToFocus;
  if (activeElementIsBody) {
    elementToFocus = findFirstDescendant(rootElement, predicate);
  } else {
    const nextTabbableOrFirst = findAfter({
      from: activeElement,
      root: rootElement,
      predicate,
    });
    elementToFocus =
      nextTabbableOrFirst || findFirstDescendant(activeElement, predicate);
  }
  if (elementToFocus) {
    elementToFocus.focus();
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const getLastTabbable = (element, predicate = isDiscoverableWithKeyboard) =>
  findLastDescendant(element, predicate);

const getPreviousTabbableOrLast = (
  element,
  predicate = isDiscoverableWithKeyboard,
) => {
  const previous = findBefore({
    from: document.activeElement,
    root: element,
    predicate,
  });
  return previous || getLastTabbable(element);
};
