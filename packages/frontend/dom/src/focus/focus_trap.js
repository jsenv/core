import { performTabNavigation } from "./tab_navigation.js";

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

  const lock = () => {
    const onmousedown = (event) => {
      if (isEventOutside(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onkeydown = (event) => {
      if (isTabEvent(event)) {
        performTabNavigation(event, { rootElement: element });
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

  const deactivate = activate({
    // element
    lock,
  });

  const untrap = () => {
    deactivate();
  };

  return untrap;
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
