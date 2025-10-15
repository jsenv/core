import { getScrollBox } from "../position/dom_coords.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import { createDragGestureController } from "./drag_gesture.js";
import { applyStickyFrontiersToVisibleArea } from "./sticky_frontiers.js";

export const createDragToMoveGestureController = ({
  stickyFrontiers = true,
  visibleAreaPadding,
  ...options
} = {}) => {
  const grabToMoveElement = (dragGesture, { element, elementToImpact }) => {
    const direction = dragGesture.gestureInfo.direction;
    const dragGestureName = dragGesture.gestureInfo.name;
    const scrollContainer = dragGesture.gestureInfo.scrollContainer;
    const positionedParent = element.offsetParent;

    let elementWidth;
    let elementHeight;
    {
      const updateElementDimension = () => {
        const elementRect = element.getBoundingClientRect();
        elementWidth = elementRect.width;
        elementHeight = elementRect.height;
      };
      updateElementDimension();
      dragGesture.addBeforeDragCallback(updateElementDimension);
    }

    let visibleArea;
    {
      const updateVisibleArea = () => {
        const visibleAreaBase = getScrollBox(scrollContainer);
        let visibleAreaCurrent = visibleAreaBase;
        if (stickyFrontiers) {
          visibleAreaCurrent = applyStickyFrontiersToVisibleArea(
            visibleAreaCurrent,
            {
              scrollContainer,
              direction,
              dragGestureName,
            },
          );
        }
        if (visibleAreaPadding > 0) {
          visibleAreaCurrent = {
            left: visibleAreaCurrent.left + visibleAreaPadding,
            top: visibleAreaCurrent.top + visibleAreaPadding,
            right: visibleAreaCurrent.right - visibleAreaPadding,
            bottom: visibleAreaCurrent.bottom - visibleAreaPadding,
          };
        }
        visibleArea = visibleAreaCurrent;
      };
      updateVisibleArea();
      dragGesture.addBeforeDragCallback(updateVisibleArea);
    }

    let elementLeftAtGrab;
    let elementTopAtGrab;

    let layoutConverter;
    // We need a unique coordinate system internally
    // (which is position relative to the scroll container)
    // but we also need to be able to set the element position
    // in the DOM which might be different according to his own position + ancestor positions
    {
      const positionedParentRect = positionedParent.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      let positionedParentLeftStatic = positionedParentRect.left;
      let positionedParentTopStatic = positionedParentRect.top;
      let scrollContainerLeftStatic = scrollContainerRect.left;
      let scrollContainerTopStatic = scrollContainerRect.top;
      const positionedParentScrolls = getAncestorScrolls(
        positionedParent,
        true,
      );
      const scrollContainerScrolls = getAncestorScrolls(scrollContainer, true);
      const positionedScrollX = positionedParentScrolls.scrollX;
      const scrollContainerScrollX = scrollContainerScrolls.scrollX;
      const positionedScrollY = positionedParentScrolls.scrollY;
      const scrollContainerScrollY = scrollContainerScrolls.scrollY;
      scrollContainerLeftStatic -= scrollContainerScrollX;
      positionedParentLeftStatic -= positionedScrollX;
      scrollContainerTopStatic -= scrollContainerScrollY;
      positionedParentTopStatic -= positionedScrollY;
      // Calculate static offset between positioned parent and scroll container
      const layoutOffsetX =
        positionedParentLeftStatic - scrollContainerLeftStatic;
      const layoutOffsetY =
        positionedParentTopStatic - scrollContainerTopStatic;
      console.log({
        layoutOffsetX,
        layoutOffsetY,
        positionedScrollY,
        scrollContainerScrollY,
      });

      const toLayoutLeft = () => {};
      const toLayoutTop = () => {};
      layoutConverter = {
        toLayoutLeft,
        toLayoutTop,
      };
    }

    let moveConverter;
    {
      const scrollLeftAtGrab = dragGesture.gestureInfo.grabScrollLeft;
      const scrollTopAtGrab = dragGesture.gestureInfo.grabScrollTop;
      const elementLeftWithScrollAtGrab = elementLeftAtGrab + scrollLeftAtGrab;
      const elementTopWithScrollAtGrab = elementTopAtGrab + scrollTopAtGrab;

      const toElementLeft = (moveX) => elementLeftWithScrollAtGrab + moveX;
      const toElementTop = (moveY) => elementTopWithScrollAtGrab + moveY;
      const fromElementLeft = (left) => left - elementLeftWithScrollAtGrab;
      const fromElementTop = (top) => top - elementTopWithScrollAtGrab;
      moveConverter = {
        toElementLeft,
        toElementTop,
        fromElementLeft,
        fromElementTop,
      };
    }

    // TODO: will be the diff between elementToImpact and elementVisuallyImpacted
    let visualOffsetX = 0;
    let visualOffsetY = 0;

    // Will be used for dynamic constraints on sticky elements
    let hasCrossedVisibleAreaLeftOnce = false;
    let hasCrossedVisibleAreaTopOnce = false;

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    const dragToMove = (gestureInfo) => {
      const {
        isGoingDown,
        isGoingUp,
        isGoingLeft,
        isGoingRight,
        moveX,
        moveY,
      } = gestureInfo;
      const elementLeft = moveConverter.toElementLeft(moveX);
      const elementTop = moveConverter.toElementTop(moveY);
      const elementLeftLayout = layoutConverter.toLayoutLeft(elementLeft);
      const elementTopLayout = layoutConverter.toLayoutTop(elementTop);
      const elementRightLayout = elementLeft + elementWidth;
      const elementBottomLayout = elementTopLayout + elementHeight;

      // Helper function to handle auto-scroll and element positioning for an axis
      const moveAndKeepIntoView = ({
        axis,
        elementStart, // left/top edge of element
        elemendEnd, // right/bottom edge of element
        visibleAreaStart, // visible left/top boundary
        visibleAreaEnd, // visible right/bottom boundary
        canAutoScrollNegative, // whether auto-scroll is allowed for sticky elements when going negative

        isGoingPositive, // right/down
        isGoingNegative, // left/up
      }) => {
        keep_into_view: {
          const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
          const currentScroll =
            axis === "x"
              ? scrollContainer.scrollLeft
              : scrollContainer.scrollTop;

          if (isGoingPositive) {
            if (elemendEnd > visibleAreaEnd) {
              const scrollAmountNeeded = elemendEnd - visibleAreaEnd;
              const scroll = currentScroll + scrollAmountNeeded;
              console.log(
                `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              );
              scrollContainer[scrollProperty] = scroll;
            }
          } else if (isGoingNegative) {
            if (canAutoScrollNegative && elementStart < visibleAreaStart) {
              const scrollAmountNeeded = visibleAreaStart - elementStart;
              const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
              console.log(
                `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              );
              scrollContainer[scrollProperty] = scroll;
            }
          }
        }
        move: {
          const styleProperty = axis === "x" ? "left" : "top";
          const visualOffset = axis === "x" ? visualOffsetX : visualOffsetY;

          const elementPosition = elementStart - visualOffset;
          if (elementToImpact) {
            elementToImpact.style[styleProperty] = `${elementPosition}px`;
          }
        }
      };

      if (direction.x) {
        // Determine if auto-scroll is allowed for sticky elements when going left
        const canAutoScrollLeft =
          !element.hasAttribute("data-sticky-left") ||
          hasCrossedVisibleAreaLeftOnce;
        moveAndKeepIntoView({
          axis: "x",
          isGoingPositive: isGoingRight,
          isGoingNegative: isGoingLeft,
          desiredElementStart: elementLeftLayout,
          desiredElementEnd: elementRightLayout,
          visibleAreaStart: visibleArea.left,
          visibleAreaEnd: visibleArea.right,
          canAutoScrollNegative: canAutoScrollLeft,
        });
      }
      if (direction.y) {
        // Determine if auto-scroll is allowed for sticky elements when going up
        const canAutoScrollUp =
          !element.hasAttribute("data-sticky-top") ||
          hasCrossedVisibleAreaTopOnce;
        moveAndKeepIntoView({
          axis: "y",
          isGoingPositive: isGoingDown,
          isGoingNegative: isGoingUp,
          desiredElementStart: elementTopLayout,
          desiredElementEnd: elementBottomLayout,
          visibleAreaStart: visibleArea.top,
          visibleAreaEnd: visibleArea.bottom,
          canAutoScrollNegative: canAutoScrollUp,
        });
      }
    };

    return { drag: dragToMove };
  };

  const dragToMoveGestureController = createDragGestureController({
    ...options,
    inferScrollContainer: ({ element }) => {
      if (!element) {
        throw new Error("element is required");
      }
      return getScrollContainer(element);
    },
    lifecycle: {
      grab: grabToMoveElement,
    },
  });
  return dragToMoveGestureController;
};
