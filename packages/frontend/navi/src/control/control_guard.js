/**
 * Input guard — enforces character and length constraints during typing, paste,
 * and external value sets. What a character class holds and which sentence
 * refuses it comes from @jsenv/validity; the guard is what only a field can do,
 * blocking the keystroke before the value exists.
 *
 * The guard answers for the GESTURE, never for what the control already holds.
 * A value can arrive already outside the class or already too long — a
 * `defaultValue`, a signal, a value written from elsewhere — and refusing the
 * next keystroke over it would blame the person for a character they did not
 * type. So a change is refused only when it makes the value worse: one more
 * character outside the class, or one more character over the limit. What is
 * already there is the `charClass`/`maxLength` constraint's business, and it
 * says so at submit.
 *
 * The guard owns a single callout token (shared across all rejection reasons) so
 * successive rejections update the same callout rather than stacking.
 *
 * Exposed as `controller.rules.guard` (created inside `createControlRules`).
 *
 * Props read from `controller.props` on each call (always up to date):
 *   - `charGuard`      — preset name (e.g. "numeric", "tel") or raw char class "[A-Z]"
 *   - `maxLengthGuard` — maximum character count (enables both guard and constraint)
 */

import { getKeyboardEventDefaultAction } from "@jsenv/dom";
import {
  compileCharClass,
  compileCharClassAnchored,
  getCharClassMessageKey,
  resolveCharClass,
} from "@jsenv/validity";

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { naviI18nFromValidityMessage } from "./rules/validity_bridge.js";
import { createOpenToken } from "./rules/control_callout.js";

export const isTypingIntent = (e) =>
  getKeyboardEventDefaultAction(e) === "type";

const s = (n) => (n > 1 ? "s" : "");

// Keydown: block only single printable characters that don't match the class.
// Multi-character key names (Delete, ArrowLeft…) are always allowed.
const getInvalidCharMessage = (char, { charClass, messageKey }) => {
  // Counted in code points: an astral character is one character typed, not two.
  const codePointCount = [...char].length;
  if (codePointCount !== 1) {
    return null;
  }
  if (compileCharClass(charClass).test(char)) return null;
  return naviI18nFromValidityMessage({ key: messageKey });
};

// Keydown: block when inserting one char would exceed maxLength.
const getMaxLengthInsertionMessage = (el, { maxLength }) => {
  if (maxLength === undefined) return null;
  const selStart = el.selectionStart ?? el.value.length;
  const selEnd = el.selectionEnd ?? el.value.length;
  const newLen = el.value.length - (selEnd - selStart) + 1;
  if (newLen <= maxLength) return null;
  return naviI18n("constraint.guard.max_length.typing", {
    max: maxLength,
    s: s(maxLength),
  });
};

const countCharsOutsideClass = (str, charClass) => {
  const regex = compileCharClass(charClass);
  let count = 0;
  for (const char of str) {
    if (!regex.test(char)) {
      count++;
    }
  }
  return count;
};

// Paste / set: block when the gesture brings in a character the class refuses.
const getInvalidCharsMessage = (
  uiState,
  { charClass, messageKey, uiStateNow },
) => {
  const str = uiState === undefined ? "" : String(uiState);
  if (compileCharClassAnchored(charClass).test(str)) return null;
  const strNow = uiStateNow === undefined ? "" : String(uiStateNow);
  if (
    countCharsOutsideClass(str, charClass) <=
    countCharsOutsideClass(strNow, charClass)
  ) {
    return null;
  }
  return naviI18nFromValidityMessage({ key: messageKey });
};

// Paste / set: truncate what the gesture adds beyond the limit.
const getLengthOverflowResult = (uiState, { maxLength, uiStateNow }) => {
  if (maxLength === undefined) return null;
  const str = uiState === undefined ? "" : String(uiState);
  if (str.length <= maxLength) return null;
  const strNow = uiStateNow === undefined ? "" : String(uiStateNow);
  if (str.length <= strNow.length) return null;
  return {
    fixedValue: str.slice(0, maxLength),
    message: naviI18n("constraint.guard.max_length.value", {
      max: maxLength,
      s: s(maxLength),
    }),
  };
};

export const createControlGuard = (controller) => {
  const token = createOpenToken();

  const show = (message, e) => {
    controller.rules.callout.addOpenToken(token, {
      message,
      status: "info",
      event: e,
      skipFocus: true,
    });
  };

  const clear = (e) => {
    controller.rules.callout.removeOpenToken(token, e);
  };

  /**
   * Called on every keydown. Returns true when the key should be blocked
   * (caller must call e.preventDefault()).
   * Non-typing keys (Delete, Arrow…) are always allowed.
   */
  const checkKeydown = (e, el) => {
    if (!isTypingIntent(e)) {
      return false;
    }
    const { charGuard, maxLengthGuard } = controller.props;

    if (charGuard) {
      const charClass = resolveCharClass(charGuard);
      const messageKey = getCharClassMessageKey(charGuard);
      const charMsg = getInvalidCharMessage(e.key, { charClass, messageKey });
      if (charMsg) {
        show(charMsg, e);
        return true;
      }
    }
    if (maxLengthGuard !== undefined) {
      const lenMsg = getMaxLengthInsertionMessage(el, {
        maxLength: maxLengthGuard,
      });
      if (lenMsg) {
        show(lenMsg, e);
        return true;
      }
    }
    clear(e);
    return false;
  };

  /**
   * Called when a full value is about to be applied (paste or external set).
   *
   * Returns:
   *   null            — value is valid, proceed normally
   *   { blocked }     — value rejected, caller must not apply it (callout shown)
   *   { fixedValue }  — value was truncated to maxLengthGuard (callout shown as info)
   */
  const checkUIState = (uiState, e) => {
    const { charGuard, maxLengthGuard } = controller.props;
    // What the control holds right now — setUIState has not written the new
    // value yet, and the paste path computes it without applying it.
    const uiStateNow = controller.uiState;

    if (charGuard) {
      const charClass = resolveCharClass(charGuard);
      const messageKey = getCharClassMessageKey(charGuard);
      const charsMsg = getInvalidCharsMessage(uiState, {
        charClass,
        messageKey,
        uiStateNow,
      });
      if (charsMsg) {
        show(charsMsg, e);
        return { blocked: true };
      }
    }

    if (maxLengthGuard !== undefined) {
      const lengthResult = getLengthOverflowResult(uiState, {
        maxLength: maxLengthGuard,
        uiStateNow,
      });
      if (lengthResult) {
        show(lengthResult.message, e);
        return { fixedValue: lengthResult.fixedValue };
      }
    }

    clear(e);
    return null;
  };

  return { checkKeydown, checkUIState, show, clear };
};
