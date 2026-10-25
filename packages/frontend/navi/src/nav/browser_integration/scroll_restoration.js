/**
 * Where a page was left, given back when one comes back to it.
 *
 * The browser does this on its own, and gets it wrong here for a reason that
 * has nothing to do with it: it puts the offset back at the instant the entry
 * changes, when the document still holds the page being LEFT. A position
 * further down than that page is tall is clamped to its bottom and lost — so
 * coming back to a long page from a short one lands short, and the deeper one
 * was, the more is missing.
 *
 * So the browser is told to stop (`scrollRestoration = "manual"`) and the
 * position is put back once the page one is coming back to is really there —
 * through the same wait as everything else that must not happen before the
 * picture of a transition is taken (see rendering_hold.js): restored after the
 * picture, the page arriving would be photographed at the top and seen jumping
 * from it.
 *
 * Kept per URL rather than per history entry: an entry has no name of its own
 * that survives a reload, and two entries on the same URL are the same place
 * to a reader. Kept in the session too, so a reload lands where the browser
 * would have landed — the flag above is a promise to do the whole job. Only a
 * reload or a back/forward load finds them: a document loaded fresh in the
 * same tab — an address typed, a link from outside — is an arrival, which the
 * browser lands at its top (see documentLoadIsReturn).
 *
 * The document is not the only scrollport of a page. A list scrolling itself
 * (a `<List expandY>` under a search field that stays put) is left and come
 * back to the same way, and the browser never knew it was a scrollport at
 * all: those say where they are by name (rememberScrollerPosition), under the
 * same URL and for the same session, and ask it back when they mount again
 * (recallScrollerPosition). What a push means for them is what it means for
 * the document — an arrival opens at the top (see startAtTop): the page
 * arrived at has its named positions dropped before its lists render, so a
 * list recalls only on the way back — or on a push that says it is one (see
 * link_return.js). A scroller that outlives a navigation —
 * its page stays under a new address, or it lives outside the page that
 * changed — is shown under the new address too, and is carried to it (see
 * carryScrollersOnceRendered). A scroller that goes while its page stays — a
 * popup closing over the same address — has nothing to come back to, and says
 * so as it leaves (forgetScrollerUnlessPageLeft).
 *
 * Every position is kept under the address the routing shows, which can be
 * ahead of the browser's: a replace waiting for its state to settle has moved
 * the page and not yet `window.location` (see readShownUrl).
 *
 * A page whose height depends on something still loading is not there at the
 * moment it is put back, and a position beyond what has arrived is clamped.
 * What navi knows a first render left out, it waits for: a `<Box
 * mount="after-paint">` is built before the offset that shows it is written
 * (see mount_after_paint.jsx), and a reload or a return waits for the route
 * actions the page has nothing to draw for — its code among them — including
 * one whose `when` lets it ask after the position is written (see
 * stayForLateAsks). Anything else only the page knows, and it says so
 * (useHoldScrollRestoration). A wait can be long, so the reader reaching for
 * the page during it cancels the position: moved afterwards, they would lose
 * whatever they had started on.
 *
 * WHEN a page is arrived at is not decided here either. A document navigation
 * lands where its kind says (see via_history.js), and one scrollport can be
 * shared by pages the browser is never told apart: a row of tabs replaces the
 * url under the same document, so the arrival — and the deafness the swap
 * needs, see suspendScrollRecording — is asked for by the row itself (see
 * route_travel.jsx).
 */

import { effect } from "@preact/signals";
import { useLayoutEffect } from "preact/hooks";

import { COMPLETED, IDLE, RUNNING } from "../../action/action_run_states.js";
import { buildDeferredBoxesAbove } from "../../box/mount_after_paint.jsx";
import { afterPaint } from "../../utils/after_paint.js";
import { whenPageRendered } from "../rendering_hold.js";
import {
  activeRouteActionsSignal,
  routeActionYetToAskSignal,
} from "../route_action.js";
import { observeRouteRender } from "../route_render.js";

const STORAGE_KEY = "navi_scroll_positions";

const positionByUrl = new Map();
// Where the document stands, as its scroll events last said, whoever it
// belongs to: what a url shown without the document moving is given (see
// stayInPlace). Null until the restoration is installed — nothing is recorded
// before.
let documentOffset = null;
// url -> (scroller name -> position). The position is whatever the scroller
// handed in: what it can put itself back on, in its own terms.
const scrollerPositionsByUrl = new Map();
// What each named scroller still mounted last said: its position and the url
// it said it under. What tells a scroller leaving a page that stays from one
// leaving with its page, and what one outliving a navigation is carried with.
const saidByScrollerName = new Map();

