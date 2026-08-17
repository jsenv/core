/**
 * The element the URL designates — the one whose id is the hash — shows itself
 * when it renders, not when the URL changes.
 *
 * The browser answers a fragment at two moments only: the end of the document
 * load, and each fragment navigation. In an app whose content comes from a
 * request, both are too early — the element does not exist yet, there is
 * nothing to scroll to, and the moment passes.
 *
 * What is already acquired, and what this file therefore does not redo:
 * `:target` is live — as soon as an element carries the hash's id it matches,
 * even if it arrives a second later. The durable "this is the one" state is
 * there for free, and an app styles it in CSS. What is lost is the one-shot
 * action tied to a moment: bringing the target under the reader's eyes, and
 * saying it just arrived. That is all of what follows.
 *
 * Two decisions worth knowing before reading:
 *
 * - **navi places the target itself, every time.** Where the browser does
 *   answer a fragment it puts the element against the top edge, where it reads
 *   as the first thing on the page rather than as the one that was pointed at;
 *   the alignment below is applied after, so one rule holds whether the target
 *   was there all along or arrived late. A page with nothing to scroll simply
 *   does not move, which is the whole of the "the list already fits on screen"
 *   case — the transient mark alone then says which one was meant.
 *
 * - **Wait, but not forever.** As long as the document is working (routes,
 *   actions) the target may still arrive; once it has been idle for a moment, a
 *   month-old link to a deleted element simply brings nothing and the reader
 *   lands on the page — the right degradation.
 *
 * The case where none of this is needed is worth naming: when a list's skeleton
 * already knows the ids of its slice (they are in cache, or they come from the
 * URL), putting them on the placeholders is enough — the target then exists on
 * the very first render and the browser does everything on its own.
 */

import { elementIsFocusable } from "@jsenv/dom";
import { computed, effect } from "@preact/signals";

import { documentIsBusySignal } from "../browser_integration/document_loading_signal.js";
import { documentUrlSignal } from "../browser_integration/document_url_signal.js";

const URL_TARGET_ATTRIBUTE = "data-url-target";

const css = /* css */ `
  @layer navi {
    [${URL_TARGET_ATTRIBUTE}] {
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
  block: "center",
  behavior: "smooth",
  markDuration: 2000,
  graceAfterIdle: 1000,
  maxWait: 10_000,
};

/**
 * Adjusts how navi answers the element designated by the URL hash.
 *
 * @param {object} options
 * @param {"start"|"center"|"end"|"nearest"} [options.block="center"]
 *   Vertical alignment of the scroll. "center" by default: an element stuck to
 *   the top of the screen reads as the first one of the page rather than as the
 *   one that was pointed at.
 * @param {ScrollBehavior} [options.behavior="smooth"]
 *   Overridden with "instant" under `prefers-reduced-motion: reduce`.
 * @param {number} [options.markDuration=2000]
 *   How long, in ms, the element carries `data-url-target`. Published to CSS as
 *   `--navi-url-target-duration`.
 * @param {number} [options.graceAfterIdle=1000]
 *   How long, in ms, to keep waiting for a target that has not arrived, counted
 *   from the moment the document stops working.
 * @param {number} [options.maxWait=10000]
 *   Longest wait, in ms, for a document that never stops working.
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

/**
 * Answers the URL's target again, as if it had just been designated.
 *
 * Clicking the very link one is already on moves nothing — same pathname, same
 * hash, no history entry, no event — so nothing downstream would notice. The
 * reader did ask, again, to be taken to that element.
 */
export const rearmUrlTarget = () => {
  currentTargetKey = undefined;
  armUrlTarget(documentUrlSignal.peek());
};

const armUrlTarget = (documentUrl) => {
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
  if (!targetId) {
    return;
  }
  stopWaitingForCurrentTarget = waitForElementWithId(targetId, (element) => {
    stopWaitingForCurrentTarget = null;
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

const waitForElementWithId = (id, onFound) => {
  let mutationObserver = null;
  let stopWatchingBusy = null;
  let idleTimeout = null;
  let maxWaitTimeout = null;
  let found = false;

  const stopWaiting = () => {
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
  };

  const checkForElement = () => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    // Rendered inside a closed tab, a folded details, a view that is not the
    // one on screen: the element exists but would show nothing. Keep waiting —
    // it is the same wait, for the same reason.
    if (element.checkVisibility && !element.checkVisibility()) {
      return;
    }
    found = true;
    stopWaiting();
    onFound(element);
  };

  checkForElement();
  if (found) {
    return stopWaiting;
  }

  mutationObserver = new MutationObserver(checkForElement);
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["id"],
  });
  const { graceAfterIdle, maxWait } = urlTargetOptions;
  stopWatchingBusy = effect(() => {
    const documentIsBusy = documentIsBusySignal.value;
    clearTimeout(idleTimeout);
    if (!documentIsBusy) {
      idleTimeout = setTimeout(stopWaiting, graceAfterIdle);
    }
  });
  maxWaitTimeout = setTimeout(stopWaiting, maxWait);

  return stopWaiting;
};

const revealUrlTarget = (element) => {
  const { block, behavior, markDuration } = urlTargetOptions;
  // The element just entered the DOM: where it sits is only known once layout
  // has run.
  requestAnimationFrame(() => {
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
  });
};

const elementIsFullyVisibleInViewport = (element) => {
  const { top, bottom, left, right } = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  return (
    top >= 0 && left >= 0 && bottom <= viewportHeight && right <= viewportWidth
  );
};

effect(() => {
  const documentUrl = documentUrlSignal.value;
  armUrlTarget(documentUrl);
});
