/**
 * Creates an input guard that enforces character and length constraints during typing,
 * paste, and external value sets.
 *
 * The guard owns a single callout token (shared across all rejection reasons) so
 * successive rejections update the same callout rather than stacking.
 *
 * Usage: `uiStateController.inputGuard = createInputGuard(uiStateController)`
 * (created after `uiStateController.rules` is available)
 *
 * Props read from `controller.props` on each call (always up to date):
 *   - `preventInvalidInput`  — block chars that don't match `inputMode`/`allowedChars`
 *   - `preventLengthOverflow` — block/autofix values that exceed `maxLength`
 *   - `inputMode`             — "numeric" → digits only
 *   - `allowedChars`          — regex character class, e.g. "[0-9A-Z ]"
 *   - `maxLength`             — maximum allowed character count
 *   - `maxLengthAutofix`      — truncate instead of blocking on paste/set
 */

import {
  getInvalidCharMessage,
  getInvalidCharsMessage,
  getLengthOverflowResult,
  getMaxLengthInsertionMessage,
} from "./prevent_invalid_input.js";
import { createOpenToken } from "./rules/control_callout.js";

export const createInputGuard = (controller) => {
  const token = createOpenToken();

  const show = (message, e) => {
    controller.rules.callout.addOpenToken(token, {
      message,
      status: "warning",
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
    const { preventInvalidInput, inputMode, allowedChars, preventLengthOverflow, maxLength } =
      controller.props;

    if (preventInvalidInput) {
      const charMsg = getInvalidCharMessage(e.key, { inputMode, allowedChars });
      if (charMsg) {
        show(charMsg, e);
        return true;
      }
    }
    if (preventLengthOverflow) {
      const lenMsg = getMaxLengthInsertionMessage(el, { maxLength });
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
   *   { fixedValue }  — value was truncated to maxLength (callout shown as info)
   */
  const checkValue = (value, e) => {
    const {
      preventInvalidInput,
      inputMode,
      allowedChars,
      preventLengthOverflow,
      maxLength,
      maxLengthAutofix,
    } = controller.props;

    if (preventInvalidInput) {
      const charsMsg = getInvalidCharsMessage(value, { inputMode, allowedChars });
      if (charsMsg) {
        show(charsMsg, e);
        return { blocked: true };
      }
    }
    if (preventLengthOverflow) {
      const lengthResult = getLengthOverflowResult(value, { maxLength, maxLengthAutofix });
      if (lengthResult) {
        show(lengthResult.message, e);
        if (lengthResult.fixedValue !== undefined) {
          return { fixedValue: lengthResult.fixedValue };
        }
        return { blocked: true };
      }
    }
    clear(e);
    return null;
  };

  return { checkKeydown, checkValue, show, clear };
};
