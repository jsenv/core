/**
 * Creates an input guard that enforces character and length constraints during typing,
 * paste, and external value sets.
 *
 * The guard owns a single callout token (shared across all rejection reasons) so
 * successive rejections update the same callout rather than stacking.
 *
 * Exposed as `controller.rules.guard` (created inside `createControlRules`).
 *
 * Props read from `controller.props` on each call (always up to date):
 *   - `charGuard` — preset name (e.g. "numeric", "tel") or raw char class "[A-Z]"
 *   - `maxLengthGuard`    — maximum character count (enables both guard and constraint)
 */

import {
  getInvalidCharMessage,
  getInvalidCharsMessage,
  getLengthOverflowResult,
  getMaxLengthInsertionMessage,
} from "./prevent_invalid_input.js";
import {
  isNumericAllowedChars,
  resolveCharClass,
} from "./char_guard_presets.js";
import { createOpenToken } from "./rules/control_callout.js";

export const createInputGuard = (controller) => {
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
   * Called on keydown for a single printable character.
   * Returns true when the key should be blocked (caller must call e.preventDefault()).
   */
  const checkKeydown = (e, el) => {
    const { charGuard, maxLengthGuard } = controller.props;

    if (charGuard) {
      const charClass = resolveCharClass(charGuard);
      const isNumeric = isNumericAllowedChars(charGuard);
      const charMsg = getInvalidCharMessage(e.key, { charClass, isNumeric });
      if (charMsg) {
        show(charMsg, e);
        return true;
      }
    }
    if (maxLengthGuard !== undefined) {
      const lenMsg = getMaxLengthInsertionMessage(el, { maxLength: maxLengthGuard });
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
  const checkValue = (value, e) => {
    const { charGuard, maxLengthGuard } = controller.props;

    if (charGuard) {
      const charClass = resolveCharClass(charGuard);
      const isNumeric = isNumericAllowedChars(charGuard);
      const charsMsg = getInvalidCharsMessage(value, { charClass, isNumeric });
      if (charsMsg) {
        show(charsMsg, e);
        return { blocked: true };
      }
    }
    if (maxLengthGuard !== undefined) {
      const lengthResult = getLengthOverflowResult(value, { maxLength: maxLengthGuard });
      if (lengthResult) {
        show(lengthResult.message, e);
        return { fixedValue: lengthResult.fixedValue };
      }
    }
    clear(e);
    return null;
  };

  return { checkKeydown, checkValue, show, clear };
};
