import { useRef } from "preact/hooks";
import { useInputCustomValidationRef } from "./use_input_custom_validation_ref.js";

export const useInputConstraint = (
  inputRef,
  constraintCallback,
  constraintName = constraintCallback.name || "anonymous",
) => {
  const callbackRef = useRef();
  callbackRef.current = constraintCallback;
  useInputCustomValidationRef(
    inputRef,
    (inputCustomValidation) => {
      inputCustomValidation.registerConstraint({
        name: constraintName,
        check: (...args) => {
          return callbackRef.current(...args);
        },
      });
    },
    [],
  );
};
