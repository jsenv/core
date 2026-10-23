import { useComputed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { addIntoArray, removeFromArray } from "../utils/array_add_remove.js";

/**
 * Whether `id` is in the array a signal holds, and the two writes that put it
 * in or take it out: `[isMember, add, remove]`. For a row that adds itself to
 * a selection held elsewhere (a "favourite" star over a list of ids). The
 * component re-renders when its own membership changes, not when other ids
 * come and go.
 *
 * Where the membership is a checkbox, a `CheckboxGroup` bound to the array's
 * signal already adds and removes each checkbox's `value`
 * (docs/control_value.md).
 *
 * @param {import("@preact/signals").Signal<any[]>} arraySignal
 * @param {any} id
 * @returns {[boolean, () => any[], () => any[]]}
 *
 * @example
 * const [starred, star, unstar] = useArraySignalMembership(starredIdsSignal, place.id);
 */
export const useArraySignalMembership = (...args) => {
  if (args.length < 2) {
    throw new Error(
      "useArraySignalMembership requires at least 2 arguments: [arraySignal, id]",
    );
  }
  const [arraySignal, id] = args;

  // Through a computed so the component re-renders when its own membership
  // changes, not every time anything else is added to or removed from the
  // array: a list of 200 rows each watching the same array would otherwise all
  // re-render (and each re-scan the array) when one row is toggled.
  const isMember = useComputed(() => arraySignal.value.includes(id)).value;
  const [, add, remove] = useMemo(
    () => arraySignalMembership(arraySignal, id),
    [arraySignal, id],
  );
  return [isMember, add, remove];
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
