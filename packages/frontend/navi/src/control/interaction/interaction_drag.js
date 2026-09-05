/**
 * `move`, `reorder`, `land`, `toss`, `leave` — one grab, and what letting go of
 * it means.
 *
 * All five are the same gesture: the element is picked up and carried. What
 * differs is the answer at the release, so one detector reads them all — it is one
 * press, and something has to arbitrate it.
 *
 *   interactions={{ reorder: moveBefore, toss: remove }}
 *   interactions={{ land: swapPlaces }}
 *   interactions={{ move: remember, leave: remove }}
 *
 * `toss` and `leave` each combine with `reorder` and with `land`: a task dragged
 * onto another changes places, the same task thrown far and fast is gotten rid
 * of, a marker let go of off its plan is removed. `leave` combines with `move` as
 * well. `move`, `reorder` and `land` do not combine with each other — an element
 * either goes where it is put, takes a place in a list, or comes down on a place,
 * and no two of those answers can both be true of one release.
 *
 * `move` carries the element ITSELF and leaves it where it was put; the others
 * carry a copy and put the original back. That is the same difference said in
 * layout terms: something moved has a new place of its own, something reordered
 * had its place taken by the list. Where that place is KEPT is the answer's:
 * an application that redraws the element from state while answering (a new
 * `left`/`top`) owns the position from then on, and the drag's own translate
 * goes; one that draws nothing leaves it to the element, where it is baked in.
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
 * nothing, and the interaction does not happen at all — unless the element
 * declares `leave` (see below), which gives that release a meaning of its own.
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
 * LET GO OF AWAY FROM EVERY PLACE: `leave`. A throw is a GESTURE — far and fast,
 * the flick that gets rid of a row, judged before any landing. A release outside
 * is a PLACE — the hand let go with nothing under the thing, judged after a
 * landing was looked for. They share the outcome an application usually attaches
 * to them and nothing else, so each has its name: `toss` is the throw, `leave` is
 * the release outside, and neither reads the other's rules — there is no speed to
 * a release, and on a plan a fast drag that ends ON it has not asked for the
 * thing to go.
 *
 *   interactions={{
 *     move: (event) => remember(event.detail.x, event.detail.y),
 *     leave: () => remove(id),
 *   }}
 *
 * Beside `land` or `reorder`, "outside" is away from every place. Beside `move`
 * — the element itself travels, and nothing is a place — it is outside the
 * surface the element stands in: the nearest `data-droppable` ancestor, or,
 * without one, what can be seen of the scroll container. Either way it is judged
 * on the element's box no longer overlapping it, not on the pointer, which is
 * still well inside the frame when a 30px marker has just left it. The detail is
 * `toss`'s, `{ id, x, y }`, the distance travelled being what an exit is animated
 * with. A refused `leave` travels back, as a refused `move` does; picked up and
 * put straight back down stays a cancel — it has to have gone somewhere to be
 * away from anything.
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
 * WHILE IT IS BEING MOVED: `moving`.
 *
 *   interactions={{ moving: (event) => setHourFrom(event.detail) }}
 *
 * `move` says where the element ended up, once. That is the answer for something
 * whose position is its own — a marker put down on a plan, remembered as it lies.
 * It is not the answer for something whose position is STATE: a disc pushed along
 * the course of the sun sets the hour, the shadows turn with it, and the disc
 * itself may never leave its course by a pixel. What such a thing needs is the
 * gesture told all along, and to be the one drawing.
 *
 * `moving` is that, and declaring it says both: the element is told where the hand
 * has taken it on every frame, and NOTHING here moves it — no translate, nothing
 * to hand back at the release. The caller draws, from the numbers it is given.
 *
 * Its detail is `{ x, y }`: where it is now, counted from the grab — the very
 * numbers `move` ends with, said all along rather than once. Not steps since the
 * last frame (which is what `pan` gives, having no grab to count from): a caller
 * adding up steps drifts, and has nothing to re-read after a frame it missed.
 *
 * Nothing travels back either: a `move` or a `leave` beside it whose answer
 * rejects normally sends the element home, and there is no home to send it to
 * when navi never moved it — the state the frames wrote is the caller's to put
 * back.
 *
 * Told, not asked, like `grab` and `release` — a draw that has to be awaited
 * before the next frame is a draw one frame late. It differs from them in being a
 * gesture of its own: `moving` alone is a complete declaration, and `move` beside
 * it is only worth writing when the release settles something the frames did not.
 * It is the element that is carried, so it goes with `move` and `leave` and not
 * with the three that carry a copy.
 *
 * WHEN THE PRESS BECOMES A HOLD: `grab`.
 *
 *   interactions={{ toss: remove, grab: () => navigator.vibrate?.(10) }}
 *
 * The five above all answer the RELEASE, and between the press and the release
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
 * on its own — declared without one of the five above there is no gesture for it
 * to be the beginning of.
 *
 * A `longpress` needs nothing of this: it already happens at the moment the hold
 * is acquired rather than at the release (see interaction_press.js).
 *
 * WHEN THE HOLD IS LET GO: `release`.
 *
 *   interactions={{
 *     grab: () => setCarrying(kind),
 *     land: (event) => add(kind, event.detail),
 *     release: () => setCarrying(null),
 *   }}
 *
 * The mirror of `grab`, and the only one always told. Each of the five above
 * answers ONE meaning, so a release that means none of them — let go of over
 * nothing, taken away by the system — reaches nobody, and whatever the grab set up
 * stays set up with nothing to take it down: a bank counting the chip in the hand
 * before it lands has no way to stop counting it when it lands nowhere.
 *
 * Its detail is `{ id, x, y, outcome }`. `outcome` is which of the five is about to
 * answer, or null when the release means none of them — told BEFORE that answer
 * runs, so what the grab put up can come down at the moment the hand lets go while
 * still knowing whether something is on its way.
 *
 * Told, not asked, like `grab`, and no more an interaction of its own: a moment of
 * a drag needs a drag to happen in.
 *
 * WHEN THE HAND PULLS AND NOTHING FOLLOWS: `refuse`.
 *
 *   interactions={{
 *     move: locked ? "refuse" : remember,
 *     refuse: () => shake(),
 *   }}
 *
 * Something that can be carried is not always free to be: a court whose place is
 * settled, a marker pinned by whoever owns the plan. Taking the interaction away
 * — `move: false` — makes the element deaf rather than locked: the press is then
 * nobody's, so whatever it stands on answers it (a surface pans under an object
 * that was aimed at), and the hand pulling is told nothing at all. A thing that
 * does not move and says nothing reads as a screen that is broken, and the hand
 * insists.
 *
 * So the interaction stays declared and says "refuse" in place of what it does.
 * The press remains the element's, the threshold is the same one — a mouse
 * travelling, a finger holding still, the first pixel inside a
 * `data-drag-on-contact` — and at the instant the grab would have been acquired
 * there is none: nothing translates, no copy is made, no release is answered.
 * `refuse` is that instant. The click the press leaves behind is swallowed as a
 * real drag's is: it was answered, by the refusal.
 *
 * One outcome refusing refuses the whole gesture — the five answer one carry, and
 * something that must not be carried has none of them.
 *
 * Told, not asked, like `grab` and `release`, and no more an interaction of its
 * own. Its detail is `{ pointerType }`: there is no `gestureInfo` because there
 * was no gesture, and what the feedback wants to know is which hand asked — a
 * vibration for a finger, nothing more for a mouse whose cursor has already said
 * it.
 *
 * What the copy LOOKS like is the application's too. A copy of a transparent
 * element is invisible — a row usually gets its background from the list around it,
 * which the copy has left — so it is dressed through the attributes the gesture
 * writes: `navi-drag-clone` on the copy, `navi-drag-clone-source` on the original.
 */

