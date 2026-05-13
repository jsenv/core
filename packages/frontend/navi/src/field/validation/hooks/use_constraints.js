import { useLayoutEffect } from "preact/hooks";

import { useOnNaviConstraintMessage } from "../constraint_message.js";
import { useCustomValidationRef } from "./use_custom_validation_ref.js";

const NO_CONSTRAINTS = [];
export const useConstraints = (
  elementRef,
  props,
  { targetSelector, disabled } = {},
) => {
  const {
    constraints = NO_CONSTRAINTS,
    disabledMessage,
    requiredMessage,
    patternMessage,
    minLengthMessage,
    maxLengthMessage,
    typeMessage,
    minMessage,
    maxMessage,
    singleSpaceMessage,
    sameAsMessage,
    minDigitMessage,
    minLowerLetterMessage,
    minUpperLetterMessage,
    minSpecialCharMessage,
    oneOfMessage,
    readOnlyMessage,
    availableMessage,
    ...remainingProps
  } = props;

  const customValidationRef = useCustomValidationRef(elementRef, {
    targetSelector,
    disabled,
  });
  useLayoutEffect(() => {
    const customValidation = customValidationRef.current;
    const cleanupCallbackSet = new Set();
    for (const constraint of constraints) {
      const unregister = customValidation.registerConstraint(constraint);
      cleanupCallbackSet.add(unregister);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, constraints);

  const onNaviConstraintMessage = useOnNaviConstraintMessage({
    disabledMessage,
    requiredMessage,
    patternMessage,
    minLengthMessage,
    maxLengthMessage,
    typeMessage,
    minMessage,
    maxMessage,
    singleSpaceMessage,
    sameAsMessage,
    minDigitMessage,
    minLowerLetterMessage,
    minUpperLetterMessage,
    minSpecialCharMessage,
    oneOfMessage,
    readOnlyMessage,
    availableMessage,
  });

  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return null;
    }
    el.addEventListener("navi_constraint_message", onNaviConstraintMessage);
    return () => {
      el.removeEventListener(
        "navi_constraint_message",
        onNaviConstraintMessage,
      );
    };
  }, [onNaviConstraintMessage]);

  return remainingProps;
};
