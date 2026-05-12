import { useCallback, useRef } from "preact/hooks";

/**
 * Returns a stable event handler to attach as onnavi_constraint_message on a DOM element.
 * messageMap keys are constraint names (e.g. "readonly"), values are the message
 * to display — either a string or a Preact element.
 *
 * @example
 * const onNaviConstraintMessage = useOnNaviConstraintMessage({ readonly: <MyMessage item={item} /> });
 * return <li onnavi_constraint_message={onNaviConstraintMessage} />;
 */
export const useOnNaviConstraintMessage = (messageMap) => {
  const messageMapRef = useRef(messageMap);
  messageMapRef.current = messageMap;

  return useCallback((e) => {
    const message = messageMapRef.current[e.detail.constraintName];
    if (message !== undefined && message !== null) {
      e.detail.respondMessage(message);
    }
  }, []);
};

export const getConstraintMessage = (element, constraint, generatedMessage) => {
  const { messageAttribute, name: constraintName } = constraint;

  // 1. Dispatch navi_constraint_message event — JSX handlers respond synchronously
  let respondedMessage = null;
  const event = new CustomEvent("navi_constraint_message", {
    bubbles: false,
    detail: {
      constraintName,
      respondMessage: (message) => {
        respondedMessage = message;
      },
    },
  });
  element.dispatchEvent(event);
  if (respondedMessage !== null) {
    return {
      message: respondedMessage,
      origin: "onnavi_constraint_message handler",
    };
  }

  // 2. Fall back to plain string attribute
  if (messageAttribute) {
    const messageAttribute_value = element.getAttribute(messageAttribute);
    if (messageAttribute_value) {
      return {
        message: messageAttribute_value,
        origin: `attribute ${messageAttribute}="${messageAttribute_value}"`,
      };
    }
  }

  // 3. Fall back to generated message
  return { message: generatedMessage, origin: "generated message" };
};
