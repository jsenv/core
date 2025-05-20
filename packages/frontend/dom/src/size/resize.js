/**
 *
 */

import { getAvailableHeight } from "./get_available_height.js";
import { getAvailableWidth } from "./get_available_width.js";
import { getHeight } from "./get_height.js";
import { getMaxHeight } from "./get_max_height.js";
import { getMaxWidth } from "./get_max_width.js";
import { getMinHeight } from "./get_min_height.js";
import { getMinWidth } from "./get_min_width.js";
import { getWidth } from "./get_width.js";

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

  const mutationSet = new Set();
  for (const child of elementToResize.parentElement.children) {
    // we must first store the sizes because when we'll set the styles
    // if will impact their sizes
    const width = getWidth(child);
    const height = getHeight(child);
    if (child === elementToResize) {
      mutationSet.add(() => {
        const setStyles = (namedValues) => {
          const inlineValueMap = new Map();
          for (const key of Object.keys(namedValues)) {
            const inlineValue = child.style[key];
            inlineValueMap.set(key, inlineValue);
            endCallbackSet.add(() => {
              if (inlineValue === "") {
                child.style.removeProperty(key);
              } else {
                child.style[key] = inlineValue;
              }
            });
          }
          for (const key of Object.keys(namedValues)) {
            const value = namedValues[key];
            child.style[key] = value;
          }
        };
        const computedStyle = window.getComputedStyle(child);
        const flex = computedStyle.flex;
        const flexGrow = computedStyle.flexGrow;

        if (
          (flex && flex !== "0 1 auto" && flex !== "0 0 auto") ||
          (flexGrow && flexGrow !== "0")
        ) {
          setStyles({
            ...(horizontalResizeEnabled ? { width: `${width}px` } : {}),
            ...(verticalResizeEnabled ? { height: `${height}px` } : {}),
            flex: "0 0 auto",
            flexGrow: "0",
            flexShrink: "0",
            flexBasis: "auto",
          });
        }
      });
    }
  }
  for (const mutation of mutationSet) {
    mutation();
  }

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
        resizeInfo.height = nextHeight;
      }
    }
    if (resizeInfo.widthChanged || resizeInfo.heightChanged) {
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
