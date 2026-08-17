/**
 * The click a gesture leaves behind.
 *
 * A press that turned into something else — an object carried, a screen swiped,
 * a menu opened by holding still — still ends with a `pointerup`, and the
 * browser follows that with a `click` on whatever the pointer was over. On a
 * link or a button that click means "follow me", which is not what the hand
 * asked for: the press was already answered, by the gesture.
 *
 * So it is swallowed, once, in capture on the document — before any handler an
 * element may have, and without anyone having to know which element that is.
 */

/**
 * Swallows the next click, for a gesture that has just answered the press.
 *
 * @returns {() => void} the gesture is over. The suppressor cannot be taken
 *   down with it — the click is dispatched AFTER the pointerup that ends the
 *   gesture, so it would be gone one event too early, and the drag would end on
 *   the link it started from being followed. It goes once it has swallowed a
 *   click, or at the next press if the gesture produced none: a click is always
 *   preceded by a press, so a suppressor that outlives one press can never
 *   reach the click of another.
 */
export const suppressClickAfterGesture = () => {
  const suppressClick = (clickEvent) => {
    clickEvent.stopPropagation();
    clickEvent.preventDefault();
    stopSuppressing();
  };
  const stopSuppressing = () => {
    document.removeEventListener("click", suppressClick, { capture: true });
    document.removeEventListener("pointerdown", stopSuppressing, {
      capture: true,
    });
  };
  document.addEventListener("click", suppressClick, { capture: true });
  return () => {
    document.addEventListener("pointerdown", stopSuppressing, {
      capture: true,
    });
  };
};
