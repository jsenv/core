/**
 * A popup that is the anchor, brought to the front.
 *
 * Opening a surface out of the element that asked for it is not the surface
 * appearing while that element stays put: it is that element leaving its place
 * in the page to stand in front of it — one box becoming another. The browser
 * draws exactly that on its own — the same `view-transition-name` on the anchor
 * before the change and on the popup after it, and it morphs the first box
 * into the second — so all this file does is hand that name over at the two
 * instants it can be handed over, and give it back afterwards.
 *
 * The pictures are taken around a DOM change, which is why the movement cannot
 * be written from outside: what a caller can reach — a command, `onClose` — is
 * either before the change or after it, never around it. The change that opens
 * a popup, and above all the one that closes it, belongs to the open
 * controller, which is what `transitionChange` (open_controller.js) exists to
 * let a popup wrap.
 *
 * The two changes are not photographed the same way. Closing is photographed
 * whole: the picture of the popup has to be taken before the close takes it
 * off screen. Opening is done on the spot, with the popup held unpainted
 * (ARRIVING_ATTRIBUTE, opacity 0 in dialog.jsx), and what the transition
 * photographs is the reveal alone. Between a tap and the first frame there is
 * then only the open itself — showing, building, placing — and not, on top of
 * it, a picture of the page before and a picture of the popup after, with
 * nothing painted in between: the backdrop, which is all the user needs to
 * know the tap landed, reaches the screen with the open — at half strength,
 * the anchor under it still being the thing about to be lifted (see the
 * [data-lifting] backdrop rules in dialog.jsx) — and the box lifts out of the
 * anchor from there.
 *
 * What is lifted is named: `data-lift` on the one node that IS the anchor
 * once in front — inside the popup, or the popup itself when the popup is
 * that node whole. It is often not there when the opening asks for it: code
 * that arrives with the address, a row fetched for the popup, both land a
 * task or a round trip later. A movement started before it exists would carry
 * the anchor into an empty box — the card dissolving into nothing, and the
 * content appearing later where the box landed. So the opening waits for it
 * (TARGET_WAIT_MS), on the half-strength frame where the anchor is still
 * readable, and lifts the moment it is there.
 *
 * One name serves the whole movement, because only one of the two boxes is on
 * screen at a time: it names the anchor while the popup is closed, and the
 * lifted node while it is open.
 *
 * The page around stays out of the picture (`view-transition-name: none` on
 * the root, in dialog.jsx): a captured element is not painted where it stands
 * and cannot be pointed at either, so photographing the whole document would
 * leave the page frozen and unpressable for the length of every opening — and
 * of every closing, which is the moment the user is coming back to it.
 */

import { ensureDocumentStartViewTransition } from "../transition/start_view_transition_polyfill.js";

// The name the two boxes take turns wearing. A single literal one is enough,
// and unique by construction: a document has one view transition, so it has at
// most one popup lifting, and the movement being replaced gives the name back
// before the next one takes it (see releaseLiftInProgress).
const NAME = "navi-popup-lift";
const NAME_PROPERTY = "view-transition-name";
// Worn by the root for the length of the movement, saying which way it goes
// ("opening" | "closing") — what the CSS keys the page's own opt-out and the
// clip near the anchor's end on, and the movement's only trace in the document.
const ROOT_ATTRIBUTE = "data-navi-popup-lift";
// What the two boxes are to each other (Dialog's `lift`: "box" | "scene"),
// worn by the root too — it decides how each picture sits in the moving box.
const KIND_ATTRIBUTE = "data-navi-popup-lift-kind";
// The one node that IS the anchor once in front: the popup itself, or a node
// inside it.
const TARGET_SELECTOR = "[data-lift]";
// Worn by the popup from its opening to the reveal, keeping it unpainted
// (dialog.jsx) while its backdrop is already on screen: the popup is brought
// in by the movement, not by the open.
const ARRIVING_ATTRIBUTE = "data-navi-popup-lift-arriving";
// How long an opening waits for something to lift. What arrives with an
// opening — code fetched for the address, a row fetched for the popup — is a
// matter of a few hundred milliseconds; past this the popup is shown where it
// stands, without a movement, so a target that never comes cannot keep it
// unpainted.
const TARGET_WAIT_MS = 1000;
// The popup's own animation duration, published on the root because the
// ::view-transition tree hangs off it and inherits from nowhere else.
const DURATION_PROPERTY = "--navi-popup-lift-duration";
// The corners of the box being left, published the same way: the pictures are
// clipped to the moving box (dialog.jsx), and a card with rounded corners must
// not travel with square ones.
const BORDER_RADIUS_PROPERTY = "--navi-popup-lift-border-radius";

let releaseLiftInProgress = null;

/**
 * Runs `applyChange` — the DOM change that opens or closes `popupEl` — inside
 * a view transition morphing the anchor's box into the lifted node's, or back.
 *
 * `opened` says which way: the box being left is the anchor when the popup is
 * opening and the lifted node when it is closing. `lift` is Dialog's own prop
 * of that name.
 */
