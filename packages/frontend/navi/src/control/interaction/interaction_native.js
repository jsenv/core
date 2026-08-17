/**
 * The interactions the browser already has an event for.
 *
 * Nothing to detect: the name IS the event type, so this listens and says it
 * happened. Registered through the same door an application uses (see
 * interaction_registry.js) — navi has no private one.
 *
 * `contextmenu` is the only one that takes something away: the browser's own menu
 * would cover the answer to the request it is.
 */

import { defineInteractionDetector } from "./interaction_registry.js";

const NATIVE_TYPE_SET = new Set([
  "mousedown",
  "mouseup",
  "click",
  "dblclick",
  "contextmenu",
]);

defineInteractionDetector({
  name: "native",
  claims: (type) => NATIVE_TYPE_SET.has(type),
  setup: (element, trigger, { types }) => {
    const listeners = types.map((type) => {
      const listener = (nativeEvent) => {
        if (type === "contextmenu") {
          nativeEvent.preventDefault();
        }
        trigger(type, nativeEvent);
      };
      element.addEventListener(type, listener);
      return [type, listener];
    });
    return () => {
      for (const [type, listener] of listeners) {
        element.removeEventListener(type, listener);
      }
    };
  },
});
