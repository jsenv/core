/**
 *
 */

import { addAttributeEffect } from "../add_attribute_effect.js";
import { setStyles } from "../style_and_attributes.js";
import { getAvailableHeight } from "./get_available_height.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMaxHeight } from "./get_max_height.js";
import { getMaxWidth } from "./get_max_width.js";
import { getMinHeight } from "./get_min_height.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

const style = /*css*/ `
   *[data-force-resize] {
     flex-shrink: 0 !important; /* flex-shrink !== 0 would prevent element to grow as much as it could  */
     flex-grow: 0 !important; /* flex-grow !== 0 would prevent element to shrink as much as it could */
   }`;
document.head.appendChild(document.createElement("style")).textContent = style;

const start = (event) => {
  if (event.button !== 0) {
    return;
  }
  const target = event.target;
  if (!target.closest) {
    return;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return;
  }
  let elementToResize;
  const dataResizeHandle =
    elementWithDataResizeHandle.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = elementWithDataResizeHandle.closest("[data-resize]");
  } else {
    elementToResize = document.querySelector(`#${dataResizeHandle}`);
  }
  if (!elementToResize) {
    console.warn("No element to resize found");
    return;
  }
  // inspired by https://developer.mozilla.org/en-US/docs/Web/CSS/resize
  // "horizontal", "vertical", "both"
  const direction = elementToResize.getAttribute("data-resize");
  if (direction === "none") {
    return;
  }
  event.preventDefault();

  const endCallbackSet = new Set();

  const horizontalResizeEnabled =
    direction === "horizontal" || direction === "both";
  const verticalResizeEnabled =
    direction === "vertical" || direction === "both";
  const availableWidth = getAvailableWidth(elementToResize.parentElement);
  const availableHeight = getAvailableHeight(elementToResize.parentElement);
  const minWidth = getMinWidth(elementToResize, availableWidth);
  const minHeight = getMinHeight(elementToResize, availableHeight);
  const maxWidth = horizontalResizeEnabled
    ? getMaxWidth(elementToResize, availableWidth)
    : null;
  const maxHeight = verticalResizeEnabled
    ? getMaxHeight(elementToResize, availableHeight)
    : null;

  const widthAtStart = elementToResize.offsetWidth;
  const heightAtStart = elementToResize.offsetHeight;
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const resizeInfo = {
    availableWidth,
    availableHeight,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,
    widthAtStart,
    heightAtStart,
    previousWidth: undefined,
    previousHeight: undefined,
    width: widthAtStart,
    height: heightAtStart,
    get widthAsPercentage() {
      const ratio = resizeInfo.width / availableWidth;
      const roundedRatio = Math.round(ratio * 100) / 100;
      const percentage = roundedRatio * 100;
      return `${percentage}%`;
    },
    get heightAsPercentage() {
      const ratio = resizeInfo.height / availableHeight;
      const roundedRatio = Math.round(ratio * 100) / 100;
      const percentage = roundedRatio * 100;
      return `${percentage}%`;
    },
    widthChanged: false,
    heightChanged: false,
  };

  const dispatchResizeStartEvent = () => {
    const resizeStartEvent = new CustomEvent("resizestart", {
      detail: resizeInfo,
    });
    elementToResize.dispatchEvent(resizeStartEvent);
  };
  const dispatchResizeEvent = () => {
    const resizeEvent = new CustomEvent("resize", { detail: resizeInfo });
    elementToResize.dispatchEvent(resizeEvent);
  };
  const dispatchResizeEndEvent = () => {
    const resizeEndEvent = new CustomEvent("resizeend", {
      detail: resizeInfo,
    });
    elementToResize.dispatchEvent(resizeEndEvent);
  };

  const requestResize = (requestedWidth, requestedHeight) => {
    if (horizontalResizeEnabled) {
      let nextWidth = requestedWidth;
      if (requestedWidth > maxWidth) {
        nextWidth = maxWidth;
      } else if (requestedWidth < minWidth) {
        nextWidth = minWidth;
      }
      const widthChanged = nextWidth !== resizeInfo.width;
      resizeInfo.widthChanged = widthChanged;
      if (widthChanged) {
        resizeInfo.previousWidth = resizeInfo.height;
        resizeInfo.width = nextWidth;
      }
    }
    if (verticalResizeEnabled) {
      let nextHeight = requestedHeight;
      if (requestedHeight > maxHeight) {
        nextHeight = maxHeight;
      } else if (requestedHeight < minHeight) {
        nextHeight = minHeight;
      }
      const heightChanged = nextHeight !== resizeInfo.height;
      resizeInfo.heightChanged = heightChanged;
      if (heightChanged) {
        resizeInfo.previousHeight = resizeInfo.height;
        resizeInfo.height = nextHeight;
      }
    }
    if (resizeInfo.widthChanged || resizeInfo.heightChanged) {
      if (horizontalResizeEnabled) {
        const widthBeforeResize = getWidth(elementToResize);
        elementToResize.style.width = `${resizeInfo.width}px`;
        const widthAfterResize = getWidth(elementToResize);
        let widthDiff = widthAfterResize - widthBeforeResize;

        if (widthDiff > 0) {
          let nextSibling = elementToResize.nextElementSibling;
          while (widthDiff > 0 && nextSibling) {
            const nextSiblingWidthBeforeAdapt = getWidth(nextSibling);
            const nextSiblingWidthAdapted =
              nextSiblingWidthBeforeAdapt - widthDiff;
            nextSibling.style.width = `${nextSiblingWidthAdapted}px`;
            const nextSiblingWidthAfterAdapt = getWidth(nextSibling);
            const actualDiff =
              nextSiblingWidthBeforeAdapt - nextSiblingWidthAfterAdapt;
            if (actualDiff) {
              const resizeEvent = new CustomEvent("resize", {
                detail: { width: nextSiblingWidthAfterAdapt },
              });
              nextSibling.dispatchEvent(resizeEvent);
              widthDiff -= actualDiff;
            }
            nextSibling = nextSibling.nextElementSibling;
          }
        }
        // else if (widthDiff < 0) {
        //   let prevSibling = elementToResize.previousElementSibling;
        //   while (widthDiff > 0 && prevSibling) {
        //     const siblingWidthBeforeAdapt = getWidth(prevSibling);
        //     const siblingWidthAdapted = siblingWidthBeforeAdapt + widthDiff;
        //     prevSibling.style.width = `${siblingWidthAdapted}px`;
        //     const siblingWidthAfterAdapt = getWidth(prevSibling);
        //     const actualDiff = siblingWidthBeforeAdapt - siblingWidthAfterAdapt;
        //     if (actualDiff) {
        //       const resizeEvent = new CustomEvent("resize", {
        //         detail: { width: siblingWidthAfterAdapt },
        //       });
        //       prevSibling.dispatchEvent(resizeEvent);
        //       widthDiff -= actualDiff;
        //     }
        //     prevSibling = prevSibling.previousElementSibling;
        //   }
        // }
      }
      if (verticalResizeEnabled) {
        elementToResize.style.height = `${resizeInfo.height}px`;
      }
      dispatchResizeEvent();
    }
  };
  const handleMouseMove = (e) => {
    resizeInfo.x = e.clientX;
    resizeInfo.y = e.clientY;
    resizeInfo.xMove = resizeInfo.x - xAtStart;
    resizeInfo.yMove = resizeInfo.y - yAtStart;
    const newWidth = widthAtStart + resizeInfo.xMove;
    const newHeight = heightAtStart + resizeInfo.yMove;
    requestResize(newWidth, newHeight);
  };

  const backdrop = document.createElement("div");
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.cursor =
    direction === "horizontal"
      ? "ew-resize"
      : direction === "vertical"
        ? "ns-resize"
        : "nwse-resize";
  backdrop.style.userSelect = "none";

  const handleMouseUp = (e) => {
    e.preventDefault();
    resizeInfo.x = e.clientX;
    resizeInfo.y = e.clientY;
    resizeInfo.xMove = resizeInfo.x - xAtStart;
    resizeInfo.yMove = resizeInfo.y - yAtStart;
    requestResize(
      widthAtStart + resizeInfo.xMove,
      heightAtStart + resizeInfo.yMove,
    );
    for (const endCallback of endCallbackSet) {
      endCallback();
    }
    dispatchResizeEndEvent();
  };

  document.body.appendChild(backdrop);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  elementToResize.setAttribute("data-resizing", "");
  endCallbackSet.add(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.removeChild(backdrop);
    elementToResize.removeAttribute("data-resizing");
  });
  if (horizontalResizeEnabled) {
    elementToResize.style.width = `${resizeInfo.width}px`;
  }
  if (verticalResizeEnabled) {
    elementToResize.style.height = `${resizeInfo.height}px`;
  }
  dispatchResizeStartEvent();
};

