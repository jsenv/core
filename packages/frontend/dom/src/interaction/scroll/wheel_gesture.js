/**
 * Who is answering the wheel gesture happening right now.
 *
 * A wheel gesture has no beginning and no end of its own: it is a burst of
 * events that starts when the fingers move and goes on after they are gone —
 * the tail of it is the momentum the system keeps sending. And it has no target
 * either: every event is aimed at whatever happens to be under the pointer at
 * that instant. So a burst that began over one box lands on another as soon as
 * the hand drifts, or as soon as what was under it has travelled away — and
 * read box by box, ONE gesture is answered twice: a slide moves, then the box
 * around it moves too, under a hand that pushed once.
 *
 * Hence an owner. Whoever answers a burst first says so, everyone else asks
 * before answering, and the owner keeps it until the events stop coming.
 * Silence is the only end there is, which is why an owner has to say it is
 * still there on every event of its gesture — a claim nobody renews is a
 * gesture that is over.
 */

// How long a silence ends a gesture, for an owner that says nothing else: long
// enough to survive a page that is busy — the frames right after something sets
// off are the ones where the main thread has the most to do, and a silence read
// there as "the hand is gone" would cut one gesture into several.
const GESTURE_END_DELAY = 150;

let gestureOwner = null;
let gestureOnEnd = null;
let gestureEndTimeout = null;

const endGesture = () => {
  const onEnd = gestureOnEnd;
  gestureOwner = null;
  gestureOnEnd = null;
  gestureEndTimeout = null;
  onEnd?.();
};

/**
 * Is the burst going on right now somebody else's? Asked before answering a
 * wheel event: `false` means it is free, or already this one's.
 */
export const wheelGestureIsTakenFrom = (candidate) =>
  gestureOwner !== null && gestureOwner !== candidate;

/**
 * Take the gesture, or say it is still going. Called on every event of it: the
 * claim lapses on its own once `delay` goes by without a word, and `onEnd` is
 * how the owner hears about that — it is the only end a wheel gesture has.
 *
 * @param {any} owner - anything that can be compared, usually the element.
 * @param {object} [options]
 * @param {() => void} [options.onEnd] - the silence was long enough.
 * @param {number} [options.delay] - how long that silence is.
 */
export const claimWheelGesture = (
  owner,
  { onEnd, delay = GESTURE_END_DELAY } = {},
) => {
  if (wheelGestureIsTakenFrom(owner)) {
    return false;
  }
  gestureOwner = owner;
  gestureOnEnd = onEnd;
  clearTimeout(gestureEndTimeout);
  gestureEndTimeout = setTimeout(endGesture, delay);
  return true;
};

/**
 * Give it back before the silence does — the box is going away, the gesture was
 * handed to something else. Whoever does not own it says nothing.
 */
export const releaseWheelGesture = (owner) => {
  if (gestureOwner !== owner) {
    return;
  }
  clearTimeout(gestureEndTimeout);
  endGesture();
};
