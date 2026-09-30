/**
 * The element the URL designates — the one whose id is the hash — shows itself
 * when it renders, not when the URL changes.
 *
 * The browser answers a fragment at two moments only: the end of the document
 * load, and each fragment navigation. In an app whose content comes from a
 * request, both are too early — the element does not exist yet, there is
 * nothing to scroll to, and the moment passes.
 *
 * `:target` is lost the same way: the browser sets it only as it answers a
 * fragment navigation, never for an element arriving after the load nor after
 * a pushState, and a pushState dropping the hash leaves it on the element
 * (measured in Chrome, Firefox and Safari). So this file answers the moment —
 * bringing the target under the reader's eyes, saying it just arrived — and
 * keeps `:target` on the element the URL names, which is the durable "this is
 * the one" state an app styles in CSS.
 *
 * Four decisions worth knowing before reading:
 *
 * - **navi places the target itself, on every arrival.** The scroll the
 *   browser would have done — target against the top edge, instantly — is
 *   applied here, after layout, so one rule holds whether the target was there
 *   all along or arrived late; `setUrlTargetOptions` lets an app pick another
 *   alignment or a smooth behavior. A page with nothing to scroll simply
 *   does not move, which is the whole of the "the list already fits on screen"
 *   case — the transient mark alone then says which one was meant.
 *
 * - **A return is not an arrival.** A back, a forward or a reload lands where
 *   the reader was (scroll_restoration.js), as the browser itself does for a
 *   fragment it traverses to. The fragment then only says which element the
 *   URL names: `:target`, no scroll, no mark, no focus.
 *
 * - **Wait for the page, but not forever.** The element is answered once the
 *   document is done working (routes, actions): until then it may not exist
 *   yet, and when it does, what sits above it may still be drawn and push it
 *   down. Once the document has been idle for a moment, a month-old link to a
 *   deleted element simply brings nothing and the reader lands on the page —
 *   the right degradation.
 *
 * - **`:target` is written with a fragment navigation of navi's own.** No API
 *   sets it, so navi replaces the entry with the very address it is at, which
 *   the browser answers like any fragment navigation. Everything else such a
 *   navigation does is put back before anything paints, and the browser
 *   integrations ignore what it announces (see writeTarget).
 *
 * The case where no wait is needed is worth naming: when a list's skeleton
 * already knows the ids of its slice (they are in cache, or they come from the
 * URL), putting them on the placeholders is enough — the target then exists on
 * the very first render and is answered at once. On the placeholder: the row
 * has to be drawn into that same node for `:target` to stay on it.
 */

import { elementIsFocusable } from "@jsenv/dom";
import { computed, effect } from "@preact/signals";

import { observeBeforeRouting } from "../browser_integration/before_routing.js";
import { documentIsBusySignal } from "../browser_integration/document_loading_signal.js";
import { documentUrlSignal } from "../browser_integration/document_url_signal.js";
import { whenRenderingResumes } from "../rendering_hold.js";

const URL_TARGET_ATTRIBUTE = "data-url-target";

const css = /* css */ `
  @layer navi {
    /* Layered whole: the mark is navi's suggestion for "here is what the URL
       pointed at", not something it needs. An app replaces it, or removes it
       with animation: none, from an unlayered rule of any weight. */
    [data-url-target] {
      animation: navi_url_target var(--navi-url-target-duration, 2000ms)
        ease-out;
    }

    @keyframes navi_url_target {
      from {
        box-shadow: 0 0 0 3px
          var(--navi-url-target-color, light-dark(#4476ff, #3b82f6));
      }
      to {
        box-shadow: 0 0 0 3px transparent;
      }
    }
  }
`;
import.meta.css = css;

let urlTargetOptions = {
  block: "start",
  behavior: "instant",
  markDuration: 2000,
  graceAfterIdle: 1000,
  maxWait: 10_000,
};

/**
 * Adjusts how navi answers the element designated by the URL hash.
 *
 * @param {object} options
 * @param {"start"|"center"|"end"|"nearest"} [options.block="start"]
 *   Vertical alignment of the scroll. "start" by default — the alignment the
 *   browser itself uses when it answers a fragment.
 * @param {ScrollBehavior} [options.behavior="instant"]
 *   "instant" by default, like the browser. When set to "smooth", it is
 *   overridden with "instant" under `prefers-reduced-motion: reduce`.
 * @param {number} [options.markDuration=2000]
 *   How long, in ms, the element carries `data-url-target`. Published to CSS as
 *   `--navi-url-target-duration`.
 * @param {number} [options.graceAfterIdle=1000]
 *   How long, in ms, to keep waiting for a target that has not arrived, counted
 *   from the moment the document stops working.
 * @param {number} [options.maxWait=10000]
 *   Longest wait, in ms, for a document that never stops working. The element
 *   is then answered as it stands, when it is there.
 */
export const setUrlTargetOptions = (options) => {
  urlTargetOptions = { ...urlTargetOptions, ...options };
  if (options.markDuration !== undefined) {
    document.documentElement.style.setProperty(
      "--navi-url-target-duration",
      `${options.markDuration}ms`,
    );
  }
};

