/**
 * Drag Gesture System
 *
 * Provides constraint-based dragging functionality for DOM elements with support for:
 *
 * **Core Features:**
 * - Mouse and scroll-based dragging interactions
 * - Bounds constraints (keep elements within container boundaries)
 * - Obstacle constraints (prevent elements from overlapping with other elements)
 * - Visual feedback with constraint lines and debug markers
 *
 * **Interaction Types:**
 * - Mouse dragging: Traditional click-and-drag with mouse events
 * - Scroll dragging: Drag using scroll wheel while holding mouse button
 * - Programmatic: Direct position updates via API
 *
 * **Constraint System:**
 * - Bounds constraints: Define rectangular areas elements must stay within
 * - Obstacle constraints: Define rectangular areas elements cannot overlap
 * - Sticky frontiers: Trigger scrolling when encountered, allow movement beyond when scroll exhausted
 * - Floating point precision handling: Ensures reliable constraint detection
 * - Overlap resolution: Automatic collision detection and resolution
 *
 * **Technical Details:**
 * - Uses floating point rounding to prevent precision issues in boundary detection
 * - Scroll events are more susceptible to floating point errors than mouse events
 * - Supports both relative and absolute positioning contexts
 * - Integrates with scrollable containers for viewport-aware constraints
 *
 * **Debug Features:**
 * - Visual markers show bounds, obstacles, and constraint feedback lines
 * - Optional marker persistence after drag ends for debugging constraint systems
 * - Enable/disable debug markers globally via DRAG_DEBUG_VISUAL_MARKERS
 *
 * **Usage:**
 * Call `createDragGesture(options)` to create a drag gesture system.
 * Configure constraints, interaction callbacks, visual feedback, and debug options.
 *
 * **Sticky Frontiers:**
 * Elements with one of
 * `[data-drag-sticky-frontier-left="dragName"]`,
 * `[data-drag-sticky-frontier-right="dragName"]`,
 * `[data-drag-sticky-frontier-top="dragName"]`,
 * `[data-drag-sticky-frontier-bottom="dragName"]`
 * create directional scroll barriers. When dragging encounters these barriers on their specified side,
 * scrolling is triggered first. Once scroll is exhausted, dragging can continue beyond the frontier.
 * This allows smooth scrolling behavior while maintaining drag flexibility.
 *
 * **Important:** Each sticky frontier element should have only ONE side attribute. Elements with
 * multiple side attributes will log a warning and only use the first detected side.
 *
 * **Examples:**
 * ```html
 * <!-- Sticky column header (blocks vertical movement from top) -->
 * <div
 *   data-drag-sticky-frontier-bottom="table-content"
 * >
 *   Header
 * </div>
 *
 * <!-- Sticky left sidebar (blocks horizontal movement from left) -->
 * <div
 *   data-drag-sticky-frontier-right="main-content"
 * >
 *   Sidebar
 * </div>
 * ```
 */

import {
  convertScrollRelativeRectToElementRect,
  getMouseEventScrollRelativeRect,
  getScrollContainerVisibleRect,
  getScrollRelativeRect,
} from "../position/dom_coords.js";
import { createPubSub } from "../pub_sub.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
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

const BASIC_MODE_OPTIONS = {
  backdrop: false,
  stickyFrontiers: false,
  areaConstraint: "visible",
  obstacleAttributeName: null,
  showConstraintFeedbackLine: false,
  dragViaScroll: false,
};
// This flag can be used to reduce number of features to the bare minimum to help debugging
const KEEP_IT_STUPID_SIMPLE = true;

