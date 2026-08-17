/**
 * `"keyboard:ctrl+backspace"` — an interaction asked for with keys.
 *
 * The name carries the shortcut, so a control says what a shortcut DOES in the
 * same place it says what a swipe does, rather than in a separate shortcut list
 * whose entries then have to find their way back to the action.
 *
 * The shortcut itself is not parsed here: `createOnKeyDownForShortcuts` already
 * knows what "ctrl+backspace" means, which keys a control may take without
 * swallowing what the browser owed them, and which it may not.
 *
 * The interaction is dispatched under its full name, colon included, so
 * `findEvent(event, "keyboard:ctrl+backspace")` gets back to it — the shortcut
 * that asked is what the action wants to know, not that a key went down.
 */

import { createOnKeyDownForShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { defineInteractionDetector } from "./interaction_registry.js";

const KEYBOARD_PREFIX = "keyboard:";

defineInteractionDetector({
  name: "keyboard",
  claims: (type) => type.startsWith(KEYBOARD_PREFIX),
  setup: (element, trigger, { types }) => {
    const shortcuts = {};
    for (const type of types) {
      shortcuts[type.slice(KEYBOARD_PREFIX.length)] = (keyboardEvent) => {
        trigger(type, keyboardEvent);
      };
    }
    const onKeyDown = createOnKeyDownForShortcuts(shortcuts);
    element.addEventListener("keydown", onKeyDown);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
    };
  },
});
