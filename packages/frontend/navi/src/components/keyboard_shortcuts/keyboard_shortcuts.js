import { activeElementSignal, canInterceptKeys } from "@jsenv/dom";
import { requestAction } from "@jsenv/validation";
import { effect, signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { keyMapping } from "./keyboard_key_meta.js";
import { isMac } from "./os.js";

export const activeShortcutsSignal = signal([]);
const shortcutsMap = new Map();
effect(() => {
  // eslint-disable-next-line no-unused-expressions
  activeElementSignal.value;
  updateActiveShortcuts();
});
const updateActiveShortcuts = () => {
  const activeElement = activeElementSignal.peek();
  // const currentActiveShortcuts = activeShortcutsSignal.peek();
  const activeShortcuts = [];
  for (const [element, { shortcuts }] of shortcutsMap) {
    if (activeElement === element || element.contains(activeElement)) {
      activeShortcuts.push(...shortcuts);
    }
  }
  activeShortcutsSignal.value = activeShortcuts;
};
const addShortcuts = (element, shortcuts) => {
  shortcutsMap.set(element, { shortcuts });
  updateActiveShortcuts();
};
const removeShortcuts = (element) => {
  shortcutsMap.delete(element);
  updateActiveShortcuts();
};

export const useKeyboardShortcuts = (
  elementRef,
  shortcuts,
  {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    allowConcurrentActions,
  } = {},
) => {
  if (!elementRef) {
    throw new Error(
      "useKeyboardShortcuts requires an elementRef to attach shortcuts to.",
    );
  }

  const executeAction = useExecuteAction(elementRef);
  const shortcutActionIsBusyRef = useRef(false);
  useActionEvents(elementRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      // setAction(() => actionEvent.detail.action);
      executeAction(actionEvent, { requester: document.activeElement });
    },
    onStart: (e) => {
      if (!allowConcurrentActions) {
        shortcutActionIsBusyRef.current = true;
      }
      onActionStart?.(e);
    },
    onAbort: (e) => {
      shortcutActionIsBusyRef.current = false;

      onActionAbort?.(e);
    },
    onError: (e) => {
      shortcutActionIsBusyRef.current = false;

      onActionError?.(e);
    },
    onEnd: (e) => {
      shortcutActionIsBusyRef.current = false;
      onActionEnd?.(e);
    },
  });

  const shortcutDeps = [];
  for (const shortcut of shortcuts) {
    shortcutDeps.push(
      shortcut.key,
      shortcut.description,
      shortcut.enabled,
      shortcut.confirmMessage,
    );
    shortcut.action = useAction(shortcut.action);
  }

  useEffect(() => {
    const element = elementRef.current;
    const shortcutsCopy = [];
    for (const shortcutCandidate of shortcuts) {
      shortcutsCopy.push({
        ...shortcutCandidate,
        handler: (keyboardEvent) => {
          if (shortcutCandidate.handler) {
            return shortcutCandidate.handler(keyboardEvent);
          }
          if (shortcutActionIsBusyRef.current) {
            return false;
          }
          const { action } = shortcutCandidate;
          return requestAction(action, {
            event: keyboardEvent,
            target: element,
            requester: document.activeElement,
            confirmMessage: shortcutCandidate.confirmMessage,
          });
        },
      });
    }

    addShortcuts(element, shortcuts);

    const onKeydown = (event) => {
      applyKeyboardShortcuts(shortcutsCopy, event);
    };
    element.addEventListener("keydown", onKeydown);
    return () => {
      element.removeEventListener("keydown", onKeydown);
      removeShortcuts(element);
    };
  }, [shortcutDeps]);
};

