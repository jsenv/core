export const startDragGesture = (
  mousedownEvent,
  {
    onStart,
    onChange,
    onEnd,
    setup = () => {
      return {
        element: mousedownEvent.target,
      };
    },
    gestureAttribute,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
  },
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
    direction = defaultDirection,
    cursor = "grabbing",
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
  let started = false;
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

      const isMouseUp = e.type === "mouseup";
      if (isMouseUp) {
        if (!started) {
          return;
        }
        onChange?.(gestureInfo);
        return;
      }

      let someChange = gestureInfo.xChanged || gestureInfo.yChanged;
      if (someChange) {
        previousGestureInfo = { ...gestureInfo };
      }

      if (!started && threshold) {
        const deltaX = Math.abs(gestureInfo.xMove);
        const deltaY = Math.abs(gestureInfo.yMove);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return;
          }
        }
        started = true;
        onStart?.(gestureInfo);
        return;
      }
      if (someChange) {
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

  if (!threshold) {
    started = true;
    onStart?.(gestureInfo);
  }
};
