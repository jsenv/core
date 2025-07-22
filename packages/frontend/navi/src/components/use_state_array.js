import { useCallback, useState } from "preact/hooks";
import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";
import { useInitialValue } from "./use_initial_value.js";

export const useStateArray = (
  externalValue = [],
  fallbackValue,
  defaultValue,
) => {
  const [array, setArray] = useState(externalValue);
  useInitialValue(externalValue, fallbackValue, defaultValue, setArray);

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

  return [array, add, remove];
};
