import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

export const useArraySignalMembership = (arraySignal, id) => {
  const array = arraySignal.value;
  const found = array.includes(id);
  return [
    found,
    (enabled) => {
      if (enabled) {
        arraySignal.value = addIntoArray(array, id);
      } else {
        arraySignal.value = removeFromArray(array, id);
      }
    },
  ];
};
