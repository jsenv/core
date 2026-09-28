import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { isVisited, visitedUrlsSignal } from "./browser_integration.js";
import { documentUrlSignal } from "./document_url_signal.js";

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
  const visitedSignal = useMemo(
    () =>
      computed(() => {
        // Both are what the answer depends on: the set, and the address a
        // relative url is resolved against (see isVisited).
        // eslint-disable-next-line no-unused-expressions
        visitedUrlsSignal.value;
        // eslint-disable-next-line no-unused-expressions
        documentUrlSignal.value;
        return isVisited(url);
      }),
    [url],
  );
  return visitedSignal.value;
};
