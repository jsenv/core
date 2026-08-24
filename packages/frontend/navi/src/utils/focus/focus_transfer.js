import { findEvent, findFocusable, getElementSignature } from "@jsenv/dom";

import {
  isEditableTarget,
  isKeyboardModality,
} from "@jsenv/navi/src/box/pseudo_styles.js";
import { coarsePointerSignal } from "@jsenv/navi/src/layout/responsive.js";

/**
 * Decides which element receives focus when a container (popover, dialog, …)
 * opens, and gives it back to where it came from when the container closes.
 *
 * The [navi-autofocus] attribute (written by use_auto_focus.js) tunes where
 * focus lands. Candidates are tried in this order:
 * 1. The element that held focus when the container was last closed
 * 2. [navi-autofocus] asking for it ("" for a plain `autoFocus`)
 * 3. The first focusable element
 * 4. [navi-autofocus="last-resort"], the container itself included
 * 5. The element focused before the container opened
 *
 * [navi-autofocus="restore"] appears in step 1 only: it never claims focus on
 * a fresh open, it only gets it back.
 *
 * A ladder that comes back empty — a container holding nothing focusable yet —
 * places no focus, and says so on the container ([navi-autofocus-unplaced]),
 * because content arriving a moment later would otherwise stand aside for a
 * transfer that never happened (see claimUnplacedAutofocus).
 */

// The element that held focus when a container closed is marked with
// [navi-autofocus-last-focused], and its container with
// [navi-autofocus-restore]. Both carry the same generated id: containers can
// nest (a popover inside a dialog), so the id is what tells a reopening
// container which mark among its descendants is its own.
let restoreIdCounter = 0;

