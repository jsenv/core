import { signal } from "@preact/signals";
import { addIntoArray, removeFromArray } from "./array_add_remove.js";

export const arraySignal = (initialValue = []) => {
  const theSignal = signal(initialValue);

  const add = (...args) => {
    theSignal.value = addIntoArray(theSignal.peek(), ...args);
  };
  const remove = (...args) => {
    theSignal.value = removeFromArray(theSignal.peek(), ...args);
  };

  return [theSignal, add, remove];
};
