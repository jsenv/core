import { generateAriaKeyShortcuts } from "./aria_key_shortcuts.js";
import { activeShortcutsSignal } from "./keyboard_shortcuts.js";

import.meta.css = /* css */ `
  .navi_shortcut_container[data-visually-hidden] {
    /* Visually hidden container - doesn't affect layout */
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not interactable */
    opacity: 0;
    pointer-events: none;
  }

  .navi_shortcut_button[data-visually-hidden] {
    /* Visually hidden but accessible to screen readers */
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not focusable via tab navigation */
    opacity: 0;
    pointer-events: none;
  }
`;

export const ActiveKeyboardShortcuts = ({ visible }) => {
  const activeShortcuts = activeShortcutsSignal.value;

  return (
    <div
      className="navi_shortcut_container"
      data-visually-hidden={visible ? undefined : ""}
    >
      {activeShortcuts.map((shortcut) => {
        return (
          <KeyboardShortcutAriaElement
            key={shortcut.key}
            visible={visible}
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
  visible,
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
      data-visually-hidden={visible ? undefined : ""}
      aria-keyshortcuts={ariaKeyshortcuts}
      tabIndex="-1"
      disabled={!enabled}
      {...props}
    >
      {description}
    </button>
  );
};
