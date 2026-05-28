export const CONSTRAINT_NAME_TO_PROP = {
  disabled: "disabledMessage",
  required: "requiredMessage",
  pattern: "patternMessage",
  type_email: "typeMessage",
  type_number: "typeMessage",
  min_length: "minLengthMessage",
  max_length: "maxLengthMessage",
  min: "minMessage",
  max: "maxMessage",
  single_space: "singleSpaceMessage",
  same_as: "sameAsMessage",
  min_lower_letter: "minLowerLetterMessage",
  min_upper_letter: "minUpperLetterMessage",
  min_digit: "minDigitMessage",
  min_special_char: "minSpecialCharMessage",
  one_of: "oneOfMessage",
  readonly: "readOnlyMessage",
  available: "availableMessage",
};

const CONSTRAINT_MESSAGE_PROP_NAME_SET = new Set(
  Object.values(CONSTRAINT_NAME_TO_PROP),
);

export const extractMessageAndRemainingProps = (props) => {
  const ownMessages = {};
  const remaining = {};
  const keyToVisit = new Set(Object.keys(props));
  for (const key of keyToVisit) {
    if (CONSTRAINT_MESSAGE_PROP_NAME_SET.has(key)) {
      ownMessages[key] = props[key];
    } else {
      remaining[key] = props[key];
    }
  }
  return [ownMessages, remaining];
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
