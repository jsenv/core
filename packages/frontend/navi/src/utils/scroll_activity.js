/*
 * Who is scrolling right now, told to the DOM: while an element scrolls it
 * carries `navi-scrolling`, so anyone concerned reacts in CSS, without a
 * listener and without a subscription.
 *
 * The one this exists for is hover. A scroll moves the content under a
 * motionless pointer, so the browser dispatches mouseenter/mouseleave for every
 * element crossing the cursor — a dozen per wheel tick. Those hovers are noise:
 * the user asked to scroll, not to hover. Anything doing real work on hover (a
 * map highlight, a preview, a prefetch) then pays for that noise on the main
 * thread, exactly while a scroll animation is running. A rule matching
 * `[navi-scrolling] *` takes the rows out of hit-testing and the browser
 * suppresses it all, at no cost per element.
 *
 * One capturing listener on the document sees them all: "scroll" does not
 * bubble, but it does propagate in the capture phase.
 */

import { signal } from "@preact/signals";

// A scroller is still moving after its last "scroll" event (momentum, smooth
// scrolling, the gap between two wheel ticks), so "still scrolling" is a
// timeout: long enough to bridge that gap, short enough that hover comes back
// as soon as the user stops.
const SCROLL_IDLE_DELAY = 120;

/**
 * True while anything in the page is being scrolled.
 */
export const scrollActivitySignal = signal(false);

/**
 * @param {Element} [element] The scroller to ask about; any scroller when omitted.
 * @returns {boolean}
 */
export const isScrolling = (element) => {
  if (element === undefined) {
    return scrollActivitySignal.peek();
  }
  return asScroller(element).hasAttribute("navi-scrolling");
};

// The page scroll is dispatched on the document; the element carrying the
// attribute is the one CSS can reach, document.scrollingElement.
const asScroller = (eventTargetOrElement) => {
  if (eventTargetOrElement === document || eventTargetOrElement === window) {
    return document.scrollingElement;
  }
  return eventTargetOrElement;
};

const idleTimeoutMap = new Map();
document.addEventListener(
  "scroll",
  (e) => {
    const scroller = asScroller(e.target);
    const idleTimeout = idleTimeoutMap.get(scroller);
    if (idleTimeout !== undefined) {
      clearTimeout(idleTimeout);
    } else {
      scroller.setAttribute("navi-scrolling", "");
      scrollActivitySignal.value = true;
    }
    idleTimeoutMap.set(
      scroller,
      setTimeout(() => {
        idleTimeoutMap.delete(scroller);
        scroller.removeAttribute("navi-scrolling");
        if (idleTimeoutMap.size === 0) {
          scrollActivitySignal.value = false;
        }
      }, SCROLL_IDLE_DELAY),
    );
  },
  { capture: true, passive: true },
);
