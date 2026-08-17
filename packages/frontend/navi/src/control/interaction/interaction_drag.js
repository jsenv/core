/**
 * `reorder` and `toss` — one grab, and what letting go of it means.
 *
 * Both are the same gesture: the element is picked up and carried. What differs is
 * the answer at the release, and the two combine — a task dragged onto another one
 * changes places, the same task thrown far and fast is gotten rid of. So one
 * detector reads both, because it is one press and something has to arbitrate it:
 *
 *   interactions={{ reorder: moveBefore, toss: remove }}
 *
 * Nothing of the gesture is decided here. `startDragToReorder` owns all of it — the
 * copy carried above the page while the original keeps its place in the layout, the
 * drop hint, the drop targets found by intersection, the no-op drops filtered out,
 * the flight of a thrown copy and its return when the answer refuses. This says
 * which elements are the items, how they are named, and what a given release means.
 *
 * WHICH ELEMENTS. Every element declaring `reorder` marks itself, so the set of
 * items IS the set of elements that declared it — no selector to pass, nothing to
 * keep in sync with the markup, and an item that must not move simply does not
 * declare it. An element that only declares `toss` marks nothing: it is not a place
 * anything lands.
 *
 * HOW THEY ARE NAMED: by `id`. A reorder is answered in terms of what moved and
 * what it landed before, and a DOM index cannot say it — a list draws fewer rows
 * than it has, and a search reorders them.
 *
 * WHAT COMES BACK, in the interaction's own detail:
 *
 *   interactions={{
 *     reorder: (event) => {
 *       const { fromId, toId, syncCloneWithDropTarget } = event.detail;
 *       return document.startViewTransition(() => {
 *         syncCloneWithDropTarget();
 *         setOrder(moveBefore(order, fromId, toId));
 *       }).finished;
 *     },
 *     toss: (event) => remove(event.detail.id),
 *   }}
 *
 * `toId` is null for a drop at the end. `syncCloneWithDropTarget` must be called
 * synchronously inside the transition callback, next to the state change, so the
 * copy is captured where it lands rather than where it was let go of.
 *
 * And the promise matters in both cases: the gesture holds its copy until the
 * answer settles. Returning the transition is what makes a landing continuous; a
 * `toss` that rejects brings the copy back, because the thing still exists and the
 * screen has to say so.
 *
 * Starting a document transition is the application's call and not navi's: a
 * `view-transition-name` must be unique per document, so only the application can
 * name what moves.
 *
 * What the copy LOOKS like is the application's too. A copy of a transparent
 * element is invisible — a row usually gets its background from the list around it,
 * which the copy has left — so it is dressed through the attributes the gesture
 * writes: `navi-drag-clone` on the copy, `navi-drag-clone-source` on the original.
 */

import { startDragToReorder } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const REORDER = "reorder";
const TOSS = "toss";

// What makes an element a place something can land, written by the detector itself.
const REORDERABLE_ATTRIBUTE = "data-reorderable";
// Which way the list runs. A row of cards reorders sideways; a list of rows, down.
const AXIS_ATTRIBUTE = "data-reorder-axis";
const DELAY_ATTRIBUTE = "data-drag-delay";
const SLOP_ATTRIBUTE = "data-drag-slop";
const THRESHOLD_ATTRIBUTE = "data-drag-threshold";
const TOSS_DISTANCE_ATTRIBUTE = "data-toss-distance";
const TOSS_SPEED_ATTRIBUTE = "data-toss-speed";

// Throwing asks for the two at once: far, and fast. One without the other is
// moving the thing while hesitating, and nothing is thrown away on a hesitation —
// it comes back.
const TOSS_DISTANCE_DEFAULT = 110;
const TOSS_SPEED_DEFAULT = 0.45;

defineInteractionDetector({
  name: "drag",
  claims: (type) => type === REORDER || type === TOSS,
  setup: (element, trigger, { types, readConfig }) => {
    const canReorder = types.includes(REORDER);
    const canToss = types.includes(TOSS);
    // Read at setup rather than at the press: a container can say it, and it is
    // what the gesture is about rather than something it discovers.
    const axis = element.closest(`[${AXIS_ATTRIBUTE}="x"]`) ? "x" : "y";

    if (canReorder) {
      element.setAttribute(REORDERABLE_ATTRIBUTE, "");
    }
    // What @jsenv/dom puts on a drag source: no iOS callout, and the touch left to
    // the scroll until the press becomes a grab. Its value is the axis the
    // SURROUNDINGS scroll on, which for a list is the axis the list runs on.
    element.setAttribute("data-drag-source", axis === "x" ? "x" : "");

    const onPointerDown = (pointerDownEvent) => {
      startDragToReorder(pointerDownEvent, {
        draggedElement: element,
        // Nothing to land on when nothing reorders: no hint is drawn and no
        // landing is looked for.
        itemSelector: canReorder ? `[${REORDERABLE_ATTRIBUTE}]` : undefined,
        getItemId: (itemElement) => itemElement.id,
        // A throw goes wherever the hand sent it; a reorder walks the list.
        direction: canToss
          ? { x: true, y: true }
          : axis === "x"
            ? { x: true, y: false }
            : { x: false, y: true },
        threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
        longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
        longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
        // A throw is asked about first: it is the more insistent of the two, and a
        // hand that sent the thing across the screen has not asked for it to swap
        // places with whatever it happened to fly over.
        resolveDrop: ({ gestureInfo, dropTarget }) => {
          if (canToss) {
            const { xDelta, yDelta } = gestureInfo.layout;
            const distance = Math.hypot(xDelta, yDelta);
            if (
              distance >
                readConfig(TOSS_DISTANCE_ATTRIBUTE, TOSS_DISTANCE_DEFAULT) &&
              gestureInfo.velocity >
                readConfig(TOSS_SPEED_ATTRIBUTE, TOSS_SPEED_DEFAULT)
            ) {
              return TOSS;
            }
          }
          if (canReorder && dropTarget) {
            return REORDER;
          }
          return "cancel";
        },
        // Handed straight back: what `trigger` returns is a promise while the
        // answer is still going, which is what the gesture waits on before it
        // lets go of its copy.
        onReorder: (fromId, toId, syncCloneWithDropTarget) =>
          trigger(REORDER, pointerDownEvent, {
            fromId,
            toId,
            syncCloneWithDropTarget,
          }),
        onToss: ({ gestureInfo }) =>
          trigger(TOSS, pointerDownEvent, {
            id: element.id,
            velocity: gestureInfo.velocity,
            x: gestureInfo.layout.xDelta,
            y: gestureInfo.layout.yDelta,
          }),
      });
    };
    element.addEventListener("pointerdown", onPointerDown);

    return () => {
      element.removeAttribute(REORDERABLE_ATTRIBUTE);
      element.removeAttribute("data-drag-source");
      element.removeEventListener("pointerdown", onPointerDown);
    };
  },
});
