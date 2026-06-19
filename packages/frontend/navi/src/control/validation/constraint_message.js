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

export const CONSTRAINT_MESSAGE_PROP_NAME_SET = new Set(
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
  controller,
  constraint,
  generatedMessage,
  { requester },
) => {
  const { name: constraintName } = constraint;
  const propName = CONSTRAINT_NAME_TO_PROP[constraintName];

  // 1. Search first on the requester (e.g. the <li> that was clicked),
  //  then fall back to element (e.g. the hidden <input>).
  if (requester) {
    const requesterController = requester.__uiStateController__;
    if (requesterController && requesterController !== controller) {
      const requesterControllerMessage = requesterController.props[propName];
      if (requesterControllerMessage) {
        return {
          message: requesterControllerMessage,
          origin: "requester controller",
        };
      }
    }
  }

  const controllerMessage = controller.props[propName];
  if (controllerMessage) {
    return {
      message: controllerMessage,
      origin: "controller",
    };
  }

  return {
    message: generatedMessage,
    origin: "generated message",
  };
};
