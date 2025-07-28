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
      const { enabled = true, needsMetaKey = false, key } = shortcutCandidate;
      if (!enabled) {
        continue;
      }
      if (needsMetaKey && !event.metaKey) {
        continue;
      }
      let eventKey = event.key;
      if (eventKey === " ") {
        eventKey = "Space";
      }
      if (key !== eventKey) {
        continue;
      }
      shortcutFound = shortcutCandidate;
      break;
    }

    if (!shortcutFound) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const { confirmMessage, action } = shortcutFound;
    // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
    // otherwise setState would call that action immediately
    setAction(() => action);
    requestAction(action, { event, confirmMessage });
  }, []);

  return [action, onKeyDown];
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
        keys[i] = "AltGraph";
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
