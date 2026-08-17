/**
 * `drag_to_reorder` — a row dragged to another place in its list.
 *
 * The gesture is `startDragToReorder`'s, whole: a clone carried above the page
 * while the original keeps its place in the layout, a drop hint saying where it
 * will land, drop targets found by intersection, no-op drops filtered out, and the
 * landing animated with a view transition. Nothing of that is re-decided here.
 *
 * What IS here is the wiring an application would otherwise write per list: which
 * elements are the items, how they are identified, and how the answer gets back.
 *
 *   <List.Item id={item.id} interactions={{ drag_to_reorder: reorder }}>
 *
 * WHICH ELEMENTS. Every element declaring the interaction marks itself, so the set
 * of items IS the set of elements that declared it — there is no selector to pass
 * and nothing to keep in sync with the markup. An item that must not move simply
 * does not declare it.
 *
 * HOW THEY ARE IDENTIFIED: by `id`. A reorder is answered in terms of what moved
 * and what it landed before, and a DOM index cannot say it — a list draws fewer
 * rows than it has, and a search reorders them.
 *
 * WHAT COMES BACK, in the interaction's own detail:
 *
 *   interactions={{
 *     drag_to_reorder: (event) => {
 *       const { fromId, toId, syncCloneWithDropTarget } = event.detail;
 *       return document.startViewTransition(() => {
 *         syncCloneWithDropTarget();
 *         setOrder(moveBefore(order, fromId, toId));
 *       }).finished;
 *     },
 *   }}
 *
 * `toId` is null for a drop at the end. `syncCloneWithDropTarget` must be called
 * synchronously inside the transition callback, next to the state change, so the
 * clone is captured where it lands rather than where it was let go of. And the
 * promise matters: the gesture keeps its clone until the answer settles, so
 * returning the transition is what makes the landing continuous.
 *
 * The document transition is the application's call and not navi's: a
 * `view-transition-name` must be unique per document, so only the application can
 * name what is moving (see AI_INSTRUCTIONS.md).
 */

import { startDragToReorder } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const TYPE = "drag_to_reorder";
// What makes an element an item of its list, written by the detector itself.
const REORDERABLE_ATTRIBUTE = "data-reorderable";
// Which way the list runs. A row of cards reorders sideways; a list of rows, down.
const AXIS_ATTRIBUTE = "data-reorder-axis";
const DELAY_ATTRIBUTE = "data-reorder-delay";
const SLOP_ATTRIBUTE = "data-reorder-slop";
const THRESHOLD_ATTRIBUTE = "data-reorder-threshold";

defineInteractionDetector({
  name: "reorder",
  claims: (type) => type === TYPE,
  setup: (element, trigger, { readConfig }) => {
    element.setAttribute(REORDERABLE_ATTRIBUTE, "");
    // Read here rather than at the press: a stylesheet or a container can say it,
    // and it is what the gesture is about, not something it discovers.
    const axis = element.closest(`[${AXIS_ATTRIBUTE}="x"]`) ? "x" : "y";
    // What @jsenv/dom puts on a drag source: no iOS callout, and the touch left
    // to the scroll until the press becomes a grab. Its value is the axis the
    // SURROUNDINGS scroll on, which for a list is the axis the list runs on.
    element.setAttribute("data-drag-source", axis === "x" ? "x" : "");

    const onPointerDown = (pointerDownEvent) => {
      startDragToReorder(pointerDownEvent, {
        draggedElement: element,
        itemSelector: `[${REORDERABLE_ATTRIBUTE}]`,
        getItemId: (itemElement) => itemElement.id,
        direction: axis === "x" ? { x: true, y: false } : { x: false, y: true },
        threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
        longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
        longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
        // Handed straight back: what `trigger` returns is a promise while the
        // answer is still going, which is exactly what the gesture waits on
        // before it lets go of its clone.
        onReorder: (fromId, toId, syncCloneWithDropTarget) =>
          trigger(TYPE, pointerDownEvent, {
            fromId,
            toId,
            syncCloneWithDropTarget,
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
