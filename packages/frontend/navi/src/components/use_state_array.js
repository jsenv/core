import { useCallback, useRef, useState } from "preact/hooks";
import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";
import {
  resolveInitialValue,
  useExternalValueSync,
} from "./use_initial_value.js";

const FIRST_MOUNT = {};
export const useStateArray = (
  externalValue,
  fallbackValue,
  defaultValue = [],
) => {
  const initialValueRef = useRef(FIRST_MOUNT);
  if (initialValueRef.current === FIRST_MOUNT) {
    const initialValue = resolveInitialValue(
      externalValue,
      fallbackValue,
      defaultValue,
    );
    initialValueRef.current = initialValue;
  }
  const initialValue = initialValueRef.current;
  const [array, setArray] = useState(initialValue);

  // Only sync external value changes if externalValue was explicitly provided
  useExternalValueSync(externalValue, defaultValue, setArray, "state_array");

  const add = useCallback((valueToAdd) => {
    setArray((array) => {
      const newArray = addIntoArray(array, valueToAdd);
      return newArray;
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