const urlTargetIdSignal = computed(() => {
  const documentUrl = documentUrlSignal.value;
  return urlToTargetId(documentUrl);
});
/**
 * The id the URL hash designates, or "" when the URL designates none.
 * Reactive: a component reading it re-renders when the target changes.
 */
export const useUrlTargetId = () => {
  return urlTargetIdSignal.value;
};

let stopWaitingForCurrentTarget = null;
let currentTargetKey;

const documentLoadIsReturn = () => {
  const [navigationEntry] = performance.getEntriesByType("navigation");
  if (!navigationEntry) {
    return false;
  }
  return (
    navigationEntry.type === "reload" || navigationEntry.type === "back_forward"
  );
};
// The url the document is on its way back to — a back, a forward, a reload —
// where the reader was, as opposed to a place just sent to. Said by the
// navigation before it writes anything, and by the load for the first url.
let returningToUrl = documentLoadIsReturn() ? window.location.href : null;
observeBeforeRouting(({ url, navigationType }) => {
  returningToUrl = navigationType === "traverse" ? url : null;
});

/**
 * Answers the URL's target again, as if it had just been designated.
 *
 * Clicking the very link one is already on moves nothing — same pathname, same
 * hash, no history entry, no event — so nothing downstream would notice. The
 * reader did ask, again, to be taken to that element.
 */
export const rearmUrlTarget = () => {
  currentTargetKey = undefined;
  armUrlTarget(documentUrlSignal.peek(), { isReturn: false });
};

const armUrlTarget = (documentUrl, { isReturn }) => {
  const targetKey = urlToTargetKey(documentUrl);
  if (targetKey === currentTargetKey) {
    return;
  }
  currentTargetKey = targetKey;
  if (stopWaitingForCurrentTarget) {
    stopWaitingForCurrentTarget();
    stopWaitingForCurrentTarget = null;
  }
  const targetId = urlToTargetId(documentUrl);
  // The browser leaves `:target` on the element a URL named once the URL has
  // stopped naming it — a pushState never touches it.
  const staleTarget = document.querySelector(":target");
  if (staleTarget && staleTarget.id !== targetId) {
    writeTarget(null);
  }
  if (!targetId) {
    return;
  }
  stopWaitingForCurrentTarget = waitForUrlTarget(targetId, (element) => {
    stopWaitingForCurrentTarget = null;
    if (!element.matches(":target")) {
      writeTarget(element);
    }
    if (isReturn) {
      // The offset put back by scroll_restoration.js is the reader's own: the
      // element is named by the URL, not arrived at.
      return;
    }
    revealUrlTarget(element);
  });
};

// The pathname and the hash, not the whole URL: a search param changing (a
// filter, a page) is still the same page and the same target, and must not make
// it answer a second time.
const urlToTargetKey = (url) => {
  const { pathname, hash } = new URL(url);
  return `${pathname}${hash}`;
};
const urlToTargetId = (url) => {
  const { hash } = new URL(url);
  return hash ? decodeURIComponent(hash.slice(1)) : "";
};

// Calls `onSettled` with the element once it can be answered: it exists, it
// shows something, and the document is done working. Found is not enough while
// the document works — what sits above it may still be drawn and push it down,
// and a page reusing a node of the page being left holds it before its own
// data has come.
//
// Confirmed at the next frame, once rendering has resumed: the render the last
// answer asked for has run by then, and a component starting its own run from
// that render has made the document busy again.
const waitForUrlTarget = (id, onSettled) => {
  const { graceAfterIdle, maxWait } = urlTargetOptions;
  let stopped = false;
  let confirmationPending = false;
  let frame = null;
  let mutationObserver = null;
  let stopWatchingBusy = null;
  let idleTimeout = null;
  let maxWaitTimeout = null;

  const stopWaiting = () => {
    stopped = true;
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (stopWatchingBusy) {
      stopWatchingBusy();
      stopWatchingBusy = null;
    }
    clearTimeout(idleTimeout);
    clearTimeout(maxWaitTimeout);
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };

  const findElement = () => {
    const element = document.getElementById(id);
    if (!element) {
      return null;
    }
    // Rendered inside a closed tab, a folded details, a view that is not the
    // one on screen: the element exists but would show nothing.
    if (element.checkVisibility && !element.checkVisibility()) {
      return null;
    }
    return element;
  };
  const settle = (element) => {
    stopWaiting();
    onSettled(element);
  };
  const check = () => {
    if (confirmationPending || documentIsBusySignal.peek() || !findElement()) {
      return;
    }
    confirmationPending = true;
    whenRenderingResumes(() => {
      if (stopped) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        confirmationPending = false;
        if (documentIsBusySignal.peek()) {
          return;
        }
        const element = findElement();
        if (element) {
          settle(element);
        }
      });
    });
  };

  mutationObserver = new MutationObserver(check);
  // Every attribute, not only `id`: what shows an element that is already
  // there — a <details> opening, a tab panel losing its display: none — is an
  // attribute written somewhere above it, and nothing else says so.
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  stopWatchingBusy = effect(() => {
    const documentIsBusy = documentIsBusySignal.value;
    clearTimeout(idleTimeout);
    if (documentIsBusy) {
      return;
    }
    check();
    // The grace is for an element that has not come; one already there and
    // waiting for rendering to resume is not given up on.
    idleTimeout = setTimeout(() => {
      if (!confirmationPending) {
        stopWaiting();
      }
    }, graceAfterIdle);
  });
  // A document that never stops working: the element as it stands, when it is
  // there at all.
  maxWaitTimeout = setTimeout(() => {
    const element = findElement();
    if (element) {
      settle(element);
    } else {
      stopWaiting();
    }
  }, maxWait);

  return stopWaiting;
};

