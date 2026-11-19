import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { isVisited, visitedUrlsSignal } from "./browser_integration.js";
import { documentUrlSignal } from "./document_url_signal.js";

const ABSOLUTE_URL = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

/**
 * Hook that reactively checks if a URL is visited.
 * Re-renders when that answer changes — not at every url added to the visited
 * set, which grows at every new address (a search param bound to a wheel
 * writes one at every notch).
 *
 * @param {string} url - The URL to check
 * @returns {boolean} Whether the URL has been visited
 */
export const useIsVisited = (url) => {
  const visitedSignal = useMemo(() => {
    // An absolute url is resolved against nothing: only the set can change
    // the answer, and the address is not followed.
    if (ABSOLUTE_URL.test(String(url))) {
      return computed(() => {
        // eslint-disable-next-line no-unused-expressions
        visitedUrlsSignal.value;
        return isVisited(url);
      });
    }
    return computed(() => {
      // What the answer depends on: the set, and the address a relative url
      // is resolved against (see isVisited).
      // eslint-disable-next-line no-unused-expressions
      visitedUrlsSignal.value;
      // eslint-disable-next-line no-unused-expressions
      documentUrlSignal.value;
      return isVisited(url);
    });
  }, [url]);
  return visitedSignal.value;
};
