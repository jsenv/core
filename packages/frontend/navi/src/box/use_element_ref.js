import { useRef } from "preact/hooks";

/**
 * Returns a ref callback that forwards the DOM node to `externalRef` if provided.
 * Always maintains an internal `.current` property pointing to the current DOM node.
 */

export const useElementRef = (externalRef) => {
  const elRef = useRef(null);
  return externalRef || elRef;
};

/**
 * Like useElementRef, but also calls `onElement(el)` when the element mounts
 * or when deps change. The return value of `onElement` is used as a cleanup
 * function called on unmount or before re-running.
 *
 * @param {function|object|null} externalRef - Optional ref to forward to
 * @param {function} onElement - Called with the DOM element on mount or when deps change
 * @param {Array} deps - onElement is re-called only when deps change (like useEffect deps)
 */

export const useElementRefEffect = (externalRef, onElement, deps) => {
  const cleanupRef = useRef(null);
  const elRef = useRef(null);
  const prevDepsRef = useRef(undefined);

  const ref = (el) => {
    elRef.current = el;
    if (externalRef) {
      if (typeof externalRef === "function") {
        externalRef(el);
      } else {
        externalRef.current = el;
      }
    }
    if (!el) {
      const cleanup = cleanupRef.current;
      if (cleanup) {
        cleanup();
        cleanupRef.current = null;
      }
      prevDepsRef.current = undefined;
      return;
    }
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
    if (!depsChanged) {
      return;
    }
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    prevDepsRef.current = deps;
    const cleanup = onElement(el);
    if (typeof cleanup === "function") {
      cleanupRef.current = cleanup;
    }
  };
  ref.current = elRef.current;

  return ref;
};
