/*
 * Whether a scroller is gliding: moving on its own toward a place it was sent
 * to, with no hand on it — a key (Home, PageDown, Space), a smooth `scrollTo`
 * or `scrollIntoView`, the status bar tap on iOS. The other scrolls follow a
 * hand: a finger on the screen, a wheel turning.
 *
 * It matters to whoever writes a scroll position while one plays: the write is
 * an instant scroll, and the browser abandons the glide for it, short of where
 * it was going. A hand is not abandoned: its next report moves the scroller on
 * from wherever the write left it.
 *
 * A scroll is followed from its first "scroll" event to its "scrollend". It is
 * a hand's when a finger was down as it started (the fling a finger leaves
 * behind is still its own), when one is down now, or when a wheel turned
 * around the time it started or since. A finger is down from its
 * touchstart to its touchend, heard on what it touched: a list removes the
 * items scrolled out of its window while the finger is still on one of them,
 * and the touchend of a removed element never reaches the document.
 *
 * In a browser without "scrollend", nothing is said to glide: a scroll would
 * never be seen ending.
 */

// The scroll a wheel turn causes starts in the frame the turn is read, or the
// next one. A turn further from it moved nothing (a wheel at an edge) and is no
// hand on a scroll that came from elsewhere.
const WHEEL_REACH = 100;

const flightMap = new WeakMap();
let fingersDown = 0;
let wheelTimeStamp = -Infinity;

/**
 * @param {Element} scrollerEl
 * @returns {boolean}
 */
export const isScrollGliding = (scrollerEl) => {
  const flight = flightMap.get(scrollerEl);
  if (!flight) {
    return false;
  }
  if (flight.fingerDown || fingersDown > 0) {
    return false;
  }
  if (wheelTimeStamp > flight.timeStamp - WHEEL_REACH) {
    return false;
  }
  return true;
};

// The page scroll is dispatched on the document; the scroller asked about is
// document.scrollingElement.
const asScroller = (eventTarget) => {
  if (eventTarget === document || eventTarget === window) {
    return document.scrollingElement;
  }
  return eventTarget;
};

const onTouchEnd = (e) => {
  fingersDown = e.touches.length;
};

if ("onscrollend" in window) {
  // Capturing: "scroll" and "scrollend" do not bubble from an element.
  document.addEventListener(
    "scroll",
    (e) => {
      const scroller = asScroller(e.target);
      if (flightMap.has(scroller)) {
        return;
      }
      flightMap.set(scroller, {
        timeStamp: e.timeStamp,
        fingerDown: fingersDown > 0,
      });
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "scrollend",
    (e) => {
      flightMap.delete(asScroller(e.target));
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "wheel",
    (e) => {
      wheelTimeStamp = e.timeStamp;
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "touchstart",
    (e) => {
      fingersDown = e.touches.length;
      const touchedEl = e.composedPath()[0];
      touchedEl.addEventListener("touchend", onTouchEnd, { passive: true });
      touchedEl.addEventListener("touchcancel", onTouchEnd, { passive: true });
    },
    { capture: true, passive: true },
  );
}
