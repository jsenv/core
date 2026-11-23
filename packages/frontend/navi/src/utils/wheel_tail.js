/**
 * The wheel a hand has already let go of, kept off a scroll a press asked for.
 *
 * Thrown on a trackpad (or a Magic Mouse), a scroller keeps scrolling once the
 * fingers lift: the system sends wheel events for a second or two more, each
 * smaller than the last. A press meanwhile sending the scroller somewhere (a
 * tab bringing its list back to the start) is overtaken by them: the scroller
 * sets off, and the tail carries it back. Measured with trackpad events posted
 * through macOS, a smooth `scrollTo(0)` asked mid-tail ended 116px from the
 * top in Chrome 156 and 413px in WebKit 27.2. Firefox 157 is not concerned:
 * its own scroll wins over the tail.
 *
 * The tail cannot be refused. In Chrome and WebKit only the first wheel event
 * of a gesture is cancelable, and the rest are dispatched `cancelable: false`
 * whatever listens. So the scroller is taken from the wheel instead:
 * `overflow: hidden` until the tail is over. A script still scrolls it, the
 * wheel no longer does. Chrome then drops the rest of the tail; WebKit hands
 * it to the scroller around (the page, when the page can scroll). Given back
 * before the tail is over, the scroller is carried again from where it stands.
 * Chrome scrolls the tail off the main thread, where the hold arrives at the
 * next commit: a step already on its way still lands, after what the press
 * wrote that frame (2v2, Chrome 157: 50 to 140px, 12 runs in 20).
 *
 * `scrollbar-gutter: stable` keeps the room of the scrollbar the hold hides:
 * a list whose width changes reflows every item it draws. Where the room
 * cannot be kept (the document's own scrollbar, in Chrome), the scroller is
 * left to the tail rather than reflowed.
 *
 * The tail is over at the first silence, or at the first event of a new
 * gesture: fingers landing on the trackpad end the momentum, and the new
 * gesture's first event is the one that is cancelable.
 */

import { readWheelHand } from "./scroll_in_flight.js";

// A tail sends an event every frame until it dies out, and Chrome coalesces
// them while the main thread is busy: a gap this long is the end of it.
const WHEEL_SILENCE = 150;

const holdMap = new Map();

/**
 * Takes the scroller from a wheel still moving it, for the length of what the
 * wheel has left. Does nothing when no wheel is moving it.
 *
 * @param {Element} scrollerEl
 */
export const holdOffWheelTail = (scrollerEl) => {
  if (holdMap.has(scrollerEl)) {
    return;
  }
  const wheelHand = readWheelHand();
  if (
    !wheelHand ||
    wheelHand.scroller !== scrollerEl ||
    performance.now() - wheelHand.timeStamp > WHEEL_SILENCE
  ) {
    return;
  }
  const { clientWidth, clientHeight } = scrollerEl;
  const heldStyles = {
    "overflow-x": "hidden",
    "overflow-y": "hidden",
  };
  // An application's own gutter is left as it is: it already keeps the room.
  if (window.getComputedStyle(scrollerEl).scrollbarGutter === "auto") {
    heldStyles["scrollbar-gutter"] = "stable";
  }
  const restoreStyles = writeStyles(scrollerEl, heldStyles);
  if (
    scrollerEl.clientWidth !== clientWidth ||
    scrollerEl.clientHeight !== clientHeight
  ) {
    restoreStyles();
    return;
  }
  const hold = {
    restoreStyles,
    silenceTimeout: null,
    armSilence: () => {
      clearTimeout(hold.silenceTimeout);
      hold.silenceTimeout = setTimeout(() => {
        release(scrollerEl);
      }, WHEEL_SILENCE);
    },
  };
  hold.armSilence();
  if (holdMap.size === 0) {
    // Not passive: whether an event is cancelable is what tells a new
    // gesture, and a page with no blocking listener gets none that are.
    window.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });
  }
  holdMap.set(scrollerEl, hold);
};

/**
 * Whether the wheel events reaching `scrollerEl` are the tail it is held off:
 * a hand that let go, not one reaching for it.
 *
 * @param {Element} scrollerEl
 * @returns {boolean}
 */
export const isWheelTailHeld = (scrollerEl) => holdMap.has(scrollerEl);

const onWheel = (e) => {
  if (!e.cancelable) {
    for (const hold of holdMap.values()) {
      hold.armSilence();
    }
    return;
  }
  // A new gesture. Which scroller it goes to is decided at this event, and a
  // held one is passed over for the one around it: refused here, the gesture
  // starts at its next event, on the scroller given back.
  for (const scrollerEl of holdMap.keys()) {
    if (scrollerEl.contains(e.target)) {
      e.preventDefault();
    }
  }
  for (const scrollerEl of [...holdMap.keys()]) {
    release(scrollerEl);
  }
};

const release = (scrollerEl) => {
  const hold = holdMap.get(scrollerEl);
  if (!hold) {
    return;
  }
  holdMap.delete(scrollerEl);
  clearTimeout(hold.silenceTimeout);
  hold.restoreStyles();
  if (holdMap.size === 0) {
    window.removeEventListener("wheel", onWheel, { capture: true });
  }
};

const writeStyles = (element, values) => {
  const { style } = element;
  const saved = [];
  for (const name of Object.keys(values)) {
    saved.push([
      name,
      style.getPropertyValue(name),
      style.getPropertyPriority(name),
    ]);
    style.setProperty(name, values[name], "important");
  }
  return () => {
    for (const [name, value, priority] of saved) {
      if (value === "") {
        style.removeProperty(name);
      } else {
        style.setProperty(name, value, priority);
      }
    }
  };
};
