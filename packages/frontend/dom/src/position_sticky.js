// workround https://github.com/w3c/csswg-drafts/issues/865

import { getScrollableParentSet } from "./scroll.js";
import { getHeight } from "./size/get_height.js";
import { getWidth } from "./size/get_width.js";
import { forceStyles, setStyles } from "./style_and_attributes.js";

import.meta.css = /* css */ `
  [data-position-sticky-placeholder] {
    opacity: 0 !important;
    position: static !important;
  }
`;

export const initPositionSticky = (element) => {
  const computedStyle = getComputedStyle(element);
  const topCssValue = computedStyle.top;
  const top = parseFloat(topCssValue);
  if (isNaN(top)) {
    return () => {};
  }

  // if there is no ancestor with overflow: auto we can skip the sticky positioning workaround
  const scrollableParentSet = getScrollableParentSet(element);
  check_overflow_on_parents: {
    let hasOverflowHiddenOrAuto = false;
    for (const scrollableParent of scrollableParentSet) {
      const scrollableParentComputedStyle = getComputedStyle(scrollableParent);
      const overflowX = scrollableParentComputedStyle.overflowX;
      if (overflowX === "auto" || overflowX === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
      const overflowY = scrollableParentComputedStyle.overflowY;
      if (overflowY === "auto" || overflowY === "hidden") {
        hasOverflowHiddenOrAuto = true;
        break;
      }
    }
    if (!hasOverflowHiddenOrAuto) {
      return () => {};
    }
  }

  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const parentElement = element.parentElement;
  const createPlaceholderClone = () => {
    const clone = element.cloneNode(true);
    clone.setAttribute("data-position-sticky-placeholder", "");
    return clone;
  };

  let placeholder = createPlaceholderClone();
  parentElement.insertBefore(placeholder, element);

  let width = getWidth(element);
  let height = getHeight(element);
  const updateSize = () => {
    const newPlaceholder = createPlaceholderClone();
    parentElement.replaceChild(newPlaceholder, placeholder);
    placeholder = newPlaceholder;
    width = getWidth(placeholder);
    height = getHeight(placeholder);
    applySizeEffects();
  };
  const applySizeEffects = () => {
    setStyles(placeholder, {
      width: `${width}px`,
      height: `${height}px`,
    });
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  };
  applySizeEffects();

  parent_is_relative: {
    // Ensure that the node will be positioned relatively to the parent node
    const restoreParentPositionStyle = forceStyles(parentElement, {
      position: "relative",
    });
    cleanupCallbackSet.add(() => {
      restoreParentPositionStyle();
    });
  }
  element_is_absolute: {
    // ensure element position is absolute
    const restorePositionStyle = forceStyles(element, {
      "position": "absolute",
      "z-index": 1,
      "left": 0,
      "top": 0,
    });
    cleanupCallbackSet.add(() => {
      restorePositionStyle();
    });
  }

  const updatePosition = () => {
    // Calculate the visible top position where the element should stick
    // This is relative to the parent's position
    let topPosition = top;

    const scrollableParent = Array.from(scrollableParentSet)[0];
    if (scrollableParent === document.documentElement) {
      const scrollTop =
        document.documentElement.scrollTop || document.body.scrollTop;
      if (scrollTop > height) {
        topPosition = scrollTop - height;
      }
    } else if (
      scrollableParent === parentElement ||
      scrollableParent.contains(parentElement)
    ) {
      const scrollTop = scrollableParent.scrollTop;
      if (scrollTop > height) {
        topPosition = scrollTop - height;
      }
    }

    const scrollableParentHeight = getHeight(scrollableParent);

    // Prevent element from going beyond parent's bottom
    const parentBottom = scrollableParentHeight;
    if (topPosition + height > parentBottom) {
      topPosition = parentBottom - height;
    }
    element.style.top = `${topPosition}px`;
  };

  updatePosition();

  update_on_scroll: {
    const handleScroll = () => {
      updatePosition();
    };

    const scrollableParentSet = getScrollableParentSet(element);
    for (const scrollableParent of scrollableParentSet) {
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  return () => {
    cleanup();
  };
};
