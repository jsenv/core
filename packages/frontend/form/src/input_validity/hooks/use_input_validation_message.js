import { useCallback } from "preact/hooks";
import { useInputCustomValidation } from "./use_input_custom_validation.js";

export const useInputValidationMessage = (inputRef, key) => {
  const inputCustomValidation = useInputCustomValidation(inputRef);

  const addCustomMessage = useCallback(
    (message, options) => {
      inputCustomValidation.addCustomMessage(message, options);
    },
    [key],
  );
  const removeCustomMessage = useCallback(
    (message) => {
      inputCustomValidation.removeCustomMessage(message);
    },
    [key],
  );

  return [addCustomMessage, removeCustomMessage];
};
