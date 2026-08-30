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
const readStoredPositions = () => {
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
    for (const [url, position] of Object.entries(JSON.parse(stored))) {
      positionByUrl.set(url, position);
    }
  } catch {
    // Something else wrote there, or it was truncated.
  }
};
const storePositions = () => {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(positionByUrl)),
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
  readStoredPositions();
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
  window.addEventListener("pagehide", storePositions);
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
// The document, because the document is the scrollport in the common case. An
// app that scrolls an element of its own scrolls it itself.
export const startAtTop = (url) => {
  // A fragment names where to land, and the browser is the one that finds it.
  if (new URL(url, window.location.href).hash) {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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
