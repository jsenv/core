import { requestAction } from "@jsenv/validation";
import { createContext } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "preact/hooks";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { useActionEvents } from "./use_action_events.js";

import.meta.css = /* css */ `
  .navi_shortcut_container {
    /* Visually hidden container - doesn't affect layout */
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not interactable */
    opacity: 0;
    pointer-events: none;
  }

  .navi_shortcut_button {
    /* Visually hidden but accessible to screen readers */
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not focusable via tab navigation */
    opacity: 0;
    pointer-events: none;
  }
`;

const ShortcutContext = createContext();
export const useShortcutContext = () => {
  return useContext(ShortcutContext);
};

export const ShortcutProvider = ({
  elementRef,
  shortcuts,
  onActionPrevented,
  onActionStart,
  onActionAbort,
  onActionError,
  onActionEnd,
  allowConcurrentActions,
  children,
}) => {
  if (!elementRef) {
    throw new Error(
      "ShortcutProvider requires an elementRef to attach shortcuts to.",
    );
  }

  const shortcutElements = [];
  shortcuts.forEach((shortcut) => {
    const combinationString = useAriaKeyShortcuts(shortcut.keyCombinations);
    shortcutElements.push(
      <button
        className="navi_shortcut_button"
        key={combinationString}
        aria-keyshortcuts={combinationString}
        aria-hidden="true"
        tabIndex="-1"
        disabled
        action={shortcut.action}
        data-action={shortcut.action.name}
        data-confirm-message={shortcut.confirmMessage}
      >
        {shortcut.description}
      </button>,
    );
  });
  const shortcutElementRef = useRef();
  const shortcutHiddenElement = (
    <div ref={shortcutElementRef} className="navi_shortcut_container">
      {shortcutElements}
    </div>
  );

  const executeAction = useExecuteAction(elementRef);
  const [shortcutActionIsBusy, setShortcutActionIsBusy] = useState(false);
  useActionEvents(shortcutElementRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      setAction(() => actionEvent.detail.action);
      executeAction(actionEvent);
    },
    onStart: (e) => {
      if (!allowConcurrentActions) {
        setShortcutActionIsBusy(true);
      }
      onActionStart?.(e);
    },
    onAbort: (e) => {
      setShortcutActionIsBusy(false);
      onActionAbort?.(e);
    },
    onError: (e) => {
      setShortcutActionIsBusy(false);
      onActionError?.(e);
    },
    onEnd: (e) => {
      setShortcutActionIsBusy(false);
      onActionEnd?.(e);
    },
  });

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const [action, setAction] = useState(null);
  for (const shortcut of shortcuts) {
    shortcut.action = useAction(shortcut.action);
  }

  const onKeyDownForShortcuts = useCallback(
    (event) => {
      if (shortcutActionIsBusy) {
        return;
      }
      let shortcutFound;
      for (const shortcutCandidate of shortcutsRef.current) {
        const { enabled = true, keyCombinations } = shortcutCandidate;
        if (!enabled) {
          continue;
        }
        const someMatch = keyCombinations.some((keyCombination) => {
          // Handle platform-specific combination objects
          let actualCombination;
          let crossPlatformCombination;

          if (
            typeof keyCombination === "object" &&
            keyCombination !== null &&
            !Array.isArray(keyCombination)
          ) {
            actualCombination = isMac
              ? keyCombination.mac
              : keyCombination.other;
          } else {
            actualCombination = keyCombination;

            // Auto-generate cross-platform combination if needed
            if (containsPlatformSpecificKeys(keyCombination)) {
              crossPlatformCombination =
                generateCrossPlatformCombination(keyCombination);
            }
          }

          // Check both the actual combination and cross-platform combination
          const matchesActual =
            actualCombination &&
            eventIsMatchingKeyCombination(event, actualCombination);
          const matchesCrossPlatform =
            crossPlatformCombination &&
            crossPlatformCombination !== actualCombination &&
            eventIsMatchingKeyCombination(event, crossPlatformCombination);

          return matchesActual || matchesCrossPlatform;
        });
        if (!someMatch) {
          continue;
        }
        shortcutFound = shortcutCandidate;
        break;
      }
      if (!shortcutFound) {
        return;
      }
      event.preventDefault();
      const { action } = shortcutFound;
      requestAction(action, {
        event,
        target: shortcutElementRef.current,
        requester: elementRef.current,
        confirmMessage: shortcutFound.confirmMessage,
      });
    },
    [shortcutActionIsBusy],
  );

  useEffect(() => {
    const element = elementRef.current;
    element.addEventListener("keydown", onKeyDownForShortcuts);
    return () => {
      element.removeEventListener("keydown", onKeyDownForShortcuts);
    };
  }, [onKeyDownForShortcuts]);

  return (
    <ShortcutContext.Provider
      value={{
        shortcutAction: action,
        shortcutActionIsBusy,
      }}
    >
      {children}
      {shortcutHiddenElement}
    </ShortcutContext.Provider>
  );
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

