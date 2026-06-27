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
 * to silently truncate the value to `maxLength` and show an info callout instead
 * of blocking entirely.
 */

import { getKeyboardEventDefaultAction } from "@jsenv/dom";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

const s = (n) => (n > 1 ? "s" : "");

/**
 * Returns true when the keyboard event is the user typing a printable character
 * (not a modifier shortcut, arrow key, delete, etc.).
 */
export const isTypingIntent = (e) => getKeyboardEventDefaultAction(e) === "type";

/**
 * Returns a message if the single character `char` is not in the allowed set, null otherwise.
 * Used on keydown to reject individual characters before they are inserted.
 */
export const getInvalidCharMessage = (char, { inputMode, allowedChars }) => {
  if (inputMode === "numeric" && !/^[0-9]$/.test(char)) {
    return naviI18n("input.prevent_invalid.key.numeric");
  }
  if (allowedChars && !new RegExp(allowedChars).test(char)) {
    return naviI18n("input.prevent_invalid.key.chars");
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
    return naviI18n("input.prevent_invalid.key.max_length", {
      max: maxLength,
      s: s(maxLength),
    });
  }
  return null;
};

/**
 * Checks a full proposed value (from paste or external set) for validity.
 *
 * Returns:
 *   null                              — value is valid, proceed normally
 *   { message }                       — invalid characters; block and show callout
 *   { fixedValue, message }           — valid chars but exceeds maxLength and
 *                                       `maxLengthAutofix` is true; apply fixedValue
 *                                       and show info callout
 */
export const checkValue = (value, { inputMode, allowedChars, maxLength, maxLengthAutofix }) => {
  if (typeof value !== "string") return null;

  if (inputMode === "numeric" && !/^[0-9]*$/.test(value)) {
    return { message: naviI18n("input.prevent_invalid.value.numeric") };
  }
  if (allowedChars && !new RegExp(`^(?:${allowedChars})*$`).test(value)) {
    return { message: naviI18n("input.prevent_invalid.value.chars") };
  }
  if (maxLength !== undefined && value.length > maxLength) {
    if (maxLengthAutofix) {
      return {
        fixedValue: value.slice(0, maxLength),
        message: naviI18n("input.prevent_invalid.value.max_length_truncated", {
          max: maxLength,
          s: s(maxLength),
        }),
      };
    }
    return {
      message: naviI18n("input.prevent_invalid.value.max_length", {
        max: maxLength,
        s: s(maxLength),
      }),
    };
  }

  return null;
};
