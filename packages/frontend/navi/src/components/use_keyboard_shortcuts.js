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
