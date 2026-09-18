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
 * would have landed — the flag above is a promise to do the whole job.
 *
 * The document is not the only scrollport of a page. A list scrolling itself
 * (a `<List expandY>` under a search field that stays put) is left and come
 * back to the same way, and the browser never knew it was a scrollport at
 * all: those say where they are by name (rememberScrollerPosition), under the
 * same URL and for the same session, and ask it back when they mount again
 * (recallScrollerPosition). What a push means for them is what it means for
 * the document — an arrival opens at the top (see startAtTop): the page
 * arrived at has its named positions dropped before its lists render, so a
 * list recalls only on the way back. A scroller that goes while its page
 * stays — a popup closing over the same address — has nothing to come back
 * to, and says so as it leaves (forgetScrollerUnlessPageLeft).
 *
 * What is NOT covered, and cannot be from here: a page whose height depends on
 * something still loading. Its content is not there at the moment it is put
 * back, so a position beyond what has arrived is clamped as before. Only the
 * page knows when it is whole.
 *
 * WHEN a page is arrived at is not decided here either. A document navigation
 * lands where its kind says (see via_history.js), and one scrollport can be
 * shared by pages the browser is never told apart: a row of tabs replaces the
 * url under the same document, so the arrival — and the deafness the swap
 * needs, see suspendScrollRecording — is asked for by the row itself (see
 * route_travel.jsx).
 */

import { observeRouteRender } from "../route_render.js";

const STORAGE_KEY = "navi_scroll_positions";

const positionByUrl = new Map();
// url -> (scroller name -> position). The position is whatever the scroller
// handed in: what it can put itself back on, in its own terms.
const scrollerPositionsByUrl = new Map();
// The url each named scroller last spoke under: what tells a scroller leaving
// a page that stays from one leaving with its page.
const urlByScrollerName = new Map();

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

let installed = false;
export const installScrollRestoration = () => {
  if (installed) {
    return;
  }
  installed = true;
  if (!("scrollRestoration" in window.history)) {
    return;
  }
  window.history.scrollRestoration = "manual";
  loadStore();
  // Read as it happens rather than when leaving: a traverse changes the url
  // before anything here is told, so a position read then would be read for
  // the wrong page.
  window.addEventListener(
    "scroll",
    () => {
      if (suspendCount) {
        return;
      }
      positionByUrl.set(window.location.href, {
        x: window.scrollX,
        y: window.scrollY,
      });
    },
    { passive: true },
  );
  // What a reload asks for, now that the browser has been told not to do it.
  // Once, and at the first render of a route: the position is only meaningful
  // once there is a page under it.
  const positionOnLoad = positionByUrl.get(window.location.href);
  if (positionOnLoad && (positionOnLoad.x || positionOnLoad.y)) {
    const stopListening = observeRouteRender(() => {
      stopListening();
      scrollTo(positionOnLoad);
    });
  }
};

// Nothing to put back is not the same as putting back the top: a page arrived
// at for the first time is startAtTop's business, and this must not step on it.
// Whether there was anything, for a caller who has an answer of its own for the
// page that has never been read.
export const restoreScrollPosition = (url) => {
  const position = positionByUrl.get(new URL(url, window.location.href).href);
  if (!position) {
    return false;
  }
  scrollTo(position);
  return true;
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
// The document, because the document is the scrollport in the common case. An
// app that scrolls an element of its own scrolls it itself.
export const startAtTop = (url, { from } = {}) => {
  if (!isArrival(url, { from })) {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
};
const isArrival = (url, { from }) => {
  const urlObject = new URL(url, window.location.href);
  // A fragment names where to land, and the browser is the one that finds it.
  if (urlObject.hash) {
    return false;
  }
  if (
    from !== undefined &&
    new URL(from, window.location.href).pathname === urlObject.pathname
  ) {
    return false;
  }
  return true;
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
export const arriveAtScrollPosition = (url) => {
  if (restoreScrollPosition(url)) {
    return;
  }
  startAtTop(url);
};

const scrollTo = ({ x, y }) => {
  window.scrollTo({ top: y, left: x, behavior: "instant" });
};

export const rememberScrollerPosition = (name, position) => {
  loadStore();
  const url = window.location.href;
  let positionByName = scrollerPositionsByUrl.get(url);
  if (!positionByName) {
    positionByName = new Map();
    scrollerPositionsByUrl.set(url, positionByName);
  }
  positionByName.set(name, position);
  urlByScrollerName.set(name, url);
};

export const recallScrollerPosition = (name) => {
  loadStore();
  const positionByName = scrollerPositionsByUrl.get(window.location.href);
  if (!positionByName) {
    return undefined;
  }
  return positionByName.get(name);
};

// Said by a scroller as it unmounts. Its page is being left when the url is
// already another one — the history is written before the page it names is
// taken down — and then its position is kept for the way back. The url still
// being the one it spoke under means the page stays and the scroller alone
// goes (a popup closing, a section folding): there is no coming back to a
// place that was not left, and a position kept would greet the next mount
// under this address as a return.
export const forgetScrollerUnlessPageLeft = (name) => {
  const url = urlByScrollerName.get(name);
  if (url === undefined) {
    return;
  }
  urlByScrollerName.delete(name);
  if (url !== window.location.href) {
    return;
  }
  const positionByName = scrollerPositionsByUrl.get(url);
  if (positionByName) {
    positionByName.delete(name);
  }
};
