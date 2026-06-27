/**
 * Pure validation helpers for the `preventInvalidInput` and `preventLengthOverflow` props.
 *
 * - `preventInvalidInput` — blocks characters that don't match the allowed set
 *   (driven by `inputMode="numeric"` or a custom `allowedChars` pattern).
 * - `preventLengthOverflow` — blocks input that would exceed `maxLength`
 *   (optionally autofixes paste/set by truncating to `maxLength`).
 *
 * Interaction points:
 *   • keydown  → `getInvalidCharMessage` + `getMaxLengthInsertionMessage`
 *   • paste / external set → `getInvalidCharsMessage` + `getLengthOverflowResult`
 *
 * All functions are side-effect free. Callout management lives in control_input_guard.js.
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
 * Keydown: returns a message if `char` is not in the allowed set, null otherwise.
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
 * Keydown: returns a message if inserting one more character would exceed maxLength,
 * null otherwise. Accounts for the current selection (selected text is replaced).
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
 * Paste / external set: returns a message if `value` contains disallowed characters,
 * null if characters are valid.
 */
export const getInvalidCharsMessage = (value, { inputMode, allowedChars }) => {
  if (typeof value !== "string") return null;
  if (inputMode === "numeric" && !/^[0-9]*$/.test(value)) {
    return naviI18n("input.prevent_invalid.value.numeric");
  }
  if (allowedChars && !new RegExp(`^(?:${allowedChars})*$`).test(value)) {
    return naviI18n("input.prevent_invalid.value.chars");
  }
  return null;
};

/**
 * Paste / external set: checks whether `value` exceeds maxLength.
 *
 * Returns:
 *   null                    — value fits within maxLength
 *   { message }             — value too long and no autofix
 *   { fixedValue, message } — value truncated to maxLength (autofix mode)
 */
export const getLengthOverflowResult = (value, { maxLength, maxLengthAutofix }) => {
  if (typeof value !== "string") return null;
  if (maxLength === undefined || value.length <= maxLength) return null;
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
};
