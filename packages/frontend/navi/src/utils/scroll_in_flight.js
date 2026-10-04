/*
 * Moves a scroll by what the content moved under the user, unless the write
 * would cost them the scroll in progress. A write is an instant scroll, and
 * the browser abandons for it any scroll it is playing on its own, short of
 * where that one was going: a key (Home, PageDown, Space), a smooth `scrollTo`
 * or `scrollIntoView`, the status bar tap on iOS. A scroll following a hand is
 * not abandoned: the wheel's next turn carries on, and on most engines a
 * finger keeps dragging from wherever the write left it, and the fling it
 * leaves behind once it lifts carries on from there too (Chrome under
 * DevTools' touch emulation: flings written to at every move of a list's
 * window went as far as flings never written to).
 *
 * A fling must not be taken for a scroll the browser plays on its own. A list
 * then leaves uncorrected, for the whole fling, the room its fillers lose above
 * the screen as its window slides: in wematch, cards jumping half a screen
 * several times per fling.
 *
 * Not on iOS. Its finger places the content from where the drag began, so a
 * write under it is undone at the finger's next move — or, when the finger
 * lifts first, lands after the lift and stops the fling dead. And a fling
 * stops on any write during its momentum, as the status bar's scroll to the
 * top does (Safari 26.5 on the simulator: flings of 1700px stopped 130 to 340px
 * after the lift, 3 in 3; a write 50ms before the lift stopped 2 flings in 3).
 * No finger there is a hand a write could hold to, nor the fling it leaves.
 *
 * A scroll is followed from its first "scroll" event to its "scrollend". It is
 * a finger's while a finger is down, and still once the finger lifts if a
 * finger moved it around the time it started or since: the fling goes on in
 * the drag's own scroll, or in a scroll of its own that Chrome starts right
 * after the drag's "scrollend". What counts is a scroll the finger moved, not
 * a lift: a tap on a button calling a smooth `scrollTo` lifts a finger that
 * moved nothing. A scroll is a wheel's when a wheel turned around the time it
 * started or since. A finger is down from its touchstart to its touchend,
 * heard on what it touched: a list removes the items scrolled out of its window
 * while the finger is still on one of them, and the touchend of a removed
 * element never reaches the document.
 *
 * Chrome ends a scroll at every write, a finger's fling included: "scrollend"
 * a frame after the write, and the fling goes on a frame later as a scroll of
 * its own, as far as it was going (a bare page written to every 120ms of a
 * fling: 9 "scrollend" for 8 writes, the fling as long). Taken for a new
 * scroll, it is nobody's once it starts far enough from the finger's last
 * move, and the list's corrections are refused for the rest of the fling: in
 * wematch, cards drawn above the screen pushing it down at every window slide.
 * So a scroll starting right after the "scrollend" of a scroll written to here
 * goes on as that scroll: same start, same hand. Only a written one: a scroll
 * starting right after one that ended on its own is a new one, a key or a
 * smooth `scrollTo` must not pass for the fling before it.
 *
 * In a browser without "scrollend", no write is said to interrupt anything: a
 * scroll would never be seen ending.
 */

// The scroll a wheel turn causes starts in the frame the turn is read, or the
// next one. A turn further from it moved nothing (a wheel at an edge) and is no
// hand on a scroll that came from elsewhere.
const WHEEL_REACH = 100;
// The fling Chrome plays as a scroll of its own starts a frame or two after the
// "scrollend" of the drag, or of a write (DevTools' touch emulation, 4× CPU:
// 12ms after the drag's, 24 to 40ms after a write's in wematch).
const FLING_REACH = 150;
// iOS's touch handling, the one engine whose finger drops writes (see above).
const FINGER_KEEPS_WRITES = !window.CSS.supports(
  "-webkit-touch-callout",
  "none",
);

const flightMap = new WeakMap();
// Scrollers written to since their last "scrollend": that "scrollend" may be
// the write's.
const writtenScrollerSet = new WeakSet();
// The flight of a written scroller, from its "scrollend" until a scroll goes on
// with it.
const writtenFlightEndMap = new WeakMap();
let fingersDown = 0;
let wheelTimeStamp = -Infinity;
let fingerScrollTimeStamp = -Infinity;

/**
 * Answers whether it wrote.
 *
 * @param {Element} scrollerEl
 * @param {number} delta
 * @param {{ horizontal?: boolean }} [options]
 * @returns {boolean}
 */
export const scrollByUnlessInterrupting = (
  scrollerEl,
  delta,
  { horizontal } = {},
) => {
  if (wouldInterruptScroll(scrollerEl)) {
    return false;
  }
  writtenScrollerSet.add(scrollerEl);
  if (horizontal) {
    scrollerEl.scrollLeft += delta;
  } else {
    scrollerEl.scrollTop += delta;
  }
  return true;
};

const wouldInterruptScroll = (scrollerEl) => {
  const flight = flightMap.get(scrollerEl);
  if (!flight) {
    return false;
  }
  if (
    fingersDown > 0 ||
    fingerScrollTimeStamp > flight.timeStamp - FLING_REACH
  ) {
    return !FINGER_KEEPS_WRITES;
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
      if (fingersDown > 0) {
        fingerScrollTimeStamp = e.timeStamp;
      }
      const scroller = asScroller(e.target);
      if (flightMap.has(scroller)) {
        return;
      }
      const writtenFlightEnd = writtenFlightEndMap.get(scroller);
      writtenFlightEndMap.delete(scroller);
      if (
        writtenFlightEnd &&
        e.timeStamp - writtenFlightEnd.timeStamp < FLING_REACH
      ) {
        flightMap.set(scroller, writtenFlightEnd.flight);
        return;
      }
      flightMap.set(scroller, { timeStamp: e.timeStamp });
    },
    { capture: true, passive: true },
  );
  document.addEventListener(
    "scrollend",
    (e) => {
      const scroller = asScroller(e.target);
      const flight = flightMap.get(scroller);
      flightMap.delete(scroller);
      if (flight && writtenScrollerSet.has(scroller)) {
        writtenFlightEndMap.set(scroller, { flight, timeStamp: e.timeStamp });
      }
      writtenScrollerSet.delete(scroller);
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
