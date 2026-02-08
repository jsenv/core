import { useCallback } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (arraySignal, id) => {
  const array = arraySignal.value;
  const isMember = array.includes(id);

  const add = useCallback(() => {
    const arrayWithId = addIntoArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithId;
    return arrayWithId;
  }, []);

  const remove = useCallback(() => {
    const arrayWithoutId = removeFromArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithoutId;
    return arrayWithoutId;
  }, []);

  return [isMember, add, remove];
};
