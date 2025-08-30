import { canInterceptKeys } from "@jsenv/dom";
import { requestAction } from "@jsenv/validation";
import { createContext } from "preact";
import { useContext, useEffect, useRef, useState } from "preact/hooks";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { generateAriaKeyShortcuts } from "./aria_key_shortcuts.js";
import { keyboardEventIsMatchingKeyCombination } from "./keyboard_shortcuts.js";
import { isMac } from "./os.js";

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
    const combinationString = generateAriaKeyShortcuts(shortcut.key);
    shortcutElements.push(
      <button
        className="navi_shortcut_button"
        key={combinationString}
        aria-keyshortcuts={combinationString}
        tabIndex="-1"
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

  const executeAction = useExecuteAction(shortcutElementRef);
  const [shortcutActionIsBusy, setShortcutActionIsBusy] = useState(false);
  useActionEvents(shortcutElementRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      setAction(() => actionEvent.detail.action);
      executeAction(actionEvent, { requester: elementRef.current });
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

  const [action, setAction] = useState(null);
  for (const shortcut of shortcuts) {
    shortcut.action = useAction(shortcut.action);
  }

  useKeyboardShortcuts(elementRef, shortcuts, (shortcut, event) => {
    if (shortcutActionIsBusy) {
      return;
    }
    event.preventDefault();
    const { action } = shortcut;
    requestAction(action, {
      event,
      target: shortcutElementRef.current,
      requester: elementRef.current,
      confirmMessage: shortcut.confirmMessage,
    });
  });

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

export const useKeyboardShortcuts = (elementRef, shortcuts, onShortcut) => {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const onShortcutRef = useRef(onShortcut);
  onShortcutRef.current = onShortcut;

  useEffect(() => {
    const element = elementRef.current;

    const onKeydown = (event) => {
      if (!canInterceptKeys(event)) {
        return;
      }

      let shortcutFound;
      for (const shortcutCandidate of shortcutsRef.current) {
        const { enabled = true, key } = shortcutCandidate;
        if (!enabled) {
          continue;
        }

        // Handle platform-specific combination objects
        let actualCombination;
        let crossPlatformCombination;

        if (typeof key === "object" && key !== null) {
          actualCombination = isMac ? key.mac : key.other;
        } else {
          actualCombination = key;

          // Auto-generate cross-platform combination if needed
          if (containsPlatformSpecificKeys(key)) {
            crossPlatformCombination = generateCrossPlatformCombination(key);
          }
        }

        // Check both the actual combination and cross-platform combination
        const matchesActual =
          actualCombination &&
          keyboardEventIsMatchingKeyCombination(event, actualCombination);
        const matchesCrossPlatform =
          crossPlatformCombination &&
          crossPlatformCombination !== actualCombination &&
          keyboardEventIsMatchingKeyCombination(
            event,
            crossPlatformCombination,
          );

        if (!matchesActual && !matchesCrossPlatform) {
          continue;
        }
        if (shortcutCandidate.when && !shortcutCandidate.when(event)) {
          continue;
        }
        shortcutFound = shortcutCandidate;
        break;
      }
      if (!shortcutFound) {
        return;
      }
      onShortcutRef.current(shortcutFound, event);
    };

    element.addEventListener("keydown", onKeydown);
    return () => {
      element.removeEventListener("keydown", onKeydown);
    };
  }, []);
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
