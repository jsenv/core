/**
 * Pure validation helpers for the `allowedCharsGuard` and `maxLengthGuard` props.
 * All functions are side-effect free; callout management lives in control_input_guard.js.
 */

import { getKeyboardEventDefaultAction } from "@jsenv/dom";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

const s = (n) => (n > 1 ? "s" : "");

export const isTypingIntent = (e) => getKeyboardEventDefaultAction(e) === "type";

// Keydown: returns a message if `char` is not in the allowed character class.
export const getInvalidCharMessage = (char, { charClass, isNumeric }) => {
  if (!new RegExp(charClass).test(char)) {
    return naviI18n(isNumeric ? "input.guard.number" : "input.guard.chars");
  }
  return null;
};

// Keydown: returns a message if inserting one char would exceed maxLength.
export const getMaxLengthInsertionMessage = (el, { maxLength }) => {
  if (maxLength === undefined) return null;
  const selStart = el.selectionStart ?? el.value.length;
  const selEnd = el.selectionEnd ?? el.value.length;
  const newLen = el.value.length - (selEnd - selStart) + 1;
  if (newLen > maxLength) {
    return naviI18n("input.guard.max_length.typing", { max: maxLength, s: s(maxLength) });
  }
  return null;
};

// Paste / external set: returns a message if `value` contains disallowed chars.
export const getInvalidCharsMessage = (value, { charClass, isNumeric }) => {
  if (typeof value !== "string") return null;
  if (!new RegExp(`^(?:${charClass})*$`).test(value)) {
    return naviI18n(isNumeric ? "input.guard.number" : "input.guard.chars");
  }
  return null;
};

// Paste / external set: when value exceeds maxLength, returns fixedValue + message.
export const getLengthOverflowResult = (value, { maxLength }) => {
  if (typeof value !== "string") return null;
  if (maxLength === undefined || value.length <= maxLength) return null;
  return {
    fixedValue: value.slice(0, maxLength),
    message: naviI18n("input.guard.max_length.value", { max: maxLength, s: s(maxLength) }),
  };
};
