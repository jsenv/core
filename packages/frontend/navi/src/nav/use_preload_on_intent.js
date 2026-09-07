import { useEffect } from "preact/hooks";

import { preloadUrl } from "./route.js";

/**
 * The code of where a link leads, fetched when the pointer or the focus
 * arrives on it: the moment the user signals a destination, before the press.
 * Only code is fetched (see route.preload), so a link whose address is not the
 * final one — an id still to be chosen — loses nothing by asking.
 */
export const usePreloadOnIntent = (ref, href, prefetch = true) => {
  useEffect(() => {
    if (!prefetch || !href) {
      return undefined;
    }
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const preload = () => {
      preloadUrl(href);
    };
    element.addEventListener("pointerenter", preload);
    element.addEventListener("focusin", preload);
    return () => {
      element.removeEventListener("pointerenter", preload);
      element.removeEventListener("focusin", preload);
    };
  }, [ref, href, prefetch]);
};
