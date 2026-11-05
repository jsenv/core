/**
 * A popup covered by a modal dialog is not in use, so it does not answer the
 * keyboard: a sheet raising one leaves what is behind it where it is, under the
 * keyboard like anything else behind that sheet.
 *
 * Two things make an open popup follow the keyboard, and both are held here for
 * as long as it is covered:
 * - its ceiling (--dialog-maxmax-height, --popover-maxmax-height), which CSS keeps
 *   tracking --navi-app-height. Written back resolved, inline. `freezeSize` cannot
 *   do it: a max-* wins over the width/height it writes;
 * - its placement, which reads the live viewport. Deferred, see
 *   deferPlacementWhileCovered.
 *
 * A popup uncovered answers the screen as it is, at once, with one
 * exception: a keyboard on its way out. It is still counted for a while after the
 * sheet closes (the browser takes its time, then --navi-vvh waits for the resize
 * to settle, see responsive.js), and answering that makes the popup jump up and
 * back down. A keyboard belongs to a focused field, so the focus says which case
 * this is: on a field the keyboard stays, anywhere else it is leaving and the
 * popup waits for the viewport to change. No timer: how long a keyboard takes to
 * leave is unknown, and a duration would also delay a keyboard that stays.
 *
 * Modal dialogs hold what is below them. What sits under a non-modal one is
 * still usable, and keeps following the keyboard. A top-layer popover can be
 * held and holds nothing: it follows its anchor, and that anchor may be inside
 * the popup below, whose rising is what carries a field in the popover above the
 * keyboard.
 */

import {
  getVirtualKeyboardOverlayHeight,
  subscribeVirtualKeyboardGeometryChange,
  subscribeVisualViewportResizeSettled,
} from "@jsenv/dom";

import { isEditableTarget } from "../box/pseudo_styles.js";
import { visualViewportHeightSignal } from "./responsive.js";

const coverStack = [];

/**
 * @param {HTMLElement} popupEl - The popup being shown.
 * @param {object} params
 * @param {string} params.ceiling - The custom property capping its height.
 * @param {boolean} params.holdsBelow - Whether it covers what is below it.
 * @param {() => void} params.place - Places the popup against the viewport as
 *   it is. Called on a popup that was held once it answers the viewport again.
 * @returns {() => void} To call when the popup closes.
 */
export const enterCoverStack = (popupEl, { ceiling, holdsBelow, place }) => {
  const entry = { popupEl, ceiling, holdsBelow, place, hold: null };
  if (holdsBelow) {
    // All of them: one under a popover was not held when that popover opened.
    for (const entryBelow of coverStack) {
      holdEntry(entryBelow);
    }
  }
  coverStack.push(entry);
  return () => {
    coverStack.splice(coverStack.indexOf(entry), 1);
    dropHold(entry);
    releaseUncovered({ closedPopupEl: popupEl });
  };
};

/**
 * Answers true when the popup must not be placed right now, and remembers to
 * place it on release.
 *
 * Only while the room differs from the one it was covered with: the placement
 * reads the live viewport whatever triggered it, so with the same room it lands
 * where the popup already is, and content growing under the sheet is answered
 * as usual.
 */
export const deferPlacementWhileCovered = (popupEl) => {
  const entry = coverStack.find((candidate) => candidate.popupEl === popupEl);
  if (!entry || !entry.hold) {
    return false;
  }
  if (readRoom() === entry.hold.room) {
    return false;
  }
  entry.hold.placementOwed = true;
  return true;
};

