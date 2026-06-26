/**
 * Shared callout manager for displaying constraint failure callouts on a control.
 *
 * Used by both:
 *  - `control_validation.js`  — invalid value (required, pattern, etc.)
 *  - `control_interaction.js` — interaction blocked (disabled, readonly, busy)
 *
 * Usage:
 *   const myToken = createOpenToken();
 *   calloutManager.addOpenToken(myToken, { message, status, anchorElement, event, skipFocus, onClose });
 *   calloutManager.removeOpenToken(myToken, event);
 *   calloutManager.requestCloseCallout(event, debugReason); // force-close all
 *   calloutManager.callout  // current open callout or null
 */

import {
  createPubSub,
  findFocusDelegateTarget,
  getElementSignature,
} from "@jsenv/dom";

import { openCallout } from "./callout/callout.js";

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
  { addTeardown, debugFocus, debugPopup } = {},
) => {
  const [notifyCalloutOpen, onCalloutOpen] = createPubSub();

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
        const [, remainingTokenData] = tokens.entries().next().value;
        callout.update(remainingTokenData.message, {
          status: remainingTokenData.status,
        });
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
    { message, status, anchorElement, event, skipFocus, onClose } = {},
  ) => {
    if (!message) {
      removeOpenToken(token, event);
      return;
    }
    const calloutOptions = {
      status,
      closeOnClickOutside: status !== "error",
    };

    tokens.set(token, { message, status, onClose });
    if (callout) {
      callout.update(message, calloutOptions);
      return;
    }
    const resolvedAnchorElement =
      anchorElement || controller.elementRef.current;
    const removeCloseOnCleanup = addTeardown?.(() => {
      requestCloseCallout(new CustomEvent("cleanup"), "cleanup");
    });
    // `openResults` is referenced in onClose which runs later — forward ref is intentional.
    let openResults = [];
    callout = openCallout(message, {
      ...calloutOptions,
      anchorElement: resolvedAnchorElement,
      openingEvent: event,
      skipFocus,
      debug: debugPopup,
      onClose: ({ event: closeEvent, shouldTransferFocusFromCallout }) => {
        removeCloseOnCleanup?.();
        for (const result of openResults) {
          if (typeof result === "function") {
            result();
          }
        }
        callout = null;
        // User dismissed the callout — notify all active tokens then clear.
        for (const [, tokenData] of tokens) {
          tokenData.onClose?.();
        }
        tokens.clear();
        const element = controller.elementRef.current;
        if (
          shouldTransferFocusFromCallout &&
          element &&
          !element.closest('[aria-hidden="true"]')
        ) {
          const focusTarget =
            findFocusDelegateTarget(resolvedAnchorElement) ||
            resolvedAnchorElement;
          debugFocus(
            closeEvent,
            `callout is closing with focus, give focus back to the control ${getElementSignature(focusTarget)}.focus()`,
          );
          focusTarget.focus();
        }
      },
    });
    // `onOpen` can be a createPubSub publisher — its return value is an array of cleanup fns.
    // Or just a plain callback — wrap the single return value in an array.
    openResults = notifyCalloutOpen(event);
  };

  const calloutManager = {
    onOpen: onCalloutOpen,
    addOpenToken,
    removeOpenToken,
    requestCloseCallout,
    get callout() {
      return callout;
    },
  };
  return calloutManager;
};
