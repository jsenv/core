/**
 * Shared callout manager for displaying constraint failure callouts on a control.
 *
 * Used by both:
 *  - `control_validation.js`  — invalid value (required, pattern, etc.)
 *  - `control_interaction.js` — interaction blocked (disabled, readonly, busy)
 *
 * Usage:
 *   const myToken = createOpenToken();
 *   calloutManager.addOpenToken(myToken, { message, status, testId, anchorElement, event, skipFocus, onClose });
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

// The close reason the manager gives itself when the callout has to be drawn on
// another element: it tears the callout down and opens it again, and this is
// what tells that apart from the callout being dismissed.
const MOVING_TO_ANOTHER_ANCHOR = "moving_to_another_anchor";

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
  // Where the open callout is drawn. What a token points at is compared against
  // it to know whether showing that token is a new message on the same element
  // or the same conversation moving to another one.
  let calloutAnchorElement = null;
  // Tracks open tokens → their constraint info.
  // The callout closes automatically when the last token is removed.
  const tokens = new Map();

  const openCalloutForToken = (tokenData, event) => {
    const { anchorElement } = tokenData;
    calloutAnchorElement = anchorElement;
    const removeCloseOnCleanup = addTeardown?.(() => {
      requestCloseCallout(new CustomEvent("cleanup"), "cleanup");
    });
    // `openResults` is referenced in onClose which runs later — forward ref is intentional.
    let openResults = [];
    callout = openCallout(tokenData.message, {
      status: tokenData.status,
      testId: tokenData.testId,
      icon: tokenData.icon,
      closeButton: tokenData.closeButton,
      closeOnClickOutside: tokenData.status !== "error",
      anchorElement,
      openingEvent: event,
      skipFocus: tokenData.skipFocus,
      debug: debugPopup,
      onClose: ({
        event: closeEvent,
        reason,
        shouldTransferFocusFromCallout,
      }) => {
        removeCloseOnCleanup?.();
        for (const result of openResults) {
          if (typeof result === "function") {
            result();
          }
        }
        callout = null;
        calloutAnchorElement = null;
        if (reason === MOVING_TO_ANOTHER_ANCHOR) {
          // The control still has the same things to say, on another element:
          // the tokens stand and nothing was dismissed, so neither the token
          // callbacks nor the focus hand-back below apply.
          return;
        }
        // User dismissed the callout — notify all active tokens then clear.
        // Told what closed it: a token whose content is a popup of its own (a
        // picker in callout mode) closes that popup on the same event.
        for (const [, otherTokenData] of tokens) {
          otherTokenData.onClose?.({ event: closeEvent, reason });
        }
        tokens.clear();
        const element = controller.ref.current;
        if (
          shouldTransferFocusFromCallout &&
          element &&
          !element.closest('[aria-hidden="true"]')
        ) {
          const focusTarget =
            findFocusDelegateTarget(anchorElement) || anchorElement;
          debugFocus(
            closeEvent,
            `callout is closing with focus, give focus back to the control ${getElementSignature(focusTarget)}.focus()`,
          );
          focusTarget.focus();
        }
      },
    });
    openResults = notifyCalloutOpen(event);
  };

  // What a token has to say, drawn where that token points. A control has one
  // callout, so a token takes it over from whoever held it — and a token about
  // another element (an action refused about the row that was pressed, on a
  // list that owns the action) moves it there, because a sentence about a row
  // drawn on the list is a sentence pointing at the wrong thing.
  const showToken = (tokenData, event) => {
    if (tokenData.anchorElement && !tokenData.anchorElement.isConnected) {
      // What the token pointed at has left the page — a row removed while its
      // refusal was still waiting behind another one. There is nothing left to
      // draw on there, and the control holding the token is still here, so it
      // takes it (same rule as an action error whose requester is gone, see
      // use_execute_action.js).
      tokenData.anchorElement = controller.ref.current;
    }
    if (callout) {
      if (tokenData.anchorElement === calloutAnchorElement) {
        callout.update(tokenData.message, {
          status: tokenData.status,
          testId: tokenData.testId,
          icon: tokenData.icon,
          closeButton: tokenData.closeButton,
        });
        return;
      }
      callout.requestClose(event, MOVING_TO_ANOTHER_ANCHOR);
    }
    openCalloutForToken(tokenData, event);
  };

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
        showToken(remainingTokenData, event);
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
    {
      message,
      status,
      testId,
      icon,
      closeButton,
      anchorElement,
      event,
      skipFocus,
      onClose,
    } = {},
  ) => {
    if (!message) {
      removeOpenToken(token, event);
      return;
    }
    const tokenData = {
      message,
      status,
      testId,
      icon,
      closeButton,
      skipFocus,
      onClose,
      // Resolved as the token is added, and kept with it: a token shown later
      // (when the one covering it goes) must be drawn where it was pointing at
      // the time, and the control itself is where a token pointing nowhere goes.
      //
      // Unless the control has somewhere better to send it, which is why it is
      // given the event: a control drawn by something else — a list row whose
      // selection is a visually hidden checkbox — answers for a whole box, and
      // the sentence belongs where the press landed inside it rather than in
      // its middle (see getCalloutAnchorElement in list_selectable.jsx).
      anchorElement:
        anchorElement ||
        controller.getCalloutAnchorElement?.(event) ||
        controller.ref.current,
    };
    tokens.set(token, tokenData);
    showToken(tokenData, event);
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
