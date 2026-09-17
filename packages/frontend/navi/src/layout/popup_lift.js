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
 * The page around is photographed too, the browser's default, kept on
 * purpose: the wall and what the popup holds around the lifted node live in
 * the top layer, which the browser paints during a transition only as part of
 * the root's picture (see the CSS in dialog.jsx). The fixed bars are part of
 * that picture, under the wall like the rest of the page. The popup is placed
 * between the bars, and its picture keeps to the room between them on the
 * way as well: the moving box is clipped to that room (animateMovingBox),
 * so a card half under the bottom bar leaves from under it and comes back
 * under it.
 */

import { trapScrollInside } from "@jsenv/dom";

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
// The fixed bars (fixed_bar.jsx): the popup is placed in the room between
// them, and the moving picture is clipped to that room on the way.
const FIXED_BAR_SELECTOR = ".navi_fixed_bar";
// The paint of the lifted node, published the same way: the box wears the
// card's own background, so where it has grown past the picture it carries it
// is the card that has grown, not a picture fading into a bigger one. Read off
// the lifted node rather than the anchor: the anchor is often a bare trigger
// around the card, painting nothing of its own, while the lifted node IS the
// card — and a card does not change colour on the way.
const BACKGROUND_COLOR_PROPERTY = "--navi-popup-lift-background-color";
const BACKGROUND_IMAGE_PROPERTY = "--navi-popup-lift-background-image";
// The corners of the box the movement starts from, published the same way —
// and, unlike the paint, not kept for the length of the movement: a corner is
// written per box, on purpose, the same card at two sizes not wanting the same
// round (a 6px corner stops showing on a big card). The moving box leaves with
// the corners of the box it leaves and arrives with those of the box it
// arrives on, the two authored values interpolated on the group's own clock
// (see animateMovingBox).
const BORDER_RADIUS_PROPERTY = "--navi-popup-lift-border-radius";

