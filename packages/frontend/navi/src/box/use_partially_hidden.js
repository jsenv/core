import { useEffect } from "preact/hooks";

/**
 * Tracks whether an element is fully visible in its scroll container and sets
 * the `navi-partially-hidden` attribute when any part of it is clipped.
 *
 * This is used to suppress `view-transition-name` on elements that are partially
 * outside the viewport or a scrollable container. Without this, a partially clipped
 * element would still participate in view transitions, producing ghost animations or
 * incorrect cross-fade effects.
 *
 * CSS usage:
 * ```css
 * [navi-partially-hidden] {
 *   view-transition-name: none !important;
 * }
 * ```
 *
 * `Box` enables this hook automatically when a `viewTransitionName` prop is provided.
 *
 * @param {import("preact").RefObject} ref - Ref to the element to observe.
 * @param {boolean} enabled - Only observe when true (typically when view-transition-name is set).
 */
export const usePartiallyHidden = (ref, enabled) => {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) {
      return undefined;
    }
    return setupPartiallyHidden(el);
  }, [enabled]);
};

export const setupPartiallyHidden = (el) => {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio >= 0.99) {
        el.removeAttribute("navi-partially-hidden");
      } else {
        el.setAttribute("navi-partially-hidden", "");
      }
    },
    { threshold: 0.99 },
  );
  observer.observe(el);
  return () => {
    observer.disconnect();
  };
};
