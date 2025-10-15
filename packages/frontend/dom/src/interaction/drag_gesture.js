/**
 * Drag Gesture System
 *
 */

import { createPubSub } from "../pub_sub.js";

export const createDragGestureController = (options = {}) => {
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    backdrop = true,
    backdropZIndex = 1,
  } = options;

  const dragGestureController = {
    grab: null,
    grabViaMouse: null,
  };

  const grab = ({
    direction = defaultDirection,
    event = new CustomEvent("programmatic"),
    grabX = 0,
    grabY = 0,
    cursor = "grabbing",
    scrollContainer = document.documentElement,
  } = {}) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const [publishBeforeDrag, addBeforeDragCallback] = createPubSub();
    const [publishDrag, addDragCallback] = createPubSub();
    const [publishRelease, addReleaseCallback] = createPubSub();
    if (onDrag) {
      addDragCallback(onDrag);
    }
    if (onRelease) {
      addReleaseCallback(onRelease);
    }

    const gestureInfo = {
      name,
      direction,
      started: !threshold,
      status: "grabbed",

      scrollContainer,
      grabScrollLeft: scrollContainer.scrollLeft, // scrollLeft of the scrollContainer at grab time
      grabScrollTop: scrollContainer.scrollTop, // scrollTop of the scrollContainer at grab time
      grabX, // x grab coordinate (excluding scroll of the scrollContainer)
      grabY, // y grab coordinate (excluding scroll of the scrollContainer)

      dragX: grabX, // coordinate of the last drag (excluding scroll of the scrollContainer)
      dragY: grabY, // coordinate of the last drag (excluding scroll of the scrollContainer)

      moveX: 0, // dragX + scrollLeft + constraints applied
      moveY: 0, // dragY + scrollTop + constraints applied
      // metadata about the move
      moveXChanged: false, // x changed since last gesture
      moveYChanged: false, // y changed since last gesture
      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,

      // metadata about interaction sources
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "name");
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "scrollContainer");
    definePropertyAsReadOnly(gestureInfo, "grabScrollLeft");
    definePropertyAsReadOnly(gestureInfo, "grabScrollTop");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    definePropertyAsReadOnly(gestureInfo, "grabEvent");

    // Set up backdrop
    if (backdrop) {
      const backdropElement = document.createElement("div");
      backdropElement.className = "navi_drag_gesture_backdrop";
      backdropElement.style.zIndex = backdropZIndex;
      backdropElement.style.cursor = cursor;
      document.body.appendChild(backdropElement);
      addReleaseCallback(() => {
        backdropElement.remove();
      });
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    drag_on_scroll: {
      let isHandlingScroll = false;
      const handleScroll = (scrollEvent) => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, { event: scrollEvent });
        isHandlingScroll = false;
      };
      const scrollEventReceiver =
        scrollContainer === document.documentElement
          ? document
          : scrollContainer;
      scrollEventReceiver.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addReleaseCallback(() => {
        scrollEventReceiver.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = ({
      dragX,
      dragY,
      dragEvent,
      isRelease = false,
    }) => {
      // === ÉTAT INITIAL (au moment du grab) ===
      const { grabX, grabY, grabScrollLeft, grabScrollTop } = gestureInfo;
      const grabXWithScroll = grabX + grabScrollLeft;
      const grabYWithScroll = grabY + grabScrollTop;
      // === CE QUI EST DEMANDÉ (où on veut aller) ===
      const dragXWithScroll = dragX + scrollContainer.scrollLeft;
      const dragYWithScroll = dragY + scrollContainer.scrollTop;
      const moveXRequested = dragXWithScroll - grabXWithScroll;
      const moveYRequested = dragYWithScroll - grabYWithScroll;
      // === APPLIQUER LES CONTRAINTES ===
      let moveXConstrained = moveXRequested;
      let moveYConstrained = moveYRequested;
      const limitMoveX = (value) => {
        moveXConstrained = value;
      };
      const limitMoveY = (value) => {
        moveYConstrained = value;
      };
      publishBeforeDrag(moveXRequested, moveYRequested, {
        limitMoveX,
        limitMoveY,
        dragEvent,
        isRelease,
      });
      // === ÉTAT FINAL ===
      const moveX = moveXConstrained;
      const moveY = moveYConstrained;
      // Calcul de la direction basé sur le mouvement précédent
      const currentMoveX = gestureInfo.moveX;
      const currentMoveY = gestureInfo.moveY;
      const isGoingLeft = moveX < currentMoveX;
      const isGoingRight = moveX > currentMoveX;
      const isGoingUp = moveY < currentMoveY;
      const isGoingDown = moveY > currentMoveY;

      const dragData = {
        dragX,
        dragY,
        moveX,
        moveY,

        moveXChanged: moveX !== currentMoveX,
        moveYChanged: moveY !== currentMoveY,
        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,

        status: isRelease ? "released" : "dragging",
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null,
      };

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(moveXRequested);
        const deltaY = Math.abs(moveYRequested);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return dragData;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return dragData;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return dragData;
          }
        }
        dragData.started = true;
      }
      return dragData;
    };

    const drag = (
      dragX = gestureInfo.dragX, // Scroll container relative X coordinate
      dragY = gestureInfo.dragY, // Scroll container relative Y coordinate
      { event = new CustomEvent("programmatic"), isRelease = false } = {},
    ) => {
      if (import.meta.dev && (isNaN(dragX) || isNaN(dragY))) {
        throw new Error(`Invalid drag coordinates x=${dragX} y=${dragY}`);
      }

      const dragData = determineDragData({
        dragX,
        dragY,
        dragEvent: event,
        isRelease,
      });
      const startedPrevious = gestureInfo.started;
      // previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);
      if (!startedPrevious && gestureInfo.started) {
        onDragStart?.(gestureInfo);
      }
      const someChange = gestureInfo.moveXChanged || gestureInfo.moveYChanged;
      if (someChange) {
        publishDrag(gestureInfo);
      }
    };

    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY,
    } = {}) => {
      drag(releaseX, releaseY, { event, isRelease: true });
      publishRelease(gestureInfo);
    };

    onGrab?.(gestureInfo);
    const dragGesture = {
      gestureInfo,
      addBeforeDragCallback,
      addDragCallback,
      addReleaseCallback,
      drag,
      release,
    };
    return dragGesture;
  };
  dragGestureController.grab = grab;

  const grabViaMouse = (mouseEvent, options = {}) => {
    if (mouseEvent.type === "mousedown" && mouseEvent.button !== 0) {
      return null;
    }
    const target = mouseEvent.target;
    if (!target.closest) {
      return null;
    }
    const mouseEventCoords = (mouseEvent) => {
      const { clientX, clientY } = mouseEvent;
      return [clientX, clientY];
    };

    const [mouseGrabX, mouseGrabY] = mouseEventCoords(mouseEvent);
    const dragGesture = dragGestureController.grab({
      grabX: mouseGrabX,
      grabY: mouseGrabY,
      event: mouseEvent,
      ...options,
    });

    const dragViaMouse = (mousemoveEvent) => {
      const [mouseDragX, mouseDragY] = mouseEventCoords(mousemoveEvent);
      dragGesture.drag(mouseDragX, mouseDragY, {
        event: mousemoveEvent,
      });
    };

    const releaseViaMouse = (mouseupEvent) => {
      const [mouseReleaseX, mouseReleaseY] = mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseReleaseX,
        releaseY: mouseReleaseY,
      });
    };
    document.addEventListener("mousemove", dragViaMouse);
    document.addEventListener("mouseup", releaseViaMouse);
    dragGesture.addReleaseCallback(() => {
      document.removeEventListener("mousemove", dragViaMouse);
      document.removeEventListener("mouseup", releaseViaMouse);
    });
    dragGesture.dragViaMouse = dragViaMouse;
    dragGesture.releaseViaMouse = releaseViaMouse;
    return dragGesture;
  };
  dragGestureController.grabViaMouse = grabViaMouse;

  return dragGestureController;
};

export const createMouseDragThresholdPromise = (mousedownEvent, threshold) => {
  let _resolve;
  let resolved = false;
  const promise = new Promise((resolve) => {
    _resolve = resolve;
  });
  const dragGestureController = createDragGestureController({
    threshold,
    backdrop: false,
    onDragStart: (gestureInfo) => {
      resolved = true;
      _resolve(gestureInfo);
      dragGesture.release(); // kill that gesture
    },
    onRelease: (gestureInfo) => {
      if (!resolved) {
        _resolve(gestureInfo);
      }
    },
  });
  const dragGesture = dragGestureController.grabViaMouse(mousedownEvent, {
    element: mousedownEvent.target,
  });
  return promise;
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};

import.meta.css = /* css */ `
  .navi_drag_gesture_backdrop {
    position: fixed;
    inset: 0;
    user-select: none;
  }
`;