let releaseLiftInProgress = null;
// What the moving box is told frame by frame on top of the browser's own morph
// (animateMovingBox: its corners, its clip to the room between the bars),
// cancelled with the movement so a finished one cannot go on applying its
// last values to the next movement's picture.
let boxAnimationInProgress = null;
// The page held still for the length of the movement. Its picture is frozen
// anyway, and the browser keeps following the live anchor: a scroll would
// carry the arriving box along under a page that does not move, and past the
// clip to the room between the bars, computed where the boxes stood.
let releaseScrollHold = null;

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
  // Read before the first write: the read brings the style up to date, and a
  // write before it would make it bring it up to date once more.
  const duration = getComputedStyle(popupEl)
    .getPropertyValue("--popup-animation-duration")
    .trim();
  const giveBackNameLeaving = wearLiftName(elementLeaving);
  const root = document.documentElement;
  root.setAttribute(ROOT_ATTRIBUTE, opened ? "opening" : "closing");
  root.setAttribute(KIND_ATTRIBUTE, lift);
  if (duration) {
    // Empty would substitute into `animation-duration:` as nothing at all,
    // which computes to 0s — a movement nobody sees rather than one at the
    // browser's own pace.
    root.style.setProperty(DURATION_PROPERTY, duration);
  }
  if (!opened) {
    publishBoxPaint(elementLeaving);
  }
  const cornersLeaving = readCorners(elementLeaving);
  root.style.setProperty(BORDER_RADIUS_PROPERTY, cornersLeaving);

  let giveBackNameArriving = null;
  let stopWaitingForTarget = null;
  const release = () => {
    if (releaseLiftInProgress !== release) {
      return;
    }
    releaseLiftInProgress = null;
    stopWaitingForTarget?.();
    boxAnimationInProgress?.cancel();
    boxAnimationInProgress = null;
    releaseScrollHold?.();
    releaseScrollHold = null;
    // Given up on, or replaced, while still waiting to be lifted: shown where
    // it stands rather than left unpainted.
    popupEl.removeAttribute(ARRIVING_ATTRIBUTE);
    giveBackNameLeaving();
    giveBackNameArriving?.();
    root.removeAttribute(ROOT_ATTRIBUTE);
    root.removeAttribute(KIND_ATTRIBUTE);
    root.style.removeProperty(DURATION_PROPERTY);
    root.style.removeProperty(BORDER_RADIUS_PROPERTY);
    root.style.removeProperty(BACKGROUND_COLOR_PROPERTY);
    root.style.removeProperty(BACKGROUND_IMAGE_PROPERTY);
  };
  releaseLiftInProgress = release;

  const startMovement = (change, resolveElementArriving) => {
    releaseScrollHold?.();
    releaseScrollHold = trapScrollInside(popupEl, { backdrop: true });
    const room = measureRoomBetweenBars();
    const boxLeaving = room ? elementLeaving.getBoundingClientRect() : null;
    let boxArriving = null;
    let cornersArriving = null;
    const viewTransition = startViewTransition(() => {
      // The name is the arriving box's from here on: worn by both, it is worn
      // by neither. Written rather than removed, so a name the element also
      // has from a stylesheet cannot resurface for the length of the movement.
      elementLeaving.style.setProperty(NAME_PROPERTY, "none");
      change();
      const elementArriving = resolveElementArriving();
      if (elementArriving) {
        giveBackNameArriving = wearLiftName(elementArriving);
        cornersArriving = readCorners(elementArriving);
        if (room) {
          boxArriving = elementArriving.getBoundingClientRect();
        }
      }
    });
    viewTransition.ready.then(() => {
      if (cornersArriving === null) {
        return;
      }
      animateMovingBox({
        cornersFrom: cornersLeaving,
        cornersTo: cornersArriving,
        room,
        boxFrom: boxLeaving,
        boxTo: boxArriving,
      });
    }, ignore);
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
    if (import.meta.dev && lift === "box") {
      warnDrawingLiftedAsBox(target);
    }
    publishBoxPaint(target);
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

// A drawing under lift="box" is drawn at its own size in a box that is not:
// the big picture cropped to a corner of the shrinking box, the small one
// riding a corner of the growing box, then a swap. Nothing about it errors,
// and at normal speed it only reads as a jolt, so it is named here.
const DRAWING_SELECTOR = "svg, img, picture, canvas, video";
const warnDrawingLiftedAsBox = (liftedElement) => {
  let current = liftedElement;
  while (current) {
    if (current.matches(DRAWING_SELECTOR)) {
      console.warn(
        `[navi] animation="lifting" with lift="box" lifts a <${current.localName}>: its pictures keep their own size while the box moving between them changes size, so the drawing is cropped then swapped rather than scaled. For a drawing, a photo or a video, use lift="scene".`,
      );
      return;
    }
    current = sameBoxChild(current);
  }
};

const publishBoxPaint = (liftedElement) => {
  const { backgroundColor, backgroundImage } = getComputedStyle(
    findPaintedBox(liftedElement),
  );
  const root = document.documentElement;
  root.style.setProperty(BACKGROUND_COLOR_PROPERTY, backgroundColor);
  root.style.setProperty(BACKGROUND_IMAGE_PROPERTY, backgroundImage);
};

// The corners of a box: the first round found going down through children
// that are the same box, the outermost one being what clips the others; a
// bare trigger around a card carries its corners on itself or on the card,
// and either is found. Square when none does.
const readCorners = (element) => {
  let current = element;
  while (current) {
    const { borderRadius } = getComputedStyle(current);
    if (borderRadius && !/^(?:0px\s*)+$/.test(borderRadius)) {
      return borderRadius;
    }
    current = sameBoxChild(current);
  }
  return "0px";
};

// The lifted node is often a wrapper painting nothing, around the card that
// paints: what the moving box has to wear is the card's paint, found by going
// down through children that are the same box, until one paints.
const findPaintedBox = (element) => {
  let current = element;
  while (current) {
    const { backgroundColor, backgroundImage } = getComputedStyle(current);
    if (backgroundImage !== "none" || !isTransparent(backgroundColor)) {
      return current;
    }
    const child = sameBoxChild(current);
    if (!child) {
      return element;
    }
    current = child;
  }
  return element;
};

const isTransparent = (color) =>
  color === "transparent" || /^rgba\(\d+, \d+, \d+, 0\)$/.test(color);

const sameBoxChild = (element) => {
  const { width, height } = element.getBoundingClientRect();
  for (const child of element.children) {
    const childRect = child.getBoundingClientRect();
    if (
      Math.abs(childRect.width - width) < 1 &&
      Math.abs(childRect.height - height) < 1
    ) {
      return child;
    }
  }
  return null;
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

const ignore = () => {};

// The room the fixed bars leave, in viewport coordinates; null without bars.
// A side with no bar is open to infinity, so the clip below never bites there.
const measureRoomBetweenBars = () => {
  const bars = document.querySelectorAll(FIXED_BAR_SELECTOR);
  if (bars.length === 0) {
    return null;
  }
  const far = 1e6;
  const room = { top: -far, right: far, bottom: far, left: -far };
  for (const bar of bars) {
    const rect = bar.getBoundingClientRect();
    const area = bar.getAttribute("data-area");
    if (area === "top" && rect.bottom > room.top) {
      room.top = rect.bottom;
    } else if (area === "bottom" && rect.top < room.bottom) {
      room.bottom = rect.top;
    } else if (area === "left" && rect.right > room.left) {
      room.left = rect.right;
    } else if (area === "right" && rect.left < room.right) {
      room.right = rect.left;
    }
  }
  return room;
};

// What the moving picture is told on top of the browser's own morph, from one
// end of the movement to the other, on the group's own clock: its corners,
// from those of the box it leaves to those of the box it arrives on; and, when
// there are fixed bars, its clip to the room between them. The clip is written
// in the moving box's own coordinates, and the box goes from one rectangle to
// the other along the browser's own easing: each inset is an affine function
// of that progress, so two keyframes with the group's timing follow the box
// exactly, and a negative inset — the box clear of that bar — clips nothing.
// The easing is the one on the group's keyframes: a CSS animation carries it
// there, and the animation's own timing reads linear.
const animateMovingBox = ({ cornersFrom, cornersTo, room, boxFrom, boxTo }) => {
  const groupAnimation = document
    .getAnimations()
    .find(
      (animation) =>
        animation.effect?.pseudoElement === `::view-transition-group(${NAME})`,
    );
  if (!groupAnimation) {
    return;
  }
  const { duration } = groupAnimation.effect.getTiming();
  const [firstKeyframe] = groupAnimation.effect.getKeyframes();
  const easing = firstKeyframe?.easing || "ease";
  const from = { borderRadius: cornersFrom, easing };
  const to = { borderRadius: cornersTo };
  if (room && boxFrom && boxTo) {
    from.clipPath = insetToRoom(room, boxFrom);
    to.clipPath = insetToRoom(room, boxTo);
  }
  boxAnimationInProgress?.cancel();
  boxAnimationInProgress = document.documentElement.animate([from, to], {
    duration,
    fill: "both",
    pseudoElement: `::view-transition-image-pair(${NAME})`,
  });
};

const insetToRoom = (room, box) =>
  `inset(${room.top - box.top}px ${box.right - room.right}px ${box.bottom - room.bottom}px ${room.left - box.left}px)`;

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