// The address the page is shown under, as the routing knows it (see
// installScrollRestoration): `window.location` lags behind a replace waiting
// for its state to settle (replaceAddressWhenSettled in either integration),
// and a scroll keyed by it meanwhile is written for the address being left.
// Resolved, as an address handed to navTo can be kept as it was given.
let readRoutingAddress = () => window.location.href;
const readShownUrl = () => {
  return new URL(readRoutingAddress(), window.location.href).href;
};

/**
 * Whether the document was loaded to come back to where the reader was — a
 * reload, a back or a forward into it — rather than sent to its address.
 */
export const documentLoadIsReturn = () => {
  const [navigationEntry] = performance.getEntriesByType("navigation");
  if (!navigationEntry) {
    return false;
  }
  return (
    navigationEntry.type === "reload" || navigationEntry.type === "back_forward"
  );
};
// Read as the document starts: the positions are loaded later, by whoever
// needs them first, and the page may have moved by then.
const urlArrivedAtByLoad = documentLoadIsReturn() ? null : window.location.href;

// Read once, the first time anyone needs the positions: the document's
// restoration is installed by the routing, and a list remembering itself may
// mount in an app that never routes.
let storeLoaded = false;
const loadStore = () => {
  if (storeLoaded) {
    return;
  }
  storeLoaded = true;
  window.addEventListener("pagehide", storePositions);
  let stored;
  try {
    stored = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    // A session storage that refuses to answer (a private window, a policy) is
    // not a reason to lose the positions of THIS session.
    return;
  }
  if (!stored) {
    return;
  }
  try {
    const { document: documentPositions, scrollers } = JSON.parse(stored);
    for (const [url, position] of Object.entries(documentPositions || {})) {
      positionByUrl.set(url, position);
    }
    for (const [url, positionByName] of Object.entries(scrollers || {})) {
      scrollerPositionsByUrl.set(url, new Map(Object.entries(positionByName)));
    }
  } catch {
    // Something else wrote there, or it was truncated.
  }
  // The address a fresh load arrived at is opened as an arrival, the document
  // and its lists alike (see forgetScrollersOnArrival): what the session kept
  // there is for a reload or a return.
  if (urlArrivedAtByLoad !== null) {
    positionByUrl.delete(urlArrivedAtByLoad);
    scrollerPositionsByUrl.delete(urlArrivedAtByLoad);
  }
};
const storePositions = () => {
  const scrollers = {};
  for (const [url, positionByName] of scrollerPositionsByUrl) {
    if (positionByName.size > 0) {
      scrollers[url] = Object.fromEntries(positionByName);
    }
  }
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        document: Object.fromEntries(positionByUrl),
        scrollers,
      }),
    );
  } catch {
    // Full, or refused: the session is the only thing lost.
  }
};

// The document is one scrollport for every page put in it, so a page swapped
// under it for a shorter one is an offset the browser CLAMPS — and a clamp is
// a scroll event like any other. It is not the reader scrolling, and by the
// time it fires the url is already the arriving page's: written down, it is
// that page's own position that the page being left destroys.
//
// Only whoever swaps the page knows when that is happening, so the deafness is
// asked for from there and lasts exactly as long as the swap. Counted rather
// than flagged: two swaps overlap — a travel relaying into the next one under
// the same finger, a travel being undone while it plays.
let suspendCount = 0;
export const suspendScrollRecording = () => {
  suspendCount++;
  let resumed = false;
  return () => {
    if (resumed) {
      return;
    }
    resumed = true;
    suspendCount--;
  };
};

// The position a reload or a return is about to put back, until it is written
// into a page that will ask nothing more (see stayForLateAsks). Where the
// document lands is the last arrival's to say: an arrival decided meanwhile — a
// page that sends the reader elsewhere as it mounts — replaces it (see
// startAtTop), and must not be scrolled to where the return was going. So does
// the reader reaching for the page: where they are is theirs (see
// installScrollRestoration).
let pendingRestoration = null;
const startRestoration = (position) => {
  const restoration = { position, due: false };
  pendingRestoration = restoration;
  return restoration;
};
// Called once the page is there. Outside the commit that rendered it: what the
// offset shows may still have to be built (see scrollTo).
const putBack = (restoration) => {
  if (pendingRestoration !== restoration) {
    return;
  }
  restoration.due = true;
  if (restorationHoldCount) {
    // The page is not whole yet: the last release puts it back.
    return;
  }
  if (isDocumentHeld()) {
    pendingRestoration = null;
    return;
  }
  scrollTo(restoration.position);
  restoration.due = false;
  stayForLateAsks(restoration);
};

