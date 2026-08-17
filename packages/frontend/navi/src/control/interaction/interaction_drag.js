/**
 * `move`, `reorder`, `toss` — one grab, and what letting go of it means.
 *
 * All three are the same gesture: the element is picked up and carried. What
 * differs is the answer at the release, so one detector reads them all — it is one
 * press, and something has to arbitrate it.
 *
 *   interactions={{ reorder: moveBefore, toss: remove }}
 *   interactions={{ move: remember }}
 *
 * `reorder` and `toss` combine: a task dragged onto another changes places, the
 * same task thrown far and fast is gotten rid of. `move` does not combine with
 * `reorder` — an element either goes where it is put or takes a place in a list,
 * and the two answers cannot both be true of one release.
 *
 * `move` carries the element ITSELF and leaves it where it was put; the other two
 * carry a copy and put the original back. That is the same difference said in
 * layout terms: something moved has a new place of its own, something reordered
 * had its place taken by the list.
 *
 * Nothing of the gesture is decided here. `startDragTo` owns all of it — the
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

import { startDragTo } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const MOVE = "move";
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

defineInteractionDetector({
  name: "drag",
  claims: (type) => type === MOVE || type === REORDER || type === TOSS,
  setup: (element, trigger, { types, readConfig }) => {
    const canMove = types.includes(MOVE);
    const canReorder = types.includes(REORDER);
    const canToss = types.includes(TOSS);
    if (import.meta.dev && canMove && canReorder) {
      console.warn(
        `interactions: "move" and "reorder" cannot both answer one release — an element either goes where it is put or takes a place in a list. "reorder" wins here.`,
      );
    }
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
      // What this element says a release can mean. The gesture then runs only what
      // those need — no copy for a move, no drop hint for something that can only
      // be thrown away.
      startDragTo(pointerDownEvent, types, {
        draggedElement: element,
        // Nothing to land on when nothing reorders.
        itemSelector: canReorder ? `[${REORDERABLE_ATTRIBUTE}]` : undefined,
        getItemId: (itemElement) => itemElement.id,
        // A throw goes wherever the hand sent it; a reorder walks the list.
        direction: canToss
          ? { x: true, y: true }
          : axis === "x"
            ? { x: true, y: false }
            : { x: false, y: true },
        // Where a moved element may go, said in the DOM: a box moved inside a
        // frame stays in it, a note pinned on a board does not.
        areaConstraint:
          canMove && element.closest(`[data-drag-free]`) ? "none" : undefined,
        threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
        longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
        longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
        tossDistance: readConfig(TOSS_DISTANCE_ATTRIBUTE, undefined),
        tossSpeed: readConfig(TOSS_SPEED_ATTRIBUTE, undefined),
        // Handed straight back in all three cases: what `trigger` returns is a
        // promise while the answer is still going, which is what the gesture waits
        // on before it lets go of what it carries.
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
        onMove: ({ x, y }) => trigger(MOVE, pointerDownEvent, { x, y }),
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
