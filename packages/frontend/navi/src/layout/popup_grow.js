/**
 * A popup that is the anchor, continued.
 *
 * Opening a surface out of the element that asked for it is not the surface
 * appearing while that element stays put: it is one box becoming another. The
 * browser draws exactly that on its own — the same `view-transition-name` on
 * the anchor before the change and on the popup after it, and it morphs the
 * first box into the second — so all this file does is hand that name over at
 * the two instants it can be handed over, and give it back afterwards.
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
 * [data-growing] backdrop rules in dialog.jsx) — and the box grows out of the
 * anchor from there.
 *
 * One name serves the whole movement, because only one of the two boxes is on
 * screen at a time: it names the anchor while the popup is closed, and the
 * popup while it is open. What continues the anchor INSIDE the popup is
 * whatever carries `data-grow`, and the popup itself when nothing does — a
 * dialog holding the grown card plus buttons around it grows the card, a
 * dialog that IS the grown thing grows whole.
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
// most one popup growing, and the movement being replaced gives the name back
// before the next one takes it (see releaseGrowInProgress).
const NAME = "navi-popup-grow";
const NAME_PROPERTY = "view-transition-name";
// Worn by the root for the length of the movement, saying which way it goes
// ("opening" | "closing") — what the CSS keys the page's own opt-out and the
// clip near the anchor's end on, and the movement's only trace in the document.
const ROOT_ATTRIBUTE = "data-navi-popup-grow";
// What the two boxes are to each other (Dialog's `grow`: "box" | "scene"),
// worn by the root too — it decides how each picture sits in the moving box.
const KIND_ATTRIBUTE = "data-navi-popup-grow-kind";
// Inside the popup, the one node that IS the anchor once it has grown.
const TARGET_SELECTOR = "[data-grow]";
// Worn by the popup from its opening to the reveal, keeping it unpainted
// (dialog.jsx) while its backdrop is already on screen: the popup is brought
// in by the movement, not by the open.
const ARRIVING_ATTRIBUTE = "data-navi-popup-grow-arriving";
// The popup's own animation duration, published on the root because the
// ::view-transition tree hangs off it and inherits from nowhere else.
const DURATION_PROPERTY = "--navi-popup-grow-duration";
// The corners of the box being left, published the same way: the pictures are
// clipped to the moving box (dialog.jsx), and a card with rounded corners must
// not travel with square ones.
const BORDER_RADIUS_PROPERTY = "--navi-popup-grow-border-radius";

let releaseGrowInProgress = null;

/**
 * Runs `applyChange` — the DOM change that opens or closes `popupEl` — inside
 * a view transition morphing the anchor's box into the popup's, or back.
 *
 * `opened` says which way: the box being left is the anchor when the popup is
 * opening and the popup when it is closing, and the arriving one is only known
 * once the change has been made (the content a popup grows into is built by
 * that very change). `grow` is Dialog's own prop of that name.
 */
export const growPopupFromAnchor = (
  popupEl,
  anchorElement,
  applyChange,
  { opened, grow },
) => {
  const startViewTransition = ensureDocumentStartViewTransition();
  // A movement still wearing the name would make the name two elements wide,
  // and a name belonging to two elements aborts the transition for the whole
  // document.
  releaseGrowInProgress?.();

  const elementLeaving = opened ? anchorElement : resolveGrowTarget(popupEl);
  const giveBackNameLeaving = wearGrowName(elementLeaving);
  const root = document.documentElement;
  root.setAttribute(ROOT_ATTRIBUTE, opened ? "opening" : "closing");
  root.setAttribute(KIND_ATTRIBUTE, grow);
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
  const release = () => {
    if (releaseGrowInProgress !== release) {
      return;
    }
    releaseGrowInProgress = null;
    giveBackNameLeaving();
    giveBackNameArriving?.();
    root.removeAttribute(ROOT_ATTRIBUTE);
    root.removeAttribute(KIND_ATTRIBUTE);
    root.style.removeProperty(DURATION_PROPERTY);
    root.style.removeProperty(BORDER_RADIUS_PROPERTY);
  };
  releaseGrowInProgress = release;

  if (opened) {
    // Opened on the spot (see this file's top comment): the next frame shows
    // the backdrop, and the movement has only the reveal to photograph.
    popupEl.setAttribute(ARRIVING_ATTRIBUTE, "");
    applyChange();
  }
  const viewTransition = startViewTransition(() => {
    // The name is the arriving box's from here on: worn by both, it is worn by
    // neither. Written rather than removed, so a name the element also has
    // from a stylesheet cannot resurface for the length of the movement.
    elementLeaving.style.setProperty(NAME_PROPERTY, "none");
    if (opened) {
      popupEl.removeAttribute(ARRIVING_ATTRIBUTE);
    } else {
      applyChange();
    }
    const elementArriving = opened
      ? resolveGrowTarget(popupEl)
      : // Gone from the document while the popup was open (the row it stood
        // in was removed): nothing to arrive at, and the browser plays the
        // popup's picture out on its own.
        anchorElement.isConnected
        ? anchorElement
        : null;
    if (elementArriving) {
      giveBackNameArriving = wearGrowName(elementArriving);
    }
  });
  viewTransition.finished.then(release, release);
};

const resolveGrowTarget = (popupEl) => {
  const declaredTarget = popupEl.querySelector(TARGET_SELECTOR);
  if (declaredTarget) {
    return declaredTarget;
  }
  return popupEl;
};

// Wears the movement's name, and gives back whatever the element had written
// inline of its own once the movement is over.
const wearGrowName = (element) => {
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
