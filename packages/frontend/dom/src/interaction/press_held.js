/**
 * A press that says something by NOT moving.
 *
 * A finger landing on an element is ambiguous — it may be a tap, a scroll, a
 * swipe — and the one unambiguous signal a finger can give is staying still:
 * travel is exactly what a scroll looks like, so it cannot be the sign. This
 * owns that wait, and only that: what the press then means (an object picked
 * up, a menu opened) belongs to whoever asked for it.
 *
 * The wait also has to hold off the system's own answer to the same gesture: a
 * press held long enough IS the context-menu gesture, and Android's menu (around
 * 500ms) or iOS's callout lands a tenth of a second after the press was
 * answered here. The half of that which is an event is refused below; the half
 * that is not (iOS selecting the word under the finger) is a stylesheet the
 * caller writes on its own elements — `-webkit-touch-callout: none` has to be
 * true before the finger lands, so it cannot be set from here.
 */

/**
 * Waits for a press to be held still, then tells the caller.
 *
 * @param {PointerEvent} pressEvent The `pointerdown` that may become a hold.
 * @param {object} options
 * @param {number} [options.delay=400] How long (ms) the pointer must stay down.
 *   Kept under the system context-menu delay so the press is answered before
 *   the menu would have opened.
 * @param {number} [options.slop=8] How far (px) the pointer may drift during
 *   the wait — beyond it the finger is going somewhere, and a press answered in
 *   passing is a press nobody made.
 * @param {function} [options.onPressStart] The wait began (a cue that the press
 *   counts).
 * @param {function} [options.onPressCancel] The pointer moved or lifted before
 *   the wait was over.
 * @param {(pressEvent: PointerEvent, handle: {endPress: () => void}) => void} options.onPressHeld
 *   The wait completed. Whatever the press now means outlives this call — an
 *   object is being carried, a menu is open under the finger — so the caller
 *   owns the end of it and says when with `endPress`, which is what gives the
 *   context menu back.
 * @returns {{ cancel: () => void }}
 */
export const waitForPressHeld = (
  pressEvent,
  { delay = 400, slop = 8, onPressStart, onPressCancel, onPressHeld },
) => {
  const { pointerId, clientX, clientY } = pressEvent;

  const pressCleanupCallbacks = [];
  const endPress = () => {
    for (const pressCleanupCallback of pressCleanupCallbacks) {
      pressCleanupCallback();
    }
    pressCleanupCallbacks.length = 0;
  };

  /* The listener goes on window, in capture: what answers the press may cover
     the page (a drag backdrop, a popup), and the contextmenu event is then
     aimed at that instead of at the element pressed.
     It is removed when the press ends — a right click with a mouse remains a
     right click. */
  const preventContextMenu = (contextMenuEvent) => {
    contextMenuEvent.preventDefault();
  };
  window.addEventListener("contextmenu", preventContextMenu, true);
  pressCleanupCallbacks.push(() => {
    window.removeEventListener("contextmenu", preventContextMenu, true);
  });

  const countdownCleanupCallbacks = [];
  const endCountdown = () => {
    for (const countdownCleanupCallback of countdownCleanupCallbacks) {
      countdownCleanupCallback();
    }
    countdownCleanupCallbacks.length = 0;
  };

  const timeout = setTimeout(() => {
    endCountdown();
    onPressHeld(pressEvent, { endPress });
  }, delay);
  countdownCleanupCallbacks.push(() => {
    clearTimeout(timeout);
  });

  const cancelPress = (pointerEvent) => {
    endCountdown();
    endPress();
    onPressCancel?.(pointerEvent);
  };
  const onPointerMove = (pointerMoveEvent) => {
    if (pointerMoveEvent.pointerId !== pointerId) {
      return;
    }
    const xDrift = Math.abs(pointerMoveEvent.clientX - clientX);
    const yDrift = Math.abs(pointerMoveEvent.clientY - clientY);
    if (xDrift < slop && yDrift < slop) {
      return;
    }
    // The finger is going somewhere: it is scrolling the page, or running down
    // the list. Letting the countdown survive would answer a press in passing.
    cancelPress(pointerMoveEvent);
  };
  const onPointerEnd = (pointerEndEvent) => {
    if (pointerEndEvent.pointerId !== pointerId) {
      return;
    }
    cancelPress(pointerEndEvent);
  };
  // On window rather than on the element: the finger can leave it, and the
  // element itself can be taken out of the document while the press is waiting.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  countdownCleanupCallbacks.push(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  });

  onPressStart?.(pressEvent);

  return {
    cancel: () => {
      endCountdown();
      endPress();
    },
  };
};
