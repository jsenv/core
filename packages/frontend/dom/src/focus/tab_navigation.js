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

  const elementToFocus = activeElementIsBody
    ? getFirstTabbable(rootElement, predicate)
    : getNextTabbableOrFirst(activeElement, predicate);
  if (elementToFocus) {
    elementToFocus.focus();
  }
};

export const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const getFirstTabbable = (element, predicate = isDiscoverableWithKeyboard) =>
  findFirstDescendant(element, predicate);

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

const getNextTabbableOrFirst = (
  element,
  predicate = isDiscoverableWithKeyboard,
) => {
  const next = findAfter({
    from: document.activeElement,
    root: element,
    predicate,
  });
  return next || getFirstTabbable(element);
};
