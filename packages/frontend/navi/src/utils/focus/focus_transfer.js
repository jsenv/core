import { findFocusable, getElementSignature } from "@jsenv/dom";

import { isMatchingFocusVisible } from "@jsenv/navi/src/box/pseudo_styles.js";

/**
 * Decides which element receives focus when a container (popover, dialog, …)
 * opens, and gives it back to where it came from when the container closes.
 *
 * The [navi-autofocus] attribute (written by use_auto_focus.js) tunes where
 * focus lands. Candidates are tried in this order:
 * 1. The element that held focus when the container was last closed, if it
 *    opted into that with "fallback" or "restore"
 * 2. [navi-autofocus] with any other value ("" for a plain `autoFocus`)
 * 3. The first focusable element
 * 4. [navi-autofocus="fallback"], the container itself included
 * 5. The element focused before the container opened
 *
 * [navi-autofocus="restore"] appears in step 1 only: it never claims focus on
 * a fresh open, it only gets it back.
 */

// The element that held focus when a container closed is marked with
// [navi-autofocus-last-focused], and its container with
// [navi-autofocus-restore]. Both carry the same generated id: containers can
// nest (a popover inside a dialog), so the id is what tells a reopening
// container which mark among its descendants is its own.
let restoreIdCounter = 0;

const isRestorableAutofocus = (el) => {
  const value = el.getAttribute("navi-autofocus");
  return value === "fallback" || value === "restore";
};

const clearAutofocusRestore = (containerEl) => {
  const restoreId = containerEl.getAttribute("navi-autofocus-restore");
  if (restoreId === null) {
    return null;
  }
  containerEl.removeAttribute("navi-autofocus-restore");
  const selector = `[navi-autofocus-last-focused="${restoreId}"]`;
  const lastFocused = containerEl.matches(selector)
    ? containerEl
    : containerEl.querySelector(selector);
  if (lastFocused) {
    lastFocused.removeAttribute("navi-autofocus-last-focused");
  }
  return lastFocused;
};

export const markAutofocusRestoreOnClose = (containerEl) => {
  clearAutofocusRestore(containerEl);
  const focused = document.activeElement;
  if (
    focused &&
    (containerEl === focused || containerEl.contains(focused)) &&
    isRestorableAutofocus(focused)
  ) {
    const restoreId = `${++restoreIdCounter}`;
    containerEl.setAttribute("navi-autofocus-restore", restoreId);
    focused.setAttribute("navi-autofocus-last-focused", restoreId);
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
      const lastFocused = clearAutofocusRestore(containerEl);
      if (lastFocused) {
        reason = "element focused when closed (restore)";
        target = lastFocused;
      }
      if (!target) {
        const naviAutoFocus = containerEl.querySelector(
          `[navi-autofocus]:not([navi-autofocus="fallback"]):not([navi-autofocus="restore"])`,
        );
        if (naviAutoFocus) {
          reason = "navi-autofocus";
          target = naviAutoFocus;
        }
      }
      if (!target) {
        const focusable = findFocusable(containerEl, {
          exclude: isRestorableAutofocus,
        });
        if (focusable) {
          reason = "first focusable element";
          target = focusable;
        }
      }
      if (!target) {
        // A [navi-autofocus="fallback"] INSIDE the container (e.g. a search
        // input) wins over the container itself. The container is only the
        // fallback-of-the-fallback: a focusable popup root gets focus solely
        // when nothing inside it already carries the fallback. (matches() covers
        // the container-only case since querySelector searches descendants only.)
        const naviAutoFocusFallback =
          containerEl.querySelector(`[navi-autofocus="fallback"]`) ||
          (containerEl.matches(`[navi-autofocus="fallback"]`)
            ? containerEl
            : null);
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
