import { createDragGestureController } from "./drag_gesture.js";

export const startDragToResizeGesture = (
  pointerdownEvent,
  { onDragStart, onDrag, onRelease, ...options },
) => {
  const target = pointerdownEvent.target;
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

  const dragToResizeGestureController = createDragGestureController({
    gestureAttribute: "data-resizing",
    onDragStart: (...args) => {
      onDragStart?.(...args);
    },
    onDrag,
    onRelease: (...args) => {
      elementWithDataResizeHandle.removeAttribute("data-active");
      onRelease?.(...args);
    },
  });
  elementWithDataResizeHandle.setAttribute("data-active", "");
  const dragToResizeGesture = dragToResizeGestureController.grabViaPointer(
    pointerdownEvent,
    {
      element: elementToResize,
      direction: resizeDirection,
      cursor:
        resizeDirection.x && resizeDirection.y
          ? "nwse-resize"
          : resizeDirection.x
            ? "ew-resize"
            : "ns-resize",
      ...options,
    },
  );
  return dragToResizeGesture;
};

const getResizeDirection = (element) => {
  const direction = element.getAttribute("data-resize");
  const x = direction === "horizontal" || direction === "both";
  const y = direction === "vertical" || direction === "both";
  return { x, y };
};
