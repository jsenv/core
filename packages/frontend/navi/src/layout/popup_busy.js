/**
 * What a popup asks before it closes: is anything inside it mid-action, and may
 * the person waiting call that wait off.
 *
 * A popup carries no state of its own — it is layout (see dialog.jsx's top
 * comment) — so it walks the controls it contains and asks each one. Asked
 * rather than read off `aria-busy`, which is a render snapshot: BUSY_CONSTRAINT
 * answers live.
 *
 * `Dialog` and `Popover` both read this way and read it identically, so it
 * lives here rather than in each of them: the answer decides whether a close
 * request goes through, and the two must not drift on that.
 */

import {
  BUSY_CONSTRAINT,
  abortControlRun,
} from "../control/rules/interaction/busy_constraint.js";

/**
 * The controls keeping `popupEl` open: mid-action, and not saying the wait is
 * their own. `ignoredByParents` is that saying (`actionStandalone`) — a popup
 * is one more ancestor such a control does not hold, the same reading a group
 * makes of it (see control_interaction.js).
 */
export const findControlsHoldingPopup = (popupEl) => {
  const controlsHolding = [];
  for (const element of popupEl.querySelectorAll("[navi-control-host]")) {
    const controller = element.__uiStateController__;
    if (!controller) {
      continue;
    }
    const busyInfo = BUSY_CONSTRAINT.check(controller);
    if (busyInfo && !busyInfo.ignoredByParents) {
      controlsHolding.push({
        element,
        controller,
        abortable: busyInfo.abortable,
      });
    }
  }
  return controlsHolding;
};

/**
 * Give up on every run holding the popup, so that closing may go through.
 *
 * All or nothing: calling off one run while another still keeps the popup shut
 * would cost an answer and change nothing on screen. Several of these controls
 * usually share one run — a form and the fields and submit inside it — and the
 * ones asked after it has been called off simply find nothing to call off.
 */
export const giveUpOnControlsHoldingPopup = (controlsHolding, reason) => {
  for (const controlHolding of controlsHolding) {
    if (!controlHolding.abortable) {
      return false;
    }
  }
  for (const controlHolding of controlsHolding) {
    abortControlRun(controlHolding.controller, reason);
  }
  return true;
};
