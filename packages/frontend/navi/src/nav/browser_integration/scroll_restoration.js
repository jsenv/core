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
 */

import { observeRouteRender } from "../route.jsx";

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
export const restoreScrollPosition = (url) => {
  const position = positionByUrl.get(new URL(url, window.location.href).href);
  if (!position) {
    return;
  }
  scrollTo(position);
};

const scrollTo = ({ x, y }) => {
  window.scrollTo({ top: y, left: x, behavior: "instant" });
};
