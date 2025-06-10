import { useCallback } from "preact/hooks";
import { useInputCustomValidationRef } from "./use_input_custom_validation_ref.js";

export const useInputValidationMessage = (inputRef, key, target) => {
  const inputCustomValidationRef = useInputCustomValidationRef(
    inputRef,
    target,
  );

  const addCustomMessage = useCallback(
    (message, options) => {
      inputCustomValidationRef.current.addCustomMessage(key, message, options);
    },
    [inputCustomValidationRef, key],
  );
  const removeCustomMessage = useCallback(() => {
    inputCustomValidationRef.current.removeCustomMessage(key);
  }, [inputCustomValidationRef, key]);

  return [addCustomMessage, removeCustomMessage];
};
