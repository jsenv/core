import { useCallback, useContext, useLayoutEffect, useRef } from "preact/hooks";

import { FieldContext } from "../../field.jsx";
import {
  CONSTRAINT_NAME_TO_PROP,
  extractMessageAndRemainingProps,
} from "../constraint_message.js";

/**
 * Installs a navi_constraint_message event listener on the given element.
 * Messages are resolved in the following priority order:
 *   1. Own *Message props passed directly to the component
 *   2. *Message props inherited from the nearest <Field> ancestor
 *
 * Returns the remaining props with all *Message props removed.
 */
export const useConstraintMessages = (elementRef, props) => {
  const fieldCtx = useContext(FieldContext);
  const fieldConstraintMessagesRef = fieldCtx?.constraintMessagesRef;

  const messagePropsRef = useRef();
  const [messageProps, remainingProps] = extractMessageAndRemainingProps(props);
  messagePropsRef.current = messageProps;

  const onConstraintMessage = useCallback(
    (e) => {
      const propName = CONSTRAINT_NAME_TO_PROP[e.detail.constraintName];
      const messageProp = messagePropsRef.current[propName];
      if (messageProp !== undefined && messageProp !== null) {
        e.detail.respondMessage(messageProp);
        return;
      }
      const fieldMessageProp = fieldConstraintMessagesRef?.current?.[propName];
      if (fieldMessageProp !== undefined && fieldMessageProp !== null) {
        e.detail.respondMessage(fieldMessageProp);
      }
    },
    [fieldConstraintMessagesRef],
  );

  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return null;
    }
    el.addEventListener("navi_constraint_message", onConstraintMessage);
    return () => {
      el.removeEventListener("navi_constraint_message", onConstraintMessage);
    };
  }, [onConstraintMessage]);

  return remainingProps;
};
