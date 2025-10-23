import { useCallback } from "preact/hooks";

import { useCustomValidationRef } from "./use_custom_validation_ref.js";

export const useValidationMessage = (inputRef, key, target, options = {}) => {
  const customValidationRef = useCustomValidationRef(inputRef, target);

  const addCustomMessage = useCallback(
    (message) => {
      customValidationRef.current.addCustomMessage(key, message, options);
    },
    [customValidationRef, key],
  );
  const removeCustomMessage = useCallback(() => {
    customValidationRef.current.removeCustomMessage(key);
  }, [customValidationRef, key]);

  return [addCustomMessage, removeCustomMessage];
};
