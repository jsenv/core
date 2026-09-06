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
 * `data-pan-after-hold="kept"` asks for that wait once rather than before every
 * pan: the surface given the hand keeps it — panning on contact, like the same
 * plan opened full screen — and asks again after a press has landed away from
 * it, which is the hand saying it has moved on. What answers "away" is the same
 * thing that closes a popup, and the surface is the one that watches for it, so
 * an application never keeps a `pointerdown` listener on the window to know.
 *
 * The WHEEL is the same question asked of a mouse, and it is not asked of the
 * caller at all: a wheel event is read rather than settled beforehand, so
 * whether anything around the surface scrolls is simply looked up when it
 * arrives (`installPanZoom`). A bare wheel zooms where nothing would have
 * scrolled and goes to the page where something would, `ctrl`/`meta` zooms
 * either way, and navi says which — a callout, in navi's own words, since a
 * gesture that does nothing has to say why. `data-zoom-on-contact` takes the
 * bare wheel back for a surface that owns it whatever stands around it, and is
 * read the same way, off the element or any ancestor.
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

import { isMac } from "../../keyboard/os.js";
import { naviI18n } from "../../text/navi_i18n.js";
import { openCallout } from "../rules/callout/callout.js";
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
// Whether a finger has to stand still before the surface is its own, and — at
// "kept" — whether that answer stands until the hand goes elsewhere. What a touch
// may do is settled when it lands, so the surface holds the mode in the DOM and
// changes it there itself; nothing here is re-read at the press.
const AFTER_HOLD_ATTRIBUTE = "data-pan-after-hold";
const AFTER_HOLD_KEPT = "kept";
// Whether a BARE wheel is the surface's whatever scrolls around it. The wheel's
// opposite of the attribute above: that one gives a gesture away, this one takes
// one back.
const ZOOM_ON_CONTACT_ATTRIBUTE = "data-zoom-on-contact";
// How long the word stays up after the last wheel of the burst it explains.
const WHEEL_HINT_DURATION = 2500;

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
    /*
     * The wheel that went to the page instead of zooming: a gesture that does
     * nothing where one expected something has to say why, and the key it is
     * waiting for is the whole message. Said once per burst and taken back on
     * its own, since nobody dismisses an answer to a wheel — and the burst has
     * no end but a silence, so the wait is renewed by every event of it.
     */
    let hint = null;
    let hintTimeout = null;
    const closeHint = () => {
      clearTimeout(hintTimeout);
      hintTimeout = null;
      const hintOpened = hint;
      hint = null;
      // `requestClose` and not `close`: the callout's own word for it, and the
      // one that runs its teardown (see callout.js).
      hintOpened?.requestClose(undefined, "wheel_gesture_over");
    };
    const sayTheWheelNeedsAKey = ({ event }) => {
      clearTimeout(hintTimeout);
      hintTimeout = setTimeout(closeHint, WHEEL_HINT_DURATION);
      if (hint) {
        return;
      }
      hint = openCallout(
        naviI18n("interaction.zoom.needs_modifier", {
          key: isMac ? "⌘" : "Ctrl",
        }),
        {
          anchorElement: element,
          status: "info",
          openingEvent: event,
          // Nothing about it is a conversation: it is not focused, it has no
          // button to press, and what closes it is the hand going quiet.
          skipFocus: true,
          closeButton: false,
          closeOnClickOutside: false,
          closeOnFocusLeave: false,
          onClose: () => {
            hint = null;
          },
        },
      );
    };

    const uninstall = installPanZoom(element, {
      threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
      afterHold: readAfterHold(element),
      wheelZoom: element.closest(`[${ZOOM_ON_CONTACT_ATTRIBUTE}]`)
        ? "always"
        : "auto",
      onWheelLeftToPage: canZoom ? sayTheWheelNeedsAKey : undefined,
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
    return () => {
      closeHint();
      uninstall();
    };
  },
});

const readAfterHold = (element) => {
  const holder = element.closest(`[${AFTER_HOLD_ATTRIBUTE}]`);
  if (!holder) {
    return false;
  }
  const value = holder.getAttribute(AFTER_HOLD_ATTRIBUTE);
  if (value === AFTER_HOLD_KEPT) {
    return AFTER_HOLD_KEPT;
  }
  if (import.meta.dev && value !== "" && value !== "true") {
    console.warn(
      `interactions: ${AFTER_HOLD_ATTRIBUTE}="${value}" is not a value the surface knows. Leave it empty for a wait before every pan, or say "${AFTER_HOLD_KEPT}" for one asked only until the surface is given the hand.`,
    );
  }
  return true;
};
