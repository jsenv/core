/**
 * A modal dialog covered by another modal dialog is not in use, so it does not
 * answer the keyboard: a sheet raising one leaves what is behind it where it
 * is, under the keyboard like anything else behind that sheet.
 *
 * Two things make an open dialog follow the keyboard, and both are held here
 * for as long as it is covered:
 * - its ceiling (--dialog-maxmax-height), which CSS keeps tracking
 *   --navi-app-height. Written back resolved, inline. `freezeSize` cannot do it:
 *   a max-* wins over the width/height it writes;
 * - its placement, which reads the live viewport. Deferred, see
 *   deferPlacementWhileCovered.
 *
 * A dialog back on top answers the screen as it is, at once, with one exception:
 * a keyboard on its way out. It is still counted for a while after the sheet
 * closes (the browser takes its time, then --navi-vvh waits for the resize to
 * settle, see responsive.js), and answering that makes the dialog jump up and
 * back down. A keyboard belongs to a focused field, so the focus says which case
 * this is: on a field the keyboard stays, anywhere else it is leaving and the
 * dialog waits for the viewport to change. No timer: how long a keyboard takes
 * to leave is unknown, and a duration would also delay a keyboard that stays.
 *
 * Only modal dialogs stack here. What sits under a non-modal one is still
 * usable, and keeps following the keyboard.
 */

import {
  getVirtualKeyboardOverlayHeight,
  subscribeVirtualKeyboardGeometryChange,
  subscribeVisualViewportResizeSettled,
} from "@jsenv/dom";

import { isEditableTarget } from "../box/pseudo_styles.js";
import { visualViewportHeightSignal } from "./responsive.js";

const CEILING = "--dialog-maxmax-height";

const modalStack = [];

/**
 * @param {HTMLDialogElement} dialogEl - The modal dialog being shown.
 * @param {object} params
 * @param {() => void} params.place - Places the dialog against the viewport as
 *   it is. Called on a dialog that was held once it answers the viewport again.
 * @returns {() => void} To call when the dialog closes.
 */
export const enterModalStack = (dialogEl, { place }) => {
  const entry = { dialogEl, place, hold: null };
  const entryBelow = modalStack.at(-1);
  if (entryBelow) {
    holdEntry(entryBelow);
  }
  modalStack.push(entry);
  return () => {
    const index = modalStack.indexOf(entry);
    const wasOnTop = index === modalStack.length - 1;
    modalStack.splice(index, 1);
    dropHold(entry);
    if (wasOnTop && modalStack.length > 0) {
      releaseBackOnTop(modalStack.at(-1), { closedDialogEl: dialogEl });
    }
  };
};

/**
 * Answers true when the dialog must not be placed right now, and remembers to
 * place it on release.
 *
 * Only while the room differs from the one it was covered with: the placement
 * reads the live viewport whatever triggered it, so with the same room it lands
 * where the dialog already is, and content growing under the sheet is answered
 * as usual.
 */
export const deferPlacementWhileCovered = (dialogEl) => {
  const entry = modalStack.find((candidate) => candidate.dialogEl === dialogEl);
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
  const { dialogEl, place } = entry;
  holdCeiling(dialogEl);
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
      holdCeiling(dialogEl);
      hold.room = readRoom();
      hold.placementOwed = false;
      place();
    }),
  };
};

const releaseBackOnTop = (entry, { closedDialogEl }) => {
  const { hold } = entry;
  if (!hold) {
    return;
  }
  // Nothing taken away, or a keyboard that stays: the room read here is the
  // screen as it is. A field in the dialog that closed is one still leaving: a
  // dialog leaving the tree only gives the focus back after the commit.
  const { activeElement } = document;
  if (
    readRoom() >= hold.room ||
    (isEditableTarget(activeElement) && !closedDialogEl.contains(activeElement))
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
  const { hold, dialogEl } = entry;
  if (!hold) {
    return;
  }
  hold.stopWaiting?.();
  hold.stopWatchingWindow();
  dialogEl.style.removeProperty(CEILING);
  entry.hold = null;
};

// The declared ceiling rather than the used max-height: it is the one cap that
// follows the keyboard, and the other caps (maxHeight) keep their say. Its
// computed value has every var() resolved, so it stops following once written
// back. Registered with inherits: false, it does not reach a dialog nested
// inside this one.
const holdCeiling = (dialogEl) => {
  dialogEl.style.removeProperty(CEILING);
  const ceiling = getComputedStyle(dialogEl).getPropertyValue(CEILING);
  dialogEl.style.setProperty(CEILING, ceiling);
};

// An overlaying keyboard leaves the viewport alone and arrives on its own.
const readRoom = () =>
  visualViewportHeightSignal.peek() - getVirtualKeyboardOverlayHeight();
