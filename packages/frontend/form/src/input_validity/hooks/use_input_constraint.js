import { useRef } from "preact/hooks";
import { useInputCustomValidationRef } from "./use_input_custom_validation_ref.js";

export const useInputConstraint = (
  inputRef,
  constraint,
  constraintName = constraint.name || "anonymous",
) => {
  const constraintRef = useRef();
  constraintRef.current = constraint;

  useInputCustomValidationRef(
    inputRef,
    (inputCustomValidation) => {
      if (typeof constraint === "function") {
        return inputCustomValidation.registerConstraint({
          name: constraintName,
          check: (...args) => {
            const callback = constraintRef.current;
            return callback(...args);
          },
        });
      }
      return inputCustomValidation.registerConstraint(constraint);
    },
    [],
  );
};