// A list scrolling the document that opens on a row puts the document where
// that row is, by measuring it (see placeWhereHeld in list.jsx). The offset kept
// for the url is pixels of the page as it was drawn — and a list draws a window
// of its rows and holds the room of the others with fillers of an estimated
// height, so the same pixels now fall on other rows. Put back after the list
// has placed itself, they would undo it, in the very picture a route transition
// takes. So the list holds the document while it is placing itself, and the
// url's offset is not put back meanwhile. One hold per list: two lists can
// share one document.
//
// A hold is for the page its list is on, and mounted is not shown: a page kept
// while its route transition plays still has its list when the page returned to
// renders, and that list says nothing about where the page arriving goes. So a
// hold is taken with the list's page (RoutePageContext), asked whether it is
// shown when a position is due — `null` outside any route container: that list
// is on whatever page is shown. Not a url: which page an address shows is the
// routes' to say, and one page can be shown under several (its params moving
// under it).
const documentHolds = new Set();
export const holdDocumentScroll = (routePage) => {
  const hold = { routePage };
  documentHolds.add(hold);
  return () => {
    documentHolds.delete(hold);
  };
};
const isDocumentHeld = () => {
  for (const { routePage } of documentHolds) {
    if (routePage === null || routePage.isShown()) {
      return true;
    }
  }
  return false;
};

// What a page holds instead: not the place, which stays the url's, but the
// moment it is put back (see useHoldScrollRestoration). Counted: several parts
// of one page can be waiting.
let restorationHoldCount = 0;
const holdScrollRestoration = () => {
  restorationHoldCount++;
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    restorationHoldCount--;
    if (restorationHoldCount) {
      return;
    }
    const restoration = pendingRestoration;
    if (restoration && restoration.due) {
      // Released from the commit that drew what was missing.
      queueMicrotask(() => {
        putBack(restoration);
      });
    }
  };
};

/**
 * Holds back the scroll position a reload or a back/forward gives the page,
 * while the page is not whole yet: written into what the page shows meanwhile,
 * it is clamped to that height and lost. Put back after the commit in which
 * `held` turns false — unless the reader has reached for the page in the
 * meantime (a finger, a click, a wheel, a key), or gone elsewhere.
 *
 * The page's route actions are waited for without this — its code, a read
 * with no answer yet, one whose `when` holds later. This is for
 * what navi cannot see: a read the page starts itself, content whose height
 * arrives late.
 *
 * ```jsx
 * const [games] = useAsyncData(GAMES, { loading: true, run: true });
 * useHoldScrollRestoration(games === undefined);
 * ```
 *
 * @param {boolean} held - true while what sets the page's height is missing.
 *   A read that fails leaves it true, and nothing is written: the screen saying
 *   so is not the page the position was taken on.
 */
export const useHoldScrollRestoration = (held) => {
  useLayoutEffect(() => {
    if (!held) {
      return undefined;
    }
    return holdScrollRestoration();
  }, [held]);
};

let installed = false;
export const installScrollRestoration = ({ readAddress }) => {
  if (installed) {
    return;
  }
  installed = true;
  readRoutingAddress = readAddress;
  if (!("scrollRestoration" in window.history)) {
    return;
  }
  window.history.scrollRestoration = "manual";
  loadStore();
  documentOffset = { x: window.scrollX, y: window.scrollY };
  // Read as it happens rather than when leaving: a traverse changes the url
  // before anything here is told, so a position read then would be read for
  // the wrong page.
  window.addEventListener(
    "scroll",
    () => {
      documentOffset = { x: window.scrollX, y: window.scrollY };
      if (suspendCount) {
        return;
      }
      positionByUrl.set(readShownUrl(), documentOffset);
    },
    { passive: true },
  );
  // The reader taking over is told by their hand, not by a scroll event: the
  // page arriving clamps the document as much as they move it.
  const onReaderReach = (event) => {
    if (event.isTrusted) {
      pendingRestoration = null;
    }
  };
  for (const type of ["pointerdown", "wheel", "keydown"]) {
    window.addEventListener(type, onReaderReach, {
      capture: true,
      passive: true,
    });
  }
  const urlOnLoad = readShownUrl();
  const positionOnLoad = positionByUrl.get(urlOnLoad);
  if (!positionOnLoad) {
    // The first page, where the browser landed it: no scroll event says so
    // (see stayInPlace).
    positionByUrl.set(urlOnLoad, documentOffset);
    return;
  }
  // What a reload asks for, now that the browser has been told not to do it.
  if (positionOnLoad.x || positionOnLoad.y) {
    restoreScrollPositionOnLoad(positionOnLoad);
  }
};

