/**
 * What `--navi-update` and `--navi-update:toggle` write, and whether a source
 * of either is "applied": the value it would write is already what its target
 * holds, so pressing it would change nothing. Shared by the command (what to
 * write) and by the source that wears the mark (button_update_applied.jsx), so
 * the two never disagree on what "already there" means.
 */

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

// "toggle:smooth", "smooth", "toggle": the words after the command name, in
// any order.
export const readUpdateCommandModifiers = (argument) => {
  const words = argument ? argument.split(":") : [];
  return {
    toggle: words.includes("toggle"),
    smooth: words.includes("smooth"),
  };
};

export const isUpdateApplied = (held, value, { toggle }) => {
  if (!toggle) {
    return compareTwoJsValues(held, value);
  }
  if (!Array.isArray(held)) {
    return compareTwoJsValues(held, value);
  }
  const items = Array.isArray(value) ? value : [value];
  if (items.length === 0) {
    return false;
  }
  return items.every((item) => includesValue(held, item));
};

// A multiple target: the items join it when not all of them are held, and all
// leave it when they are. A single one: the value, or nothing when it is
// already the one held.
export const toggledValue = (held, value) => {
  if (!isUpdateApplied(held, value, { toggle: true })) {
    if (!Array.isArray(held)) {
      return value;
    }
    const items = Array.isArray(value) ? value : [value];
    const joined = [...held];
    for (const item of items) {
      if (!includesValue(joined, item)) {
        joined.push(item);
      }
    }
    return joined;
  }
  if (!Array.isArray(held)) {
    return undefined;
  }
  const items = Array.isArray(value) ? value : [value];
  return held.filter((heldItem) => !includesValue(items, heldItem));
};

const includesValue = (array, value) =>
  array.some((item) => compareTwoJsValues(item, value));
