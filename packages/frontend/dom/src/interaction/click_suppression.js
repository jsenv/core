/**
 * The click a gesture leaves behind.
 *
 * A press that turned into something else — an object carried, a screen swiped,
 * a menu opened by holding still — still ends with a `pointerup`, and the
 * browser follows that with a `click` on whatever the pointer was over. On a
 * link or a button that click means "follow me", which is not what the hand
 * asked for: the press was already answered, by the gesture.
 *
 * So it is swallowed, once, before any other listener sees it. Being first is
 * earned twice, because both orderings matter:
 *
 * - on `window`, the first target of the capture phase — a listener anywhere
 *   lower (document included) comes after, no matter when it was registered.
 * - registered at module load — among listeners on the same target and phase,
 *   registration order decides. A listener added when the gesture ends would
 *   lose to any window-capture listener registered at startup (@jsenv/navi's
 *   link interception is one), so the listener is permanent and merely armed
 *   by each gesture.
 *
 * A window-capture listener that this module's evaluation cannot be proven to
 * precede must not bet on that order: it checks `clickIsSuppressed()` and
 * stands aside on its own.
 */

let suppressing = false;
let disarmAtNextPress = false;

const suppressClick = (clickEvent) => {
  if (!suppressing) {
    return;
  }
  suppressing = false;
  disarmAtNextPress = false;
  clickEvent.preventDefault();
  clickEvent.stopImmediatePropagation();
};
const onPointerDown = () => {
  if (disarmAtNextPress) {
    suppressing = false;
    disarmAtNextPress = false;
  }
};
window.addEventListener("click", suppressClick, { capture: true });
window.addEventListener("pointerdown", onPointerDown, { capture: true });

/**
 * Swallows the next click, for a gesture that has just answered the press.
 *
 * @returns {() => void} the gesture is over. The suppression cannot be lifted
 *   with it — the click is dispatched AFTER the pointerup that ends the
 *   gesture, so it would be gone one event too early, and the drag would end on
 *   the link it started from being followed. It lifts once it has swallowed a
 *   click, or at the next press if the gesture produced none: a click is always
 *   preceded by a press, so a suppression that outlives one press can never
 *   reach the click of another.
 */
export const suppressClickAfterGesture = () => {
  suppressing = true;
  disarmAtNextPress = false;
  return () => {
    disarmAtNextPress = true;
  };
};

/**
 * Whether the click being dispatched is one a gesture left behind — armed by
 * `suppressClickAfterGesture`, waiting to be swallowed by this module.
 *
 * A last resort, not a convenience. The suppressor already swallows the click
 * before anyone else sees it; the one listener that legitimately needs to ask
 * is a `click` listener in capture on `window` whose registration cannot be
 * proven to come after this module's evaluation — that one may run before the
 * suppressor and must stand aside on its own. Everywhere else (an element,
 * `document`, the bubble phase) the click never arrives and checking this is
 * dead code. Reach for it only when you are sure that is your situation and
 * no other ordering is available.
 */
export const clickIsSuppressed = () => suppressing;
