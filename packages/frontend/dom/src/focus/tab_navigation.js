import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { isDiscoverableWithKeyboard } from "./element_is_focusable.js";

export const performTabNavigation = (event, rootElement = document.body) => {
  const activeElement = document.activeElement;
  const activeElementIsBody = activeElement === document.body;

  if (event.shiftKey) {
    const elementToFocus = activeElementIsBody
      ? getLastTabbable(rootElement)
      : getPreviousTabbableOrLast(activeElement);
    if (elementToFocus) {
      elementToFocus.focus();
    }
    return;
  }

  const elementToFocus = activeElementIsBody
    ? getFirstTabbable(rootElement)
    : getNextTabbableOrFirst(activeElement);
  if (elementToFocus) {
    elementToFocus.focus();
  }
};

const getFirstTabbable = (element) =>
  findFirstDescendant(element, isDiscoverableWithKeyboard);

const getLastTabbable = (element) =>
  findLastDescendant(element, isDiscoverableWithKeyboard);

const getPreviousTabbableOrLast = (element) => {
  const previous = findBefore({
    from: document.activeElement,
    root: element,
    predicate: isDiscoverableWithKeyboard,
  });
  return previous || getLastTabbable(element);
};

const getNextTabbableOrFirst = (element) => {
  const next = findAfter({
    from: document.activeElement,
    root: element,
    predicate: isDiscoverableWithKeyboard,
  });
  return next || getFirstTabbable(element);
};