// The position is only meaningful once there is a page under it: at the first
// render of a route, unless that render had nothing to draw for one of the
// route actions asking — the page's code arriving on its own, a read the
// previous document did not keep. What it drew is their stand-in, a pending
// screen or a <Loading> fallback, which clamps the offset; so the position
// waits for their answers and the render that draws them.
//
// Nothing is written when one of them fails: the screen saying so is not the
// page the position was taken on, and the position stays for the reload that
// brings the page back.
const restoreScrollPositionOnLoad = (position) => {
  const restoration = startRestoration(position);
  const stopListening = observeRouteRender(() => {
    stopListening();
    putBackOnceAnswered(restoration);
  });
};

// Reads the actions to wait for at once: called from the commit of a render,
// the ones it had nothing to draw for are those still running then. An answer
// can start another read (params made of that answer), so the actions asking
// are read again before the position is written.
//
// The same for a reload and a return: a return to a page this document has
// never drawn, or whose read was reset since, finds no answer either.
const putBackOnceAnswered = (restoration) => {
  const unanswered = readUnansweredRouteActions();
  if (unanswered.length === 0) {
    queueMicrotask(() => {
      putBack(restoration);
    });
    return;
  }
  // A reader drawing its own wait subscribes in an effect, after the first
  // paint (see afterPaint): an answer that came before is drawn only then.
  let waitCount = 2;
  const waitOver = () => {
    waitCount--;
    if (waitCount === 0) {
      whenPageRendered(() => {
        putBackOnceAnswered(restoration);
      });
    }
  };
  afterPaint(waitOver);
  whenSettled(unanswered, (answered) => {
    if (answered) {
      waitOver();
    }
  });
};

const readUnansweredRouteActions = () => {
  const unanswered = [];
  for (const routeAction of activeRouteActionsSignal.peek()) {
    if (
      routeAction.runningStateSignal.peek() === RUNNING &&
      routeAction.dataSignal.peek() === undefined
    ) {
      unanswered.push(routeAction);
    }
  }
  return unanswered;
};

// A page can still be arriving after the position is written: an action whose
// `when` waits for app state not there yet (see routeActionYetToAskSignal). So
// a written position stays pending while one does: the next one that starts
// without an answer is waited for like the first ones, and the position put
// back once it is drawn. Params that say no are not waited for: the address
// asks nothing of the action, and one that asks later — a search typed — is
// the page moving on under the reader, not arriving. Not told when the
// restoration is dropped (pendingRestoration is no signal): it notices at its
// next run.
const stayForLateAsks = (restoration) => {
  effect(function () {
    let running = false;
    let starting = false;
    for (const routeAction of activeRouteActionsSignal.value) {
      if (routeAction.dataSignal.value !== undefined) {
        continue;
      }
      const runningState = routeAction.runningStateSignal.value;
      if (runningState === RUNNING) {
        running = true;
      } else if (runningState === IDLE) {
        // Asking, and run by an effect of the same batch that has not run yet.
        starting = true;
      }
    }
    const yetToAsk = routeActionYetToAskSignal.value;
    if (pendingRestoration !== restoration) {
      this.dispose();
      return;
    }
    if (running) {
      this.dispose();
      putBackOnceAnswered(restoration);
      return;
    }
    if (starting || yetToAsk) {
      return;
    }
    this.dispose();
    pendingRestoration = null;
  });
};

