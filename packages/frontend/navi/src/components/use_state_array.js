import { useCallback, useState } from "preact/hooks";
import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";
import {
  resolveInitialValue,
  useExternalValueSync,
} from "./use_initial_value.js";

export const useStateArray = (
  externalValue = [],
  fallbackValue,
  defaultValue = [],
) => {
  const initialValue = resolveInitialValue(
    externalValue,
    fallbackValue,
    defaultValue,
  );
  const [array, setArray] = useState(initialValue);

  // Sync external value changes
  useExternalValueSync(externalValue, defaultValue, setArray, "state_array");

  const add = useCallback((valueToAdd) => {
    setArray((array) => {
      return addIntoArray(array, valueToAdd);
    });
  }, []);

  const remove = useCallback((valueToRemove) => {
    setArray((array) => {
      return removeFromArray(array, valueToRemove);
    });
  }, []);

  const reset = useCallback(() => {
    setArray(initialValue);
  }, [initialValue]);

  return [array, add, remove, reset];
};