export const createMouseDragThresholdPromise = (mousedownEvent, threshold) => {
  let _resolve;
  let resolved = false;
  const promise = new Promise((resolve) => {
    _resolve = resolve;
  });
  const dragGestureController = createDragGestureController({
    threshold,
    isThresholdOnly: true,
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

export const createDragGestureController = (options = {}) => {
  if (KEEP_IT_STUPID_SIMPLE) {
    Object.assign(options, BASIC_MODE_OPTIONS);
  }
  let {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    isThresholdOnly,
    gestureAttribute,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    backdrop = !isThresholdOnly,
    backdropZIndex = 1,

    stickyFrontiers = true,
    areaConstraint = "scroll",
    customAreaConstraint,
    obstacleAttributeName = "data-drag-obstacle",
    dragViaScroll = true,
    // Padding to reduce the visible area constraint by this amount (applied after sticky frontiers)
    // This creates an invisible margin around the visible area where elements cannot be dragged
    visibleAreaPadding = 0,

    // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
    // This provides intuitive feedback during drag operations when the element cannot reach the mouse
    // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
    // initially grabbed the element, but moves with the element to show the current anchor position.
    // It becomes visible when there's a significant distance between mouse and grab point.
    showConstraintFeedbackLine = true,
    lifecycle,
  } = options;

  const grab = (
    element,
    {
      event = new CustomEvent("programmatic"),
      grabX = 0,
      grabY = 0,
      elementToImpact = element,
      elementVisuallyImpacted = elementToImpact,
      direction = defaultDirection,
      cursor = "grabbing",
    } = {},
  ) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const [teardown, addTeardown] = createPubSub();

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

    if (isThresholdOnly) {
    } else if (fromFixed) {
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

    const gestureInfo = {
      direction,
      element,
      elementToImpact,
      elementVisuallyImpacted,
      visualOffsetX,
      visualOffsetY,
      elementVisuallyImpactedWidth: width,
      elementVisuallyImpactedHeight: height,

      grabX, // x grab coordinate (scroll relative), default to 0
      grabY, // y grab coordinate (scroll relative), default to 0
      dragX: grabX, // coordinate of the last drag (scroll relative)
      dragY: grabY, // coordinate of the last drag (scroll relative)

      grabScrollRelativeRect,
      scrollRelativeRect,
      xMove: 0, // diff between x and PREVIOUS x
      yMove: 0, // diff between y and PREVIOUS y
      xChanged: false, // x changed since last gesture
      yChanged: false, // y changed since last gesture

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,
      // Track whether elements have entered visible area once
      // Elements may start outside the visible area (mostly when sticky + sticky frontiers)
      // In that case until they cross the visible sides
      // they won't trigger auto-scroll and sticky obstacles can collide independently of the scroll
      hasCrossedVisibleAreaLeftOnce: false,
      hasCrossedVisibleAreaTopOnce: false,

      started: !threshold,
      status: "grabbed",
      interactionType: event.type,
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetX");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetY");
    definePropertyAsReadOnly(gestureInfo, "grabScrollRelativeRect");
    definePropertyAsReadOnly(gestureInfo, "grabX");
    definePropertyAsReadOnly(gestureInfo, "grabY");
    let previousGestureInfo = null;

    // Set up backdrop
    if (backdrop) {
      const backdropElement = document.createElement("div");
      backdropElement.className = "navi_drag_gesture_backdrop";
      backdropElement.style.zIndex = backdropZIndex;
      backdropElement.style.cursor = cursor;
      document.body.appendChild(backdropElement);
      addTeardown(() => {
        backdropElement.remove();
      });
    }

    let constraintFeedbackLine;
    if (showConstraintFeedbackLine) {
      constraintFeedbackLine = setupConstraintFeedbackLine({
        scrollContainer,
      });
      addTeardown(() => {
        constraintFeedbackLine.onRelease();
      });
    }

    // Collect all constraint functions
    const constraintFunctions = [];
    if (areaConstraint === "visible") {
      stickyFrontiers = false;
    }

    if (areaConstraint === "scroll") {
      // Capture scroll container dimensions at drag start to ensure consistency
      const scrollWidthAtStart = scrollContainer.scrollWidth;
      const scrollHeightAtStart = scrollContainer.scrollHeight;
      // Use consistent scroll dimensions captured at drag start
      const { left, top } = scrollContainerIsDocument
        ? { left: 0, top: 0 }
        : getScrollRelativeRect(scrollContainer);

      const scrollAreaConstraintFunction = () => {
        // Handle floating point precision issues between getBoundingClientRect() and scroll dimensions
        // - elementWidth/elementHeight: floats from getBoundingClientRect() (e.g., 2196.477294921875)
        // - scrollWidth/scrollHeight: integers from browser's internal calculations (e.g., 2196)
        //
        // When element dimensions exceed or equal scroll dimensions due to precision differences,
        // we cap the constraint bounds to prevent negative positioning that would push elements
        // outside their intended scrollable area.

        // Right bound should be the rightmost position where the element can start (not end)
        // So it's containerLeft + (scrollWidth - elementWidth)
        const right = left + scrollWidthAtStart;
        const bottom = top + scrollHeightAtStart;

        return createBoundConstraint(
          { left, top, right, bottom },
          {
            element: scrollContainer,
            name: "scroll_area",
          },
        );
      };
      constraintFunctions.push(scrollAreaConstraintFunction);
    } else if (areaConstraint === "visible") {
      const visibleAreaConstraintFunction = () => {
        const bounds = getScrollContainerVisibleRect(element);
        return createBoundConstraint(bounds, {
          element: bounds.scrollContainer,
          name: "visible_area_constraint",
        });
      };
      constraintFunctions.push(visibleAreaConstraintFunction);
    }

    if (customAreaConstraint) {
      const customAreaConstraintFunction = () => {
        return createBoundConstraint(customAreaConstraint, {
          element: scrollContainer,
          name: "custom_area",
        });
      };
      constraintFunctions.push(customAreaConstraintFunction);
    }

    if (obstacleAttributeName) {
      const obstacleConstraintFunctions =
        createObstacleConstraintsFromQuerySelector(scrollContainer, {
          name,
          obstacleAttributeName,
          gestureInfo,
          isDraggedElementSticky:
            isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
        });
      constraintFunctions.push(...obstacleConstraintFunctions);
    }

    const visualMarkers = setupVisualMarkers({
      direction,
      element,
      scrollContainer,
    });
    addTeardown(() => {
      visualMarkers.onRelease();
    });

    // Set up dragging attribute
    element.setAttribute("data-grabbed", "");
    addTeardown(() => {
      element.removeAttribute("data-grabbed");
    });

    if (gestureAttribute) {
      element.setAttribute(gestureAttribute, "");
      addTeardown(() => {
        element.removeAttribute(gestureAttribute);
      });
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    if (dragViaScroll) {
      let isHandlingScroll = false;
      const handleScroll = (scrollEvent) => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;
        drag(gestureInfo.dragX, gestureInfo.dragY, { event: scrollEvent });
        isHandlingScroll = false;
      };
      scrollContainer.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addTeardown(() => {
        scrollContainer.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = ({
      xScrollRelative,
      yScrollRelative,
      dragEvent,
      isRelease = false,
    }) => {
      const interactionType = event.type;
      // Get current element dimensions for dynamic constraint calculation
      const currentRect = elementVisuallyImpacted.getBoundingClientRect();
      const visibleAreaBase = getScrollContainerVisibleRect(element);

      let visibleArea;
      if (stickyFrontiers) {
        visibleArea = applyStickyFrontiersToVisibleArea(visibleAreaBase, {
          scrollContainer,
          direction,
          dragName: name,
        });
      } else {
        visibleArea = visibleAreaBase;
      }
      // Apply visible area padding (reduce the visible area by the padding amount)
      if (visibleAreaPadding > 0) {
        visibleArea = {
          left: visibleArea.left + visibleAreaPadding,
          top: visibleArea.top + visibleAreaPadding,
          right: visibleArea.right - visibleAreaPadding,
          bottom: visibleArea.bottom - visibleAreaPadding,
        };
      }

      const constraints = prepareConstraints(constraintFunctions, {
        name,
        elementWidth: currentRect.width,
        elementHeight: currentRect.height,
        visibleArea,
      });

      const { grabX, grabY, grabScrollRelativeRect } = gestureInfo;
      const { scrollLeft: grabScrollLeft, scrollTop: grabScrollTop } =
        grabScrollRelativeRect;
      const grabXWithScroll = grabX + grabScrollLeft;
      const grabYWithScroll = grabY + grabScrollTop;
      const dragXWithScrollNoConstraint =
        xScrollRelative + scrollContainer.scrollLeft;
      const dragYWithScrollNoConstraint =
        yScrollRelative + scrollContainer.scrollTop;
      const xMoveNoConstraint = dragXWithScrollNoConstraint - grabXWithScroll;
      const yMoveNoConstraint = dragYWithScrollNoConstraint - grabYWithScroll;

      const { left: grabLeft, top: grabTop } = grabScrollRelativeRect;
      const leftRequested = grabLeft + xMoveNoConstraint;
      const topRequested = grabTop + yMoveNoConstraint;
      const [leftConstrained, topConstrained] = applyConstraints(
        constraints,
        leftRequested,
        topRequested,
        {
          gestureInfo,
          elementWidth: currentRect.width,
          elementHeight: currentRect.height,
          direction,
          interactionType,
        },
      );
      const xMove = leftConstrained - grabLeft;
      const yMove = topConstrained - grabTop;
      // Calculate direction based on where the element is trying to move (relative to previous position)
      const previousXMove = gestureInfo.xMove;
      const previousYMove = gestureInfo.yMove;
      const isGoingLeft = xMove < previousXMove;
      const isGoingRight = xMove > previousXMove;
      const isGoingUp = yMove < previousYMove;
      const isGoingDown = yMove > previousYMove;
      const elementLeftWithScroll = grabLeft + xMove;
      const elementTopWithScroll = grabTop + yMove;
      const elementLeftRelative =
        elementLeftWithScroll - scrollContainer.scrollLeft;
      const elementTopRelative =
        elementTopWithScroll - scrollContainer.scrollTop;
      const dragData = {
        dragX: xScrollRelative,
        dragY: yScrollRelative,
        xMove,
        yMove,
        xChanged: xMove !== gestureInfo.xMove,
        yChanged: yMove !== gestureInfo.yMove,
        scrollRelativeRect: {
          ...gestureInfo.scrollRelativeRect,
          left: elementLeftRelative,
          top: elementTopRelative,
          right: elementLeftRelative + currentRect.width,
          bottom: elementTopRelative + currentRect.height,
          scrollLeft: scrollContainer.scrollLeft,
          scrollTop: scrollContainer.scrollTop,
        },
        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,
        visibleArea,

        elementVisuallyImpactedWidth: currentRect.width,
        elementVisuallyImpactedHeight: currentRect.height,

        status: isRelease ? "released" : "dragging",
        interactionType,
        dragEvent: isRelease ? gestureInfo.dragEvent : dragEvent,
        releaseEvent: isRelease ? dragEvent : null,

        hasCrossedVisibleAreaLeftOnce:
          elementLeftWithScroll >= visibleArea.left,
        hasCrossedVisibleAreaTopOnce: elementTopWithScroll >= visibleArea.top,
      };

      visualMarkers.onDrag({
        constraints,
        visibleArea,
        elementWidth: currentRect.width,
        elementHeight: currentRect.height,
      });

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(xMoveNoConstraint);
        const deltaY = Math.abs(yMoveNoConstraint);
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
      xScrollRelative = gestureInfo.dragX, // Scroll container relative X coordinate
      yScrollRelative = gestureInfo.dragY, // Scroll container relative Y coordinate
      { event = new CustomEvent("programmatic"), isRelease = false } = {},
    ) => {
      if (
        import.meta.dev &&
        (isNaN(xScrollRelative) || isNaN(yScrollRelative))
      ) {
        throw new Error(
          `Invalid drag coordinates x=${xScrollRelative} y=${yScrollRelative}`,
        );
      }

      const dragData = determineDragData({
        xScrollRelative,
        yScrollRelative,
        event,
        isRelease,
      });
      previousGestureInfo = { ...gestureInfo };
      Object.assign(gestureInfo, dragData);

      console.log(`Final gesture xMove=${gestureInfo.xMove}`);
      const someChange = gestureInfo.xChanged || gestureInfo.yChanged;
      if (someChange) {
        lifecycle?.drag?.(gestureInfo, {
          scrollContainer,
          direction,
        });
      }
      constraintFeedbackLine?.onDrag(gestureInfo);

      if (isRelease) {
        onDrag?.(gestureInfo);
      } else if (!previousGestureInfo.started) {
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo);
      } else {
        onDrag?.(gestureInfo);
      }
    };

    const release = ({
      event = new CustomEvent("programmatic"),
      releaseX = gestureInfo.dragX,
      releaseY = gestureInfo.dragY,
    } = {}) => {
      drag(releaseX, releaseY, { event, isRelease: true });
      teardown();
      onRelease?.(gestureInfo);
    };

    onGrab?.(gestureInfo);

    const dragGesture = {
      drag,
      release,
      gestureInfo,
      addTeardown,
    };
    return dragGesture;
  };

  const grabViaMouse = (mouseEvent, { element, ...options } = {}) => {
    if (mouseEvent.type === "mousedown" && mouseEvent.button !== 0) {
      return null;
    }
    const target = mouseEvent.target;
    if (!target.closest) {
      return null;
    }

    // Get scroll container for proper coordinate conversion
    const scrollContainer = getScrollContainer(element);

    const mouseEventCoords = (mouseEvent) => {
      // Use scroll coordinates for consistency with drag system
      const { left, top } = getMouseEventScrollRelativeRect(
        mouseEvent,
        scrollContainer,
      );
      return [left, top];
    };

    const [mouseXScrollRelative, mouseYScrollRelative] =
      mouseEventCoords(mouseEvent);
    const dragGesture = grab(element, {
      event: mouseEvent,
      grabX: mouseXScrollRelative,
      grabY: mouseYScrollRelative,
      ...options,
    });

    const dragViaMouse = (mousemoveEvent) => {
      const [xScrollContainer, yScrollContainer] =
        mouseEventCoords(mousemoveEvent);
      dragGesture.drag(xScrollContainer, yScrollContainer, {
        event: mousemoveEvent,
      });
    };

    const releaseViaMouse = (mouseupEvent) => {
      const [mouseXScrollRelative, mouseYScrollRelative] =
        mouseEventCoords(mouseupEvent);
      dragGesture.release({
        event: mouseupEvent,
        releaseX: mouseXScrollRelative,
        releaseY: mouseYScrollRelative,
      });
    };
    document.addEventListener("mousemove", dragViaMouse);
    document.addEventListener("mouseup", releaseViaMouse);
    dragGesture.addTeardown(() => {
      document.removeEventListener("mousemove", dragViaMouse);
      document.removeEventListener("mouseup", releaseViaMouse);
    });

    dragGesture.dragViaMouse = dragViaMouse;
    dragGesture.releaseViaMouse = releaseViaMouse;
    return dragGesture;
  };

  return {
    grab,
    grabViaMouse,
  };
};

export const createDragToMoveGestureController = (options) => {
  const dragToMoveGestureController = createDragGestureController({
    ...options,
    lifecycle: {
      drag: (gestureInfo, { direction, scrollContainer }) => {
        const {
          elementToImpact,
          elementVisuallyImpacted,
          elementVisuallyImpactedWidth,
          elementVisuallyImpactedHeight,
          visualOffsetX,
          visualOffsetY,
          grabScrollRelativeRect,

          isGoingDown,
          isGoingUp,
          isGoingLeft,
          isGoingRight,
          visibleArea,
          hasCrossedVisibleAreaLeftOnce,
          hasCrossedVisibleAreaTopOnce,
        } = gestureInfo;

        const { left: grabLeft, top: grabTop } = grabScrollRelativeRect;
        const initialLeftToImpact = grabLeft - visualOffsetX;
        const initialTopToImpact = grabTop - visualOffsetY;

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
          canAutoScrollNegative, // whether auto-scroll is allowed for sticky elements when going negative
        }) => {
          keep_into_view: {
            if (isGoingPositive) {
              if (desiredElementEnd > visibleAreaEnd) {
                console.log(
                  `Auto-scroll RIGHT triggered: desiredElementEnd=${desiredElementEnd} > visibleAreaEnd=${visibleAreaEnd}`,
                );
                const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
                const scroll = currentScroll + scrollAmountNeeded;
                console.log(
                  `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
                );
                scrollContainer[scrollProperty] = scroll;
              } else {
                console.log(
                  `Auto-scroll RIGHT NOT needed: desiredElementEnd=${desiredElementEnd} <= visibleAreaEnd=${visibleAreaEnd}`,
                );
              }
            } else if (isGoingNegative) {
              if (
                canAutoScrollNegative &&
                desiredElementStart < visibleAreaStart
              ) {
                console.log(
                  `Auto-scroll LEFT triggered: desiredElementStart=${desiredElementStart} < visibleAreaStart=${visibleAreaStart}`,
                );
                const scrollAmountNeeded =
                  visibleAreaStart - desiredElementStart;
                const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
                console.log(
                  `Scrolling ${scrollProperty} from ${currentScroll} to ${scroll} (amount: ${scrollAmountNeeded})`,
                );
                scrollContainer[scrollProperty] = scroll;
              } else {
                console.log(
                  `Auto-scroll LEFT NOT needed: canAutoScrollNegative=${canAutoScrollNegative}, desiredElementStart=${desiredElementStart} >= visibleAreaStart=${visibleAreaStart}`,
                );
              }
            }
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
          const desiredElementLeft = grabLeft + gestureInfo.xMove;
          const desiredElementRight =
            desiredElementLeft + elementVisuallyImpactedWidth;
          // Convert constraint boundary to actual visible area boundary
          // visibleArea.right is where element left edge can be positioned
          // The actual visible right boundary is where element right edge can be
          const actualVisibleAreaRight =
            visibleArea.right + elementVisuallyImpactedWidth;
          // Determine if auto-scroll is allowed for sticky elements when going left
          const canAutoScrollLeft =
            !elementVisuallyImpacted.hasAttribute("data-sticky-left") ||
            hasCrossedVisibleAreaLeftOnce;

          moveAndKeepIntoView({
            // axis: "x",
            isGoingPositive: isGoingRight,
            isGoingNegative: isGoingLeft,
            desiredElementStart: desiredElementLeft,
            desiredElementEnd: desiredElementRight,
            visibleAreaStart: visibleArea.left,
            visibleAreaEnd: actualVisibleAreaRight,
            currentScroll: scrollContainer.scrollLeft,
            initialPosition: initialLeftToImpact,
            moveAmount: gestureInfo.xMove,
            scrollProperty: "scrollLeft",
            styleProperty: "left",
            canAutoScrollNegative: canAutoScrollLeft,
          });
        }

        // Vertical auto-scroll
        if (direction.y) {
          const desiredElementTop = grabTop + gestureInfo.yMove;
          const desiredElementBottom =
            desiredElementTop + elementVisuallyImpactedHeight;
          // Convert constraint boundary to actual visible area boundary
          // visibleArea.bottom is where element top edge can be positioned
          // The actual visible bottom boundary is where element bottom edge can be
          const actualVisibleAreaBottom =
            visibleArea.bottom + elementVisuallyImpactedHeight;
          // Determine if auto-scroll is allowed for sticky elements when going up
          const canAutoScrollUp =
            !elementVisuallyImpacted.hasAttribute("data-sticky-top") ||
            hasCrossedVisibleAreaTopOnce;

          moveAndKeepIntoView({
            // axis: "y",
            isGoingPositive: isGoingDown,
            isGoingNegative: isGoingUp,
            desiredElementStart: desiredElementTop,
            desiredElementEnd: desiredElementBottom,
            visibleAreaStart: visibleArea.top,
            visibleAreaEnd: actualVisibleAreaBottom,
            currentScroll: scrollContainer.scrollTop,
            initialPosition: initialTopToImpact,
            moveAmount: gestureInfo.yMove,
            scrollProperty: "scrollTop",
            styleProperty: "top",
            canAutoScrollNegative: canAutoScrollUp,
          });
        }
      },
    },
  });
  return dragToMoveGestureController;
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
