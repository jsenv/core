// see also https://github.com/preactjs/preact/issues/1255

import { getElementSignature } from "@jsenv/dom";

import { useDebugFocus } from "../../navi_debug.jsx";
import { useDisplayedLayoutEffect } from "../use_displayed_layout_effect.js";

/**
 * Programmatic autofocus that runs after Preact layout effects are flushed.
 *
 * WHY NOT USE THE NATIVE `autofocus` ATTRIBUTE?
 *
 * The browser's built-in `autofocus` triggers a `scrollIntoView` that reads
 * element geometry before JavaScript layout effects have run. This can cause
 * incorrect scrolling — for example, a popover that is still being positioned
 * by our own layout logic will report stale geometry, and the browser may scroll
 * the page unnecessarily. There is no way to suppress just the scroll side-effect
 * while keeping the focus itself.
 *
 * For that reason, components that use `useAutoFocus` must NOT set the
 * `autofocus`|`autoFocus` attribute on the underlying DOM node (use
 * `navi-autofocus` instead, which has no browser behavior). The hook takes over
 * the focus call entirely and fires it inside a `useDisplayedLayoutEffect`,
 * which runs after Preact layout work is done and the element is correctly
 * positioned.
 *
 * As a secondary benefit, firing focus after layout effects means any
 * positioning-dependent setup (e.g. popover placement) is already complete,
 * though in practice this ordering issue has not been observed — it is simply
 * a safe default.
 *
 * @param {import("preact/hooks").Ref<HTMLElement>} focusableElementRef
 *   Ref to the element to focus.
 * @param {boolean} autoFocus
 *   When false the hook is a no-op.
 * @param {object} [options]
 * @param {boolean} [options.preventScroll]
 *   Passed as `preventScroll` to `element.focus()`. Defaults to true to suppress
 *   the browser's built-in scroll-into-view that accompanies focus.
 * @param {boolean} [options.focusVisible]
 *   Passed as `focusVisible` to `element.focus()`.
 * @param {boolean} [options.autoSelect]
 *   When true, also calls `element.select()` after focusing (useful for text inputs).
 * @returns {Function} triggerAutofocus — can be called manually with a synthetic
 *   event to re-run the focus logic outside of the layout-effect lifecycle.
 */
export const useAutoFocus = (
  focusableElementRef,
  autoFocus,
  { preventScroll = true, focusVisible, autoSelect } = {},
) => {
  const debugFocus = useDebugFocus();

  const triggerAutofocus = (e) => {
    if (!autoFocus) {
      return () => {};
    }
    const focusableElement = focusableElementRef.current;
    if (!focusableElement) {
      return () => {};
    }
    const activeElement = document.activeElement;
    const focusDebugCall = `${getElementSignature(focusableElement)}.focus({ preventScroll: ${preventScroll} })`;
    if (e.type === "navi_displayed_on_document") {
      debugFocus(e, `[autofocus] mount -> ${focusDebugCall}`);
    } else {
      debugFocus(
        e,
        `[autofocus] "${e.type}" ${getElementSignature(e.target)} -> ${focusDebugCall}`,
      );
    }
    focusableElement.focus({ preventScroll, focusVisible });
    if (autoSelect) {
      focusableElement.select();
      // Keep the beginning of the text visible instead of scrolling to the end
      focusableElement.scrollLeft = 0;
    }
    return () => {
      const focusIsOnSelfOrInsideSelf =
        document.activeElement === focusableElement ||
        focusableElement.contains(document.activeElement);
      if (
        !focusIsOnSelfOrInsideSelf &&
        document.activeElement !== document.body
      ) {
        // focus is not on our element (or body) anymore
        // keep it where it is
        return;
      }

      // We have focus but we are unmounted
      // -> try to move focus back to something more meaningful that what browser would do
      // (browser would put it to document.body)
      // -> We'll try to move focus back to the element that had focus before we moved it to this element

      if (!document.body.contains(activeElement)) {
        // previously active element is no longer in the document
        return;
      }

      if (blurEvent) {
        // But if this element is unmounted during a blur, the element that is about to receive focus should prevail
        const elementAboutToReceiveFocus = blurEvent.relatedTarget;
        const isSelfOrInsideSelf =
          elementAboutToReceiveFocus === focusableElement ||
          focusableElement.contains(elementAboutToReceiveFocus);
        const isPreviouslyActiveElementOrInsideIt =
          elementAboutToReceiveFocus === activeElement ||
          (activeElement && activeElement.contains(elementAboutToReceiveFocus));
        if (!isSelfOrInsideSelf && !isPreviouslyActiveElementOrInsideIt) {
          // the element about to receive focus is not the input itself or inside it
          // and is not the previously active element or inside it
          // -> the element about to receive focus should prevail
          return;
        }
      }

      debugFocus(
        e,
        `restore focus to previously active element ${getElementSignature(activeElement)}.focus()`,
      );
      activeElement.focus();
    };
  };

  useDisplayedLayoutEffect(
    focusableElementRef,
    (el, e) => {
      return triggerAutofocus(e);
    },
    [],
  );

  // useEffect(() => {
  //   if (autoFocus) {
  //     const focusableElement = focusableElementRef.current;
  //     focusableElement.scrollIntoView({ inline: "nearest", block: "nearest" });
  //   }
  // }, []);

  return triggerAutofocus;
};

let blurEvent = null;
let timeout;
document.body.addEventListener(
  "blur",
  (e) => {
    blurEvent = e;
    setTimeout(() => {
      blurEvent = null;
    });
  },
  { capture: true },
);
document.body.addEventListener(
  "focus",
  () => {
    clearTimeout(timeout);
    blurEvent = null;
  },
  { capture: true },
);