const revealUrlTarget = (element) => {
  const { block, behavior, markDuration } = urlTargetOptions;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  element.scrollIntoView({
    block,
    behavior: prefersReducedMotion ? "instant" : behavior,
  });
  // What the browser does when it handles a fragment itself: keyboard
  // navigation resumes from the target, not from the top of the document.
  if (elementIsFocusable(element)) {
    element.focus({ preventScroll: true });
  }
  element.setAttribute(URL_TARGET_ATTRIBUTE, "");
  setTimeout(() => {
    element.removeAttribute(URL_TARGET_ATTRIBUTE);
  }, markDuration);
};

let targetWriteInProgress = false;
/**
 * True while navi writes the browser's `:target`. The fragment navigation that
 * takes is announced like any other — a popstate, a navigate event, an entry
 * change — and names the address and the state the document is already at, so
 * whoever routes on those events leaves it alone.
 */
export const isTargetWriteInProgress = () => {
  return targetWriteInProgress;
};

// `:target` onto `element`, or off whatever holds it when `element` is null.
//
// A replace towards the address the browser is at: the browser answers it as a
// fragment navigation, and that is the only moment it sets `:target`. It also
// scrolls to what the fragment designates, resets the entry's states
// (history.state in Firefox, the Navigation API state everywhere) and fires a
// popstate (Chrome, Safari) and a navigate event. The address, both states and
// the scroll are put back in the same task, so nothing of it is painted; a
// running view transition is not skipped by it (measured in Chrome, Firefox
// and Safari).
const writeTarget = (element) => {
  const address = window.location.href;
  const historyState = window.history.state;
  const { navigation } = window;
  const entry = navigation ? navigation.currentEntry : null;
  const entryState = entry ? entry.getState() : undefined;
  const putScrollBack = captureScroll(element);
  const addressFragment = new URL(address).hash.slice(1);
  const addressTargetId = decodeURIComponent(addressFragment);

  let fragmentUrl;
  let silencedElement = null;
  if (element) {
    fragmentUrl =
      element.id === addressTargetId
        ? address
        : `${urlWithoutFragment(address)}#${encodeURIComponent(element.id)}`;
  } else if (addressFragment) {
    // The address itself, so the fragment does not change and no hashchange
    // follows; the element it names briefly without its id, so it designates
    // nothing.
    fragmentUrl = address;
    silencedElement = document.getElementById(addressTargetId);
  } else {
    // An empty fragment designates the top of the document; the scroll it
    // makes is put back with the others.
    fragmentUrl = `${address}#`;
  }

  targetWriteInProgress = true;
  try {
    if (silencedElement) {
      silencedElement.removeAttribute("id");
    }
    window.location.replace(fragmentUrl);
  } finally {
    if (silencedElement) {
      silencedElement.id = addressTargetId;
    }
    window.history.replaceState(historyState, null, address);
    // Only a state the entry had is put back: an entry nobody wrote one on
    // (via_history.js never does) has nothing to lose, and updateCurrentEntry
    // cannot say "none" — `state` is a required member, and undefined throws.
    if (entry && navigation.currentEntry && entryState !== undefined) {
      navigation.updateCurrentEntry({ state: entryState });
    }
    targetWriteInProgress = false;
  }
  putScrollBack();
};

// Every box a fragment navigation towards `element` may scroll: its ancestors,
// and the document.
const captureScroll = (element) => {
  const boxes = [];
  let box = element ? element.parentElement : null;
  while (box) {
    boxes.push(box);
    box = box.parentElement;
  }
  const { scrollingElement } = document;
  if (!boxes.includes(scrollingElement)) {
    boxes.push(scrollingElement);
  }
  const positions = boxes.map((box) => {
    return { box, left: box.scrollLeft, top: box.scrollTop };
  });
  return () => {
    for (const { box, left, top } of positions) {
      if (box.scrollLeft !== left || box.scrollTop !== top) {
        box.scrollTo({ left, top, behavior: "instant" });
      }
    }
  };
};

const urlWithoutFragment = (url) => {
  const urlObject = new URL(url);
  urlObject.hash = "";
  return urlObject.href;
};

effect(() => {
  const documentUrl = documentUrlSignal.value;
  const isReturn = returningToUrl === documentUrl;
  returningToUrl = null;
  armUrlTarget(documentUrl, { isReturn });
});
