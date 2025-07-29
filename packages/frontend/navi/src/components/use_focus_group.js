import { initFocusGroup } from "@jsenv/dom";
import { useLayoutEffect } from "preact/hooks";

export const useFocusGroup = (elementRef, options) => {
  const { direction, skipTab, loop, name, enabled } = options;

  useLayoutEffect(() => {
    if (!enabled) {
      return null;
    }
    const focusGroup = initFocusGroup(elementRef.current, {
      direction,
      skipTab,
      loop,
      name,
    });
    return focusGroup.cleanup;
  }, [direction, skipTab, loop, name]);
};
