import { useRef } from "preact/hooks";
import { useInputCustomValidation } from "./use_input_custom_validation.js";

export const useInputConstraint = (
  inputRef,
  constraintCallback,
  constraintName = constraintCallback.name || "anonymous",
) => {
  const callbackRef = useRef();
  callbackRef.current = constraintCallback;
  useInputCustomValidation(
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