export const liftPopupFromAnchor = (
  popupEl,
  anchorElement,
  applyChange,
  { opened, lift },
) => {
  const startViewTransition = ensureDocumentStartViewTransition();
  // A movement still wearing the name would make the name two elements wide,
  // and a name belonging to two elements aborts the transition for the whole
  // document.
  releaseLiftInProgress?.();

  const elementLeaving = opened ? anchorElement : resolveLiftTarget(popupEl);
  const giveBackNameLeaving = wearLiftName(elementLeaving);
  const root = document.documentElement;
  root.setAttribute(ROOT_ATTRIBUTE, opened ? "opening" : "closing");
  root.setAttribute(KIND_ATTRIBUTE, lift);
  const duration = getComputedStyle(popupEl)
    .getPropertyValue("--popup-animation-duration")
    .trim();
  if (duration) {
    // Empty would substitute into `animation-duration:` as nothing at all,
    // which computes to 0s — a movement nobody sees rather than one at the
    // browser's own pace.
    root.style.setProperty(DURATION_PROPERTY, duration);
  }
  const borderRadius = getComputedStyle(elementLeaving).borderRadius;
  if (borderRadius) {
    root.style.setProperty(BORDER_RADIUS_PROPERTY, borderRadius);
  }

  let giveBackNameArriving = null;
  let stopWaitingForTarget = null;
  const release = () => {
    if (releaseLiftInProgress !== release) {
      return;
    }
    releaseLiftInProgress = null;
    stopWaitingForTarget?.();
    // Given up on, or replaced, while still waiting to be lifted: shown where
    // it stands rather than left unpainted.
    popupEl.removeAttribute(ARRIVING_ATTRIBUTE);
    giveBackNameLeaving();
    giveBackNameArriving?.();
    root.removeAttribute(ROOT_ATTRIBUTE);
    root.removeAttribute(KIND_ATTRIBUTE);
    root.style.removeProperty(DURATION_PROPERTY);
    root.style.removeProperty(BORDER_RADIUS_PROPERTY);
  };
  releaseLiftInProgress = release;

  const startMovement = (change, resolveElementArriving) => {
    const viewTransition = startViewTransition(() => {
      // The name is the arriving box's from here on: worn by both, it is worn
      // by neither. Written rather than removed, so a name the element also
      // has from a stylesheet cannot resurface for the length of the movement.
      elementLeaving.style.setProperty(NAME_PROPERTY, "none");
      change();
      const elementArriving = resolveElementArriving();
      if (elementArriving) {
        giveBackNameArriving = wearLiftName(elementArriving);
      }
    });
    viewTransition.finished.then(release, release);
  };

  if (!opened) {
    startMovement(applyChange, () =>
      // Gone from the document while the popup was open (the row it stood in
      // was removed): nothing to arrive at, and the browser plays the popup's
      // picture out on its own.
      anchorElement.isConnected ? anchorElement : null,
    );
    return;
  }

  // Opened on the spot (see this file's top comment): the next frame shows
  // the backdrop, and the movement has only the reveal to photograph.
  popupEl.setAttribute(ARRIVING_ATTRIBUTE, "");
  applyChange();
  const reveal = () => {
    popupEl.removeAttribute(ARRIVING_ATTRIBUTE);
  };
  const liftTarget = (target) => {
    startMovement(reveal, () => target);
  };
  const targetNow = findLiftTarget(popupEl);
  if (targetNow) {
    liftTarget(targetNow);
    return;
  }
  stopWaitingForTarget = whenLiftTargetAppears(popupEl, (target) => {
    stopWaitingForTarget = null;
    if (target) {
      liftTarget(target);
      return;
    }
    if (import.meta.dev) {
      console.warn(
        `[navi] animation="lifting": nothing carrying data-lift appeared in the popup within ${TARGET_WAIT_MS}ms, so it is shown without a movement. Put data-lift on what the anchor becomes once in front — the popup itself, or a node inside it — and render it at once (a copy of the anchor while its content loads) so the lift starts with the opening.`,
      );
    }
    release();
  });
};

const findLiftTarget = (popupEl) => {
  if (popupEl.matches(TARGET_SELECTOR)) {
    return popupEl;
  }
  return popupEl.querySelector(TARGET_SELECTOR);
};

// The node leaving on a close. What was lifted is normally still there (a
// popup throwing its content away does so once its exit has played, see
// popup_content_mount.js); the popup stands in when it is not.
const resolveLiftTarget = (popupEl) => {
  return findLiftTarget(popupEl) || popupEl;
};

// Calls `callback` with the lift target once one is in the popup, or with
// null once TARGET_WAIT_MS have passed without one. Returns how to stop
// waiting.
const whenLiftTargetAppears = (popupEl, callback) => {
  const observer = new MutationObserver(() => {
    const target = findLiftTarget(popupEl);
    if (!target) {
      return;
    }
    stop();
    callback(target);
  });
  observer.observe(popupEl, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-lift"],
  });
  const timeout = setTimeout(() => {
    stop();
    callback(null);
  }, TARGET_WAIT_MS);
  const stop = () => {
    observer.disconnect();
    clearTimeout(timeout);
  };
  return stop;
};

// Wears the movement's name, and gives back whatever the element had written
// inline of its own once the movement is over.
const wearLiftName = (element) => {
  const nameBefore = element.style.getPropertyValue(NAME_PROPERTY);
  element.style.setProperty(NAME_PROPERTY, NAME);
  return () => {
    if (nameBefore) {
      element.style.setProperty(NAME_PROPERTY, nameBefore);
      return;
    }
    element.style.removeProperty(NAME_PROPERTY);
  };
};
