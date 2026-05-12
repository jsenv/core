import { useCallback, useRef } from "preact/hooks";

/**
 * Returns a stable event handler to attach as onnavi_constraint_message on a DOM element.
 * messageMap keys are constraint names (e.g. "readonly"), values are the message
 * to display — either a string or a Preact element.
 *
 * @example
 * const onNaviConstraintMessage = useOnNaviConstraintMessage({ readOnlyMessage: <MyMessage item={item} /> });
 * return <li onnavi_constraint_message={onNaviConstraintMessage} />;
 */
export const useOnNaviConstraintMessage = (props) => {
  const propsRef = useRef(props);
  propsRef.current = props;

  return useCallback((e) => {
    const propName = MAPPING[e.detail.constraintName];
    const message = propsRef.current[propName];
    if (message !== undefined && message !== null) {
      e.detail.respondMessage(message);
    }
  }, []);
};

const MAPPING = {
  readonly: "readOnlyMessage",
};

export const getConstraintMessage = (
  element,
  constraint,
  generatedMessage,
  { requester },
) => {
  const { messageAttribute, name: constraintName } = constraint;

  // 1. Dispatch navi_constraint_message event — JSX handlers respond synchronously.
  //    Dispatch on the requester first (e.g. the <li> that was clicked),
  //    then fall back to element (e.g. the hidden <input>).
  const dispatchOn = (target) => {
    let responded = null;
    const event = new CustomEvent("navi_constraint_message", {
      bubbles: false,
      detail: {
        constraintName,
        respondMessage: (message) => {
          responded = message;
        },
      },
    });
    target.dispatchEvent(event);
    return responded;
  };

  if (requester && requester !== element) {
    const fromRequester = dispatchOn(requester);
    if (fromRequester !== null) {
      return {
        message: fromRequester,
        origin: "onnavi_constraint_message handler on requester",
      };
    }
  }
  const fromElement = dispatchOn(element);
  if (fromElement !== null) {
    return {
      message: fromElement,
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
