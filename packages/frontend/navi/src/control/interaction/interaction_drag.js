/**
 * `move`, `reorder`, `land`, `toss` — one grab, and what letting go of it means.
 *
 * All four are the same gesture: the element is picked up and carried. What
 * differs is the answer at the release, so one detector reads them all — it is one
 * press, and something has to arbitrate it.
 *
 *   interactions={{ reorder: moveBefore, toss: remove }}
 *   interactions={{ land: swapPlaces }}
 *   interactions={{ move: remember }}
 *
 * `toss` combines with `reorder` and with `land`: a task dragged onto another
 * changes places, the same task thrown far and fast is gotten rid of. The three
 * others do not combine with each other — an element either goes where it is put,
 * takes a place in a list, or comes down on a place, and no two of those answers
 * can both be true of one release.
 *
 * `move` carries the element ITSELF and leaves it where it was put; the others
 * carry a copy and put the original back. That is the same difference said in
 * layout terms: something moved has a new place of its own, something reordered
 * had its place taken by the list.
 *
 * `reorder` VS `land`: both come down on an item, and what separates them is what
 * a place IS. A row of a list is a place BETWEEN two others — free by construction,
 * so the answer is an insertion, and putting a row back where it already was is a
 * no-op. A place of a board is a place of its own, which may already be taken — so
 * nothing is inserted, nothing is a no-op, and the answer is simply "this one came
 * down on that one". What that means is the application's: take the place, swap the
 * two, refuse.
 *
 *   interactions={{ land: (event) => {
 *     const { fromId, toId, x, y, syncCloneWithDropTarget } = event.detail;
 *     …
 *   }}}
 *
 * `toId` is an element and never null: a copy over nothing is a release that meant
 * nothing, and the interaction does not happen at all — unless the element says
 * `data-toss-by="release-outside"` (see below), which gives that release a
 * meaning of its own.
 *
 * WHERE ON IT, in `x`, `y`, `width`, `height`: the box the copy came down in,
 * measured inside the place — its border and its scroll taken out. A place that is
 * a SURFACE — a plan, a map, a floor — has no element under the copy to name and
 * nothing to swap with: where it came down IS the answer, and `toId` says which
 * surface rather than which piece.
 *
 * `syncCloneWithDropTarget` takes an element here, which `reorder` has no use for:
 * a place of a board can be larger than what stands on it (a quarter of a court, a
 * square holding a smaller piece), and the copy has to come down where the piece
 * will be rather than filling the place. Left alone, it lands on the place itself —
 * so a surface either passes what the thing becomes or does not call it at all,
 * which leaves the copy where the hand put it, over the thing appearing there.
 *
 * WHICH ELEMENTS ARE PLACES: those marked `data-droppable`, and only those.
 * Declaring `land` says an element can be CARRIED, which on a board is a different
 * thing from being somewhere one can be put: a zone receives without ever being
 * carried, a piece is carried without ever receiving, and both at once is a third
 * case (dropped on a piece, the two swap). A list has no such distinction — every
 * row is both, which is why `reorder` needs no marker in the markup.
 *
 * WHERE THE PLACES ARE LOOKED FOR: inside the carried element's PARENT, so a place
 * and a piece are siblings — and `data-drop-container` on an ancestor says
 * otherwise. Two arrangements need it, and both are the same one: what is carried
 * does not stand among the places. A palette is a strip BESIDE the surface it
 * fills, a marker already placed is drawn INSIDE the surface it can be put back
 * on, and in each case the search must cover what holds both. It holds the places
 * rather than being one — a surface carrying it would never be found from inside
 * itself. It is also what lets the copy travel there: named, the area it may cross
 * is the page rather than the source's own scroll area.
 *
 *   <div data-drop-container>
 *     <aside>{shapes.map((shape) => <Shape interactions={{ land: add }} />)}</aside>
 *     <Plan id="plan" data-droppable>…</Plan>
 *   </div>
 *
 * HOW A TOSS IS MADE: `data-toss-by`, beside `toss`. A THROW (`"throw"`, the
 * default) is far AND fast — the flick that gets rid of something, a list's
 * gesture, and it is judged before any landing. A RELEASE OUTSIDE
 * (`"release-outside"`) has no place under it — dragging a marker off a plan and
 * letting go, deliberate and never a flick, a surface's gesture. Each is named on
 * its own because each is wrong where the other is right: on a plan a fast drag
 * that ends ON it has not asked for the thing to go, and on a list a row let go of
 * beside it is a row put back. Both at once is
 * `data-toss-by="throw release-outside"`.
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

import { markDragSource, startDragTo } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const MOVE = "move";
const REORDER = "reorder";
// "drop" is taken: it is the name of the platform's own drag-and-drop event, and
// an interaction is dispatched as an event of its own name — so anything listening
// for a file being dropped on the page would get this one and read it as such.
const LAND = "land";
const TOSS = "toss";
// The moment the press stops being a press and becomes a hold on the object.
const GRAB = "grab";

// What makes an element a place something can land, written by the detector itself.
const REORDERABLE_ATTRIBUTE = "data-reorderable";
// The same for `land`, except the markup is what writes it: a place of a board is
// not the same thing as a piece of it (see the top of this file).
const DROPPABLE_ATTRIBUTE = "data-droppable";
// What holds the places, when the carried element does not stand among them.
const DROP_CONTAINER_ATTRIBUTE = "data-drop-container";
// Which axes the drag walks: "x", "y" or "xy". Its default is not the same for
// every outcome — a list runs one way, and something being put somewhere goes
// wherever it is put.
const AXIS_ATTRIBUTE = "data-drag-axis";
const DELAY_ATTRIBUTE = "data-drag-delay";
const SLOP_ATTRIBUTE = "data-drag-slop";
const THRESHOLD_ATTRIBUTE = "data-drag-threshold";
const TOSS_DISTANCE_ATTRIBUTE = "data-toss-distance";
const TOSS_SPEED_ATTRIBUTE = "data-toss-speed";
// How a toss is made here: "throw" (far and fast), "release-outside" (let go of
// away from every place), or both.
const TOSS_BY_ATTRIBUTE = "data-toss-by";
const TOSS_BY_DEFAULT = "throw";
const TOSS_WAYS = ["throw", "release-outside"];

defineInteractionDetector({
  name: "drag",
  claims: (type) =>
    type === MOVE ||
    type === REORDER ||
    type === LAND ||
    type === TOSS ||
    type === GRAB,
  // The press is the beginning of the gesture, not an answer: nothing may read
  // it until it is known whether the hand is dragging or just pressing.
  disputesPress: true,
  setup: (element, trigger, { types, readConfig }) => {
    const canMove = types.includes(MOVE);
    const canReorder = types.includes(REORDER);
    const canLand = types.includes(LAND);
    const canToss = types.includes(TOSS);
    if (!canMove && !canReorder && !canLand && !canToss) {
      // Only "grab": there is no gesture to be taken by, so there is no moment to
      // be told about either.
      if (import.meta.dev) {
        console.warn(
          `interactions: "${GRAB}" says when a drag takes hold, so it needs a drag to say it about. Declare it beside "${MOVE}", "${REORDER}", "${LAND}" or "${TOSS}".`,
        );
      }
      return undefined;
    }
    const tellsWhenGrabbed = types.includes(GRAB);
    // `startDragTo` arbitrates the same conflicts and says so too, and that voice
    // is not heard from here: @jsenv/dom publishes one build with `import.meta.dev`
    // false, so nothing of its dev code exists for whoever consumes navi. What a
    // caller wrote is `interactions`, so this is also where the warning can name it.
    if (import.meta.dev && canMove && (canReorder || canLand || canToss)) {
      // The other three all carry a copy and put the original back — there is no
      // move anywhere in that gesture, so the element itself never travels.
      const other = canLand ? LAND : canReorder ? REORDER : TOSS;
      const instead =
        other === TOSS
          ? ` Something that can be put down anywhere AND thrown away declares "${LAND}" rather than "${MOVE}": its detail says where the copy came down, which is what a surface answers with.`
          : "";
      console.warn(
        `interactions: "${MOVE}" and "${other}" cannot both answer one release — "${MOVE}" leaves the element where the hand put it, "${other}" carries a copy and puts the original back. "${other}" wins here, so the element never travels.${instead}`,
      );
    }
    if (import.meta.dev && canReorder && canLand) {
      console.warn(
        `interactions: "reorder" and "land" cannot both answer one release — a release either takes a place between two items or comes down on one. "land" wins here.`,
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
      (canReorder && !canLand && !canToss ? "y" : "xy");
    // Where the places are, and what a release away from all of them means —
    // both read at setup for the same reason as the axes: they are what the
    // gesture is about, and it is what holds the two sides of it that says them.
    const dropContainer = element.closest(`[${DROP_CONTAINER_ATTRIBUTE}]`);
    const tossByHolder = element.closest(`[${TOSS_BY_ATTRIBUTE}]`);
    const tossBy = (
      tossByHolder?.getAttribute(TOSS_BY_ATTRIBUTE) || TOSS_BY_DEFAULT
    )
      .trim()
      .split(/\s+/);
    if (import.meta.dev) {
      for (const way of tossBy) {
        if (!TOSS_WAYS.includes(way)) {
          console.warn(
            `interactions: "${way}" is not a way a toss is made. ${TOSS_BY_ATTRIBUTE} takes "${TOSS_WAYS.join('", "')}", or both.`,
          );
        }
      }
      if (
        tossBy.includes("release-outside") &&
        (!canToss || (!canReorder && !canLand))
      ) {
        console.warn(
          `interactions: ${TOSS_BY_ATTRIBUTE}="release-outside" makes a release away from every place mean the thing is gotten rid of, so it needs both "${TOSS}" and places to be away from. Declare "${TOSS}" beside "${REORDER}" or "${LAND}".`,
        );
      }
    }

    if (canReorder) {
      element.setAttribute(REORDERABLE_ATTRIBUTE, "");
    }
    // What @jsenv/dom puts on a drag source: the axes written in the DOM for
    // whoever else answers this press (a sheet pushed down to close it, a row of
    // slides), no iOS callout, the touch left to the scroll until the press
    // becomes a grab, and the listener that lets the grab take it back.
    const unmarkDragSource = markDragSource(element, axes);

    // What a release can mean, which is not all of what was declared: "grab" is a
    // moment, not an outcome, and the gesture must not read it as one.
    const effects = types.filter((type) => type !== GRAB);

    // Whether there is anywhere to land, asked at the first press rather than
    // here: the places are drawn by whatever renders them, which at setup may
    // not have happened yet.
    let placesLookedFor = false;

    const onPointerDown = (pointerDownEvent) => {
      if (import.meta.dev && canLand && !placesLookedFor) {
        placesLookedFor = true;
        warnWhenNothingToLandOn(element, dropContainer, tossBy);
      }
      // What this element says a release can mean. The gesture then runs only what
      // those need — no copy for a move, no drop hint for something that can only
      // be thrown away.
      startDragTo(pointerDownEvent, effects, {
        draggedElement: element,
        // Nothing to land on when nothing reorders.
        itemSelector: canLand
          ? `[${DROPPABLE_ATTRIBUTE}]`
          : canReorder
            ? `[${REORDERABLE_ATTRIBUTE}]`
            : undefined,
        containerElement: dropContainer || undefined,
        getItemId: (itemElement) => itemElement.id,
        direction: { x: axes.includes("x"), y: axes.includes("y") },
        // Where it may go, said in the DOM. A thing that is put somewhere stays
        // inside what one can SEE of its container ("scrollport", not "scroll":
        // the scrollable area can be far larger than the box, and "inside the box"
        // is what a hand expects). `data-drag-free` lifts that, and so does a
        // named container of places: they are somewhere else by construction, and
        // a copy kept in its own scroll area could never reach them. Left alone
        // for a throw, which frees the area on its own — it has to be able to
        // leave.
        areaConstraint:
          dropContainer || element.closest(`[data-drag-free]`)
            ? "none"
            : canMove
              ? "scrollport"
              : undefined,
        threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
        longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
        longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
        tossDistance: readConfig(TOSS_DISTANCE_ATTRIBUTE, undefined),
        tossSpeed: readConfig(TOSS_SPEED_ATTRIBUTE, undefined),
        tossBy,
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
        onLand: (detail) => trigger(LAND, pointerDownEvent, detail),
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
      unmarkDragSource();
      element.removeEventListener("pointerdown", onPointerDown);
    };
  },
});

// A place is looked for INSIDE the container and nowhere else, so the surface a
// piece already stands on is not one of them — a search never finds what it starts
// from. Nothing then happens at all, and where `release-outside` is on it is worse
// than nothing: every release is away from every place, so every release gets rid
// of the thing.
const warnWhenNothingToLandOn = (element, dropContainer, tossBy) => {
  const container = dropContainer || element.parentElement;
  if (!container) {
    return;
  }
  for (const droppable of container.querySelectorAll(
    `[${DROPPABLE_ATTRIBUTE}]`,
  )) {
    if (droppable !== element) {
      return;
    }
  }
  const consequence = tossBy.includes("release-outside")
    ? ` Every release is then away from every place, which ${TOSS_BY_ATTRIBUTE}="release-outside" reads as a toss.`
    : " Nothing answers a release.";
  const droppableAround = element.parentElement?.closest(
    `[${DROPPABLE_ATTRIBUTE}]`,
  );
  if (droppableAround) {
    console.warn(
      `interactions: "${LAND}" has nowhere to land — this element sits INSIDE the only place there is, and places are looked for inside ${dropContainer ? `the [${DROP_CONTAINER_ATTRIBUTE}]` : `the element's parent`}, never above it.${consequence} Put ${DROP_CONTAINER_ATTRIBUTE} on an ancestor of both, so the surface is among the places rather than around them.`,
      droppableAround,
    );
    return;
  }
  console.warn(
    `interactions: "${LAND}" has nowhere to land — nothing marked ${DROPPABLE_ATTRIBUTE} is inside ${dropContainer ? `the [${DROP_CONTAINER_ATTRIBUTE}]` : `the element's parent`}, which is where the places are looked for.${consequence} Mark them, and when they are not siblings of this element put ${DROP_CONTAINER_ATTRIBUTE} on an ancestor of both.`,
    container,
  );
};
