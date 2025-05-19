const start = (element, xStart, yStart) => {
  if (!element.hasAttribute("data-resize-handle")) {
    return;
  }
  let elementToResize;
  const dataResizeHandle = element.getAttribute("data-resize-handle");
  if (!dataResizeHandle || dataResizeHandle === "true") {
    elementToResize = element.closest("[data-resize]");
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
  let x = 0;
  let y = 0;
  let xMove = 0;
  let yMove = 0;
  const resizeInfo = {
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    xAtStart: 0,
    yAtStart: 0,
    x: 0,
    y: 0,
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
    x = e.clientX;
    y = e.clientY;
    xMove = x - xStart;
    yMove = y - yStart;
    requestResize(widthAtStart + xMove, heightAtStart + yMove);
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
    x = e.clientX;
    y = e.clientY;
    xMove = x - xStart;
    yMove = y - yStart;
    requestResize(widthAtStart + xMove, heightAtStart + yMove);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.removeChild(backdrop);
    elementToResize.removeAttribute("data-resizing");
    dispatchResizeEndEvent();
  };

  document.body.appendChild(backdrop);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  elementToResize.setAttribute("data-resizing", "");
  dispatchResizeStartEvent();
};

const getMinWidth = (element) => {
  const minWidth = parseInt(window.getComputedStyle(element).minWidth);
  return isNaN(minWidth) ? 0 : minWidth;
};

const getMinHeight = (element) => {
  const minHeight = parseInt(window.getComputedStyle(element).minHeight);
  return isNaN(minHeight) ? 0 : minHeight;
};

document.addEventListener("mousedown", (e) => {
  start(e.target, e.clientX, e.clientY);
});
