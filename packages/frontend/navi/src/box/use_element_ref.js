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
 * Keeps a DOM element in sync with `syncElement(el)` whenever deps change.
 * - If element is already mounted: runs syncElement immediately during render.
 * - If not yet mounted: runs syncElement in the ref callback when element arrives.
 * - Calls cleanup (if returned by syncElement) before each re-run and on unmount.
 *
 * @param {function|object|null} externalRef - Optional ref to forward to
 * @param {function} syncElement - Called with the DOM element when deps change
 * @param {Array} deps - syncElement is re-called only when deps change
 */
export const useElementRefEffect = (externalRef, syncElement, deps) => {
  const cleanupRef = useRef(null);
  const elRef = useRef(null);
  const prevDepsRef = useRef(undefined);

  const runSync = (el) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    prevDepsRef.current = deps;
    const cleanup = syncElement(el);
    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    }
  };

  // If element already mounted, check deps and sync during render.
  if (elRef.current) {
    const prevDeps = prevDepsRef.current;
    let depsChanged;
    if (!prevDeps || prevDeps.length !== deps.length) {
      depsChanged = true;
    } else {
      depsChanged = false;
      for (let i = 0; i < deps.length; i++) {
        if (!Object.is(deps[i], prevDeps[i])) {
          depsChanged = true;
          break;
        }
      }
    }
    if (depsChanged) {
      runSync(elRef.current);
    }
  }

  const ref = (el) => {
    elRef.current = el;
    if (externalRef) {
      if (typeof externalRef === "function") {
        externalRef(el);
      } else {
        externalRef.current = el;
      }
    }
    if (el) {
      runSync(el);
    } else {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      prevDepsRef.current = undefined;
    }
  };
  ref.current = elRef.current;

  return ref;
};
