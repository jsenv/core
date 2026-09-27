import { useEffect } from "preact/hooks";

import { announceOpeningPress } from "../control/commands.js";
import { preloadUrl } from "./route.js";

/**
 * Where a link leads, asked for when the pointer or the focus arrives on it:
 * the moment the user signals a destination, before the press. Only what the
 * route's actions ask without the address is fetched (see route.preload), so
 * a link whose address is not the final one — an id still to be chosen —
 * loses nothing by asking.
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

/**
 * What a popup's opening will read, asked for when the press on the element
 * whose command opens it starts (see announceOpeningPress): the popup, the
 * value it opens on and so the address it will write are all known before
 * the release.
 */
export const usePreloadOpeningOnPress = (ref, command, prefetch = true) => {
  useEffect(() => {
    if (!prefetch || !command) {
      return undefined;
    }
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const onPointerDown = (pointerdownEvent) => {
      // A right click opens a menu, never the popup.
      if (pointerdownEvent.button !== 0) {
        return;
      }
      announceOpeningPress(element, command);
    };
    element.addEventListener("pointerdown", onPointerDown);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
    };
  }, [ref, command, prefetch]);
};