const applyKeyboardShortcuts = (shortcuts, keyboardEvent) => {
  if (!canInterceptKeys(keyboardEvent)) {
    return null;
  }
  for (const shortcutCandidate of shortcuts) {
    let { enabled = true, key } = shortcutCandidate;
    if (!enabled) {
      continue;
    }

    if (typeof key === "function") {
      const keyReturnValue = key(keyboardEvent);
      if (!keyReturnValue) {
        continue;
      }
      key = keyReturnValue;
    }
    if (!key) {
      console.error(shortcutCandidate);
      throw new TypeError(`key is required in keyboard shortcut, got ${key}`);
    }

    // Handle platform-specific combination objects
    let actualCombination;
    let crossPlatformCombination;
    if (typeof key === "object" && key !== null) {
      actualCombination = isMac ? key.mac : key.other;
    } else {
      actualCombination = key;
      if (containsPlatformSpecificKeys(key)) {
        crossPlatformCombination = generateCrossPlatformCombination(key);
      }
    }

    // Check both the actual combination and cross-platform combination
    const matchesActual =
      actualCombination &&
      keyboardEventIsMatchingKeyCombination(keyboardEvent, actualCombination);
    const matchesCrossPlatform =
      crossPlatformCombination &&
      crossPlatformCombination !== actualCombination &&
      keyboardEventIsMatchingKeyCombination(
        keyboardEvent,
        crossPlatformCombination,
      );

    if (!matchesActual && !matchesCrossPlatform) {
      continue;
    }
    if (typeof enabled === "function" && !enabled(keyboardEvent)) {
      continue;
    }
    const returnValue = shortcutCandidate.handler(keyboardEvent);
    if (returnValue) {
      keyboardEvent.preventDefault();
    }
    return shortcutCandidate;
  }
  return null;
};
const containsPlatformSpecificKeys = (combination) => {
  const lowerCombination = combination.toLowerCase();
  const macSpecificKeys = ["command", "cmd"];

  return macSpecificKeys.some((key) => lowerCombination.includes(key));
};
const generateCrossPlatformCombination = (combination) => {
  let crossPlatform = combination;

  if (isMac) {
    // No need to convert anything TO Windows/Linux-specific format since we're on Mac
    return null;
  }
  // If not on Mac but combination contains Mac-specific keys, generate Windows equivalent
  crossPlatform = crossPlatform.replace(/\bcommand\b/gi, "control");
  crossPlatform = crossPlatform.replace(/\bcmd\b/gi, "control");

  return crossPlatform;
};

export const keyboardEventIsMatchingKeyCombination = (
  event,
  keyCombination,
) => {
  const keys = keyCombination.toLowerCase().split("+");

  for (const key of keys) {
    let modifierFound = false;

    // Check if this key is a modifier
    for (const [eventProperty, config] of Object.entries(modifierKeyMapping)) {
      const allNames = [...config.names];

      // Add Mac-specific names only if we're on Mac and they exist
      if (isMac && config.macNames) {
        allNames.push(...config.macNames);
      }

      if (allNames.includes(key)) {
        // Check if the corresponding event property is pressed
        if (!event[eventProperty]) {
          return false;
        }
        modifierFound = true;
        break;
      }
    }
    if (modifierFound) {
      continue;
    }

    // If it's not a modifier, check if it matches the actual key
    if (!isSameKey(event.key, key)) {
      return false;
    }
  }
  return true;
};
// Configuration for mapping shortcut key names to browser event properties
const modifierKeyMapping = {
  metaKey: {
    names: ["meta"],
    macNames: ["command", "cmd"],
  },
  ctrlKey: {
    names: ["control", "ctrl"],
  },
  shiftKey: {
    names: ["shift"],
  },
  altKey: {
    names: ["alt"],
    macNames: ["option"],
  },
};
const isSameKey = (browserEventKey, key) => {
  browserEventKey = browserEventKey.toLowerCase();
  key = key.toLowerCase();

  if (browserEventKey === key) {
    return true;
  }

  // Check if either key is an alias for the other
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(browserEventKey) && allKeys.includes(key)) {
      return true;
    }
  }

  return false;
};