document.addEventListener(
  "mousedown",
  (e) => {
    start(e);
  },
  {
    capture: true,
  },
);

addAttributeEffect("data-resize", (element) => {
  const direction = element.getAttribute("data-resize");
  const horizontalResizeEnabled =
    direction === "horizontal" || direction === "both";
  const verticalResizeEnabled =
    direction === "vertical" || direction === "both";
  if (!horizontalResizeEnabled && !verticalResizeEnabled) {
    return null;
  }

  const cleanupCallbackSet = new Set();

  max_width_max_height: {
    const updateMaxSizes = (parentWidth, parentHeight) => {
      if (horizontalResizeEnabled) {
        const availableWidth = getAvailableWidth(element, parentWidth);
        const maxWidth = getMaxWidth(element, availableWidth);
        element.style.maxWidth = `${maxWidth}px`;
      }
      if (verticalResizeEnabled) {
        const availableHeight = getAvailableHeight(element, parentHeight);
        const maxHeight = getMaxHeight(element, availableHeight);
        element.style.maxHeight = `${maxHeight}px`;
      }
    };

    const parentElement = element.parentElement;
    // updateMaxSizes(getWidth(parentElement), getHeight(parentElement));
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      updateMaxSizes(entry.contentRect.width, entry.contentRect.height);
    });
    resizeObserver.observe(parentElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(parentElement);
    });
  }

  // disable flex stuff to ensure element can be resized
  force_resizable: {
    if (horizontalResizeEnabled) {
      const width = getWidth(element);
      const restoreInlineWidth = setStyles(element, {
        width: `${width}px`,
      });
      cleanupCallbackSet.add(() => {
        restoreInlineWidth();
      });
    }
    if (verticalResizeEnabled) {
      const restoreInlineHeight = setStyles(element, {
        height: `${getHeight(element)}px`,
      });
      cleanupCallbackSet.add(() => {
        restoreInlineHeight();
      });
    }
    element.setAttribute("data-force-resize", "");
    cleanupCallbackSet.add(() => {
      element.removeAttribute("data-force-resize");
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
});
