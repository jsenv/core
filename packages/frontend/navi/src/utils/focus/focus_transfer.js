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

/**
 * Where the focus goes inside a container, in the order candidates are tried:
 * 1. [navi-autofocus] with a value of its own — "put it here";
 * 2. the first focusable that is not a fallback — what one came to do;
 * 3. the DEEPEST [navi-autofocus="fallback"] — "focus me if nothing inside me
 *    can", so a fallback holding another fallback yields to it. A slide says
 *    this about itself: it takes the keyboard only when it has nothing to
 *    offer, and never over what it contains;
 * 4. nothing, and the caller decides what that means.
 *
 * @param {HTMLElement} containerEl
 * @param {object} [options]
 * @param {(element: HTMLElement) => boolean} [options.exclude] - never land
 *   here (a slide's own way out, say).
 * @returns {{target: HTMLElement, reason: string}|undefined}
 */
export const findFocusTarget = (containerEl, { exclude } = {}) => {
  const skip = (element) =>
    isRestorableAutofocus(element) || Boolean(exclude?.(element));

  const asked = containerEl.querySelector(
    `[navi-autofocus]:not([navi-autofocus="fallback"]):not([navi-autofocus="restore"])`,
  );
  if (asked && !exclude?.(asked)) {
    // The mark is not always ON the focusable itself — a control puts it on the
    // box it renders, the field inside being what takes the keyboard.
    const askedFocusable = findFocusable(asked, { exclude });
    if (askedFocusable) {
      return { target: askedFocusable, reason: "navi-autofocus" };
    }
  }
  const focusable = findFocusable(containerEl, { exclude: skip });
  if (focusable) {
    return { target: focusable, reason: "first focusable element" };
  }
  const fallbacks = Array.from(
    containerEl.querySelectorAll(`[navi-autofocus="fallback"]`),
  );
  if (containerEl.matches?.(`[navi-autofocus="fallback"]`)) {
    // Last of all: querySelectorAll only looks at descendants, and the
    // container is the outermost fallback there is.
    fallbacks.push(containerEl);
  }
  const deepestFallback = fallbacks.find(
    (candidate) =>
      !exclude?.(candidate) &&
      !fallbacks.some(
        (other) => other !== candidate && candidate.contains(other),
      ),
  );
  if (deepestFallback) {
    const fallbackFocusable = findFocusable(deepestFallback, { exclude });
    if (fallbackFocusable) {
      return { target: fallbackFocusable, reason: "navi-autofocus fallback" };
    }
  }
  return undefined;
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
        const found = findFocusTarget(containerEl);
        if (found) {
          reason = found.reason;
          target = found.target;
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
      const restoreFocusVisible = isMatchingFocusVisible(focusedElement);
      focusedElement.focus({
        preventScroll: true,
        focusVisible: restoreFocusVisible,
      });
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
