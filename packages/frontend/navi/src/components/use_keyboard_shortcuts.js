import { requestAction } from "@jsenv/validation";
import { useCallback, useRef, useState } from "preact/hooks";
import { useAction } from "./action_execution/use_action.js";

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

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
export const useAriaKeyShortcuts = (combinations) => {
  const combinationSet = new Set();
  for (const combination of combinations) {
    const lowerCaseCombination = combination.toLowerCase();
    const keys = lowerCaseCombination.split("+");
    if (keys.includes("meta")) {
      const controlCombination = lowerCaseCombination.replace(
        "meta",
        "control",
      );
      combinationSet.add(controlCombination);
    }
    if (keys.includes("control")) {
      const metaCombination = lowerCaseCombination.replace("control", "meta");
      combinationSet.add(metaCombination);
    }
    combinationSet.add(lowerCaseCombination);
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
