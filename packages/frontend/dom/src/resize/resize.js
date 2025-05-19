/**
 * - make it work on details
 * - when details is active, somehow the resize-handle becomes harder to click
 *
 */

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

  const horizontalResizeEnabled =
    direction === "horizontal" || direction === "both";
  const verticalResizeEnabled =
    direction === "vertical" || direction === "both";

  const minWidth = getMinWidth(elementToResize);
  const minHeight = getMinHeight(elementToResize);
  let maxWidth;
  if (horizontalResizeEnabled) {
    maxWidth = elementToResize.parentElement.offsetWidth;
    const parentElement = elementToResize.parentElement;
    const parentElementComputedStyle = window.getComputedStyle(parentElement);
    if (
      parentElementComputedStyle.display === "flex" &&
      parentElementComputedStyle.flexDirection === "row"
    ) {
      let previousSibling = elementToResize.previousElementSibling;
      while (previousSibling) {
        const previousSiblinWidth = previousSibling.offsetWidth;
        maxWidth -= previousSiblinWidth;
        previousSibling = previousSibling.previousElementSibling;
      }
      let nextSibling = elementToResize.nextElementSibling;
      while (nextSibling) {
        const nextSiblingMinWidth = getMinWidth(nextSibling);
        maxWidth -= nextSiblingMinWidth;
        nextSibling = nextSibling.nextElementSibling;
      }
    }
  }
  let maxHeight;
  if (verticalResizeEnabled) {
    maxHeight = elementToResize.parentElement.offsetHeight;
    const parentElement = elementToResize.parentElement;
    const parentElementComputedStyle = window.getComputedStyle(parentElement);
    if (
      parentElementComputedStyle.display === "flex" &&
      parentElementComputedStyle.flexDirection === "column"
    ) {
      let previousSibling = elementToResize.previousElementSibling;
      while (previousSibling) {
        const previousSiblingHeight = previousSibling.offsetHeight;
        maxHeight -= previousSiblingHeight;
        previousSibling = previousSibling.previousElementSibling;
      }
      let nextSibling = elementToResize.nextElementSibling;
      while (nextSibling) {
        const nextSiblingMinHeight = getMinHeight(nextSibling);
        maxHeight -= nextSiblingMinHeight;
        nextSibling = nextSibling.nextElementSibling;
      }
    }
  }

  const widthAtStart = elementToResize.offsetWidth;
  const heightAtStart = elementToResize.offsetHeight;
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const resizeInfo = {
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

  const endCallbackSet = new Set();

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

const getMinWidth = (element) => {
  const minWidth = window.getComputedStyle(element).minWidth;
  if (minWidth && minWidth.endsWith("%")) {
    const availableWidth = element.parentElement.offsetWidth;
    return (parseInt(minWidth) / 100) * availableWidth;
  }
  return isNaN(minWidth) ? 0 : parseInt(minWidth);
};

const getMinHeight = (element) => {
  const minHeight = window.getComputedStyle(element).minHeight;
  if (minHeight && minHeight.endsWith("%")) {
    const availableHeight = element.parentElement.offsetHeight;
    return (parseInt(minHeight) / 100) * availableHeight;
  }
  return isNaN(minHeight) ? 0 : parseInt(minHeight);
};

// document.addEventListener("click", (e) => {
//   if (e.target.closest("summary")) {
//     e.preventDefault();
//   }
// });

document.addEventListener(
  "mousedown",
  (e) => {
    start(e);
  },
  {
    capture: true,
  },
);
