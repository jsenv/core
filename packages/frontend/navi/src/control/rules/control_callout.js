/**
 * Shared callout manager for displaying constraint failure callouts on a control.
 *
 * Used by both:
 *  - `control_validation.js`  — invalid value (required, pattern, etc.)
 *  - `control_interaction.js` — interaction blocked (disabled, readonly, busy)
 *
 * Usage:
 *   const calloutManager = createCalloutManager(controller, {
 *     addTeardown,
 *     debugFocus,
 *     debugCallout,
 *     onOpen,   // called after opening — returns array of cleanup fns (can be createPubSub publisher)
 *   });
 *
 *   calloutManager.openConstraintCallout(constraintInfo, { event, requester, skipFocus });
 *   calloutManager.closeCallout(event, reason);
 *   calloutManager.callout  // current open callout or null
 */

import { findFocusDelegateTarget, getElementSignature } from "@jsenv/dom";

import { openCallout } from "./callout/callout.js";
import { getConstraintMessage } from "./constraint_message.js";

/**
 * Creates a callout state manager for a controller.
 *
 * @param {object} controller - The UI state controller owning this callout.
 * @param {object} [options]
 * @param {Function} [options.addTeardown]   - Register a cleanup fn (called on controller unmount).
 * @param {Function} [options.debugFocus]    - Focus debug logger.
 * @param {Function} [options.debugPopup]  - Callout debug logger (passed as `debug` to openCallout).
 * @param {Function} [options.onOpen]        - Called after opening. May return an array of cleanup fns.
 */
export const createCalloutManager = (
  controller,
  { addTeardown, debugFocus, debugPopup, onOpen } = {},
) => {
  let callout = null;

  const closeCallout = (event, reason) => {
    if (!callout) {
      return false;
    }
    return callout.requestClose(event, reason);
  };

  const openConstraintCallout = (
    constraintInfo,
    { event, requester, skipFocus } = {},
  ) => {
    if (!constraintInfo) {
      closeCallout(event, "is_valid");
      return;
    }
    const { message } = getConstraintMessage(
      controller,
      constraintInfo.constraint,
      constraintInfo.message,
      { requester },
    );
    if (callout) {
      callout.update(message, { status: constraintInfo.status });
      return;
    }
    const anchorElement =
      constraintInfo.target || controller.elementRef.current;
    if (!skipFocus && !anchorElement.closest('[aria-hidden="true"]')) {
      const focusTarget =
        findFocusDelegateTarget(anchorElement) || anchorElement;
      debugFocus?.(
        event,
        `opening callout, give focus to anchor -> ${getElementSignature(focusTarget)}.focus()`,
      );
      focusTarget.focus();
    }
    const removeCloseOnCleanup = addTeardown?.(() => {
      closeCallout(new CustomEvent("cleanup"), "cleanup");
    });
    // `openResults` is referenced in onClose which runs later — forward ref is intentional.
    let openResults = [];
    callout = openCallout(message, {
      anchorElement,
      status: constraintInfo.status,
      openingEvent: event,
      debug: debugPopup,
      onClose: ({ event: closeEvent, focusWithinCallout }) => {
        removeCloseOnCleanup?.();
        for (const result of openResults) {
          if (typeof result === "function") {
            result();
          }
        }
        callout = null;
        if (constraintInfo) {
          constraintInfo.reportStatus = "closed";
        }
        const element = controller.elementRef.current;
        if (
          !skipFocus &&
          focusWithinCallout &&
          element &&
          !element.closest('[aria-hidden="true"]')
        ) {
          const focusTarget =
            findFocusDelegateTarget(anchorElement) || anchorElement;
          debugFocus?.(
            closeEvent,
            `callout is closing with focus, give focus back to the control ${getElementSignature(focusTarget)}.focus()`,
          );
          focusTarget.focus();
        }
      },
    });
    // `onOpen` can be a createPubSub publisher — its return value is an array of cleanup fns.
    // Or just a plain callback — wrap the single return value in an array.
    const rawResults = onOpen?.(event);
    if (Array.isArray(rawResults)) {
      openResults = rawResults;
    } else if (rawResults !== undefined) {
      openResults = [rawResults];
    }
    constraintInfo.reportStatus = "reported";
  };

  const calloutManager = {
    openConstraintCallout,
    closeCallout,
  };
  Object.defineProperty(calloutManager, "callout", {
    get: () => callout,
  });
  return calloutManager;
};
