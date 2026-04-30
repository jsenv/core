// see also https://github.com/preactjs/preact/issues/1255

import { getElementSignature } from "@jsenv/dom";

import { useDisplayedLayoutEffect } from "../use_displayed_layout_effect.js";
import { useDebugFocus } from "./focus.jsx";

/**
 * Programmatic autofocus that runs after Preact layout effects are flushed.
 *
 * WHY NOT USE THE NATIVE `autofocus` ATTRIBUTE?
 *
 * The browser fires autofocus before JavaScript layout effects have run. This
 * means the element may not be correctly positioned yet — for example a popover
 * that is still being placed by our own positioning logic. When the browser then
 * calls scrollIntoView internally as part of focusing, it reads stale geometry
 * and may scroll the page even though the popover content is already fully on
 * screen (or will be once layout settles). There is no way to hook into the
 * browser's autofocus timing or suppress just its scroll side-effect while
 * keeping the focus itself.
 *
 * Also browser is just bad at scrolling into view something in a popover
 *
 * For that reason, components that use `useAutoFocus` must NOT set the
 * `autofocus`|`autoFocus` attribute on the underlying DOM node. The hook
 * takes over the focus call entirely, fires it inside a `useDisplayedLayoutEffect`
 * (so Preact layout work is done and the element is correctly positioned), and
 * exposes `autoFocusPreventScroll` to let the caller decide whether any
 * scroll-into-view should happen at all.
 *
 * @param {import("preact/hooks").Ref<HTMLElement>} focusableElementRef
 *   Ref to the element to focus.
 * @param {boolean} autoFocus
 *   When false the hook is a no-op.
 * @param {object} [options]
 * @param {boolean} [options.autoFocusPreventScroll]
 *   Passed as `preventScroll` to `element.focus()`. Set to true to suppress
 *   the browser's built-in scroll-into-view that accompanies focus.
 * @param {boolean} [options.autoFocusVisible]
 *   Passed as `focusVisible` to `element.focus()`.
 * @param {boolean} [options.autoSelect]
 *   When true, also calls `element.select()` after focusing (useful for text inputs).
 * @param {boolean} [options.debugFocus]
 *   When true, logs focus decisions to the console.
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
    const isWithinDialog = focusableElement.closest("dialog");
    if (isWithinDialog && focusableElement.hasAttribute("autofocus")) {
      // let dialog manage autofocus
      return () => {};
    }

    const activeElement = document.activeElement;
    debugFocus(
      `autoFocus after "${e.type}" -> ${getElementSignature(e.target)}.focus({ preventScroll: ${preventScroll} })`,
    );
    focusableElement.focus({
      preventScroll,
      focusVisible,
    });
    // requestAnimationFrame(() => {
    //   focusableElement.focus({
    //     preventScroll: autoFocusPreventScroll,
    //     focusVisible: autoFocusVisible,
    //   });
    // });
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
