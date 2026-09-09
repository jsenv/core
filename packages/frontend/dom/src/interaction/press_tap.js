/**
 * A press that turns out to be a tap: let go of before it went anywhere.
 *
 * The counterpart of the hold next door (press_held.js). That one is a press
 * saying something by NOT moving for long enough; this one is a press saying
 * something by being BRIEF — and it is the same ambiguity read from the other
 * end, so a caller that reads both gets one press told apart once.
 *
 * Its reason to exist is what a tap is NOT: a `click` is the browser's answer to
 * the same question and it cannot be counted, because a browser withholds the
 * clicks of a gesture it is keeping for itself — two taps in a row on a page
 * that can be double-tap-zoomed produce two `pointerup` and a single `click`.
 * Anything counting presses (a double click that has to mean the same thing
 * under a finger and under a mouse) therefore has to read the pointer, and this
 * is that read: one press in, "it stayed a tap" out.
 *
 * What disqualifies a press is exactly what says it became a gesture: it
 * travelled (past `slop`), or the browser took the touch for itself
 * (`pointercancel` — a scroll starting under the finger, the system's own
 * double-tap zoom). How LONG it lasted is not asked here: a press held still is
 * a tap for as long as the hand wants, and whether a slow one still counts
 * towards whatever is being counted belongs to the counter, which is the only
 * one that knows what rhythm it is looking for.
 */

// How far the pointer may travel and still be a tap. Wider than a hold's slop
// because it is a different question: a hold asks whether a finger is standing
// still, a tap only asks whether the press went somewhere — and between two of
// them the finger LEAVES the glass, so what a counter compares is fingertips
// apart rather than pixels apart.
const TAP_SLOP_DEFAULT = 30;

/**
 * Watches one press and says whether it stayed a tap.
 *
 * @param {PointerEvent} pressEvent The `pointerdown` that may be a tap.
 * @param {object} options
 * @param {number} [options.slop=30] How far (px) the pointer may travel before
 *   the press is a gesture rather than a tap.
 * @param {(tapEvent: PointerEvent) => void} options.onTap The press was let go
 *   of, having gone nowhere.
 * @returns {{ cancel: () => void }} Somebody else settled what the press is.
 */
export const waitForTap = (pressEvent, { slop = TAP_SLOP_DEFAULT, onTap }) => {
  const { pointerId, clientX, clientY } = pressEvent;

  const cleanupCallbacks = [];
  const stopWatching = () => {
    for (const cleanupCallback of cleanupCallbacks) {
      cleanupCallback();
    }
    cleanupCallbacks.length = 0;
  };

  const onPointerMove = (pointerMoveEvent) => {
    if (pointerMoveEvent.pointerId !== pointerId) {
      return;
    }
    const xTravel = Math.abs(pointerMoveEvent.clientX - clientX);
    const yTravel = Math.abs(pointerMoveEvent.clientY - clientY);
    if (xTravel < slop && yTravel < slop) {
      return;
    }
    // The press is going somewhere: it is scrolling, swiping, panning, carrying
    // something. Whatever it is, it is not a tap.
    stopWatching();
  };
  const onPointerUp = (pointerUpEvent) => {
    if (pointerUpEvent.pointerId !== pointerId) {
      return;
    }
    stopWatching();
    onTap(pointerUpEvent);
  };
  // Not the hand letting go: the browser saying it is taking the touch for a
  // gesture of its own, which is the one press that ends without ever having
  // been anybody else's.
  const onPointerCancel = (pointerCancelEvent) => {
    if (pointerCancelEvent.pointerId !== pointerId) {
      return;
    }
    stopWatching();
  };
  // On window rather than on the element: the pointer can leave it, and the
  // element itself can be taken out of the document while the press is watched.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  cleanupCallbacks.push(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  });

  return {
    cancel: stopWatching,
  };
};
