export const startResizeGesture = (event, { onStart, onMove, onEnd }) => {
  if (event.button !== 0) {
    return null;
  }
  const target = event.target;
  if (!target.closest) {
    return null;
  }
  const elementWithDataResizeHandle = target.closest("[data-resize-handle]");
  if (!elementWithDataResizeHandle) {
    return null;
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
    return null;
  }
  // inspired by https://developer.mozilla.org/en-US/docs/Web/CSS/resize
  // "horizontal", "vertical", "both"
  const resizeDirection = getResizeDirection(elementToResize);
  if (!resizeDirection.x && !resizeDirection.y) {
    return null;
  }
  event.preventDefault();

  const endCallbackSet = new Set();
  const xAtStart = event.clientX;
  const yAtStart = event.clientY;
  const gestureInfo = {
    element: elementToResize,
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,
    xChanged: false,
    yChanged: false,
  };
  let previousGestureInfo = null;

  elementWithDataResizeHandle.setAttribute("data-active", "");
  endCallbackSet.add(() => {
    elementWithDataResizeHandle.removeAttribute("data-active");
  });
  append_backdrop: {
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.inset = "0";
    backdrop.style.cursor =
      resizeDirection.x && resizeDirection.y
        ? "nwse-resize"
        : resizeDirection.x
          ? "ew-resize"
          : "ns-resize";
    backdrop.style.userSelect = "none";
    document.body.appendChild(backdrop);
    endCallbackSet.add(() => {
      document.body.removeChild(backdrop);
    });
  }
  mouse_events: {
    const updateMousePosition = (e) => {
      if (resizeDirection.x) {
        gestureInfo.x = e.clientX;
        gestureInfo.xMove = gestureInfo.x - xAtStart;
        gestureInfo.xChanged = previousGestureInfo
          ? gestureInfo.xMove !== previousGestureInfo.xMove
          : true;
      }
      if (resizeDirection.y) {
        gestureInfo.y = e.clientY;
        gestureInfo.yMove = gestureInfo.y - yAtStart;
        gestureInfo.yChanged = previousGestureInfo
          ? gestureInfo.yMove !== previousGestureInfo.yMove
          : true;
      }
      if (gestureInfo.xChanged || gestureInfo.yChanged) {
        previousGestureInfo = { ...gestureInfo };
        onMove?.(gestureInfo);
      }
    };

    const handleMouseMove = (e) => {
      updateMousePosition(e);
    };
    const handleMouseUp = (e) => {
      e.preventDefault();
      updateMousePosition(e);
      for (const endCallback of endCallbackSet) {
        endCallback();
      }
      onEnd?.(gestureInfo);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    endCallbackSet.add(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
  }
  data_resizing_attribute: {
    elementToResize.setAttribute("data-resizing", "");
    endCallbackSet.add(() => {
      elementToResize.removeAttribute("data-resizing");
    });
  }
  onStart?.(gestureInfo);
  return null;
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};
