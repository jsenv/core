import { initFocusGroup } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

export const useFocusGroup = (
  elementRef,
  { enabled = true, direction, skipTab, loop, name } = {},
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
      direction,
      skipTab,
      loop,
      name,
    });
    return focusGroup.cleanup;
  }, [direction, skipTab, loop, name]);
};
