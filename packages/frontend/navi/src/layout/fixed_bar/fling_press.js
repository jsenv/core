/**
 * The press that stops a fling, on what the fling does not move.
 *
 * Thrown by a thumb, a page keeps scrolling once the finger lifts, and a finger
 * landing meanwhile stops it. Chrome for Android keeps the click of that touch
 * to itself: `pointerdown` and `pointerup` reach the page, the click does not
 * (measured on a phone, 2v2's bottom bar). Over a list that is right: the
 * content was moving under the finger, and what the touch landed on is not
 * what the hand aimed at. A fixed bar does not move, so an entry touched there
 * is the entry meant. Losing its press makes it look dead: it shrinks under the
 * finger and does nothing, the tab already shown needs a second tap to bring
 * its page back up, and the tab of another page does not go there.
 *
 * So a press on the bar that began during a fling and lifted as a tap is
 * answered at its `pointerup`, with the click the browser would have given:
 * dispatched on what the finger touched, it runs whatever that click runs (the
 * ui action, the action, the command, the link followed). Then the click that
 * may still come for that press is swallowed: Chrome gives it when what was
 * moving is a smooth `scrollTo` taken for a fling, and another engine may give
 * it after a fling too. It is told apart by the press it follows, never by a
 * delay: a click comes before the next press does (click_suppression.js in
 * @jsenv/dom). Its `pointerId` cannot tell it: WebKit gives the click of a
 * touch the mouse's.
 *
 * The click dispatched here is a press's click, so a gesture that took the
 * press (a hold opening a menu) swallows it like the browser's.
 *
 * A scroller around what was pressed carries it, the document's excepted (the
 * bar is fixed to the window). A row of tabs scrolling inside the bar moves its
 * tabs under the finger, and a pane of a route row holds what it has in
 * position: fixed (route_travel.jsx). A fling there leaves the browser's call
 * standing.
 */

import { suppressClickAfterGesture, waitForTap } from "@jsenv/dom";

import { findFlingsInFlight } from "../../utils/scroll_in_flight.js";

// The browser's: a touch that moved further gets no click from Chrome
// (docs/mobile_touch.md).
const TAP_SLOP = 8;
// Held longer, a finger is the system's long press (around 500ms on Android,
// see press_held.js in @jsenv/dom), which gets no click either.
const TAP_LONGEST_MS = 500;

/**
 * @param {Element} element What stands still while the page scrolls under it.
 * @returns {() => void} Stops answering.
 */
export const answerPressesStoppingAFling = (element) => {
  const onPointerDown = (pointerDownEvent) => {
    if (
      pointerDownEvent.pointerType === "mouse" ||
      !pointerDownEvent.isPrimary
    ) {
      return;
    }
    if (!landsOnAFling(pointerDownEvent)) {
      return;
    }
    waitForTap(pointerDownEvent, {
      slop: TAP_SLOP,
      onTap: (pointerUpEvent) => {
        if (
          pointerUpEvent.timeStamp - pointerDownEvent.timeStamp >
          TAP_LONGEST_MS
        ) {
          return;
        }
        answerPress(pointerDownEvent.target, pointerUpEvent);
      },
    });
  };
  element.addEventListener("pointerdown", onPointerDown, { capture: true });
  return () => {
    element.removeEventListener("pointerdown", onPointerDown, {
      capture: true,
    });
  };
};

const landsOnAFling = (pointerDownEvent) => {
  const flingingScrollers = findFlingsInFlight(pointerDownEvent.timeStamp);
  if (flingingScrollers.length === 0) {
    return false;
  }
  const pressedElement = pointerDownEvent.target;
  const rootScroller = document.scrollingElement;
  for (const scroller of flingingScrollers) {
    if (scroller !== rootScroller && scroller.contains(pressedElement)) {
      return false;
    }
  }
  return true;
};

const answerPress = (pressedElement, pointerUpEvent) => {
  if (!pressedElement.isConnected) {
    return;
  }
  pressedElement.dispatchEvent(
    new PointerEvent("click", {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      // A press's click (isPressDrivenClick in @jsenv/dom).
      detail: 1,
      screenX: pointerUpEvent.screenX,
      screenY: pointerUpEvent.screenY,
      clientX: pointerUpEvent.clientX,
      clientY: pointerUpEvent.clientY,
      ctrlKey: pointerUpEvent.ctrlKey,
      shiftKey: pointerUpEvent.shiftKey,
      altKey: pointerUpEvent.altKey,
      metaKey: pointerUpEvent.metaKey,
      button: 0,
      buttons: 0,
      pointerId: pointerUpEvent.pointerId,
      pointerType: pointerUpEvent.pointerType,
      isPrimary: true,
    }),
  );
  const clickSuppressionIsOver = suppressClickAfterGesture();
  clickSuppressionIsOver();
};
