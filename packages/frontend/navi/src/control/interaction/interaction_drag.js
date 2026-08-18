/**
 * `move`, `reorder`, `drop`, `toss` — one grab, and what letting go of it means.
 *
 * All four are the same gesture: the element is picked up and carried. What
 * differs is the answer at the release, so one detector reads them all — it is one
 * press, and something has to arbitrate it.
 *
 *   interactions={{ reorder: moveBefore, toss: remove }}
 *   interactions={{ drop: swapPlaces }}
 *   interactions={{ move: remember }}
 *
 * `toss` combines with `reorder` and with `drop`: a task dragged onto another
 * changes places, the same task thrown far and fast is gotten rid of. The three
 * others do not combine with each other — an element either goes where it is put,
 * takes a place in a list, or lands on something, and no two of those answers can
 * both be true of one release.
 *
 * `move` carries the element ITSELF and leaves it where it was put; the others
 * carry a copy and put the original back. That is the same difference said in
 * layout terms: something moved has a new place of its own, something reordered
 * had its place taken by the list.
 *
 * `reorder` VS `drop`: both land on an item, and what separates them is what a
 * place IS. A row of a list is a place BETWEEN two others — free by construction,
 * so the answer is an insertion and dropping a row back where it already was is a
 * no-op. A square of a board is a place of its own, which may already be taken —
 * so nothing is inserted, nothing is a no-op, and the answer is simply "this one
 * landed on that one". What that means is the application's: take the place, swap
 * the two, refuse.
 *
 *   interactions={{ drop: (event) => {
 *     const { fromId, toId, syncCloneWithDropTarget } = event.detail;
 *     …
 *   }}}
 *
 * `toId` is an element and never null: a copy over nothing is a release that meant
 * nothing, and the interaction does not happen at all.
 *
 * WHICH ELEMENTS ARE PLACES, for `drop`: every element declaring it, plus anything
 * marked `data-droppable` in the markup. That second door is what a board needs and
 * a list does not — an empty square receives without ever being carried, so it has
 * no interaction to declare, and it must still be somewhere the hand can go.
 *
 * Nothing of the gesture is decided here. `startDragTo` owns all of it — the
 * copy carried above the page while the original keeps its place in the layout, the
 * drop hint, the drop targets found by intersection, the no-op drops filtered out,
 * the flight of a thrown copy and its return when the answer refuses. This says
 * which elements are the items, how they are named, and what a given release means.
 *
 * WHICH ELEMENTS, for `reorder`. Every element declaring it marks itself, so the
 * set of items IS the set of elements that declared it — no selector to pass, nothing to
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
 * WHEN THE PRESS BECOMES A HOLD: `grab`.
 *
 *   interactions={{ toss: remove, grab: () => navigator.vibrate?.(10) }}
 *
 * The four above all answer the RELEASE, and between the press and the release
 * there is one instant that counts for the hand making the gesture: the one where
 * the object stops being pressed and starts being held. `grab` is that instant,
 * and it is the same one whichever way the drag was entered — a finger held still,
 * a mouse travelled a few pixels.
 *
 * It matters most where it is least visible. On a screen the held object is under
 * the thumb that hides it, so the only feedback available is the one that is felt;
 * without it the hand waits, doubts the press was heard, and lets go too early. A
 * vibration is the usual answer, but nothing here is about vibration — a sound, a
 * class, a measure are the same moment.
 *
 * It is told, not asked: `grab` reports, so what it returns is not waited on and
 * preventing its event does not call the gesture off. And it is not an interaction
 * on its own — declared without one of the four above there is no gesture for it
 * to be the beginning of.
 *
 * A `longpress` needs nothing of this: it already happens at the moment the hold
 * is acquired rather than at the release (see interaction_press.js).
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
const DROP = "drop";
const TOSS = "toss";
// The moment the press stops being a press and becomes a hold on the object.
const GRAB = "grab";

// What makes an element a place something can land, written by the detector itself.
const REORDERABLE_ATTRIBUTE = "data-reorderable";
// The same for `drop`, except the markup may write it too: a place that only ever
// receives has no interaction of its own to declare.
const DROPPABLE_ATTRIBUTE = "data-droppable";
// Which axes the drag walks: "x", "y" or "xy". Its default is not the same for
// every outcome — a list runs one way, and something being put somewhere goes
// wherever it is put.
const AXIS_ATTRIBUTE = "data-drag-axis";
const DELAY_ATTRIBUTE = "data-drag-delay";
const SLOP_ATTRIBUTE = "data-drag-slop";
const THRESHOLD_ATTRIBUTE = "data-drag-threshold";
const TOSS_DISTANCE_ATTRIBUTE = "data-toss-distance";
const TOSS_SPEED_ATTRIBUTE = "data-toss-speed";

defineInteractionDetector({
  name: "drag",
  claims: (type) =>
    type === MOVE ||
    type === REORDER ||
    type === DROP ||
    type === TOSS ||
    type === GRAB,
  setup: (element, trigger, { types, readConfig }) => {
    const canMove = types.includes(MOVE);
    const canReorder = types.includes(REORDER);
    const canDrop = types.includes(DROP);
    const canToss = types.includes(TOSS);
    if (!canMove && !canReorder && !canDrop && !canToss) {
      // Only "grab": there is no gesture to be taken by, so there is no moment to
      // be told about either.
      if (import.meta.dev) {
        console.warn(
          `interactions: "${GRAB}" says when a drag takes hold, so it needs a drag to say it about. Declare it beside "${MOVE}", "${REORDER}", "${DROP}" or "${TOSS}".`,
        );
      }
      return undefined;
    }
    const tellsWhenGrabbed = types.includes(GRAB);
    if (import.meta.dev && canMove && (canReorder || canDrop)) {
      console.warn(
        `interactions: "move" and "${canReorder ? REORDER : DROP}" cannot both answer one release — an element either goes where it is put, or takes the place the list/board gives it. "${canReorder ? REORDER : DROP}" wins here.`,
      );
    }
    if (import.meta.dev && canReorder && canDrop) {
      console.warn(
        `interactions: "reorder" and "drop" cannot both answer one release — a release either takes a place between two items or lands on one. "drop" wins here.`,
      );
    }
    // Read at setup rather than at the press: a container can say it, and it is
    // what the gesture is about rather than something it discovers.
    const axisHolder = element.closest(`[${AXIS_ATTRIBUTE}]`);
    const axes =
      axisHolder?.getAttribute(AXIS_ATTRIBUTE) ||
      // A list runs one way, and reordering walks it. Anything else goes wherever
      // the hand takes it: a board has places all around, a thing put somewhere has
      // two axes to be put along, and a throw goes where it was thrown.
      (canReorder && !canDrop && !canToss ? "y" : "xy");

    if (canReorder) {
      element.setAttribute(REORDERABLE_ATTRIBUTE, "");
    }
    if (canDrop) {
      element.setAttribute(DROPPABLE_ATTRIBUTE, "");
    }
    // What @jsenv/dom puts on a drag source: no iOS callout, and the touch left to
    // the scroll until the press becomes a grab. Its value is the axis the
    // SURROUNDINGS scroll on, which for a list is the axis the list runs on.
    element.setAttribute("data-drag-source", axes === "x" ? "x" : "");

    // What a release can mean, which is not all of what was declared: "grab" is a
    // moment, not an outcome, and the gesture must not read it as one.
    const effects = types.filter((type) => type !== GRAB);

    const onPointerDown = (pointerDownEvent) => {
      // What this element says a release can mean. The gesture then runs only what
      // those need — no copy for a move, no drop hint for something that can only
      // be thrown away.
      startDragTo(pointerDownEvent, effects, {
        draggedElement: element,
        // Nothing to land on when nothing reorders.
        itemSelector: canDrop
          ? `[${DROPPABLE_ATTRIBUTE}]`
          : canReorder
            ? `[${REORDERABLE_ATTRIBUTE}]`
            : undefined,
        getItemId: (itemElement) => itemElement.id,
        direction: { x: axes.includes("x"), y: axes.includes("y") },
        // Where it may go, said in the DOM. A thing that is put somewhere stays
        // inside what one can SEE of its container ("scrollport", not "scroll":
        // the scrollable area can be far larger than the box, and "inside the box"
        // is what a hand expects). `data-drag-free` lifts that. Left alone for a
        // throw, which frees the area on its own — it has to be able to leave.
        areaConstraint: element.closest(`[data-drag-free]`)
          ? "none"
          : canMove
            ? "scrollport"
            : undefined,
        threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
        longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
        longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
        tossDistance: readConfig(TOSS_DISTANCE_ATTRIBUTE, undefined),
        tossSpeed: readConfig(TOSS_SPEED_ATTRIBUTE, undefined),
        // The one moment the gesture has that is not a release. Said here rather
        // than from the press that led to it, because the press is only one of the
        // two ways in: a finger holds still, a mouse travels a few pixels, and it
        // is the same instant — the object is now held. Nothing is done with what
        // comes back: this says something happened, it does not ask for work.
        onDragStart: tellsWhenGrabbed
          ? (gestureInfo) => {
              trigger(GRAB, pointerDownEvent, {
                pointerType: pointerDownEvent.pointerType,
                gestureInfo,
              });
            }
          : undefined,
        // Handed straight back in all three cases: what `trigger` returns is a
        // promise while the answer is still going, which is what the gesture waits
        // on before it lets go of what it carries.
        onReorder: (fromId, toId, syncCloneWithDropTarget) =>
          trigger(REORDER, pointerDownEvent, {
            fromId,
            toId,
            syncCloneWithDropTarget,
          }),
        onDrop: (fromId, toId, syncCloneWithDropTarget) =>
          trigger(DROP, pointerDownEvent, {
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
      element.removeAttribute(DROPPABLE_ATTRIBUTE);
      element.removeAttribute("data-drag-source");
      element.removeEventListener("pointerdown", onPointerDown);
    };
  },
});
