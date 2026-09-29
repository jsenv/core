/**
 * Which presses are still down, and where each one is now.
 *
 * A press is read by whoever it landed on, from its `pointerdown` to its
 * `pointerup`. Some are handed over halfway: a hold opens a popup, and
 * something inside it takes the press the finger is still making (see
 * `handedOver` in drag_to.js). Whoever receives it was not listening when it
 * began, so it cannot know whether the pointer has let go since, nor where it
 * is now — the `pointerdown` it is handed says where the finger WAS. Listened
 * for from the start instead, on the window in capture so that nothing lower
 * can hide a press from it.
 *
 * Keyed by the `pointerdown` itself and not by the pointer: the same finger
 * lifted and put down again is another press, and a press handed over late
 * must not be answered by the next one.
 */

const pressDownByPointerId = new Map();

/**
 * Where the pointer of `pressEvent` is now, while that press is still down.
 *
 * @param {PointerEvent} pressEvent A `pointerdown`.
 * @returns {{ clientX: number, clientY: number } | null} `null` once that press
 *   has ended — let go of, or cancelled by the browser.
 */
export const readPressDown = (pressEvent) => {
  const pressDown = pressDownByPointerId.get(pressEvent.pointerId);
  if (!pressDown || pressDown.pressEvent !== pressEvent) {
    return null;
  }
  return { clientX: pressDown.clientX, clientY: pressDown.clientY };
};

const onPointerMove = (pointerMoveEvent) => {
  const pressDown = pressDownByPointerId.get(pointerMoveEvent.pointerId);
  if (!pressDown) {
    return;
  }
  pressDown.clientX = pointerMoveEvent.clientX;
  pressDown.clientY = pointerMoveEvent.clientY;
};
const onPointerEnd = (pointerEndEvent) => {
  pressDownByPointerId.delete(pointerEndEvent.pointerId);
  if (pressDownByPointerId.size === 0) {
    // A mouse moves all the time without being pressed: nothing is read from
    // it between presses.
    window.removeEventListener("pointermove", onPointerMove, true);
  }
};
window.addEventListener(
  "pointerdown",
  (pointerDownEvent) => {
    if (pressDownByPointerId.size === 0) {
      window.addEventListener("pointermove", onPointerMove, {
        capture: true,
        passive: true,
      });
    }
    pressDownByPointerId.set(pointerDownEvent.pointerId, {
      pressEvent: pointerDownEvent,
      clientX: pointerDownEvent.clientX,
      clientY: pointerDownEvent.clientY,
    });
  },
  { capture: true, passive: true },
);
window.addEventListener("pointerup", onPointerEnd, {
  capture: true,
  passive: true,
});
window.addEventListener("pointercancel", onPointerEnd, {
  capture: true,
  passive: true,
});
