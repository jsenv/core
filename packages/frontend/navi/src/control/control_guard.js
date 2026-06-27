/**
 * Input guard — enforces character and length constraints during typing, paste,
 * and external value sets.
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
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import {
  getCharGuardMessageKey,
  resolveCharClass,
} from "./char_guard_presets.js";
import { createOpenToken } from "./rules/control_callout.js";

export const isTypingIntent = (e) =>
  getKeyboardEventDefaultAction(e) === "type";

const s = (n) => (n > 1 ? "s" : "");

// Keydown: block only single printable characters that don't match the class.
// Multi-character key names (Delete, ArrowLeft…) are always allowed.
const getInvalidCharMessage = (char, { charClass, messageKey }) => {
  if (char.length !== 1) return null;
  if (new RegExp(charClass).test(char)) return null;
  return naviI18n(messageKey);
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

// Paste / set: block when value contains disallowed chars.
const getInvalidCharsMessage = (uiState, { charClass, messageKey }) => {
  const str = uiState === undefined ? "" : String(uiState);
  if (new RegExp(`^(?:${charClass})*$`).test(str)) return null;
  return naviI18n(messageKey);
};

// Paste / set: truncate when value exceeds maxLength.
const getLengthOverflowResult = (uiState, { maxLength }) => {
  if (maxLength === undefined) return null;
  const str = uiState === undefined ? "" : String(uiState);
  if (str.length <= maxLength) return null;
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
      const messageKey = getCharGuardMessageKey(charGuard);
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

    if (charGuard) {
      const charClass = resolveCharClass(charGuard);
      const messageKey = getCharGuardMessageKey(charGuard);
      const charsMsg = getInvalidCharsMessage(uiState, {
        charClass,
        messageKey,
      });
      if (charsMsg) {
        show(charsMsg, e);
        return { blocked: true };
      }
    }

    if (maxLengthGuard !== undefined) {
      const lengthResult = getLengthOverflowResult(uiState, {
        maxLength: maxLengthGuard,
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
