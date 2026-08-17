/**
 * The interactions the browser already has an event for.
 *
 * Nothing to detect: the name IS the event type, so this listens and says it
 * happened. Registered through the same door an application uses (see
 * interaction_registry.js) — navi has no private one.
 *
 * `contextmenu` is the only one that takes something away: the browser's own menu
 * would cover the answer to the request it is. It takes it away AFTER, though —
 * a native interaction IS its own event, the very one the gate reads, and a gate
 * refuses what is already `defaultPrevented`. Cancelling first would therefore
 * make the interaction refuse itself, and no right click could ever get through.
 * So: ask, and only cover the browser's menu once something answered.
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
        const performed = trigger(type, nativeEvent);
        if (type === "contextmenu" && performed) {
          // Something answered the request, so the browser's own menu would only
          // cover it. Nothing answered (the gate refused, a listener said "not
          // this time"): the right click stays what it was, and opens the menu.
          nativeEvent.preventDefault();
        }
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