// Calls back once none of the actions is running, saying whether all of them
// completed.
const whenSettled = (actions, callback) => {
  const unsubscribes = [];
  const check = () => {
    let completed = true;
    for (const action of actions) {
      const state = action.runningStateSignal.peek();
      if (state === RUNNING) {
        return;
      }
      if (state !== COMPLETED) {
        completed = false;
      }
    }
    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
    callback(completed);
  };
  for (const action of actions) {
    unsubscribes.push(action.runningStateSignal.subscribe(check));
  }
};

// Nothing to put back is not the same as putting back the top: a page arrived
// at for the first time is startAtTop's business, and this must not step on it.
// Whether there was anything, for a caller who has an answer of its own for the
// page that has never been read.
//
// Written at once, never held (see useHoldScrollRestoration): a row of tabs
// measures its window right after.
const restoreScrollPosition = (url) => {
  pendingRestoration = null;
  const position = positionByUrl.get(new URL(url, window.location.href).href);
  if (!position) {
    return false;
  }
  if (isDocumentHeld()) {
    // There is a place to go back to, and the list holding the document on
    // that page is putting it back (see holdDocumentScroll).
    return true;
  }
  scrollTo(position);
  return true;
};

// A traversal back to `url`. The offset is written once the page returned to is
// rendered and answered (see putBackOnceAnswered): written sooner, the document
// still holds the page being left, or a stand-in for the one arriving, and
// clamps it to that height. It is read at once all the same — a page left
// taller than the one arriving is clamped by the render itself, and that clamp
// is a scroll recorded under the url already returned to.
export const restoreScrollPositionOnReturn = (url) => {
  pendingRestoration = null;
  const href = new URL(url, window.location.href).href;
  carryScrollersOnceRendered(href);
  const position = positionByUrl.get(href);
  if (!position) {
    return;
  }
  const restoration = startRestoration(position);
  whenPageRendered(() => {
    putBackOnceAnswered(restoration);
  });
};

// A page one arrives at for the first time starts at its top. Only a document
// navigation does that on its own: a pushState creates its entry with whatever
// scroll happened to be there, so without this the page opens at the offset of
// the one before it — and that borrowed offset is what is then remembered FOR
// it, and handed back on the way forward.
//
// Arrived at, which a push does not always mean. A push that keeps the pathname
// stacks an entry over the document the reader is scrolled in — a layer opened
// over the screen, a param whose values are places one came from (see
// navigation.md) — and the page under the new address is the one they never
// left. The path names the page; the search says what is drawn on or over it.
// So `from`, the url being left, tells an arrival from the same place said
// differently, and only the first is moved.
//
// A fragment does not make it less of an arrival. The browser finds nothing to
// scroll to after a pushState; url_target.js brings the element in once it
// renders, from this top — and when it never comes, the page is read from its
// top like any other.
//
// The document, because the document is the scrollport in the common case. An
// app that scrolls an element of its own scrolls it itself.
export const startAtTop = (url, { from } = {}) => {
  if (!isArrival(url, { from })) {
    stayInPlace(url);
    return;
  }
  pendingRestoration = null;
  const href = new URL(url, window.location.href).href;
  carryScrollersOnceRendered(href);
  // Written down as well as done: a document already at its top fires no
  // scroll event, and a page left without ever being scrolled would have no
  // position to come back to — the return would keep the offset of the page
  // being left.
  positionByUrl.set(href, { x: 0, y: 0 });
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};
// Also what decides whether a push carries the state of the page it keeps
// (see resolveEffectiveDocumentState).
export const isArrival = (url, { from }) => {
  if (
    from !== undefined &&
    new URL(from, window.location.href).pathname ===
      new URL(url, window.location.href).pathname
  ) {
    return false;
  }
  return true;
};

// A url the page is shown under without changing: a replace, a push that
// keeps the page (see startAtTop). Nothing scrolls, so nothing says where the
// document stands under it — written down here, or a return to it would find
// nothing and keep the offset of the page being left.
//
// The offset as its scroll events last told it, not read again: a read here
// would lay the page out in the middle of a routing, once per address a
// settling param writes. Deaf with the recording: a row of tabs replaces the
// url as it travels, and the offset belongs to nobody until the row says where
// its tab lands (see arriveAtScrollPosition).
export const stayInPlace = (url) => {
  const href = new URL(url, window.location.href).href;
  carryScrollersOnceRendered(href);
  if (documentOffset !== null && !suspendCount) {
    positionByUrl.set(href, documentOffset);
  }
};

