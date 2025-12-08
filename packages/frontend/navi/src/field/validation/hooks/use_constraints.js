import { useLayoutEffect } from "preact/hooks";

import { useCustomValidationRef } from "./use_custom_validation_ref.js";

const NO_CONSTRAINTS = [];
export const useConstraints = (elementRef, props, { targetSelector } = {}) => {
  const {
    constraints = NO_CONSTRAINTS,
    requiredMessage,
    minMessage,
    maxMessage,
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

    if (requiredMessage) {
      setupCustomEvent(el, "required", requiredMessage);
    }
    if (minMessage) {
      setupCustomEvent(el, "min", minMessage);
    }
    if (maxMessage) {
      setupCustomEvent(el, "max", maxMessage);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, [requiredMessage, minMessage, maxMessage]);

  return remainingProps;
};
