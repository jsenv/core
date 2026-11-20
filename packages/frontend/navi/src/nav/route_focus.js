/**
 * Where the keyboard goes when the router changes what is on screen.
 *
 * A page arriving is an arrival like any other (see the focus skill and
 * docs/autofocus.md): the keyboard goes to what one came for, through the
 * ladder every container uses, with its policy for a coarse pointer. And a
 * return goes back to where one was. The router is the one owner of that for
 * what it shows: the page of a route container, the pane a RouteTravel row
 * shows. It hands over in the steps a SlideContainer takes (see
 * utils/focus/focus_hand_over.js):
 *
 * - Prepared before the navigation's first write (observeBeforeRouting), while
 *   what asked for it is in hand: the modality, and the address being left —
 *   what a return gives the focus back to.
 * - Landed once what arrived has committed and the renders it set off are over,
 *   into the outermost thing that arrived: a page arriving builds the routes
 *   inside it too, and is the one that speaks for them.
 * - Landed again once the page is at rest (whenPageAtRest) when that found
 *   nothing to take the keyboard: a page waiting for its code or its reads
 *   arrives as a title or a skeleton, or suspended to the <Loading> around it,
 *   and what it came to draw commits later.
 * - Only into a void: the focus on nothing, on document.body, in a page kept
 *   hidden while leaving, in the pane a row is leaving. Held anywhere that
 *   stays — a tab bar above the routes, a field the page arriving focused
 *   itself (autoFocus) — it is left where it is.
 *
 * Three arrivals are not handed over:
 * - a load or a reload: the browser places nothing on a document load beyond
 *   what asks for it (autoFocus), and neither does navi;
 * - an address designating an element (a hash): that arrival is url_target's,
 *   its focus included;
 * - a navigation bringing nothing new on screen (a search param written, a
 *   page carried over to its next address): there is nothing to land in, and
 *   the next navigation takes the place of what was prepared.
 *
 * A page of a route container is mounted anew on a return, so nothing in it
 * remembers what was pressed: the address left does. On a return the page is
 * landed once it is at rest — its reads answered, its lists back where they
 * were (whenPageAtRest) — on the link that leads to the address left, when the
 * page draws one, and through the ladder otherwise. A pane of a row stays built
 * and is told what it was left on before it goes (markAutofocusRestore), which
 * its transfer reads first.
 */

import { elementIsFocusable } from "@jsenv/dom";

import { afterRendersSettle } from "../utils/focus/focus_hand_over.js";
import {
  moveFocusTo,
  prepareFocusTransfer,
} from "../utils/focus/focus_transfer.js";
import { observeBeforeRouting } from "./browser_integration/before_routing.js";
import { documentUrlSignal } from "./browser_integration/document_url_signal.js";
import { whenPageAtRest } from "./route_action.js";
import { urlDesignatesElement } from "./url_target/url_target.js";

const LEAVING_SELECTOR = "[data-navi-route-leaving]";
const noDebug = () => {};

let handOver = null;
let cancelLandingAtRest = null;
observeBeforeRouting(({ navigationType }) => {
  if (navigationType === "load" || navigationType === "reload") {
    handOver = null;
    return;
  }
  handOver = {
    isReturn: navigationType === "traverse",
    urlLeft: documentUrlSignal.peek(),
    focusTransfer: prepareFocusTransfer(undefined, noDebug),
    arrivals: [],
  };
});

/**
 * Said from the commit that puts something new on screen.
 *
 * @param {object} arrival
 * @param {"page"|"pane"} arrival.kind - a page of a route container, read as
 *   the elements it renders; a pane of a row, one element that stays built.
 * @param {() => Element[]} arrival.readRoots - what arrived, read at the landing.
 * @param {() => boolean} [arrival.isShown] - whether it is still on screen when
 *   a return lands, a moment later.
 * @param {Element} [arrival.leaving] - the part being left, still within reach
 *   until the landing (a row's pane): the focus in it is the focus to hand over.
 * @param {() => void} [arrival.afterLanding] - what waits for the focus to have
 *   moved on: putting the part left out of reach. Called at once when no
 *   navigation is being handed over.
 */
