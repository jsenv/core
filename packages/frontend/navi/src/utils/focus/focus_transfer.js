import { findFocusable, getElementSignature } from "@jsenv/dom";

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

// Get the active element before we transfer focus in the popover/dialog
// We don't just use document.activeElement because when dialog is opened by mousedown
// we prevent default so browser don't steal focus back from the dialog
// meaning the focus did not yet reach the element receiving the mousedown
// as a result document.activeElement is not up-to-date (can be document.body for instance)
export const getFocusedBeforeTransfer = (e) => {
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

export const transferFocus = (containerEl, debugFocus, e, fallback) => {
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
    const naviAutoFocusFallback = containerEl.querySelector(
      "[navi-autofocus='fallback']",
    );
    if (naviAutoFocusFallback) {
      reason = "navi-autofocus fallback";
      target = naviAutoFocusFallback;
    }
  }
  if (!target) {
    if (fallback) {
      reason = "focused element before open (fallback)";
      target = fallback;
    }
  }
  if (!target) {
    return;
  }
  debugFocus(
    e,
    `Moving focus to ${getElementSignature(target)}.focus({ preventScroll: true }) (reason: ${reason})`,
  );
  target.focus({ preventScroll: true });
  if (target.hasAttribute("navi-autofocus-select")) {
    target.select();
    target.scrollLeft = 0;
  }
};
