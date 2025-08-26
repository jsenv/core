// autoFocus does not work so we focus in a useLayoutEffect,
// see https://github.com/preactjs/preact/issues/1255

import { useEffect, useLayoutEffect } from "preact/hooks";

let blurEvent = null;
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

export const useAutoFocus = (
  focusableElementRef,
  autoFocus,
  { autoFocusVisible, autoSelect } = {},
) => {
  useLayoutEffect(() => {
    if (!autoFocus) {
      return null;
    }
    const activeElement = document.activeElement;
    const focusableElement = focusableElementRef.current;
    focusableElement.focus({ focusVisible: autoFocusVisible });
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

      activeElement.focus();
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      const focusableElement = focusableElementRef.current;
      focusableElement.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, []);
};
