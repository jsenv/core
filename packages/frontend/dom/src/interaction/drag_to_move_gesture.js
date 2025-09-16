import { createDragGesture } from "./drag_gesture.js";

export const createDragToMoveGesture = (options) => {
  const dragToMoveGesture = createDragGesture({
    ...options,
    lifecycle: {
      drag: (
        gestureInfo,
        { direction, positionedParent, scrollableParent },
      ) => {
        const {
          initialLeft,
          initialTop,
          isGoingDown,
          isGoingUp,
          isGoingLeft,
          isGoingRight,
          elementToImpact,
          elementVisuallyImpacted,
          visibleAreaLeft,
          visibleAreaRight,
          visibleAreaTop,
          visibleAreaBottom,
        } = gestureInfo;
        const elementVisuallyImpactedRect =
          elementVisuallyImpacted.getBoundingClientRect();
        const elementWidth = elementVisuallyImpactedRect.width;
        const elementHeight = elementVisuallyImpactedRect.height;

        // Calculate where element bounds would be in viewport coordinates
        const currentPositionedParentRect =
          positionedParent.getBoundingClientRect();

        // Helper function to handle auto-scroll and element positioning for an axis
        const moveAndKeepIntoView = ({
          // axis,
          isGoingPositive, // right/down
          isGoingNegative, // left/up
          desiredElementStart, // left/top edge of element
          desiredElementEnd, // right/bottom edge of element
          visibleAreaStart, // visible left/top boundary
          visibleAreaEnd, // visible right/bottom boundary
          currentScroll, // current scrollLeft or scrollTop value
          initialPosition, // initialLeft or initialTop
          moveAmount, // gestureInfo.xMove or gestureInfo.yMove
          scrollProperty, // 'scrollLeft' or 'scrollTop'
          styleProperty, // 'left' or 'top'
          autoScrollProperty, // 'autoScrolledX' or 'autoScrolledY'
        }) => {
          let scroll = currentScroll;

          keep_into_view: {
            if (isGoingPositive) {
              if (desiredElementEnd > visibleAreaEnd) {
                const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
                scroll = currentScroll + scrollAmountNeeded;
              }
            } else if (isGoingNegative) {
              if (desiredElementStart < visibleAreaStart) {
                const scrollAmountNeeded =
                  visibleAreaStart - desiredElementStart;
                scroll = Math.max(0, currentScroll - scrollAmountNeeded);
              }
            }
            scrollableParent[scrollProperty] = scroll;
            gestureInfo[autoScrollProperty] = scroll;
          }
          move: {
            const elementPosition = initialPosition + moveAmount;
            if (elementToImpact) {
              elementToImpact.style[styleProperty] = `${elementPosition}px`;
            }
          }
        };
        // Horizontal auto-scroll
        if (direction.x) {
          const desiredElementLeftRelative = initialLeft + gestureInfo.xMove;
          const desiredElementLeft =
            desiredElementLeftRelative + currentPositionedParentRect.left;
          const desiredElementRight = desiredElementLeft + elementWidth;
          moveAndKeepIntoView({
            axis: "x",
            isGoingPositive: isGoingRight,
            isGoingNegative: isGoingLeft,
            desiredElementStart: desiredElementLeft,
            desiredElementEnd: desiredElementRight,
            visibleAreaStart: visibleAreaLeft,
            visibleAreaEnd: visibleAreaRight,
            currentScroll: scrollableParent.scrollLeft,
            initialPosition: initialLeft,
            moveAmount: gestureInfo.xMove,
            scrollProperty: "scrollLeft",
            styleProperty: "left",
            autoScrollProperty: "autoScrolledX",
          });
        }

        // Vertical auto-scroll
        if (direction.y) {
          const desiredElementTopRelative = initialTop + gestureInfo.yMove;
          const desiredElementTop =
            desiredElementTopRelative + currentPositionedParentRect.top;
          const desiredElementBottom = desiredElementTop + elementHeight;
          moveAndKeepIntoView({
            axis: "y",
            isGoingPositive: isGoingDown,
            isGoingNegative: isGoingUp,
            desiredElementStart: desiredElementTop,
            desiredElementEnd: desiredElementBottom,
            visibleAreaStart: visibleAreaTop,
            visibleAreaEnd: visibleAreaBottom,
            currentScroll: scrollableParent.scrollTop,
            initialPosition: initialTop,
            moveAmount: gestureInfo.yMove,
            scrollProperty: "scrollTop",
            styleProperty: "top",
            autoScrollProperty: "autoScrolledY",
          });
        }
      },
    },
  });
  return dragToMoveGesture;
};