const eventIsMatchingKeyCombination = (event, keyCombination) => {
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

    // If it's not a modifier, check if it matches the actual key
    if (!modifierFound) {
      if (!isSameKey(event.key, key)) {
        return false;
      }
    }
  }
  return true;
};

const isSameKey = (browserEventKey, key) => {
  browserEventKey = browserEventKey.toLowerCase();
  key = key.toLowerCase();

  if (browserEventKey === key) {
    return true;
  }

  // Check key synonyms
  for (const synonymGroup of keySynonyms) {
    if (synonymGroup.includes(browserEventKey) && synonymGroup.includes(key)) {
      return true;
    }
  }

  return false;
};

const detectMac = () => {
  // Modern way using User-Agent Client Hints API
  if (window.navigator.userAgentData) {
    return window.navigator.userAgentData.platform === "macOS";
  }
  // Fallback to userAgent string parsing
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
};
const isMac = detectMac();

const keySynonyms = [
  ["space", " "],
  ["escape", "esc"],
  ["arrowup", "up"],
  ["arrowdown", "down"],
  ["arrowleft", "left"],
  ["arrowright", "right"],
  ["home", "start"],
  ["end", "finish"],
  // Platform-specific synonyms for event matching
  ...(isMac ? [["delete", "backspace"]] : [["backspace", "delete"]]),
];

// Mapping from shortcut key names to ARIA keyshortcuts attribute values
const keyToAriaKeyMapping = {
  // Modifier keys - platform-specific ARIA names
  "command": "meta",
  "cmd": "meta",
  "option": "altgraph", // Mac option key uses "altgraph" in ARIA spec
  "control": "control",
  "ctrl": "control",
  "shift": "shift",
  "alt": "alt",
  "meta": "meta",

  // Regular keys - platform-specific normalization
  "delete": isMac ? "backspace" : "delete", // Mac delete key is backspace semantically
  "backspace": isMac ? "backspace" : "delete",

  // Arrow keys
  "arrowup": "arrowup",
  "up": "arrowup",
  "arrowdown": "arrowdown",
  "down": "arrowdown",
  "arrowleft": "arrowleft",
  "left": "arrowleft",
  "arrowright": "arrowright",
  "right": "arrowright",

  // Other keys
  "space": "space",
  " ": "space",
  "escape": "escape",
  "esc": "escape",
  "home": "home",
  "start": "home",
  "end": "end",
  "finish": "end",
};

const normalizeKeyCombination = (combination) => {
  const lowerCaseCombination = combination.toLowerCase();
  const keys = lowerCaseCombination.split("+");

  // Normalize keys using the ARIA mapping
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];

    // Use the keyToAriaKeyMapping for consistent normalization
    if (keyToAriaKeyMapping[key]) {
      key = keyToAriaKeyMapping[key];
    }

    keys[i] = key;
  }

  return keys.join("+");
};

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
const useAriaKeyShortcuts = (combinations) => {
  const combinationSet = new Set();

  for (const combination of combinations) {
    let actualCombination;

    // Handle platform-specific combination objects
    if (
      typeof combination === "object" &&
      combination !== null &&
      !Array.isArray(combination)
    ) {
      actualCombination = isMac ? combination.mac : combination.other;
    } else {
      actualCombination = combination;

      // Auto-generate cross-platform combination if needed
      if (containsPlatformSpecificKeys(combination)) {
        const crossPlatformCombination =
          generateCrossPlatformCombination(combination);
        if (
          crossPlatformCombination &&
          crossPlatformCombination !== combination
        ) {
          const normalizedCrossPlatform = normalizeKeyCombination(
            crossPlatformCombination,
          );
          combinationSet.add(normalizedCrossPlatform);
        }
      }
    }

    if (actualCombination) {
      const normalizedCombination = normalizeKeyCombination(actualCombination);
      combinationSet.add(normalizedCombination);
    }
  }

  let combinationString = "";
  for (const combination of combinationSet) {
    if (combinationString) {
      combinationString += " ";
    }
    combinationString += combination;
  }
  return combinationString;
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
