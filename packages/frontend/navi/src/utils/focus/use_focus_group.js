import { initFocusGroup } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

export const useFocusGroup = (
  elementRef,
  {
    enabled = true,
    skipTab,
    name,
    // Which axes are active: "x", "y", or "both" (default)
    direction = "both",
    // Which axes loop at boundaries: "x", "y", "both", or undefined (no looping)
    wrap,
    // CSS selector to restrict candidates on each axis
    xSelector,
    ySelector,
  } = {},
) => {
  useLayoutEffect(() => {
    if (!enabled) {
      return null;
    }
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const focusGroup = initFocusGroup(element, {
      skipTab,
      name,
      direction,
      wrap,
      xSelector,
      ySelector,
    });
    return focusGroup.cleanup;
  }, [elementRef, direction, wrap, skipTab, name, xSelector, ySelector]);
};
