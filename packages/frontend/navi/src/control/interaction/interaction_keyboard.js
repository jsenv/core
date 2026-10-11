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
 * The control's own element is the exception to that last part. `interactions`
 * are set up on a field's outer box while the key goes down in its `<input>`,
 * and that field is the control the declaration speaks for: an ArrowUp declared
 * on a text field is the field saying what ArrowUp does there, not a container
 * taking the caret from a field inside it. A field inside a box that declares
 * keys for something else (a row, a list) keeps every key it has a use for.
 *
 * A declared key that matches takes the key: its default does not happen as
 * well, whether the gate lets the interaction through or refuses it and says
 * why — the same as a number field's arrows.
 *
 * The interaction is dispatched under its full name, colon included, so
 * `findEvent(event, "keyboard:ctrl+backspace")` gets back to it — the shortcut
 * that asked is what the action wants to know, not that a key went down.
 */

import { createOnKeyDownForShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { findNearestControlHost } from "../control_dom.js";
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
        keyboardEvent.preventDefault();
      };
    }
    const onKeyDown = createOnKeyDownForShortcuts(shortcuts, {
      ownsTarget: (target) => target === findNearestControlHost(element),
    });
    element.addEventListener("keydown", onKeyDown);
    return () => {
      element.removeEventListener("keydown", onKeyDown);
    };
  },
});
