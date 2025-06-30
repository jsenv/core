import { useLayoutEffect } from "preact/hooks";
import { useCustomValidationRef } from "./use_custom_validation_ref.js";

export const useConstraints = (elementRef, constraints) => {
  const customValidationRef = useCustomValidationRef(elementRef);
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
