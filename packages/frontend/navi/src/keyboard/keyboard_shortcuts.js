import { activeElementSignal, canInterceptKeys } from "@jsenv/dom";
import { effect, signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

import { requestAction } from "../../validation/custom_constraint_validation.js";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../field/use_action_events.js";
import { keyMapping } from "./keyboard_key_meta.js";
import { isMac } from "./os.js";

export const activeShortcutsSignal = signal([]);
const shortcutsMap = new Map();

const areShortcutsEqual = (shortcutA, shortcutB) => {
  return (
    shortcutA.key === shortcutB.key &&
    shortcutA.description === shortcutB.description &&
    shortcutA.enabled === shortcutB.enabled
  );
};

const areShortcutArraysEqual = (arrayA, arrayB) => {
  if (arrayA.length !== arrayB.length) {
    return false;
  }

  for (let i = 0; i < arrayA.length; i++) {
    if (!areShortcutsEqual(arrayA[i], arrayB[i])) {
      return false;
    }
  }

  return true;
};

const updateActiveShortcuts = () => {
  const activeElement = activeElementSignal.peek();
  const currentActiveShortcuts = activeShortcutsSignal.peek();
  const activeShortcuts = [];
  for (const [element, { shortcuts }] of shortcutsMap) {
    if (element === activeElement || element.contains(activeElement)) {
      activeShortcuts.push(...shortcuts);
    }
  }

  // Only update if shortcuts have actually changed
  if (!areShortcutArraysEqual(currentActiveShortcuts, activeShortcuts)) {
    activeShortcutsSignal.value = activeShortcuts;
  }
};
effect(() => {
  // eslint-disable-next-line no-unused-expressions
  activeElementSignal.value;
  updateActiveShortcuts();
});
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
    actionOrigin: "keyboard_shortcut",
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const { shortcut } = actionEvent.detail.meta || {};
      if (!shortcut) {
        // not a shortcut (an other interaction triggered the action, don't request it again)
        return;
      }
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      // setAction(() => actionEvent.detail.action);
      executeAction(actionEvent, {
        requester: document.activeElement,
      });
    },
    onStart: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      if (!allowConcurrentActions) {
        shortcutActionIsBusyRef.current = true;
      }
      shortcut.onStart?.(e);
      onActionStart?.(e);
    },
    onAbort: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onAbort?.(e);
      onActionAbort?.(e);
    },
    onError: (error, e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onError?.(error, e);
      onActionError?.(error, e);
    },
    onEnd: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onEnd?.(e);
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
          return requestAction(element, action, {
            actionOrigin: "keyboard_shortcut",
            event: keyboardEvent,
            requester: document.activeElement,
            confirmMessage: shortcutCandidate.confirmMessage,
            meta: {
              shortcut: shortcutCandidate,
            },
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
const keyboardEventIsMatchingKeyCombination = (event, keyCombination) => {
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

    // Check if it's a range pattern like "a-z" or "0-9"
    if (key.includes("-") && key.length === 3) {
      const [startChar, dash, endChar] = key;
      if (dash === "-") {
        // Only check ranges for single alphanumeric characters
        const eventKey = event.key.toLowerCase();
        if (eventKey.length !== 1) {
          return false; // Not a single character key
        }

        // Only allow a-z and 0-9 ranges
        const isValidRange =
          (startChar >= "a" && endChar <= "z") ||
          (startChar >= "0" && endChar <= "9");

        if (!isValidRange) {
          return false; // Invalid range pattern
        }

        const eventKeyCode = eventKey.charCodeAt(0);
        const startCode = startChar.charCodeAt(0);
        const endCode = endChar.charCodeAt(0);

        if (eventKeyCode >= startCode && eventKeyCode <= endCode) {
          continue; // Range matched
        }
        return false; // Range not matched
      }
    }

    // If it's not a modifier or range, check if it matches the actual key
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