export const reportRouteArrival = (arrival) => {
  if (!handOver) {
    arrival.afterLanding?.();
    return;
  }
  const current = handOver;
  current.arrivals.push(arrival);
  if (current.arrivals.length === 1) {
    // What arrives now takes the place of what was still owed a landing: the
    // keyboard follows the latest page. A navigation bringing nothing new on
    // screen (a search param written as the page arrives) leaves that landing
    // owed: the page it is for is still the one on screen.
    if (cancelLandingAtRest) {
      cancelLandingAtRest();
      cancelLandingAtRest = null;
    }
    afterRendersSettle(() => {
      land(current);
    });
  }
};

const land = (current) => {
  const { arrivals } = current;
  current.arrivals = [];
  if (handOver === current) {
    handOver = null;
  }
  const leavingParts = arrivals
    .map((arrival) => arrival.leaving)
    .filter(Boolean);
  try {
    if (!focusIsInVoid(leavingParts)) {
      return;
    }
    const outermost = findOutermost(arrivals);
    if (current.isReturn && (!outermost || outermost.arrival.kind === "page")) {
      landWhenAtRest(current, arrivals);
      return;
    }
    if (urlDesignatesElement(documentUrlSignal.peek())) {
      return;
    }
    if (outermost) {
      transferInto(current, outermost);
    }
    // Nothing took the keyboard: the page arrived waiting — its code, its reads
    // — on a screen with nothing to land on yet (a title, a skeleton), or
    // suspended to the <Loading> around it with nothing of it in the DOM. Its
    // content commits later, with nothing left to hand it the keyboard: the
    // arrival was the one moment there was. So the landing is owed until the
    // page is at rest, and the ladder runs again then.
    if (focusIsInVoid(leavingParts)) {
      landWhenAtRest(current, arrivals);
    }
  } finally {
    for (const arrival of arrivals) {
      arrival.afterLanding?.();
    }
  }
};

// The arrival that holds the others — a page arriving builds the routes inside
// it too — read as it stands now: an arrival with nothing of it in the DOM
// (suspended) is not one.
const findOutermost = (arrivals) => {
  const readings = [];
  for (const arrival of arrivals) {
    const roots = arrival.readRoots();
    if (roots.length > 0) {
      readings.push({ arrival, roots });
    }
  }
  return readings.find(
    (reading) =>
      !readings.some(
        (other) =>
          other !== reading &&
          other.roots.some((otherRoot) =>
            reading.roots.some(
              (root) => otherRoot !== root && otherRoot.contains(root),
            ),
          ),
      ),
  );
};

const transferInto = (current, { arrival, roots }) => {
  current.focusTransfer.transferFocus(
    undefined,
    arrival.kind === "pane" ? roots[0] : roots,
  );
};

const focusIsInVoid = (leavingParts) => {
  const focusedElement = document.activeElement;
  if (!focusedElement || focusedElement === document.body) {
    return true;
  }
  if (focusedElement.closest(LEAVING_SELECTOR)) {
    return true;
  }
  return leavingParts.some((part) => part.contains(focusedElement));
};

// Once the page is at rest, its reads answered and its lists back where they
// were: what it draws then is what it came to draw. Only into a void still —
// the keyboard used meanwhile (a Tab, a field pressed) is the reader's own
// landing — and only into what is still on screen.
const landWhenAtRest = (current, arrivals) => {
  cancelLandingAtRest = whenPageAtRest(() => {
    cancelLandingAtRest = null;
    if (!focusIsInVoid([])) {
      return;
    }
    const outermost = findOutermost(
      arrivals.filter((arrival) => !arrival.isShown || arrival.isShown()),
    );
    if (!outermost) {
      return;
    }
    const { arrival, roots } = outermost;
    if (current.isReturn && arrival.kind === "page") {
      const link = findLinkTo(roots, current.urlLeft);
      if (link) {
        moveFocusTo(link, {
          focusVisible: current.focusTransfer.focusVisible,
        });
        return;
      }
    }
    transferInto(current, outermost);
  });
};

// The link the reader left by, as the page draws it now: an anchor whose
// address is the one left, and that can take the focus (drawn, within reach).
const findLinkTo = (roots, url) => {
  const href = new URL(url, window.location.href).href;
  for (const root of roots) {
    const links = root.matches("a[href]")
      ? [root, ...root.querySelectorAll("a[href]")]
      : root.querySelectorAll("a[href]");
    for (const link of links) {
      if (link.href === href && elementIsFocusable(link)) {
        return link;
      }
    }
  }
  return null;
};
