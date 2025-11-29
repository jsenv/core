import { useMemo } from "preact/hooks";

import { isVisited, visitedUrlsSignal } from "./browser_integration.js";

/**
 * Hook that reactively checks if a URL is visited.
 * Re-renders when the visited URL set changes.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} Whether the URL has been visited
 */
export const useIsVisited = (url) => {
  return useMemo(() => {
    // Access the signal to create reactive dependency
    // eslint-disable-next-line no-unused-expressions
    visitedUrlsSignal.value;

    return isVisited(url);
  }, [url, visitedUrlsSignal.value]);
};
