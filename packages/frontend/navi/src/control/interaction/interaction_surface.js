/**
 * `pan`, `zoom` — a surface under the hand.
 *
 *   <Box
 *     interactions={{
 *       pan: (event) => moveCenterBy(event.detail),    // { x, y } since the last one
 *       zoom: (event) => zoomBy(event.detail),         // { factor, x, y }
 *     }}
 *   />
 *
 * Neither is an outcome: both are a stream, reported on every frame while the
 * hand is still moving. What earns them a name is not the number but what has to
 * be settled BEFORE the press, which is what `interactions` exists for:
 * `touch-action` on the surface, said from a stylesheet since a browser decides
 * what a touch may do when it lands; the pan stepping back for what is carried
 * ACROSS the surface (a marker declaring `move` or `moving`, a handle) and for
 * what answers the pointer on its own; the pinch not beginning as a pan under
 * its first finger; the wheel and the pinch writing one `zoom`. What is carried
 * rather than looked around has the same arbitration settled for it by the drag
 * detector, and is told the same way there (`moving`, in interaction_drag.js).
 *
 * `pan`'s detail is the movement since the previous `pan`, in px. `zoom`'s is
 * the factor (above 1 is in) and the point of the surface it is around,
 * measured inside its border — the point between the fingers, or under the
 * wheel. What a pixel of pan means in the application's coordinates, and
 * whether the zoom is continuous or stepped, is the application's.
 *
 * Declared alone, `zoom` leaves one pointer to whatever else reads it and takes
 * only two fingers and the wheel; `pan` alone leaves the wheel to the page.
 *
 * `data-pan-after-hold` is for the surface that stands in something that
 * scrolls — a plan shown as a thumbnail on a page: a finger there means to
 * scroll nine times out of ten, and it keeps the page until it has said
 * otherwise by standing still, the way a finger says it means to carry a drag
 * source. Read off the element or any ancestor, since what it knows is about the
 * place rather than about this box.
 *
 * `grab` and `release` are the same two words a carried element says, said of the
 * other thing that holds a hand: the surface has it, the surface has let go. They
 * are the one moment of the gesture that is not a stream, and the one thing an
 * application cannot see for itself — the capture taken at that instant is
 * announced by the browser only before the NEXT pointer event, so a finger held
 * still is announced nothing and a finger that moves is told while the surface is
 * already moving under it. A visual needs neither: `[data-grabbed]` is on the
 * element for as long as the hand is on it, and a stylesheet is enough. What the
 * pair adds is what a stylesheet cannot do — a vibration on the touch that took
 * it, a state kept elsewhere. Declared without `pan` or `zoom` they are not the
 * surface's: they go back to being a drag's, which is what says so (see
 * interaction_drag.js).
 *
 * Nothing of the gesture is decided here — `installPanZoom` in @jsenv/dom owns
 * the pointers, the capture, the wheel burst and the click left behind. This
 * says which names the element answers with, and hands the numbers over.
 */

import { installPanZoom } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const PAN = "pan";
const ZOOM = "zoom";
// The moments, shared word for word with a drag: what holds the hand differs,
// what is being told does not.
const GRAB = "grab";
const RELEASE = "release";
// The same attribute a carried element reads: how far a pointer travels before
// it is a gesture rather than a press.
const THRESHOLD_ATTRIBUTE = "data-drag-threshold";
// Whether a finger has to stand still before the surface is its own. What a
// touch may do is settled when it lands, so this is read once, at setup.
const AFTER_HOLD_ATTRIBUTE = "data-pan-after-hold";

defineInteractionDetector({
  name: "surface",
  claims: (type) =>
    type === PAN || type === ZOOM || type === GRAB || type === RELEASE,
  // A press on the surface may be a tap, a hold or the beginning of a pan, and
  // nothing may read it as the first until the pointer has said which.
  disputesPress: true,
  setup: (element, trigger, { types, readConfig }) => {
    const canPan = types.includes(PAN);
    const canZoom = types.includes(ZOOM);
    if (!canPan && !canZoom) {
      // Only moments, and no surface for them to be moments OF: the two words
      // are a drag's unless a surface is declared beside them, and the drag
      // detector is the one that says so. Nothing is installed here — a surface
      // that answers nothing would still take every touch that lands on it.
      return undefined;
    }
    const tellsWhenGrabbed = types.includes(GRAB);
    const tellsWhenReleased = types.includes(RELEASE);
    return installPanZoom(element, {
      threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
      afterHold: Boolean(element.closest(`[${AFTER_HOLD_ATTRIBUTE}]`)),
      onPan: canPan
        ? ({ event, x, y }) => trigger(PAN, event, { x, y })
        : undefined,
      onZoom: canZoom
        ? ({ event, factor, x, y }) => trigger(ZOOM, event, { factor, x, y })
        : undefined,
      // Told, not asked: what comes back is not waited on, and preventing the
      // event does not call the gesture off. `pointerType` because the hand that
      // took the surface is usually answered in kind — a phone vibrates where a
      // mouse has already seen the thing move.
      onGrab: tellsWhenGrabbed
        ? ({ event }) =>
            trigger(GRAB, event, { pointerType: event?.pointerType })
        : undefined,
      onRelease: tellsWhenReleased
        ? ({ event }) =>
            trigger(RELEASE, event, { pointerType: event?.pointerType })
        : undefined,
    });
  },
});
