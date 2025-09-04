import { requestAction } from "@jsenv/validation";
import { useEffect, useRef, useState } from "preact/hooks";
import { useAction } from "../action_execution/use_action.js";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { generateAriaKeyShortcuts } from "./aria_key_shortcuts.js";
import { applyKeyboardShortcuts } from "./keyboard_shortcuts.js";

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

export const KeyboardShortcuts = ({
  elementRef,
  shortcuts,
  onActionPrevented,
  onActionStart,
  onActionAbort,
  onActionError,
  onActionEnd,
  allowConcurrentActions,
}) => {
  if (!elementRef) {
    throw new Error(
      "useKeyboardShortcutsProvider requires an elementRef to attach shortcuts to.",
    );
  }

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

  const shortcutElementRef = useRef();
  const executeAction = useExecuteAction(shortcutElementRef);
  const [shortcutActionIsBusy, setShortcutActionIsBusy] = useState(false);
  useActionEvents(shortcutElementRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      // setAction(() => actionEvent.detail.action);
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

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const shortcutsCopy = [];
    for (const shortcutCandidate of shortcuts) {
      shortcutsCopy.push({
        ...shortcutCandidate,
        handler: (keyboardEvent) => {
          if (shortcutCandidate.handler) {
            return shortcutCandidate.handler(keyboardEvent);
          }
          if (shortcutActionIsBusy) {
            return false;
          }
          const { action } = shortcutCandidate;
          return requestAction(action, {
            event: keyboardEvent,
            target: shortcutElementRef.current,
            requester: elementRef.current,
            confirmMessage: shortcutCandidate.confirmMessage,
          });
        },
      });
    }
    const onKeydown = (event) => {
      applyKeyboardShortcuts(shortcutsCopy, event);
    };
    element.addEventListener("keydown", onKeydown);
    return () => {
      element.removeEventListener("keydown", onKeydown);
    };
  }, [shortcuts]);

  return (
    <div ref={shortcutElementRef} className="navi_shortcut_container">
      {shortcuts.map((shortcut) => {
        return (
          <KeyboardShortcutAriaElement
            key={shortcut.key}
            keyCombination={shortcut.key}
            description={shortcut.description}
            enabled={shortcut.enabled}
            data-action={shortcut.action ? shortcut.action.name : undefined}
            data-confirm-message={shortcut.confirmMessage}
          />
        );
      })}
    </div>
  );
};

const KeyboardShortcutAriaElement = ({
  keyCombination,
  description,
  enabled,
  ...props
}) => {
  if (typeof keyCombination === "function") {
    return null;
  }
  const ariaKeyshortcuts = generateAriaKeyShortcuts(keyCombination);
  return (
    <button
      className="navi_shortcut_button"
      aria-keyshortcuts={ariaKeyshortcuts}
      tabIndex="-1"
      disabled={!enabled}
      {...props}
    >
      {description}
    </button>
  );
};
