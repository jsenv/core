import { useCallback } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "useArraySignalMembership requires at least 2 arguments: [arraySignal, id]",
    );
  }
  const [arraySignal, id] = args;
  const array = arraySignal.value;
  const isMember = array.includes(id);

  const add = useCallback(() => {
    const arrayWithId = addIntoArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithId;
    return arrayWithId;
  }, [id]);

  const remove = useCallback(() => {
    const arrayWithoutId = removeFromArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithoutId;
    return arrayWithoutId;
  }, [id]);

  return [isMember, add, remove];
};
