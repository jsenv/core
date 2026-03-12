import { useMemo } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "useArraySignalMembership requires at least 2 arguments: [arraySignal, id]",
    );
  }

  return useMemo(() => {
    const [useIsMember, add, remove] = arraySignalMembership(...args);
    const isMember = useIsMember();
    return [isMember, add, remove];
  }, args);
};

export const arraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "arraySignalMemberShip requires at least 2 arguments: [arraySignal, id]",
    );
  }
  const [arraySignal, id] = args;

  const useIsMember = () => {
    const array = arraySignal.value; // use value to subscribe to signal changes
    const idFoundInArray = array.includes(id);
    return idFoundInArray;
  };

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

  return [useIsMember, add, remove];
};
