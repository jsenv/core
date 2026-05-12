import { useCallback, useRef } from "preact/hooks";

/**
 * Returns a stable event handler to attach as onnavi_message on a DOM element.
 * messageMap keys are constraint names (e.g. "readonly"), values are the message
 * to display — either a string or a Preact element.
 *
 * @example
 * const onNaviMessage = useNaviMessage({ readonly: <MyMessage item={item} /> });
 * return <li onnavi_constraint_message={onNaviMessage} />;
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

export const getConstraintMessage = (
  element,
  attributeName,
  constraintName,
  generatedMessage,
) => {
  // 1. Dispatch navi_message event — JSX handlers (useNaviMessage) respond synchronously
  let respondedMessage = null;
  const event = new CustomEvent("navi_constraint_message", {
    bubbles: false,
    detail: {
      constraintName,
      respondCustomMessage: (message) => {
        respondedMessage = message;
      },
    },
  });
  element.dispatchEvent(event);
  if (respondedMessage !== null) {
    return respondedMessage;
  }

  // 2. Fall back to plain string attribute
  const messageAttribute = element.getAttribute(attributeName);
  if (messageAttribute) {
    return messageAttribute;
  }

  // 3. Fall back to generated message
  return generatedMessage;
};
