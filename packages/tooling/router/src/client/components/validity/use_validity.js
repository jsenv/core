import { useLayoutEffect, useRef, useCallback } from "preact/hooks";
import { createInputValidity } from "./input_validity.js";

export const useValidity = (inputRef, { onCancel } = {}) => {
  const inputValidityRef = useRef(null);

  const addCustomValidity = useCallback((key, message) => {
    const inputValidity = inputValidityRef.current;
    inputValidity.addCustomValidity(key, message);
  }, []);
  const removeCustomValidity = useCallback((key, message) => {
    const inputValidity = inputValidityRef.current;
    inputValidity.removeCustomValidity(key, message);
  }, []);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const inputValidity = createInputValidity(input, { onCancel });
    inputValidityRef.current = inputValidity;
    return () => {
      inputValidity.cleanup();
    };
  }, [onCancel]);

  return [addCustomValidity, removeCustomValidity];
};