import { markDragSource, refuseDragTo, startDragTo } from "@jsenv/dom";

import { defineInteractionDetector } from "./interaction_registry.js";

const MOVE = "move";
// The same carry, told while it happens instead of once it is over.
const MOVING = "moving";
const REORDER = "reorder";
// "drop" is taken: it is the name of the platform's own drag-and-drop event, and
// an interaction is dispatched as an event of its own name — so anything listening
// for a file being dropped on the page would get this one and read it as such.
const LAND = "land";
const TOSS = "toss";
// Let go of away from every place — not a throw, which is judged on its speed.
const LEAVE = "leave";
// The moment the press stops being a press and becomes a hold on the object.
const GRAB = "grab";
// And the moment that hold ends, whatever it ended up meaning.
const RELEASE = "release";
// The moment that hold is not acquired, on something that would be carried and
// says no.
const REFUSE = "refuse";

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

defineInteractionDetector({
  name: "drag",
  claims: (type) =>
    type === MOVE ||
    type === MOVING ||
    type === REORDER ||
    type === LAND ||
    type === TOSS ||
    type === LEAVE ||
    type === GRAB ||
    type === RELEASE ||
    type === REFUSE,
  // The five outcomes can be turned down; the moments cannot — a moment is told,
  // and there is nothing in it to refuse.
  refusable: (type) =>
    type === MOVE ||
    type === MOVING ||
    type === REORDER ||
    type === LAND ||
    type === TOSS ||
    type === LEAVE,
  // The press is the beginning of the gesture, not an answer: nothing may read
  // it until it is known whether the hand is dragging or just pressing.
  disputesPress: true,
  setup: (element, trigger, { types, readConfig, isRefused, isDeclared }) => {
    const canMove = types.includes(MOVE);
    const canMoving = types.includes(MOVING);
    const canReorder = types.includes(REORDER);
    const canLand = types.includes(LAND);
    const canToss = types.includes(TOSS);
    const canLeave = types.includes(LEAVE);
    if (
      !canMove &&
      !canMoving &&
      !canReorder &&
      !canLand &&
      !canToss &&
      !canLeave
    ) {
      // Only moments: there is no gesture to be taken by, so there is no moment to
      // be told about either — unless a surface is declared here, whose grab and
      // release are the same two words said of the other gesture that holds a
      // hand (see interaction_surface.js). Then they are its, and this one has
      // nothing to say about them. Their names are written out rather than
      // imported: what detectors know of each other must not become what order
      // they are registered in (see interactions.js).
      if (import.meta.dev && !isDeclared("pan") && !isDeclared("zoom")) {
        const moments = types.filter(
          (type) => type === GRAB || type === RELEASE || type === REFUSE,
        );
        const them = moments.length === 1 ? "it" : "them";
        console.warn(
          `interactions: "${moments.join(`", "`)}" ${moments.length === 1 ? "is a moment of a drag, so it needs" : "are moments of a drag, so they need"} a drag to happen in. Declare ${them} beside "${MOVE}", "${MOVING}", "${REORDER}", "${LAND}", "${TOSS}" or "${LEAVE}".`,
        );
      }
      return undefined;
    }
    const tellsWhenGrabbed = types.includes(GRAB);
    const tellsWhenReleased = types.includes(RELEASE);
    const tellsWhenRefused = types.includes(REFUSE);
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
          ? ` Something that moves in place AND goes away when dragged off its surface declares "${LEAVE}" beside "${MOVE}": a release outside the surface is what "${LEAVE}" answers, and it is not a throw.`
          : "";
      console.warn(
        `interactions: "${MOVE}" and "${other}" cannot both answer one release — "${MOVE}" leaves the element where the hand put it, "${other}" carries a copy and puts the original back. "${other}" wins here, so the element never travels.${instead}`,
      );
    }
    if (import.meta.dev && canMoving && (canReorder || canLand || canToss)) {
      const other = canLand ? LAND : canReorder ? REORDER : TOSS;
      console.warn(
        `interactions: "${MOVING}" tells the element ITSELF being carried, and "${other}" carries a copy while the original stays where it is — so there is nothing being moved to tell. "${other}" wins here.`,
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
      // two axes to be put along, a throw goes where it was thrown and a thing
      // that leaves goes out by whichever edge.
      (canReorder && !canLand && !canToss && !canLeave ? "y" : "xy");
    // Where the places are, read at setup for the same reason as the axes: they
    // are what the gesture is about, and it is what holds the two sides of it
    // that says them.
    const dropContainer = element.closest(`[${DROP_CONTAINER_ATTRIBUTE}]`);
    // What a `leave` is outside of when nothing is a place: the surface the
    // element stands in. Looked for above the parent — the element itself may be
    // a place of its own (a piece that receives), which is not what it is inside.
    const outsideOf =
      element.parentElement.closest(`[${DROPPABLE_ATTRIBUTE}]`) || undefined;
    if (import.meta.dev && canLeave && !canLand && !canReorder && !outsideOf) {
      console.warn(
        `interactions: "${LEAVE}" is judged against the surface this element stands in, and nothing above it is marked ${DROPPABLE_ATTRIBUTE} — so it is judged against what can be seen of the scroll container, which on a page is the window. Mark the surface it leaves.`,
        element,
      );
    }

    if (canReorder) {
      element.setAttribute(REORDERABLE_ATTRIBUTE, "");
    }
    // What @jsenv/dom puts on a drag source: the axes written in the DOM for
    // whoever else answers this press (a sheet pushed down to close it, a row of
    // slides), no iOS callout, the touch left to the scroll until the press
    // becomes a grab, and the listener that lets the grab take it back.
    const unmarkDragSource = markDragSource(element, axes);

    // What a release can mean, which is not all of what was declared: "grab",
    // "release" and "refuse" are moments, not outcomes, and "moving" is the carry
    // told while it happens rather than a meaning the release can have — the
    // gesture must not read any of them as ones.
    const effects = types.filter(
      (type) =>
        type === MOVE ||
        type === REORDER ||
        type === LAND ||
        type === TOSS ||
        type === LEAVE,
    );
    // And what the element saying no is about: the carry, whether it is told at
    // the release or all along.
    const carries = canMoving ? [...effects, MOVING] : effects;

    // Whether there is anywhere to land, asked at the first press rather than
    // here: the places are drawn by whatever renders them, which at setup may
    // not have happened yet.
    let placesLookedFor = false;

    const onPointerDown = (pointerDownEvent) => {
      // Asked at every press and never once: what an interaction does is the
      // caller's latest render, and a thing is locked and unlocked while its
      // listeners stay where they are. One outcome saying no is enough — the
      // element is carried or it is not, and each of the five is an answer to
      // that same carry.
      if (carries.some(isRefused)) {
        refuseDragTo(pointerDownEvent, {
          draggedElement: element,
          threshold: readConfig(THRESHOLD_ATTRIBUTE, undefined),
          longPressDelay: readConfig(DELAY_ATTRIBUTE, undefined),
          longPressSlop: readConfig(SLOP_ATTRIBUTE, undefined),
          // The press is still the element's — it stays a drag source, so the
          // surface under it does not pan — and the refusal comes where the grab
          // would have: nothing to be told before that, since up to there the
          // gesture is one that could still have been anything.
          onRefuse: tellsWhenRefused
            ? () => {
                trigger(REFUSE, pointerDownEvent, {
                  pointerType: pointerDownEvent.pointerType,
                });
              }
            : undefined,
        });
        return;
      }
      if (import.meta.dev && canLand && !placesLookedFor) {
        placesLookedFor = true;
        warnWhenNothingToLandOn(element, dropContainer, canLeave);
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
        outsideOf,
        getItemId: (itemElement) => itemElement.id,
        direction: { x: axes.includes("x"), y: axes.includes("y") },
        // Where it may go, said in the DOM. A thing that is put somewhere stays
        // inside what one can SEE of its container ("scrollport", not "scroll":
        // the scrollable area can be far larger than the box, and "inside the box"
        // is what a hand expects). `data-drag-free` lifts that, and so does a
        // named container of places: they are somewhere else by construction, and
        // a copy kept in its own scroll area could never reach them. So does
        // "leave": a thing let go of outside has to be able to get there. Left
        // alone for a throw, which frees the area on its own.
        areaConstraint:
          dropContainer || element.closest(`[data-drag-free]`) || canLeave
            ? "none"
            : canMove || canMoving
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
        // The other moment: the hold ends, whatever it ended up meaning — a
        // landing, a throw, nothing at all, the gesture taken away mid-air. Told
        // before the outcome below is answered, and nothing is done with what
        // comes back either.
        onRelease: tellsWhenReleased
          ? ({ x, y, outcome }) => {
              trigger(RELEASE, pointerDownEvent, {
                id: element.id,
                x,
                y,
                outcome,
              });
            }
          : undefined,
        // Handed straight back in every case: what `trigger` returns is a
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
        onLeave: ({ x, y }) =>
          trigger(LEAVE, pointerDownEvent, { id: element.id, x, y }),
        onMove: ({ x, y }) => trigger(MOVE, pointerDownEvent, { x, y }),
        // Every frame, and nothing is waited on: the caller is drawing, and a
        // draw that has to be awaited before the next frame is one frame late.
        onMoving: canMoving
          ? ({ x, y }) => {
              trigger(MOVING, pointerDownEvent, { x, y });
            }
          : undefined,
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
// from. Nothing then happens at all, and beside `leave` it is worse than nothing:
// every release is away from every place, so every release is a leave.
const warnWhenNothingToLandOn = (element, dropContainer, canLeave) => {
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
  const consequence = canLeave
    ? ` Every release is then away from every place, which "${LEAVE}" answers.`
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
