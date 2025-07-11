import { useCallback, useState } from "preact/hooks";
import { addIntoArray, removeFromArray } from "./array_add_remove.js";

export const useStateArray = (initialValue = []) => {
  const [array, setArray] = useState(initialValue);

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
