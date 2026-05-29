import { useRef } from "preact/hooks";

/**
 * Returns either the external ref passed via props, or a local ref as fallback.
 * Useful when a component needs to access its own DOM node but must also support
 * an optional ref forwarded by the parent.
 */
export const useElementRef = (externalRef) => {
  const elRef = useRef(null);
  return externalRef || elRef;
};

/**
 * Keeps a DOM element in sync with `syncElement(el)` whenever syncElement changes.
 * - If element is already mounted: runs syncElement immediately during render.
 * - If not yet mounted: runs syncElement in the ref callback when element arrives.
 * - Calls cleanup (if returned by syncElement) before each re-run and on unmount.
 *
 * Wrap `syncElement` in `useCallback(fn, deps)` at the call site to control
 * when re-sync happens.
 *
 * @param {function} syncElement - Called with the DOM element when its reference changes
 * @param {function|object|null} externalRef - Optional ref to forward to
 */
export const useComposeElementRef = (syncElement, externalRef) => {
  const cleanupRef = useRef(null);
  const elRef = useRef(null);
  const prevSyncElementRef = useRef(undefined);
  const refCallbackRef = useRef(null);
  const externalRefRef = useRef(externalRef);
  externalRefRef.current = externalRef;

  const runSync = (el) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    prevSyncElementRef.current = syncElement;
    const cleanup = syncElement(el);
    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    }
  };

  // If element already mounted, re-sync when syncElement reference changed.
  if (elRef.current && syncElement !== prevSyncElementRef.current) {
    runSync(elRef.current);
  }

  if (!refCallbackRef.current) {
    const refCallback = (el) => {
      elRef.current = el;
      // Keep .current in sync immediately so useEffect callbacks that read
      // ref.current (e.g. usePartiallyHidden) see the element, not null.
      refCallback.current = el;
      const currentExternalRef = externalRefRef.current;
      if (currentExternalRef) {
        if (typeof currentExternalRef === "function") {
          currentExternalRef(el);
        } else {
          currentExternalRef.current = el;
        }
      }
      if (el) {
        runSync(el);
      } else {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        prevSyncElementRef.current = undefined;
      }
    };
    refCallbackRef.current = refCallback;
  }

  const refCallback = refCallbackRef.current;
  refCallback.current = elRef.current;
  return refCallback;
};
