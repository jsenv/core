import {
  findAfter,
  findBefore,
  findFirstDescendant,
  findLastDescendant,
} from "../traversal.js";
import { elementIsFocusable } from "./element_is_focusable.js";

export const trapFocusInside = (element) => {
  if (element.nodeType === 3) {
    console.warn("cannot trap focus inside a text node");
    return () => {};
  }

  const trappedElement = activeTraps.find(
    (activeTrap) => activeTrap.element === element,
  );
  if (trappedElement) {
    console.warn("focus already trapped inside this element");
    return () => {};
  }

  const isEventOutside = (event) => {
    if (event.target === element) return false;
    if (element.contains(event.target)) return false;
    return true;
  };

  const getFirstTabbable = () =>
    findFirstDescendant(element, isDiscoverableWithKeyboard);

  const getLastTabbable = () =>
    findLastDescendant(element, isDiscoverableWithKeyboard);

  const getPreviousTabbableOrLast = () => {
    const previous = findBefore({
      from: document.activeElement,
      root: element,
      predicate: isDiscoverableWithKeyboard,
    });
    return previous || getLastTabbable();
  };

  const getNextTabbableOrFirst = () => {
    const next = findAfter({
      from: document.activeElement,
      root: element,
      predicate: isDiscoverableWithKeyboard,
    });
    return next || getFirstTabbable();
  };

  const performTabEventNavigation = (event) => {
    const activeElement = document.activeElement;
    const activeElementIsBody = activeElement === document.body;

    if (event.shiftKey) {
      const elementToFocus = activeElementIsBody
        ? getLastTabbable()
        : getPreviousTabbableOrLast(activeElement);
      if (elementToFocus) {
        elementToFocus.focus();
      }
    } else {
      const elementToFocus = activeElementIsBody
        ? getFirstTabbable()
        : getNextTabbableOrFirst(activeElement);
      if (elementToFocus) {
        elementToFocus.focus();
      }
    }
  };

  const lock = () => {
    const onmousedown = (event) => {
      if (isEventOutside(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onkeydown = (event) => {
      if (isTabEvent(event)) {
        event.preventDefault();
        performTabEventNavigation(event);
      }
    };

    document.addEventListener("mousedown", onmousedown, {
      capture: true,
      passive: false,
    });
    document.addEventListener("keydown", onkeydown, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("mousedown", onmousedown, {
        capture: true,
        passive: false,
      });
      document.removeEventListener("keydown", onkeydown, {
        capture: true,
        passive: false,
      });
    };
  };

  const deactivate = activate({ element, lock });

  const untrap = () => {
    deactivate();
  };

  return untrap;
};

const hasNegativeTabIndex = (element) => {
  return (
    element.hasAttribute &&
    element.hasAttribute("tabIndex") &&
    Number(element.getAttribute("tabindex")) < 0
  );
};

const isDiscoverableWithKeyboard = (element) => {
  if (hasNegativeTabIndex(element)) {
    return false;
  }
  return elementIsFocusable(element);
};

const isTabEvent = (event) => event.key === "Tab" || event.keyCode === 9;

const activeTraps = [];
const activate = ({ lock }) => {
  // unlock any trap currently activated
  let previousTrap;
  if (activeTraps.length > 0) {
    previousTrap = activeTraps[activeTraps.length - 1];
    previousTrap.unlock();
  }

  // store trap methods to lock/unlock as traps are acivated/deactivated
  const trap = { lock, unlock: lock() };
  activeTraps.push(trap);

  return () => {
    if (activeTraps.length === 0) {
      console.warn("cannot deactivate an already deactivated trap");
      return;
    }
    const lastTrap = activeTraps[activeTraps.length - 1];
    if (trap !== lastTrap) {
      // TODO: investigate this and maybe remove this requirment
      console.warn(
        "you must deactivate trap in the same order they were activated",
      );
      return;
    }
    activeTraps.pop();
    trap.unlock();
    // if any,reactivate the previous trap
    if (previousTrap) {
      previousTrap.unlock = previousTrap.lock();
    }
  };
};
