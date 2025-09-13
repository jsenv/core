export const startDragGesture = (
  mousedownEvent,
  { onStart, onChange, onEnd, setup, gestureAttribute },
) => {
  if (mousedownEvent.defaultPrevented) {
    // an other resize gesture has call preventDefault()
    // or something wants to prevent mousedown effects
    return;
  }
  if (mousedownEvent.button !== 0) {
    return;
  }
  const target = mousedownEvent.target;
  if (!target.closest) {
    return;
  }
  const endCallbackSet = new Set();
  const setupResult = setup({
    addTeardown: (callback) => {
      endCallbackSet.add(callback);
    },
  });
  if (!setupResult) {
    return;
  }
  const {
    element,
    direction = { x: true, y: true },
    cursor = "default",
  } = setupResult;
  if (!direction.x && !direction.y) {
    return;
  }
  mousedownEvent.preventDefault();
  const xAtStart = mousedownEvent.clientX;
  const yAtStart = mousedownEvent.clientY;
  const gestureInfo = {
    element,
    xAtStart,
    yAtStart,
    x: xAtStart,
    y: yAtStart,
    xMove: 0,
    yMove: 0,
    xChanged: false,
    yChanged: false,
    isMouseUp: false,
  };
  let previousGestureInfo = null;

  append_backdrop: {
    const backdrop = document.createElement("div");
    backdrop.style.position = "fixed";
    backdrop.style.zIndex = "1";
    backdrop.style.inset = "0";
    backdrop.style.cursor = cursor;
    backdrop.style.userSelect = "none";
    document.body.appendChild(backdrop);
    endCallbackSet.add(() => {
      document.body.removeChild(backdrop);
    });
  }
  mouse_events: {
    const updateMousePosition = (e) => {
      if (direction.x) {
        gestureInfo.x = e.clientX;
        gestureInfo.xMove = gestureInfo.x - xAtStart;
        gestureInfo.xChanged = previousGestureInfo
          ? gestureInfo.xMove !== previousGestureInfo.xMove
          : true;
      }
      if (direction.y) {
        gestureInfo.y = e.clientY;
        gestureInfo.yMove = gestureInfo.y - yAtStart;
        gestureInfo.yChanged = previousGestureInfo
          ? gestureInfo.yMove !== previousGestureInfo.yMove
          : true;
      }
      if (gestureInfo.xChanged || gestureInfo.yChanged) {
        previousGestureInfo = { ...gestureInfo };
        onChange?.(gestureInfo);
      }
    };

    const handleMouseMove = (e) => {
      updateMousePosition(e);
    };
    const handleMouseUp = (e) => {
      e.preventDefault();
      gestureInfo.isMouseUp = true;
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
  data_dragging_attribute: {
    element.setAttribute("data-dragging", "");
    endCallbackSet.add(() => {
      element.removeAttribute("data-dragging");
    });
  }
  if (gestureAttribute) {
    element.setAttribute(gestureAttribute, "");
    endCallbackSet.add(() => {
      element.removeAttribute(gestureAttribute);
    });
  }

  onStart?.(gestureInfo);
};
