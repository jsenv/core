// autoFocus does not work so we focus in a useLayoutEffect,
// see https://github.com/preactjs/preact/issues/1255

import { useEffect, useLayoutEffect } from "preact/hooks";

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
      if (
        document.activeElement === focusableElement ||
        document.activeElement === document.body
      ) {
        // if the input is focused when the component is unmounted,
        // we restore focus to the element that was focused before
        // the input was focused
        if (document.body.contains(activeElement)) {
          activeElement.focus();
        }
      }
    };
  }, []);
  useEffect(() => {
    if (autoFocus) {
      const focusableElement = focusableElementRef.current;
      focusableElement.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, []);
};
