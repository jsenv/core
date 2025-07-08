import { useCallback } from "preact/hooks";

export const useKeyboardShortcuts = (shortcuts = []) => {
  const onKeyDown = useCallback(
    (event) => {
      let shortcutFound;
      for (const shortcutCandidate of shortcuts) {
        const { enabled = true, needsMetaKey = false, key } = shortcutCandidate;
        if (!enabled) {
          continue;
        }
        if (needsMetaKey && !event.metaKey) {
          continue;
        }
        if (key !== event.key) {
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
      if (typeof action === "function") {
        action();
      } else {
        action.reload();
      }
    },
    [shortcuts],
  );
  return onKeyDown;
};
