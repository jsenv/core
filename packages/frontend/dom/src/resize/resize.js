const start = (element, xStart, yStart) => {
  if (!element.hasAttribute("data-resize-handle")) {
    return;
  }
  const elementToResize = element.closest("[data-resize]");
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

  const widthAtStart = element.offsetWidth;
  const heightAtStart = element.offsetHeight;
  let x = 0;
  let y = 0;
  let xMove = 0;
  let yMove = 0;
  const resizeInfo = {
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

  let minWidth = parseInt(window.getComputedStyle(element).minWidth);
  let minHeight = parseInt(window.getComputedStyle(element).minHeight);

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
    if (direction === "horizontal" || direction === "both") {
      const nextWidth = requestedWidth < minWidth ? minWidth : requestedWidth;
      const widthChanged = nextWidth !== resizeInfo.width;
      resizeInfo.widthChanged = widthChanged;
      if (widthChanged) {
        resizeInfo.width = nextWidth;
      }
    }
    if (direction === "vertical" || direction === "both") {
      const nextHeight =
        requestedHeight < minHeight ? minHeight : requestedHeight;
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
  const handleMouseUp = (e) => {
    x = e.clientX;
    y = e.clientY;
    xMove = x - xStart;
    yMove = y - yStart;
    requestResize(widthAtStart + xMove, heightAtStart + yMove);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    dispatchResizeEndEvent();
  };

  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  document.body.style.cursor =
    direction === "horizontal"
      ? "ew-resize"
      : direction === "vertical"
        ? "ns-resize"
        : "nwse-resize";
  document.body.style.userSelect = "none";
  dispatchResizeStartEvent();
};

document.addEventListener("mousedown", (e) => {
  start(e.target, e.clientX, e.clientY);
});
