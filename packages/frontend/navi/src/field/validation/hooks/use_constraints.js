import { useLayoutEffect } from "preact/hooks";

import { useCustomValidationRef } from "./use_custom_validation_ref.js";

const NO_CONSTRAINTS = [];
export const useConstraints = (elementRef, props, { targetSelector } = {}) => {
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
    availableMessage,
    ...remainingProps
  } = props;

  const customValidationRef = useCustomValidationRef(
    elementRef,
    targetSelector,
  );
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

  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return null;
    }
    const cleanupCallbackSet = new Set();
    const setupCustomEvent = (el, constraintName, Component) => {
      const attrName = `data-${constraintName}-message-event`;
      const customEventName = `${constraintName}_message_jsx`;
      el.setAttribute(attrName, customEventName);
      const onCustomEvent = (e) => {
        e.detail.render(Component);
      };
      el.addEventListener(customEventName, onCustomEvent);
      cleanupCallbackSet.add(() => {
        el.removeEventListener(customEventName, onCustomEvent);
        el.removeAttribute(attrName);
      });
    };

    if (disabledMessage) {
      setupCustomEvent(el, "disabled", disabledMessage);
    }
    if (requiredMessage) {
      setupCustomEvent(el, "required", requiredMessage);
    }
    if (patternMessage) {
      setupCustomEvent(el, "pattern", patternMessage);
    }
    if (minLengthMessage) {
      setupCustomEvent(el, "min-length", minLengthMessage);
    }
    if (maxLengthMessage) {
      setupCustomEvent(el, "max-length", maxLengthMessage);
    }
    if (typeMessage) {
      setupCustomEvent(el, "type", typeMessage);
    }
    if (minMessage) {
      setupCustomEvent(el, "min", minMessage);
    }
    if (maxMessage) {
      setupCustomEvent(el, "max", maxMessage);
    }
    if (singleSpaceMessage) {
      setupCustomEvent(el, "single-space", singleSpaceMessage);
    }
    if (sameAsMessage) {
      setupCustomEvent(el, "same-as", sameAsMessage);
    }
    if (minDigitMessage) {
      setupCustomEvent(el, "min-digit", minDigitMessage);
    }
    if (minLowerLetterMessage) {
      setupCustomEvent(el, "min-lower-letter", minLowerLetterMessage);
    }
    if (minUpperLetterMessage) {
      setupCustomEvent(el, "min-upper-letter", minUpperLetterMessage);
    }
    if (minSpecialCharMessage) {
      setupCustomEvent(el, "min-special-char", minSpecialCharMessage);
    }
    if (availableMessage) {
      setupCustomEvent(el, "available", availableMessage);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, [
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
    availableMessage,
  ]);

  return remainingProps;
};