// A scroller that outlives a navigation — its page stays under the new url, or
// it lives outside the page that changed (a sidebar list kept by every page) —
// is shown under that url as well, and says nothing there unless it moves: a
// return to it would find no position and open the list at its top. So it is
// carried, with the position it last said.
//
// Told apart once the navigation has rendered: until then a list about to be
// swapped out is as mounted as one that stays, and carried, its position is
// what a list of the same name arriving would read. By then one that left has
// said so (forgetScrollerUnlessPageLeft), and one that arrived has read its
// own and speaks under this url. One still mounted on its way out (a page kept
// hidden while its route transition plays) is carried, and forgets the copy as
// it unmounts under this url.
const carryScrollersOnceRendered = (url) => {
  whenPageRendered(() => {
    if (readShownUrl() !== url) {
      // Another navigation came first: what is mounted is shown under its url,
      // and its own carry says so.
      return;
    }
    for (const [name, said] of saidByScrollerName) {
      if (said.url === url) {
        continue;
      }
      writeScrollerPosition(url, name, said.position);
    }
  });
};

// A push that reads as a return (see link_return.js) lands where its address
// was last left, as a traversal does (restoreScrollPositionOnReturn) — when it
// was ever left: an address never read is an arrival like any other, and a push
// that keeps the page moves nothing either way.
export const hasScrollPositionToReturnTo = (url, { from }) => {
  if (!isArrival(url, { from })) {
    return false;
  }
  return positionByUrl.has(new URL(url, window.location.href).href);
};

// The same arrival, for the page's own scrollers. The document is scrolled to
// its top once the page is there; a list opens where it decides to in its
// first render, so what it must not find is dropped before the routing
// renders anything.
export const forgetScrollersOnArrival = (url, { from } = {}) => {
  if (!isArrival(url, { from })) {
    return;
  }
  scrollerPositionsByUrl.delete(new URL(url, window.location.href).href);
};

// An arrival at a page whose scrollport is already showing another one: the
// tabs of a row share the document, and the offset on it is whichever tab was
// last read. Where this one was read, and its top when it never was — leaving
// the offset alone would seat the reader wherever the neighbour happened to
// be, so here "nothing recorded" and "stay" are not the same thing.
//
// Called outside a Preact commit only, like scrollTo: a row of tabs measures
// its window right after, so what the top shows is built first here rather
// than in the frame (see mount_after_paint.jsx).
export const arriveAtScrollPosition = (url) => {
  if (restoreScrollPosition(url)) {
    return;
  }
  buildDeferredBoxesAbove(window.innerHeight);
  startAtTop(url);
};

// What the offset shows is built first: written into a document still missing
// a deferred box, the offset is clamped (see mount_after_paint.jsx). That build
// is a render of its own, so this is never called from inside a commit — a
// caller that learns the page is there from a layout effect (observeRouteRender)
// writes once that commit has ended.
const scrollTo = ({ x, y }) => {
  buildDeferredBoxesAbove(y + window.innerHeight);
  window.scrollTo({ top: y, left: x, behavior: "instant" });
};

export const rememberScrollerPosition = (name, position) => {
  loadStore();
  writeScrollerPosition(readShownUrl(), name, position);
};
const writeScrollerPosition = (url, name, position) => {
  let positionByName = scrollerPositionsByUrl.get(url);
  if (!positionByName) {
    positionByName = new Map();
    scrollerPositionsByUrl.set(url, positionByName);
  }
  positionByName.set(name, position);
  saidByScrollerName.set(name, { url, position });
};

export const recallScrollerPosition = (name) => {
  loadStore();
  const positionByName = scrollerPositionsByUrl.get(readShownUrl());
  if (!positionByName) {
    return undefined;
  }
  return positionByName.get(name);
};

// Said by a scroller as it unmounts. Its page is being left when the url is
// already another one — the history is written before the page it names is
// taken down — and then its position is kept for the way back. The url still
// being the one it was last kept under means the page stays and the scroller
// alone goes (a popup closing, a section folding): there is no coming back to
// a place that was not left, and a position kept would greet the next mount
// under this address as a return.
export const forgetScrollerUnlessPageLeft = (name) => {
  const said = saidByScrollerName.get(name);
  if (said === undefined) {
    return;
  }
  saidByScrollerName.delete(name);
  const { url } = said;
  if (url !== readShownUrl()) {
    return;
  }
  const positionByName = scrollerPositionsByUrl.get(url);
  if (positionByName) {
    positionByName.delete(name);
  }
};
