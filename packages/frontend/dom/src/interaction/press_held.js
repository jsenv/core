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
 * FINGER held long enough IS the context-menu gesture, and Android's menu (around
 * 500ms) or iOS's callout lands a tenth of a second after the press was answered
 * here. The half of that which is an event is refused below; the half that is not
 * (iOS selecting the word under the finger) is a stylesheet the caller writes on
 * its own elements — `-webkit-touch-callout: none` has to be true before the
 * finger lands, so it cannot be set from here.
 *
 * THE REFUSAL LASTS THE PRESS, NOT THE WAIT. The system's delay is the longer of
 * the two, so between the moment this wait gives up and the moment the finger
 * leaves there is a stretch where the menu is still coming — and the press is
 * abandoned far more often than it is held: the finger drifts, another gesture
 * takes the pointer, the browser takes the touch. Given back there, the refusal
 * is given back to a finger that is still down, and the menu it was there for is
 * exactly what arrives. So the finger holds the refusal until it leaves, and the
 * caller holds it for as long as what the press started is still going; the last
 * of the two to let go is what ends it.
 *
 * A mouse is a different matter and is left alone: its context menu comes from
 * the other button, not from this press, and refusing it would take the browser's
 * menu away from an element for no reason.
 */

/* How long the refusal outlives a touch the browser has taken for itself: enough
   to cover the menu that follows the taking (a tenth of a second, on both
   systems), and short enough that the hand cannot have started something else in
   it. */
const MENU_GRACE_AFTER_CANCEL = 300;

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
 *   owns the end of it and says when with `endPress`. That is the caller's half
 *   of what gives the context menu back; the finger leaving is the other half,
 *   and both have to have happened (see the top of this file).
 * @returns {{ cancel: () => void }}
 */
export const waitForPressHeld = (
  pressEvent,
  { delay = 400, slop = 8, onPressStart, onPressCancel, onPressHeld },
) => {
  const { pointerId, clientX, clientY } = pressEvent;

  const pressCleanupCallbacks = [];
  // Who is still holding the refusal. The finger holds it because the finger is
  // what the system's menu answers; the caller holds it from the moment the press
  // is handed over until it says the press is over.
  let fingerHoldsPress = pressEvent.pointerType === "touch";
  let answerHoldsPress = false;
  const endPressWhenNobodyHoldsIt = () => {
    if (fingerHoldsPress || answerHoldsPress) {
      return;
    }
    for (const pressCleanupCallback of pressCleanupCallbacks) {
      pressCleanupCallback();
    }
    pressCleanupCallbacks.length = 0;
  };
  const endPress = () => {
    answerHoldsPress = false;
    endPressWhenNobodyHoldsIt();
  };

  /* A FINGER held down is the system's own context-menu gesture, and the menu it
     raises lands on top of the answer this press was already given. A MOUSE is
     not: its context menu comes from the other button, has nothing to do with
     this press, and is the user asking for the browser's menu — so it is left
     alone, and only a touch press refuses it.
     The listener goes on window, in capture: what answers the press may cover the
     page (a drag backdrop, a popup), and the contextmenu event is then aimed at
     that instead of at the element pressed. */
  if (pressEvent.pointerType === "touch") {
    const preventContextMenu = (contextMenuEvent) => {
      contextMenuEvent.preventDefault();
    };
    window.addEventListener("contextmenu", preventContextMenu, true);
    /* The finger letting go, watched for the length of the press rather than for
       the length of the wait: the wait can be over long before the hand is.
       A pointerCANCEL is not the hand letting go, it is the browser saying it is
       taking the touch for a gesture of its own — and on a press that stayed
       still, that gesture IS the menu. Nothing then says when the finger leaves
       (a cancelled touch gets no end of its own), so the refusal is held a moment
       longer, which is the moment the menu comes in. */
    let menuGraceTimeout;
    const onPressPointerEnd = (pointerEndEvent) => {
      if (pointerEndEvent.pointerId !== pointerId) {
        return;
      }
      if (pointerEndEvent.type === "pointercancel") {
        menuGraceTimeout = setTimeout(() => {
          fingerHoldsPress = false;
          endPressWhenNobodyHoldsIt();
        }, MENU_GRACE_AFTER_CANCEL);
        return;
      }
      fingerHoldsPress = false;
      endPressWhenNobodyHoldsIt();
    };
    window.addEventListener("pointerup", onPressPointerEnd, true);
    window.addEventListener("pointercancel", onPressPointerEnd, true);
    pressCleanupCallbacks.push(() => {
      clearTimeout(menuGraceTimeout);
      window.removeEventListener("contextmenu", preventContextMenu, true);
      window.removeEventListener("pointerup", onPressPointerEnd, true);
      window.removeEventListener("pointercancel", onPressPointerEnd, true);
    });
  }

  const countdownCleanupCallbacks = [];
  const endCountdown = () => {
    for (const countdownCleanupCallback of countdownCleanupCallbacks) {
      countdownCleanupCallback();
    }
    countdownCleanupCallbacks.length = 0;
  };

  const timeout = setTimeout(() => {
    endCountdown();
    // Whatever the press now means outlives the wait, so it holds the refusal
    // from here until the caller says it is over.
    answerHoldsPress = true;
    onPressHeld(pressEvent, { endPress });
  }, delay);
  countdownCleanupCallbacks.push(() => {
    clearTimeout(timeout);
  });

  // The wait is over and the press is not: the finger may still be down, and the
  // menu it is about to be answered with is the one being refused — so endPress
  // here says the answer lets go, and the refusal outlives it until the hand does.
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
  // Somebody else settled what this press is. Taking the pointer is how a gesture
  // says it — and it says it about the same finger this wait is counting on, so
  // whatever the press turned out to be, it is not a hold. Two waits on one press
  // is the ordinary case rather than an odd one: an element that can be picked up
  // AND held answers a finger with two delays, the shorter one wins, and without
  // this the longer one would answer a hundred milliseconds into the carry.
  // The listener goes with the countdown, so the gesture THIS wait starts (which
  // captures the pointer from inside onPressHeld) never reaches it.
  const onGotPointerCapture = (captureEvent) => {
    if (captureEvent.pointerId !== pointerId) {
      return;
    }
    cancelPress(captureEvent);
  };
  // On window rather than on the element: the finger can leave it, and the
  // element itself can be taken out of the document while the press is waiting.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  window.addEventListener("gotpointercapture", onGotPointerCapture, true);
  countdownCleanupCallbacks.push(() => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
    window.removeEventListener("gotpointercapture", onGotPointerCapture, true);
  });

  onPressStart?.(pressEvent);

  return {
    cancel: () => {
      endCountdown();
      endPress();
    },
  };
};
