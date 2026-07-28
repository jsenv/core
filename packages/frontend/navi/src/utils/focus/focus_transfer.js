import { findFocusable, getElementSignature } from "@jsenv/dom";

import { isMatchingFocusVisible } from "@jsenv/navi/src/box/pseudo_styles.js";

/**
 * Mirrors what browsers do when navigating to a page:
 * 1. Focus the first element with [navi-autofocus] (but not [navi-autofocus="fallback"]) inside the container
 * 2. Fall back to the first focusable element
 * 3. Fall back to the first element with [navi-autofocus="fallback"]
 * Does nothing if no candidate is found.
 */
export const markAutofocusRestoreOnClose = (containerEl) => {
  const focused = document.activeElement;
  if (
    focused &&
    containerEl.contains(focused) &&
    focused.getAttribute("navi-autofocus") === "fallback"
  ) {
    containerEl.setAttribute("navi-autofocus-restore", "");
  } else {
    containerEl.removeAttribute("navi-autofocus-restore");
  }
};

export const prepareFocusTransfer = (prepareEvent, debugFocus) => {
  const focusedElement = getFocusedBeforeTransfer(prepareEvent);
  const focusVisible = isMatchingFocusVisible(focusedElement);

  debugFocus(
    prepareEvent,
    `prepare focus transfer from`,
    focusedElement,
    focusVisible ? " matching :focus-visible" : "not matching :focus-visible",
  );

  return {
    focusedElement,
    focusVisible,

    transferFocus: (transferEvent, containerEl) => {
      let target;
      let reason;
      if (containerEl.hasAttribute("navi-autofocus-restore")) {
        containerEl.removeAttribute("navi-autofocus-restore");
        const naviAutoFocusFallback = containerEl.querySelector(
          "[navi-autofocus='fallback']",
        );
        if (naviAutoFocusFallback) {
          reason = "navi-autofocus fallback (restore)";
          target = naviAutoFocusFallback;
        }
      }
      if (!target) {
        const naviAutoFocus = containerEl.querySelector(
          "[navi-autofocus]:not([navi-autofocus='fallback'])",
        );
        if (naviAutoFocus) {
          reason = "navi-autofocus";
          target = naviAutoFocus;
        }
      }
      if (!target) {
        const focusable = findFocusable(containerEl, {
          exclude: (el) => el.getAttribute("navi-autofocus") === "fallback",
        });
        if (focusable) {
          reason = "first focusable element";
          target = focusable;
        }
      }
      if (!target) {
        // querySelector only searches descendants — but the container itself may
        // carry [navi-autofocus="fallback"] (a focusable popup root with nothing
        // else to focus). It's fine to focus the container in that case.
        const naviAutoFocusFallback = containerEl.matches(
          `[navi-autofocus="fallback"]`,
        )
          ? containerEl
          : containerEl.querySelector(`[navi-autofocus="fallback"]`);
        if (naviAutoFocusFallback) {
          reason = "navi-autofocus fallback";
          target = naviAutoFocusFallback;
        }
      }
      if (!target) {
        if (focusedElement) {
          reason = "focused element before open (fallback)";
          target = focusedElement;
        }
      }
      if (!target) {
        return;
      }
      debugFocus(
        transferEvent,
        `Moving focus to ${getElementSignature(target)}.focus({ preventScroll: true, focusVisible: ${focusVisible} }) (reason: ${reason})`,
      );
      target.focus({
        preventScroll: true,
        focusVisible,
      });
      if (target.hasAttribute("navi-autofocus-select")) {
        target.select();
        target.scrollLeft = 0;
      }
    },

    restoreFocus: (restoreEvent) => {
      debugFocus(
        restoreEvent,
        `restore focus to previously focused element`,
        focusedElement,
      );
      focusedElement.focus({ preventScroll: true });
    },
  };
};

// Get the active element before we transfer focus in the popover/dialog
// We don't just use document.activeElement because when dialog is opened by mousedown
// we prevent default so browser don't steal focus back from the dialog
// meaning the focus did not yet reach the element receiving the mousedown
// as a result document.activeElement is not up-to-date (can be document.body for instance)
const getFocusedBeforeTransfer = (e) => {
  const initiator =
    e.detail && e.detail.eventChain ? e.detail.eventChain[0] : null;
  if (initiator) {
    if (initiator.type === "mousedown") {
      // if we we had let browser give focus, the element would be the one that would be focused
      return initiator.currentTarget;
    }
    if (initiator.type === "click") {
      // label use case
      return initiator.currentTarget;
    }
  }
  return document.activeElement;
};
