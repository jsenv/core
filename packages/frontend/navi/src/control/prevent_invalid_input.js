/**
 * Helpers for the `preventInvalidInput` prop.
 *
 * When `preventInvalidInput` is set on an Input, any keypress, paste, or external
 * value set that would produce a disallowed value is blocked and a callout is shown.
 *
 * Rules applied (in order):
 *   1. Character set — driven by `inputMode="numeric"` (digits only) or a custom
 *      `allowedChars` pattern (a regex character class such as "[0-9A-Z ]").
 *   2. Max length — driven by the standard `maxLength` prop.
 *
 * For paste and external set (onnavi_set_ui_state), `maxLengthAutofix` can be set
 * to silently truncate the value to `maxLength` instead of blocking entirely.
 */

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

const s = (n) => (n > 1 ? "s" : "");

/**
 * Returns a message if the single character `char` is not in the allowed set, null otherwise.
 * Used on keydown to reject individual characters before they are inserted.
 */
export const getInvalidCharMessage = (char, { inputMode, allowedChars }) => {
  if (inputMode === "numeric" && !/^[0-9]$/.test(char)) {
    return naviI18n("input.prevent_invalid.numeric");
  }
  if (allowedChars && !new RegExp(allowedChars).test(char)) {
    return naviI18n("input.prevent_invalid.chars");
  }
  return null;
};

/**
 * Returns a message if inserting one character into `el` would exceed `maxLength`, null otherwise.
 * Accounts for the current selection: selected text is replaced, not appended.
 */
export const getMaxLengthInsertionMessage = (el, { maxLength }) => {
  if (maxLength === undefined) return null;
  const selStart = el.selectionStart ?? el.value.length;
  const selEnd = el.selectionEnd ?? el.value.length;
  const newLen = el.value.length - (selEnd - selStart) + 1;
  if (newLen > maxLength) {
    return naviI18n("input.prevent_invalid.max_length", {
      max: maxLength,
      s: s(maxLength),
    });
  }
  return null;
};

/**
 * Checks a full proposed value for validity.
 *
 * Returns:
 *   null                    — value is valid, proceed normally
 *   { message: string }     — value has invalid characters; block and show callout
 *   { fixedValue: string }  — chars are valid but value exceeds maxLength and
 *                             `maxLengthAutofix` is true; apply truncated value
 */
export const checkValue = (value, { inputMode, allowedChars, maxLength, maxLengthAutofix }) => {
  if (typeof value !== "string") return null;

  if (inputMode === "numeric" && !/^[0-9]*$/.test(value)) {
    return { message: naviI18n("input.prevent_invalid.numeric") };
  }
  if (allowedChars && !new RegExp(`^(?:${allowedChars})*$`).test(value)) {
    return { message: naviI18n("input.prevent_invalid.chars") };
  }
  if (maxLength !== undefined && value.length > maxLength) {
    if (maxLengthAutofix) {
      return { fixedValue: value.slice(0, maxLength) };
    }
    return {
      message: naviI18n("input.prevent_invalid.max_length", {
        max: maxLength,
        s: s(maxLength),
      }),
    };
  }

  return null;
};
