import { useLayoutEffect } from "preact/hooks";
import { useInputCustomValidationRef } from "./use_input_custom_validation_ref.js";

export const useConstraints = (elementRef, constraints) => {
  const inputCustomValidationRef = useInputCustomValidationRef(elementRef);
  useLayoutEffect(() => {
    const inputCustomValidation = inputCustomValidationRef.current;
    const cleanupCallbackSet = new Set();
    for (const constraint of constraints) {
      const unregister = inputCustomValidation.registerConstraint(constraint);
      cleanupCallbackSet.add(unregister);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, constraints);
};
