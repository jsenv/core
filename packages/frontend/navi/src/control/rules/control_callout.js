/**
 * Shared callout manager for displaying constraint failure callouts on a control.
 *
 * Used by both:
 *  - `control_validation.js`  — invalid value (required, pattern, etc.)
 *  - `control_interaction.js` — interaction blocked (disabled, readonly, busy)
 *
 * Usage:
 *   const myToken = createOpenToken();
 *   calloutManager.addOpenToken(myToken, { constraint, event, requester, skipFocus });
 *   calloutManager.removeOpenToken(myToken, event);
 *   calloutManager.requestCloseCallout(event, debugReason); // force-close all
 *   calloutManager.callout  // current open callout or null
 */

import { findFocusDelegateTarget, getElementSignature } from "@jsenv/dom";

import { openCallout } from "./callout/callout.js";
import { getConstraintMessage } from "./constraint_message.js";

/**
 * Creates an opaque token used as a key for callout open reasons.
 * Each caller (validation, interaction, …) owns one token.
 */
export const createOpenToken = () => ({});

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
  // Tracks open tokens → their constraint info.
  // The callout closes automatically when the last token is removed.
  const tokens = new Map();

  // Remove a token. Closes the callout only when no tokens remain.
  // If other tokens are still active, updates the callout to show the first remaining one.
  const removeOpenToken = (token, event) => {
    if (!tokens.has(token)) {
      return false;
    }
    tokens.delete(token);
    if (tokens.size > 0) {
      if (callout) {
        const [, remainingConstraintInfo] = tokens.entries().next().value;
        const { message } = getConstraintMessage(
          controller,
          remainingConstraintInfo.constraint,
          remainingConstraintInfo.message,
          {},
        );
        callout.update(message, { status: remainingConstraintInfo.status });
      }
      return false;
    }
    if (!callout) {
      return false;
    }
    return callout.requestClose(event, "token_removed");
  };

  // Force-close the callout regardless of active tokens (teardown / external request).
  const requestCloseCallout = (event, debugReason) => {
    tokens.clear();
    if (!callout) {
      return false;
    }
    return callout.requestClose(event, debugReason);
  };

  const addOpenToken = (
    token,
    { constraint, event, requester, skipFocus } = {},
  ) => {
    if (!constraint) {
      removeOpenToken(token, event);
      return;
    }
    tokens.set(token, constraint);
    const { message } = getConstraintMessage(
      controller,
      constraint.constraint,
      constraint.message,
      { requester },
    );
    if (callout) {
      callout.update(message, { status: constraint.status });
      return;
    }
    const anchorElement = constraint.target || controller.elementRef.current;
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
      requestCloseCallout(new CustomEvent("cleanup"), "cleanup");
    });
    // `openResults` is referenced in onClose which runs later — forward ref is intentional.
    let openResults = [];
    callout = openCallout(message, {
      anchorElement,
      status: constraint.status,
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
        // User dismissed the callout — clear all tokens so it doesn't reopen spuriously.
        tokens.clear();
        if (constraint) {
          constraint.reportStatus = "closed";
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
    constraint.reportStatus = "reported";
  };

  const calloutManager = {
    addOpenToken,
    removeOpenToken,
    requestCloseCallout,
    get callout() {
      return callout;
    },
  };
  return calloutManager;
};
