/**
 * The addresses this tab has stood at: what a link's visited look reads (see
 * use_is_visited.js) — the browser's own `:visited` cannot be read, and knows
 * nothing of an address written by `pushState`.
 *
 * It describes the tab, not an entry, so it is kept once, in the session (a
 * reload of the tab finds it), and no history entry carries a copy: every
 * entry written would serialize the whole set into its state, and WebKit adds
 * each pushed state to a budget per document (64 MiB) past which `pushState`
 * throws.
 *
 * An address is visited once the history holds it: written there (see
 * writeHistoryEntryNow in via_history.js), or traversed to, or loaded. The
 * intermediate addresses of a state whose writes wait for it to settle
 * (`debounceUrl`) never reach the history, and only the settled one counts.
 * The latest few hundred are kept: a link is lit by where the reader has
 * been lately, and the count must not follow the length of a session.
 */

import { signal } from "@preact/signals";

import { whenDocumentMayEnd } from "./document_may_end.js";

const STORAGE_KEY = "navi_visited_urls";
const VISITED_URLS_KEPT = 500;

// In the order they were last stood at, the latest last.
const visitedUrlSet = new Set();
// Moves at every change of the set: links compare their own url again (see
// use_is_visited.js).
export const visitedUrlsSignal = signal(0);

let loaded = false;
const loadVisitedUrls = () => {
  if (loaded) {
    return;
  }
  loaded = true;
  let stored;
  try {
    stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    stored = null;
  }
  if (Array.isArray(stored)) {
    for (const url of stored) {
      if (typeof url === "string") {
        visitedUrlSet.add(url);
      }
    }
  }
  whenDocumentMayEnd(storeVisitedUrls);
};
const storeVisitedUrls = () => {
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(visitedUrlSet)),
    );
  } catch {
    // Full, or refused: only the visited look is lost across a reload.
  }
};

export const isUrlVisited = (url) => {
  loadVisitedUrls();
  return visitedUrlSet.has(url);
};

export const markUrlAsVisited = (url) => {
  loadVisitedUrls();
  if (visitedUrlSet.has(url)) {
    // Stood at again: the latest, the last to go.
    visitedUrlSet.delete(url);
    visitedUrlSet.add(url);
    return;
  }
  visitedUrlSet.add(url);
  if (visitedUrlSet.size > VISITED_URLS_KEPT) {
    const [oldest] = visitedUrlSet;
    visitedUrlSet.delete(oldest);
  }
  visitedUrlsSignal.value++;
};
