import { useLayoutEffect } from "preact/hooks";

import { useCustomValidationRef } from "./use_custom_validation_ref.js";

const NO_CONSTRAINTS = [];
export const useConstraints = (
  elementRef,
  constraints = NO_CONSTRAINTS,
  { targetSelector, disabled } = {},
) => {
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
};