const holdEntry = (entry) => {
  if (entry.hold) {
    // Covered again before the keyboard had left: the ceiling it holds is still
    // the one it had before all of this.
    entry.hold.stopWaiting?.();
    entry.hold.stopWaiting = null;
    return;
  }
  const { place } = entry;
  holdCeiling(entry);
  entry.hold = {
    room: readRoom(),
    placementOwed: false,
    stopWaiting: null,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    // A rotation, which a covered dialog has to fit, is told from a keyboard by
    // the window's size: the keyboard leaves it alone (see safe_area.md). Read
    // once the visual viewport settles, not on the window's own resize: that one
    // can fire first, while --navi-vvh still describes the screen being left.
    stopWatchingWindow: subscribeVisualViewportResizeSettled(() => {
      const { hold } = entry;
      if (
        window.innerWidth === hold.windowWidth &&
        window.innerHeight === hold.windowHeight
      ) {
        return;
      }
      hold.windowWidth = window.innerWidth;
      hold.windowHeight = window.innerHeight;
      holdCeiling(entry);
      hold.room = readRoom();
      hold.placementOwed = false;
      place();
    }),
  };
};

// From the top down to the first popup that holds what is below it: nothing
// above covers any of these.
const releaseUncovered = ({ closedPopupEl }) => {
  for (let i = coverStack.length - 1; i >= 0; i--) {
    const entry = coverStack[i];
    releaseBackOnTop(entry, { closedPopupEl });
    if (entry.holdsBelow) {
      return;
    }
  }
};

const releaseBackOnTop = (entry, { closedPopupEl }) => {
  const { hold } = entry;
  if (!hold) {
    return;
  }
  // Already waiting when a popover above it closes in turn: this close asks again.
  hold.stopWaiting?.();
  hold.stopWaiting = null;
  // Nothing taken away, or a keyboard that stays: the room read here is the
  // screen as it is. A field in the popup that closed is one still leaving: a
  // popup leaving the tree only gives the focus back after the commit.
  const { activeElement } = document;
  if (
    readRoom() >= hold.room ||
    (isEditableTarget(activeElement) && !closedPopupEl.contains(activeElement))
  ) {
    release(entry);
    return;
  }
  // Any change, not the room it was covered with: the bars of a mobile browser
  // may come back different, and the wait would never end.
  const roomWithKeyboardLeaving = readRoom();
  const releaseIfViewportChanged = () => {
    if (readRoom() !== roomWithKeyboardLeaving) {
      release(entry);
    }
  };
  // The focus can come back after the close (a popup leaving the tree gives it
  // back once the commit is over), and the keyboard then stays after all.
  const releaseIfFieldFocused = () => {
    if (isEditableTarget(document.activeElement)) {
      release(entry);
    }
  };
  document.addEventListener("focusin", releaseIfFieldFocused, {
    capture: true,
  });
  const unsubscribes = [
    visualViewportHeightSignal.subscribe(releaseIfViewportChanged),
    subscribeVirtualKeyboardGeometryChange(releaseIfViewportChanged),
  ];
  hold.stopWaiting = () => {
    document.removeEventListener("focusin", releaseIfFieldFocused, {
      capture: true,
    });
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
  };
};

const release = (entry) => {
  const { placementOwed } = entry.hold;
  dropHold(entry);
  if (placementOwed) {
    entry.place();
  }
};

const dropHold = (entry) => {
  const { hold, popupEl, ceiling } = entry;
  if (!hold) {
    return;
  }
  hold.stopWaiting?.();
  hold.stopWatchingWindow();
  popupEl.style.removeProperty(ceiling);
  entry.hold = null;
};

// The declared ceiling rather than the used max-height: it is the one cap that
// follows the keyboard, and the other caps (maxHeight) keep their say. Its
// computed value has every var() resolved, so it stops following once written
// back. Registered with inherits: false, it does not reach a popup nested inside
// this one.
const holdCeiling = ({ popupEl, ceiling }) => {
  popupEl.style.removeProperty(ceiling);
  const value = getComputedStyle(popupEl).getPropertyValue(ceiling);
  popupEl.style.setProperty(ceiling, value);
};

// An overlaying keyboard leaves the viewport alone and arrives on its own.
const readRoom = () =>
  visualViewportHeightSignal.peek() - getVirtualKeyboardOverlayHeight();
