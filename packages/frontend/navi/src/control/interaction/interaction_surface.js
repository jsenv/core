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
 * hand is still moving, and navi otherwise names only what happens once (see
 * "A gesture whose product is a value" in docs/interactions.md). They are named
 * here because of what has to be settled BEFORE the press, which is what
 * `interactions` exists for: `touch-action` on the surface, said from a
 * stylesheet since a browser decides what a touch may do when it lands; the pan
 * stepping back for what is carried ACROSS the surface (a marker declaring
 * `move`, a handle) and for what answers the pointer on its own; the pinch not
 * beginning as a pan under its first finger; the wheel and the pinch writing
 * one `zoom`. A handle turned, a sun dragged around a plan have none of that to
 * arbitrate — the handle is the whole surface of the gesture — and stay
 * unnamed.
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
 * Nothing of the gesture is decided here — `installPanZoom` in @jsenv/dom owns
 * the pointers, the capture, the wheel burst and the click left behind. This
 * says which names the element answers with, and hands the numbers over.
 */

import { installPanZoom } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const PAN = "pan";
const ZOOM = "zoom";
// The same attribute a carried element reads: how far a pointer travels before
// it is a gesture rather than a press.
const THRESHOLD_ATTRIBUTE = "data-drag-threshold";

defineInteractionDetector({
  name: "surface",
  claims: (type) => type === PAN || type === ZOOM,
  // A press on the surface may be a tap, a hold or the beginning of a pan, and
  // nothing may read it as the first until the pointer has said which.
  disputesPress: true,
  setup: (element, trigger, { types, readConfig }) => {
    const canPan = types.includes(PAN);
    const canZoom = types.includes(ZOOM);
    return installPanZoom(element, {
      threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
      onPan: canPan
        ? ({ event, x, y }) => trigger(PAN, event, { x, y })
        : undefined,
      onZoom: canZoom
        ? ({ event, factor, x, y }) => trigger(ZOOM, event, { factor, x, y })
        : undefined,
    });
  },
});
