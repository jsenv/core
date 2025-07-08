import { useCallback, useRef, useState } from "preact/hooks";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";

export const useKeyboardShortcuts = (elementRef, shortcuts = []) => {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const executeAction = useExecuteAction(elementRef);
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
    if (confirmMessage) {
      // eslint-disable-next-line no-alert
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setAction(action);
    executeAction(action, {
      requester: event.target,
      event,
    });
  }, []);

  return [action, onKeyDown];
};
