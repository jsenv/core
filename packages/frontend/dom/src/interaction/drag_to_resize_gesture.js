import { createDragGestureController } from "./drag_gesture.js";

export const startDragToResizeGesture = (
  mousedownEvent,
  { onDragStart, onDrag, onRelease, ...options },
) => {
  const target = mousedownEvent.target;
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

  const dragToResizeGesture = createDragGestureController({
    gestureAttribute: "data-resizing",
    onDragStart,
    onDrag,
    onRelease,
  });

  elementWithDataResizeHandle.setAttribute("data-active", "");
  dragToResizeGesture.addTeardown(() => {
    elementWithDataResizeHandle.removeAttribute("data-active");
  });

  dragToResizeGesture.grabViaMousedown(mousedownEvent, {
    element: elementToResize,
    direction: resizeDirection,
    cursor:
      resizeDirection.x && resizeDirection.y
        ? "nwse-resize"
        : resizeDirection.x
          ? "ew-resize"
          : "ns-resize",
    ...options,
  });
  return dragToResizeGesture;
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};
