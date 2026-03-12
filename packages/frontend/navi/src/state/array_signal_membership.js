import { useMemo } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "useArraySignalMembership requires at least 2 arguments: [arraySignal, id]",
    );
  }

  return useMemo(() => {
    return arraySignalMembership(...args);
  }, args);
};

export const arraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "arraySignalMemberShip requires at least 2 arguments: [arraySignal, id]",
    );
  }
  const [arraySignal, id] = args;
  const array = arraySignal.value;
  const isMember = array.includes(id);

  const add = () => {
    const arrayWithId = addIntoArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithId;
    return arrayWithId;
  };

  const remove = () => {
    const arrayWithoutId = removeFromArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithoutId;
    return arrayWithoutId;
  };

  return [isMember, add, remove];
};
