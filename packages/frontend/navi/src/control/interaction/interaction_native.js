/**
 * The interactions the browser already has an event for.
 *
 * Nothing to detect: the name IS the event type, so this listens and answers.
 * Registered through the same door an application uses (see
 * interaction_registry.js) — navi has no private one.
 *
 * `contextmenu` is the only one that takes something away: the browser's own menu
 * would cover the answer to the request it is.
 */

import { defineInteractionDetector } from "./interaction_registry.js";

const PROP_NAME_BY_TYPE = {
  mousedown: "onMouseDown",
  mouseup: "onMouseUp",
  click: "onClick",
  dblclick: "onDblClick",
  contextmenu: "onContextMenu",
};

defineInteractionDetector({
  name: "native",
  claims: (type) => type in PROP_NAME_BY_TYPE,
  setup: ({ types, perform }) => {
    const props = {};
    for (const type of types) {
      props[PROP_NAME_BY_TYPE[type]] = (nativeEvent) => {
        if (type === "contextmenu") {
          nativeEvent.preventDefault();
        }
        perform(type, nativeEvent);
      };
    }
    return props;
  },
});
