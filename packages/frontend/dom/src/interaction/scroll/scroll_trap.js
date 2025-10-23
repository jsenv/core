import { getStyle, setStyles } from "../../style/style_inline.js";
import { isScrollable } from "./is_scrollable.js";
import { getSelfAndAncestorScrolls } from "./scroll_container.js";
import { measureScrollbar } from "./scrollbar_size.js";

export const trapScrollInside = (element) => {
  const cleanupCallbackSet = new Set();
  const lockScroll = (el) => {
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(el);
    // scrollbar-gutter would work but would display an empty blank space
    const paddingRight = parseInt(getStyle(el, "padding-right"), 0);
    const paddingTop = parseInt(getStyle(el, "padding-top"), 0);
    const removeScrollLockStyles = setStyles(el, {
      "padding-right": `${paddingRight + scrollbarWidth}px`,
      "padding-top": `${paddingTop + scrollbarHeight}px`,
      "overflow": "hidden",
    });
    cleanupCallbackSet.add(() => {
      removeScrollLockStyles();
    });
  };
  let previous = element.previousSibling;
  while (previous) {
    if (previous.nodeType === 1) {
      if (isScrollable(previous)) {
        lockScroll(previous);
      }
    }
    previous = previous.previousSibling;
  }

  const selfAndAncestorScrolls = getSelfAndAncestorScrolls(element);
  for (const selfOrAncestorScroll of selfAndAncestorScrolls) {
    const elementToScrollLock = selfOrAncestorScroll.scrollContainer;
    lockScroll(elementToScrollLock);
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};