// The values that never ASK for the focus: one takes it for want of anything
// better ("last-resort"), the other only takes it back ("restore"). What they
// have in common is being worth giving back to — a container that was holding
// the keyboard itself, a field that said it wants it, are both places one was,
// and coming back to where one was is the whole point of a restore.
const isRestorableAutofocus = (el) => {
  const value = el.getAttribute("navi-autofocus");
  return value === "last-resort" || value === "restore";
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

// An opening whose transfer had nothing to give: the ladder came back empty, or
// only found somewhere outside the container to leave the focus (see
// transferFocus). Nothing inside was focused, so nothing inside owes the
// opening anything either — what mounts or gets displayed right after may
// claim the focus with its own autofocus (see use_auto_focus.js), instead of
// standing aside for a transfer that placed nothing.
const AUTOFOCUS_UNPLACED_ATTRIBUTE = "navi-autofocus-unplaced";

/**
 * "Did this container's opening leave the focus unplaced, and may I take it?" —
 * asked by whatever appears inside it right after. Answering yes settles the
 * debt: the first to ask is the one the opening was missing, and the ones after
 * it are content appearing alongside, which has no more claim than usual.
 *
 * @param {HTMLElement} containerEl
 * @returns {boolean}
 */
export const claimUnplacedAutofocus = (containerEl) => {
  if (!containerEl.hasAttribute?.(AUTOFOCUS_UNPLACED_ATTRIBUTE)) {
    return false;
  }
  containerEl.removeAttribute(AUTOFOCUS_UNPLACED_ATTRIBUTE);
  return true;
};

/**
 * "When the focus comes back here, put it on this" — what transferFocus reads
 * first when it next hands the focus to that container.
 *
 * Told rather than watched: whoever is about to take the focus away is the one
 * moment that still knows what was holding it.
 */
export const markAutofocusRestore = (containerEl, element) => {
  clearAutofocusRestore(containerEl);
  if (!element || !(containerEl === element || containerEl.contains(element))) {
    return;
  }
  const restoreId = `${++restoreIdCounter}`;
  containerEl.setAttribute("navi-autofocus-restore", restoreId);
  element.setAttribute("navi-autofocus-last-focused", restoreId);
};

// A popup closing remembers what held the focus, so reopening comes back to
// it — re-focusing where the user was takes priority over any autofocus the
// contents declare (see transferFocus). One exception: the element the closing
// pointer itself pressed (a close button, an option whose click dismissed the
// popup) is remembered only if it asked to be (restorable) — reopening a
// dialog on the button one pressed to leave it would be surprising. A keyboard
// close (Escape) designates no element, so whatever holds the focus is
// remembered as where the user was.
export const markAutofocusRestoreOnClose = (
  containerEl,
  closeEvent,
  // Received rather than read here: by the time the close cleanups run, the
  // closing itself may have moved the focus already (a native <dialog>.close()
  // hands it back to what held it at showModal() time) — the caller captured
  // it when the close was decided.
  focused = document.activeElement,
) => {
  clearAutofocusRestore(containerEl);
  if (!focused || !(containerEl === focused || containerEl.contains(focused))) {
    return;
  }
  if (!isRestorableAutofocus(focused)) {
    const pointerEvent = closeEvent
      ? findEvent(closeEvent, "mousedown") || findEvent(closeEvent, "click")
      : null;
    if (pointerEvent) {
      const pointerTarget = pointerEvent.target;
      if (
        pointerTarget &&
        (focused === pointerTarget || focused.contains(pointerTarget))
      ) {
        return;
      }
    }
  }
  markAutofocusRestore(containerEl, focused);
};

/**
 * Where the focus goes inside a container, in the order candidates are tried:
 * 1. the first [navi-autofocus] that leads somewhere focusable — "put it here";
 * 2. the first focusable that asks for nothing in particular — what one came to
 *    do;
 * 3. the DEEPEST [navi-autofocus="last-resort"], the container itself included
 *    — "not me, unless you have nothing else". Deepest first, because of two
 *    nested ones the inner is the more precise answer: a dialog holding a panel
 *    holding a close button lands on the button, not on the dialog;
 * 4. nothing, and the caller decides what that means.
 *
 * One word covers both readings of "last resort", because they are the same
 * sentence said by different elements. On a FOCUSABLE — a picker's search box,
 * a panel's close button, a slide's chevron — it means "prefer anything else in
 * here to me". On a CONTAINER — a dialog, a popover, a slide — it means the
 * same about its own contents, and those contents being tried first (step 2
 * walks them) is exactly what makes the container a last resort.
 *
 * @param {HTMLElement} containerEl
 * @param {object} [options]
 * @param {boolean} [options.skipFirstFocusable]
 *   Drops step 2 — the focus then goes where something ASKED for it, or to the
 *   last resort, which for a container is itself. What arrives is read before
 *   it is reached: the first focusable is wherever the content happens to put
 *   it, so landing there scrolls whatever comes before it out of sight.
 *   transferFocus turns this on by itself wherever the keyboard is a virtual
 *   one — see the reasoning there.
 * @returns {{target: HTMLElement, reason: string}|undefined}
 */
export const findFocusTarget = (containerEl, { skipFirstFocusable } = {}) => {
  // Not while there is anything else: what takes the focus only for want of
  // anything better ("last-resort") and what only takes it back ("restore").
  // Neither is dropped, both are simply tried later — step 3 below for the
  // first, and for the second the restore transferFocus does before ever
  // calling here.
  //
  // Skipped for good, unlike the two above: an element hidden from assistive
  // technology is not a place the focus can land at all. Something aria-hidden
  // and out of the tab order is a value holder standing behind what one
  // actually uses — a spin's headless picker behind its slides, say — and
  // landing there puts a ring on it, raises a phone's keyboard over the panel
  // that just opened, and has the browser complain about a focused aria-hidden
  // element. What one came to use is further down the same container.
  const isHiddenFromAssistiveTech = (element) =>
    Boolean(element.closest?.(`[aria-hidden="true"]`));

  const skip = (element) =>
    isRestorableAutofocus(element) || isHiddenFromAssistiveTech(element);

  // Every mark, not just the first: a mark is only worth stopping at if it
  // leads somewhere focusable. One inside a screen waiting its turn (an inert
  // slide) says where the focus goes WHEN it arrives there, not now — so it is
  // passed over here rather than treated as an answer that then fails silently.
  //
  // The container's own mark comes last among the asked, and querySelectorAll
  // does not return it: a surface saying "the keyboard stops on me" is answered
  // by anything inside it that named itself, the more precise answer winning.
  const askedList = Array.from(
    containerEl.querySelectorAll(`[navi-autofocus]`),
  );
  if (containerEl.matches?.(`[navi-autofocus]`)) {
    askedList.push(containerEl);
  }
  for (const asked of askedList) {
    if (skip(asked)) {
      continue;
    }
    // Through findFocusable: the mark is not always ON the focusable itself — a
    // control puts it on the box it renders, the field inside being what takes
    // the keyboard — and it is also what answers "can this be focused at all"
    // (inert, hidden, disabled).
    const askedFocusable = findFocusable(asked, { exclude: skip });
    if (askedFocusable) {
      return { target: askedFocusable, reason: "navi-autofocus" };
    }
  }
  if (!skipFirstFocusable) {
    const focusable = findFocusable(containerEl, { exclude: skip });
    if (focusable) {
      return { target: focusable, reason: "first focusable element" };
    }
  }
  const lastResorts = Array.from(
    containerEl.querySelectorAll(`[navi-autofocus="last-resort"]`),
  );
  if (containerEl.matches?.(`[navi-autofocus="last-resort"]`)) {
    // Last of all: querySelectorAll only looks at descendants, and the
    // container is the outermost last resort there is.
    lastResorts.push(containerEl);
  }
  const deepestLastResort = lastResorts.find(
    (candidate) =>
      !lastResorts.some(
        (other) => other !== candidate && candidate.contains(other),
      ),
  );
  if (deepestLastResort) {
    const lastResortFocusable = findFocusable(deepestLastResort);
    if (lastResortFocusable) {
      return {
        target: lastResortFocusable,
        reason: "navi-autofocus last-resort",
      };
    }
  }
  return undefined;
};

export const prepareFocusTransfer = (prepareEvent, debugFocus) => {
  const focusedElement = getFocusedBeforeTransfer(prepareEvent);
  // Whether what receives the focus shows a ring: the modality of the
  // interaction asking for the transfer, not the state of the element handing
  // it over. That element is often no witness at all — a popup opened from a
  // trigger whose mousedown we prevented keeps a :focus-visible nobody can see,
  // and a slide handing over to the next one was itself focused programmatically
  // without a ring, so it would report "no ring" for a travel asked for with
  // ArrowLeft. The modality answers "was the user on the keyboard when this was
  // asked for", which is the whole question (see isKeyboardModality).
  const focusVisible = isKeyboardModality();

  debugFocus(
    prepareEvent,
    `prepare focus transfer from`,
    focusedElement,
    focusVisible ? " matching :focus-visible" : "not matching :focus-visible",
  );

  return {
    focusedElement,
    focusVisible,

    /**
     * Moves the focus into `containerEl`, on the element the ladder above
     * picks.
     *
     * `getDelay(target)` — asked once the target is known, answers how many
     * milliseconds to wait before actually focusing it. The ladder is what
     * decides WHO gets the focus and it may only run once (it consumes the
     * autofocus-restore mark), so a caller with a policy about WHEN cannot
     * resolve the target itself to make up its mind: it is handed the answer
     * instead. Returns a cancel function when it did delay, so a container
     * closing before the delay is up takes back a focus it never gave;
     * undefined when it focused straight away and there is nothing to take
     * back.
     */
    transferFocus: (transferEvent, containerEl, { getDelay } = {}) => {
      // Where the keyboard is a virtual one, an arrival lands on what ASKED for
      // the focus, or on the surface — never on the first focusable that
      // happens to be there. That element costs the top of what just arrived
      // twice over: the browser scrolls it into view, and a field raises a
      // keyboard taking a third of what is left, so the title and the sentence
      // saying what this is about are gone before it has been looked at. A
      // field that really is what one came for asks by name (step 2) and gets
      // the keyboard anyway.
      //
      // The device, not the interaction (unlike the delay callers apply on top
      // of this): whether focusing raises a keyboard over what arrived is true
      // of the screen, and an arrival with no pointer in it at all — a popup
      // opened by the page loading, a travel asked for by code — is precisely
      // the one that must not be answered "no keyboard here".
      const skipFirstFocusable = coarsePointerSignal.value;
      let target;
      let reason;
      containerEl.removeAttribute(AUTOFOCUS_UNPLACED_ATTRIBUTE);
      const lastFocused = clearAutofocusRestore(containerEl);
      if (lastFocused) {
        // Through findFocusable: what was remembered may have become a wrapper
        // since (or stopped taking focus at all), and what is inside it is then
        // what the memory meant.
        const stillFocusable = findFocusable(lastFocused);
        if (stillFocusable) {
          reason = "element focused when it was left (restore)";
          target = stillFocusable;
        }
      }
      if (!target) {
        const found = findFocusTarget(containerEl, { skipFirstFocusable });
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
      // Whether the focus ends up inside is what the transfer is asked for; a
      // container that has to say no leaves the mark saying so, for whatever
      // appears inside it next (see claimUnplacedAutofocus). Both ways of
      // saying no count: finding nothing at all, and the fallback above, which
      // leaves the focus where it already was — outside.
      const placedInside =
        target && (containerEl === target || containerEl.contains(target));
      let cancelRetry;
      if (!placedInside) {
        containerEl.setAttribute(AUTOFOCUS_UNPLACED_ATTRIBUTE, "");
        cancelRetry = retryWhenPlaceable(containerEl, {
          skipFirstFocusable,
          focusVisible,
          debugFocus,
          transferEvent,
        });
      }
      if (!target) {
        return cancelRetry;
      }
      // The modality speaks for the transfer, but an editable target outranks
      // it: it draws its ring on any focus (see isMatchingFocusVisible), so
      // the native :focus-visible is told the same.
      const targetFocusVisible = focusVisible || isEditableTarget(target);
      const giveFocus = () => {
        debugFocus(
          transferEvent,
          `Moving focus to ${getElementSignature(target)}.focus({ preventScroll: true, focusVisible: ${targetFocusVisible} }) (reason: ${reason})`,
        );
        focusTransferTarget(target, targetFocusVisible);
      };
      const delay = getDelay?.(target) || 0;
      if (!delay) {
        giveFocus();
        return cancelRetry;
      }
      debugFocus(
        transferEvent,
        `Delaying focus to ${getElementSignature(target)} by ${delay}ms`,
      );
      const timeout = setTimeout(giveFocus, delay);
      return () => {
        clearTimeout(timeout);
        cancelRetry?.();
      };
    },

    restoreFocus: (restoreEvent) => {
      debugFocus(
        restoreEvent,
        `restore focus to previously focused element`,
        focusedElement,
      );
      const restoreFocusVisible =
        isKeyboardModality() || isEditableTarget(focusedElement);
      focusedElement.focus({
        preventScroll: true,
        focusVisible: restoreFocusVisible,
      });
    },
  };
};

/**
 * The second and last try at placing a focus the ladder had nowhere to put.
 *
 * A container can open on a moment where nothing in it — its own contents, and
 * itself — can take the focus: content still being built, a screen not yet
 * interactive. That moment is over almost immediately, and nothing else would
 * ever come back to it: the opening is the one event there is, and it has
 * passed. So the transfer keeps its promise one microtask later, still before
 * the browser paints, and still before anything the user does.
 *
 * Whoever settled the debt in between wins — content arriving with an autofocus
 * of its own claims it through use_auto_focus.js, and finding the mark gone is
 * how this knows to stand down.
 */
const retryWhenPlaceable = (
  containerEl,
  { skipFirstFocusable, focusVisible, debugFocus, transferEvent },
) => {
  let cancelled = false;
  queueMicrotask(() => {
    if (cancelled || !containerEl.isConnected) {
      return;
    }
    if (!claimUnplacedAutofocus(containerEl)) {
      return;
    }
    const found = findFocusTarget(containerEl, { skipFirstFocusable });
    if (!found) {
      return;
    }
    const { target, reason } = found;
    debugFocus(
      transferEvent,
      `Moving focus to ${getElementSignature(target)} on second try (reason: ${reason})`,
    );
    focusTransferTarget(target, focusVisible || isEditableTarget(target));
  });
  return () => {
    cancelled = true;
  };
};

const focusTransferTarget = (target, focusVisible) => {
  target.focus({ preventScroll: true, focusVisible });
  if (target.hasAttribute("navi-autofocus-select")) {
    target.select();
    // Keep the beginning of the text visible instead of scrolling to the end
    target.scrollLeft = 0;
  }
};

// Get the active element before we transfer focus in the popover/dialog
// We don't just use document.activeElement because when dialog is opened by mousedown
// we prevent default so browser don't steal focus back from the dialog
// meaning the focus did not yet reach the element receiving the mousedown
// as a result document.activeElement is not up-to-date (can be document.body for instance)
const getFocusedBeforeTransfer = (e) => {
  // No event at all: a transfer asked for by code (a `current` prop moving a
  // slide, say) has no interaction to read — whatever holds the focus is all
  // there is to know.
  const initiator = e?.detail?.eventChain ? e.detail.eventChain[0] : null;
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
