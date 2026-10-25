import { computed } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { writeStatesAsOne } from "./state_signal.js";

/**
 * One object value made of several states, each kept on its own — an answer
 * the address writes as several params (`?levels=…&level_exact=…`), bound to
 * one control:
 *
 * ```js
 * const levelSignal = stateSignalGroup({
 *   levels: levelsSignal,
 *   level_exact: levelExactSignal,
 * });
 * <Picker type="object" signal={levelSignal}>…</Picker>
 * ```
 *
 * Read, it is `{ levels, level_exact }`, following each part — a Back that
 * moves one param moves the group. Written, each part that changes is written,
 * in one batch: one move, so the url writes it causes take one history entry
 * (a push when a part declares `history: "push"`, a replace otherwise). A key
 * the object does not hold writes `undefined` into its part, which sends a
 * state back to its default; `undefined` for the whole empties every part.
 *
 * Declared once, beside its parts: a group made in a render is a new signal at
 * each render.
 *
 * @param {Record<string, import("@preact/signals").Signal>} signalByKey
 * @returns {import("@preact/signals").Signal<Record<string, any>>}
 */
export const stateSignalGroup = (signalByKey) => {
  const keys = Object.keys(signalByKey);
  const groupSignal = computed(() => {
    const value = {};
    for (const key of keys) {
      value[key] = signalByKey[key].value;
    }
    return value;
  });
  const valueDescriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(groupSignal),
    "value",
  );
  Object.defineProperty(groupSignal, "value", {
    get() {
      return valueDescriptor.get.call(groupSignal);
    },
    set(newValue) {
      const writes = [];
      let history = "replace";
      for (const key of keys) {
        const part = signalByKey[key];
        const partValue =
          newValue === undefined || newValue === null
            ? undefined
            : newValue[key];
        if (compareTwoJsValues(partValue, part.peek())) {
          continue;
        }
        writes.push([part, partValue]);
        if (part.options?.history === "push") {
          history = "push";
        }
      }
      if (writes.length === 0) {
        return;
      }
      writeStatesAsOne(writes, { history });
    },
    enumerable: true,
    configurable: true,
  });
  return groupSignal;
};
