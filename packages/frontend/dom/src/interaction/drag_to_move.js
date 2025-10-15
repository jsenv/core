import {
  addScrollToRect,
  convertScrollRelativeRectToElementRect,
  getMouseEventScrollRelativeRect,
  getScrollRelativeRect,
  getScrollRelativeVisibleRect,
} from "../position/dom_coords.js";
import { createPubSub } from "../pub_sub.js";
import {
  getAncestorScrolls,
  getScrollContainer,
} from "../scroll/scroll_container.js";
import { setStyles } from "../style_and_attributes.js";
import {
  applyConstraints,
  createBoundConstraint,
  prepareConstraints,
} from "./constraint.js";
import { setupConstraintFeedbackLine } from "./constraint_feedback_line.js";
import { setupVisualMarkers } from "./debug_markers.js";
import { createObstacleConstraintsFromQuerySelector } from "./drag_obstacles.js";
import { applyStickyFrontiersToVisibleArea } from "./sticky_frontiers.js";

import { createDragGestureController } from "./drag_gesture.js";

export const createDragToMoveGestureController = (options) => {
  const grabToMove = (
    dragGesture,
    { element, elementToImpact, elementVisuallyImpacted },
  ) => {
    // Convert all element coordinates to document-relative coordinates
    const {
      left: elementToImpactLeftScrollRelative,
      top: elementToImpactTopScrollRelative,
    } = getScrollRelativeRect(elementToImpact);
    const grabScrollRelativeRect = getScrollRelativeRect(
      elementVisuallyImpacted,
    );
    const {
      left: grabLeft,
      top: grabTop,
      width,
      height,
      scrollContainer,
      scrollContainerIsDocument,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,
    } = grabScrollRelativeRect;

    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    let visualOffsetX = grabLeft - elementToImpactLeftScrollRelative;
    let visualOffsetY = grabTop - elementToImpactTopScrollRelative;
    // const [layoutOffsetX, layoutOffsetY] = getScrollContainerOffset(element);

    const positionedParent = element.offsetParent;
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    let positionedParentLeftStatic = positionedParentRect.left;
    let positionedParentTopStatic = positionedParentRect.top;
    let scrollContainerLeftStatic = scrollContainerRect.left;
    let scrollContainerTopStatic = scrollContainerRect.top;
    const positionedParentScrolls = getAncestorScrolls(positionedParent, true);
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
    const layoutOffsetY = positionedParentTopStatic - scrollContainerTopStatic;
    console.log({
      grabTop,
      layoutOffsetX,
      layoutOffsetY,
      positionedScrollY,
      scrollContainerScrollY,
    });

    if (fromFixed) {
      const stylesToSet = {
        position: "absolute",
        left: `${grabLeft}px`,
        top: `${grabTop}px`,
        transform: "none",
      };
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const { left: leftFixed, top: topFixed } =
          convertScrollRelativeRectToElementRect(
            gestureInfo.scrollRelativeRect,
            element,
          );
        restoreStyles();
        setStyles(element, {
          left: `${leftFixed}px`,
          top: `${topFixed}px`,
        });
      });
    } else if (fromStickyLeft || fromStickyTop) {
      const isStickyLeft = Boolean(fromStickyLeft);
      const isStickyTop = Boolean(fromStickyTop);
      const stylesToSet = {
        position: "relative",
      };
      if (isStickyLeft) {
        stylesToSet.left = `${grabLeft}px`;
      }
      if (isStickyTop) {
        stylesToSet.top = `${grabTop}px`;
      }
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const { left: leftSticky, top: topSticky } =
          convertScrollRelativeRectToElementRect(
            gestureInfo.scrollRelativeRect,
            element,
          );
        const stylesToSetOnTeardown = {};
        restoreStyles();
        if (isStickyLeft) {
          stylesToSetOnTeardown.left = `${leftSticky}px`;
        }
        if (isStickyTop) {
          stylesToSetOnTeardown.top = `${topSticky}px`;
        }
        setStyles(element, stylesToSetOnTeardown);
      });
    } else {
      // Handle data-sticky attributes for visual offset adjustment
      if (fromStickyLeftAttr) {
        if (scrollContainerIsDocument) {
          // For document scrolling with sticky elements, calculate the position as it would be at zero scroll
          // The current 'left' is the scrollable coordinate, which includes scroll offset
          // The position at zero scroll would be: left + scrollLeftAtStart
          const positionAtZeroScroll = grabLeft + scrollContainer.scrollLeft;
          visualOffsetX =
            positionAtZeroScroll - elementToImpactLeftScrollRelative;
        }
      }
      if (fromStickyTopAttr) {
        if (scrollContainerIsDocument) {
          const positionAtZeroScroll = grabTop + scrollContainer.scrollTop;
          visualOffsetY =
            positionAtZeroScroll - elementToImpactTopScrollRelative;
        }
      }
    }

    const scrollRelativeRect = { ...grabScrollRelativeRect };

    const grabGestureInfo = {
      element,
      elementToImpact,
      elementVisuallyImpacted,
      visualOffsetX,
      visualOffsetY,
      layoutOffsetX,
      layoutOffsetY,
      elementVisuallyImpactedWidth: width,
      elementVisuallyImpactedHeight: height,

      grabScrollRelativeRect,
      scrollRelativeRect,
      // Track whether elements have entered visible area once
      // Elements may start outside the visible area (mostly when sticky + sticky frontiers)
      // In that case until they cross the visible sides
      // they won't trigger auto-scroll and sticky obstacles can collide independently of the scroll
      hasCrossedVisibleAreaLeftOnce: false,
      hasCrossedVisibleAreaTopOnce: false,
    };

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    dragGesture.addReleaseCallback(() => {
      element.removeAttribute("data-grabbed");
    });

    const dragToMove = () => {
      const {
        elementToImpact,
        elementVisuallyImpacted,
        elementVisuallyImpactedWidth,
        elementVisuallyImpactedHeight,
        visualOffsetX,
        visualOffsetY,
        layoutOffsetX,
        layoutOffsetY,
        grabScrollRelativeRect,

        isGoingDown,
        isGoingUp,
        isGoingLeft,
        isGoingRight,
        visibleArea,
        hasCrossedVisibleAreaLeftOnce,
        hasCrossedVisibleAreaTopOnce,
      } = gestureInfo;

      const {
        left: grabLeft,
        top: grabTop,
        scrollLeft: grabScrollLeft,
        scrollTop: grabScrollTop,
      } = grabScrollRelativeRect;
      const desiredElementLeft =
        grabLeft - layoutOffsetX + grabScrollLeft + gestureInfo.xMove;
      const desiredElementRight =
        desiredElementLeft + elementVisuallyImpactedWidth;
      const desiredElementTop =
        grabTop - layoutOffsetY + grabScrollTop + gestureInfo.yMove;
      const desiredElementBottom =
        desiredElementTop + elementVisuallyImpactedHeight;

      console.log({
        grabTop,
        layoutOffsetY,
        grabScrollTop,
        yMove: gestureInfo.yMove,
      });

      // Helper function to handle auto-scroll and element positioning for an axis
      const moveAndKeepIntoView = ({
        axis,
        isGoingPositive, // right/down
        isGoingNegative, // left/up
        desiredElementStart, // left/top edge of element
        desiredElementEnd, // right/bottom edge of element
        visibleAreaStart, // visible left/top boundary
        visibleAreaEnd, // visible right/bottom boundary
        currentScroll, // current scrollLeft or scrollTop value
        canAutoScrollNegative, // whether auto-scroll is allowed for sticky elements when going negative
      }) => {
        const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
        const styleProperty = axis === "x" ? "left" : "top";
        const visualOffset = axis === "x" ? visualOffsetX : visualOffsetY;
        //  const layoutOffset = axis === "x" ? layoutOffsetX : layoutOffsetY;

        keep_into_view: {
          if (isGoingPositive) {
            if (desiredElementEnd > visibleAreaEnd) {
              const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
              const scroll = currentScroll + scrollAmountNeeded;
              console.log(
                `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              );
              scrollContainer[scrollProperty] = scroll;
            }
          } else if (isGoingNegative) {
            if (
              canAutoScrollNegative &&
              desiredElementStart < visibleAreaStart
            ) {
              const scrollAmountNeeded = visibleAreaStart - desiredElementStart;
              const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
              console.log(
                `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
              );
              scrollContainer[scrollProperty] = scroll;
            }
          }
        }
        move: {
          const elementPosition = desiredElementStart - visualOffset;
          if (elementToImpact) {
            elementToImpact.style[styleProperty] = `${elementPosition}px`;
          }
        }
      };

      // Horizontal auto-scroll
      if (direction.x) {
        // Determine if auto-scroll is allowed for sticky elements when going left
        const canAutoScrollLeft =
          !elementVisuallyImpacted.hasAttribute("data-sticky-left") ||
          hasCrossedVisibleAreaLeftOnce;
        moveAndKeepIntoView({
          axis: "x",
          isGoingPositive: isGoingRight,
          isGoingNegative: isGoingLeft,
          desiredElementStart: desiredElementLeft,
          desiredElementEnd: desiredElementRight,
          visibleAreaStart: visibleArea.left,
          visibleAreaEnd: visibleArea.right,
          canAutoScrollNegative: canAutoScrollLeft,
          currentScroll: scrollContainer.scrollLeft,
        });
      }

      // Vertical auto-scroll
      if (direction.y) {
        // Determine if auto-scroll is allowed for sticky elements when going up
        const canAutoScrollUp =
          !elementVisuallyImpacted.hasAttribute("data-sticky-top") ||
          hasCrossedVisibleAreaTopOnce;
        moveAndKeepIntoView({
          axis: "y",
          isGoingPositive: isGoingDown,
          isGoingNegative: isGoingUp,
          desiredElementStart: desiredElementTop,
          desiredElementEnd: desiredElementBottom,
          visibleAreaStart: visibleArea.top,
          visibleAreaEnd: visibleArea.bottom,
          canAutoScrollNegative: canAutoScrollUp,
          currentScroll: scrollContainer.scrollTop,
        });
      }
    };

    return { drag: dragToMove };
  };

  const dragToMoveGestureController = createDragGestureController({
    ...options,
    lifecycle: {
      grab: grabToMove,
    },
  });
  return dragToMoveGestureController;
};
