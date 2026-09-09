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
  const holderRef = useRef(null);
  const externalRefRef = useRef(externalRef);
  const syncElementRef = useRef(syncElement);
  syncElementRef.current = syncElement;
  // Detect external ref identity change between renders. The refCallback keeps
  // its identity once it holds the element, so when the parent passes a new
  // ref object (or switches from null to a ref), Preact does NOT re-fire the
  // callback while the DOM element is unchanged. We must manually clear the
  // old ref and populate the new one with the current element to avoid
  // leaving the new ref's `.current` stuck at `null`.
  const prevExternalRefRef = useRef(externalRef);
  if (prevExternalRefRef.current !== externalRef) {
    const previous = prevExternalRefRef.current;
    if (previous && typeof previous !== "function") {
      previous.current = null;
    }
    if (externalRef && elRef.current) {
      if (typeof externalRef === "function") {
        externalRef(elRef.current);
      } else {
        externalRef.current = elRef.current;
      }
    }
    prevExternalRefRef.current = externalRef;
  }
  externalRefRef.current = externalRef;

  if (!holderRef.current) {
    // Created once, and reading the sync function through a ref for that
    // reason: the element can be replaced long after the first render — a tag
    // that changes, a box hidden then shown — and what the new element gets
    // must be the current render's sync, not the one the first render closed
    // over.
    const runSync = (el) => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      const syncElementNow = syncElementRef.current;
      prevSyncElementRef.current = syncElementNow;
      const cleanup = syncElementNow(el);
      if (typeof cleanup === "function") {
        cleanupRef.current = cleanup;
      }
    };
    holderRef.current = { runSync, refCallback: null };
  }
  const { runSync } = holderRef.current;

  // A new callback on every render until Preact has handed it the element,
  // the same one afterwards. Preact re-applies a ref only when its identity
  // changes, and a diff that throws with no error boundary above skips
  // commitRoot: its refs are dropped while its DOM stays and is adopted as
  // mounted by the next render. A callback that never fired would then never
  // fire, and a Box would stay raw HTML for the life of the document. Free on
  // a healthy mount, where the first callback is the only one ever created.
  if (!elRef.current) {
    const refCallback = (el) => {
      elRef.current = el;
      // Keep .current in sync immediately so useEffect callbacks that read
      // ref.current see the element, not null.
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
    holderRef.current.refCallback = refCallback;
  }
  const { refCallback } = holderRef.current;

  // If element already mounted, re-sync when syncElement reference changed.
  if (elRef.current && syncElement !== prevSyncElementRef.current) {
    runSync(elRef.current);
  }

  refCallback.current = elRef.current;
  return refCallback;
};
