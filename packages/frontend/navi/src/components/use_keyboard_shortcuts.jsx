import { requestAction } from "@jsenv/validation";
import { useCallback, useRef, useState } from "preact/hooks";
import { useAction } from "./action_execution/use_action.js";

import.meta.css = /* css */ `
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

export const useKeyboardShortcuts = (shortcuts = []) => {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const [action, setAction] = useState(null);

  for (const shortcut of shortcuts) {
    shortcut.action = useAction(shortcut.action);
  }

  const onKeyDown = useCallback((event) => {
    if (event.defaultPrevented) {
      // If the keydown was prevented by another handler, do not interfere
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
    const { confirmMessage, action } = shortcutFound;
    // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
    // otherwise setState would call that action immediately
    setAction(() => action);
    requestAction(action, { event, confirmMessage });
  }, []);

  return [action, onKeyDown];
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
    if (event.key !== key) {
      if (key === "space" && event.key === " ") {
        continue;
      }
      return false;
    }
    continue;
  }
  return true;
};

export const useShortcutHiddenElement = (shortcuts) => {
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
      ></button>,
    );
  });
  return shortcutElements;
};

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
export const useAriaKeyShortcuts = (combinations) => {
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
