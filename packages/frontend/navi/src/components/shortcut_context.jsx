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
        const someMatch = keyCombinations.some((keyCombination) =>
          eventIsMatchingKeyCombination(event, keyCombination),
        );
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

const eventIsMatchingKeyCombination = (event, keyCombination) => {
  const keys = keyCombination.toLowerCase().split("+");
  for (const key of keys) {
    if (key === "meta" || key === "command") {
      if (!event.metaKey) {
        return false;
      }
      continue;
    }
    if (key === "control") {
      if (!event.ctrlKey) {
        return false;
      }
      continue;
    }
    if (key === "shift") {
      if (!event.shiftKey) {
        return false;
      }
      continue;
    }
    if (key === "option" || key === "alt") {
      if (!event.altKey) {
        return false;
      }
      continue;
    }
    if (!isSameKey(event.key, key)) {
      return false;
    }
    continue;
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

const keySynonyms = [
  ["backspace", "delete"],
  ["space", " "],
  ["escape", "esc"],
  ["arrowup", "up"],
  ["arrowdown", "down"],
  ["arrowleft", "left"],
  ["arrowright", "right"],
  ["home", "start"],
  ["end", "finish"],
];

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
const useAriaKeyShortcuts = (combinations) => {
  const combinationSet = new Set();
  for (const combination of combinations) {
    const lowerCaseCombination = combination.toLowerCase();
    const keys = lowerCaseCombination.split("+");
    let i = 0;
    let useMeta = false;
    let useControl = false;
    for (; i < keys.length; i++) {
      const key = keys[i];
      if (key === "option") {
        keys[i] = "altgraph";
      }
      if (key === "command") {
        keys[i] = "meta";
        useMeta = true;
      }
      if (key === "meta") {
        useMeta = true;
      }
      if (key === "control") {
        useControl = true;
      }
    }
    const normalizedCombination = keys.join("+");
    combinationSet.add(normalizedCombination);

    if (useMeta) {
      const controlCombination = normalizedCombination.replace(
        "meta",
        "control",
      );
      combinationSet.add(controlCombination);
    }
    if (useControl) {
      const metaCombination = normalizedCombination.replace("control", "meta");
      combinationSet.add(metaCombination);
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
