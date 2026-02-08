import { useCallback } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (arraySignal, id) => {
  const array = arraySignal.value;
  const isMember = array.includes(id);

  const add = useCallback(() => {
    arraySignal.value = addIntoArray(array, id);
  }, []);

  const remove = useCallback(() => {
    arraySignal.value = removeFromArray(array, id);
  }, []);

  return [isMember, add, remove];
};
