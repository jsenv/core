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

import { getPositionedParent } from "../offset_parent.js";
import { getScrollableParent } from "../scroll.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
import { setStyles } from "../style_and_attributes.js";
import {
  applyConstraints,
  createBoundConstraint,
  prepareConstraints,
} from "./constraint.js";
import { setupConstraintFeedbackLine } from "./constraint_feedback_line.js";
import {
  updateVisualMarkersOnDrag,
  updateVisualMarkersOnGrab,
  updateVisualMarkersOnRelease,
} from "./debug_markers.js";
import "./drag_gesture_css.js";
import { createObstacleConstraintsFromQuerySelector } from "./drag_obstacles.js";
import { applyStickyFrontiersToVisibleArea } from "./sticky_frontiers.js";

const BASIC_MODE_OPTIONS = {
  backdrop: false,
  stickyFrontiers: false,
  keepInScrollableArea: false,
  obstacleQuerySelector: null,
  showConstraintFeedbackLine: false,
};

export const createDragGesture = (options) => {
  // for now force the basic mode because we just
  // want to test auto scroll and snap during scroll
  Object.assign(options, BASIC_MODE_OPTIONS);
  const {
    name,
    onGrab,
    onDragStart,
    onDrag,
    onRelease,
    gestureAttribute,
    threshold = 5,
    direction: defaultDirection = { x: true, y: true },
    backdrop = true,
    backdropZIndex = 1,

    stickyFrontiers = true,
    keepInScrollableArea = true,
    obstacleQuerySelector = "[data-drag-obstacle]",

    // Custom bounds that override the default scrollable area bounds
    // Useful for scenarios like column resizing where you want custom min/max constraints
    customLeftBound,
    customRightBound,
    customTopBound,
    customBottomBound,

    // Visual feedback line connecting mouse cursor to the moving grab point when constraints prevent following
    // This provides intuitive feedback during drag operations when the element cannot reach the mouse
    // position due to obstacles, boundaries, or other constraints. The line originates from where the mouse
    // initially grabbed the element, but moves with the element to show the current anchor position.
    // It becomes visible when there's a significant distance between mouse and grab point.
    showConstraintFeedbackLine = true,
    lifecycle,
  } = options;

  const teardownCallbackSet = new Set();
  const addTeardown = (callback) => {
    teardownCallbackSet.add(callback);
  };

  const grab = (
    element,
    {
      xAtStart = 0,
      yAtStart = 0,
      elementToImpact = element,
      elementVisuallyImpacted = elementToImpact,
      direction = defaultDirection,
      cursor = "grabbing",
      interactionType,
    } = {},
  ) => {
    if (!direction.x && !direction.y) {
      return null;
    }

    const scrollableParent = getScrollableParent(element);
    const positionedParent = getPositionedParent(element);

    const scrollableRect = scrollableParent.getBoundingClientRect();
    const positionedParentRect = positionedParent.getBoundingClientRect();
    const elementToImpactRect = elementToImpact.getBoundingClientRect();
    const elementVisuallyImpactedRect =
      elementVisuallyImpacted.getBoundingClientRect();
    const parentRect = positionedParentRect;

    const computedStyle = getComputedStyle(element);
    if (computedStyle.position === "sticky") {
      const left = parseFloat(computedStyle.left) || 0;
      const top = parseFloat(computedStyle.top) || 0;
      const leftWithScroll = left + scrollableParent.scrollLeft;
      const topWithScroll = top + scrollableParent.scrollTop;
      const restoreStyles = setStyles(element, {
        position: "relative",
        left: `${leftWithScroll}px`,
        top: `${topWithScroll}px`,
      });
      addTeardown(() => {
        const elementRect = element.getBoundingClientRect();
        const leftRelative = elementRect.left - scrollableRect.left;
        const topRelative = elementRect.top - scrollableRect.top;
        restoreStyles();
        setStyles(element, {
          left: `${leftRelative}px`,
          top: `${topRelative}px`,
        });
      });
    }

    const leftAtStart = elementVisuallyImpactedRect.left - parentRect.left;
    const topAtStart = elementVisuallyImpactedRect.top - parentRect.top;
    const scrollLeftAtStart = scrollableParent.scrollLeft;
    const scrollTopAtStart = scrollableParent.scrollTop;

    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    const visualOffsetX =
      elementVisuallyImpactedRect.left - elementToImpactRect.left;
    const visualOffsetY =
      elementVisuallyImpactedRect.top - elementToImpactRect.top;

    const gestureInfo = {
      element,
      elementToImpact,
      elementVisuallyImpacted,

      xAtStart,
      yAtStart,
      leftAtStart,
      topAtStart,
      scrollLeftAtStart,
      scrollTopAtStart,
      visualOffsetX,
      visualOffsetY,

      x: xAtStart,
      y: yAtStart,
      xMove: 0,
      yMove: 0,
      xMouseMove: 0, // Movement caused by mouse drag
      yMouseMove: 0, // Movement caused by mouse drag
      xChanged: false,
      yChanged: false,

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,

      interactionType,
    };
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "leftAtStart");
    definePropertyAsReadOnly(gestureInfo, "topAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollLeftAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollTopAtStart");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetX");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetY");
    let previousGestureInfo = null;
    let started = !threshold;

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
      constraintFeedbackLine = setupConstraintFeedbackLine();
      addTeardown(() => {
        constraintFeedbackLine.onRelease();
      });
    }

    // Collect all constraint functions
    const constraintFunctions = [];
    if (keepInScrollableArea) {
      const boundsConstraintFunction = createScrollableAreaConstraint(
        scrollableParent,
        {
          customLeftBound,
          customRightBound,
          customTopBound,
          customBottomBound,
        },
      );
      constraintFunctions.push(boundsConstraintFunction);
    }
    if (obstacleQuerySelector) {
      const obstacleConstraintFunctions =
        createObstacleConstraintsFromQuerySelector(scrollableParent, {
          name,
          positionedParent,
          obstacleQuerySelector,
        });
      constraintFunctions.push(...obstacleConstraintFunctions);
    }

    updateVisualMarkersOnGrab();
    addTeardown(() => {
      updateVisualMarkersOnRelease();
    });

    // Set up dragging attribute
    element.setAttribute("data-dragging", "");
    addTeardown(() => {
      element.removeAttribute("data-dragging");
    });

    if (gestureAttribute) {
      element.setAttribute(gestureAttribute, "");
      addTeardown(() => {
        element.removeAttribute(gestureAttribute);
      });
    }

    // Set up scroll event handling to adjust drag position when scrolling occurs
    update_on_scroll: {
      let isHandlingScroll = false;
      const handleScroll = () => {
        if (isHandlingScroll) {
          return;
        }
        isHandlingScroll = true;

        // When scrolling occurs during drag, recalculate with scroll interaction type
        // This preserves mouse movement but recalculates total movement with new scroll offset
        drag(gestureInfo.x, gestureInfo.y, { interactionType: "scroll" });

        isHandlingScroll = false;
      };
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      addTeardown(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }

    const determineDragData = (
      currentXRelative,
      currentYRelative,
      { isRelease = false, interactionType },
    ) => {
      const previousX = gestureInfo.x;
      const previousY = gestureInfo.y;

      const x = currentXRelative;
      const y = currentYRelative;
      const xDiff = previousX - currentXRelative;
      const yDiff = previousY - currentYRelative;

      // Calculate movement based on interaction type
      let xMouseMove;
      let yMouseMove;
      let xMove;
      let yMove;

      if (interactionType === "scroll") {
        // For scroll events, keep existing mouse movement but recalculate total movement with new scroll
        xMouseMove = gestureInfo.xMouseMove; // Keep existing mouse movement
        yMouseMove = gestureInfo.yMouseMove; // Keep existing mouse movement

        // Recalculate total movement with current scroll offset
        const currentScrollLeft = scrollableParent.scrollLeft;
        const currentScrollTop = scrollableParent.scrollTop;
        const scrollDeltaX = direction.x
          ? currentScrollLeft - scrollLeftAtStart
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - scrollTopAtStart
          : 0;

        xMove = xMouseMove + scrollDeltaX;
        yMove = yMouseMove + scrollDeltaY;
      } else {
        // For mouse movement and programmatic calls, calculate scroll offset first
        const currentScrollLeft = scrollableParent.scrollLeft;
        const currentScrollTop = scrollableParent.scrollTop;
        const scrollDeltaX = direction.x
          ? currentScrollLeft - scrollLeftAtStart
          : 0;
        const scrollDeltaY = direction.y
          ? currentScrollTop - scrollTopAtStart
          : 0;

        // For mouse movement, currentXRelative already includes scroll effects
        // So mouse movement = current position - start position - scroll offset
        xMouseMove = direction.x ? x - gestureInfo.xAtStart - scrollDeltaX : 0;
        yMouseMove = direction.y ? y - gestureInfo.yAtStart - scrollDeltaY : 0;

        // Total movement = mouse movement + scroll offset (should equal x - xAtStart)
        xMove = xMouseMove + scrollDeltaX;
        yMove = yMouseMove + scrollDeltaY;
      }

      // Calculate direction based on where the element is trying to move (relative to previous position)
      const previousXMove = previousGestureInfo ? previousGestureInfo.xMove : 0;
      const previousYMove = previousGestureInfo ? previousGestureInfo.yMove : 0;

      const isGoingLeft = xMove < previousXMove;
      const isGoingRight = xMove > previousXMove;
      const isGoingUp = yMove < previousYMove;
      const isGoingDown = yMove > previousYMove;

      // Get current element dimensions for dynamic constraint calculation
      const currentElementRect =
        elementVisuallyImpacted.getBoundingClientRect();
      const currentElementWidth = currentElementRect.width;
      const currentElementHeight = currentElementRect.height;

      const constraints = prepareConstraints(constraintFunctions, {
        name,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
      });

      const scrollableRect = scrollableParent.getBoundingClientRect();
      const availableWidth = scrollableParent.clientWidth;
      const availableHeight = scrollableParent.clientHeight;

      // Calculate base visible area accounting for borders
      const borderSizes = getBorderSizes(scrollableParent);
      const visibleAreaBase = {
        left: scrollableRect.left + borderSizes.left,
        top: scrollableRect.top + borderSizes.top,
        right: null,
        bottom: null,
      };
      visibleAreaBase.right = visibleAreaBase.left + availableWidth;
      visibleAreaBase.bottom = visibleAreaBase.top + availableHeight;
      let visibleArea;
      if (stickyFrontiers) {
        visibleArea = applyStickyFrontiersToVisibleArea(visibleAreaBase, {
          scrollableParent,
          direction,
          dragName: name,
        });
      } else {
        visibleArea = visibleAreaBase;
      }

      updateVisualMarkersOnDrag({
        direction,
        constraints,
        visibleArea,
        positionedParent,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
      });

      const [finalXMove, finalYMove] = applyConstraints(constraints, {
        gestureInfo,
        xMove,
        yMove,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
        interactionType,
      });

      const dragData = {
        x,
        y,
        xDiff,
        yDiff,
        xMove: finalXMove,
        yMove: finalYMove,
        xMouseMove,
        yMouseMove,
        isGoingLeft,
        isGoingRight,
        isGoingUp,
        isGoingDown,
        visibleArea,
      };

      if (isRelease) {
        if (!started) {
          return null;
        }
        return dragData;
      }
      if (!started && threshold) {
        const deltaX = Math.abs(finalXMove);
        const deltaY = Math.abs(finalYMove);
        if (direction.x && direction.y) {
          // Both directions: check both axes
          if (deltaX < threshold && deltaY < threshold) {
            return null;
          }
        } else if (direction.x) {
          if (deltaX < threshold) {
            return null;
          }
        } else if (direction.y) {
          if (deltaY < threshold) {
            return null;
          }
        }
      }
      return dragData;
    };

    const drag = (
      currentXRelative,
      currentYRelative,
      {
        isRelease = false,
        mouseX = null,
        mouseY = null,
        interactionType = "programmatic", // "mousemove", "scroll", "programmatic"
      } = {},
    ) => {
      const dragData = determineDragData(currentXRelative, currentYRelative, {
        isRelease,
        interactionType,
      });

      if (!dragData) {
        if (constraintFeedbackLine) {
          constraintFeedbackLine.onDrag(gestureInfo, { mouseX, mouseY });
        }
        return;
      }
      // Only update previousGestureInfo if it's not a release
      if (!isRelease) {
        previousGestureInfo = { ...gestureInfo };
      }

      Object.assign(gestureInfo, dragData);

      // Calculate xChanged/yChanged based on previous gesture info
      const xChanged = previousGestureInfo
        ? dragData.xMove !== previousGestureInfo.xMove
        : true;
      const yChanged = previousGestureInfo
        ? dragData.yMove !== previousGestureInfo.yMove
        : true;
      Object.assign(gestureInfo, { xChanged, yChanged });
      const someChange = xChanged || yChanged;
      if (someChange) {
        lifecycle?.drag?.(gestureInfo, {
          scrollableParent,
          positionedParent,
          direction,
        });
      }
      if (constraintFeedbackLine) {
        constraintFeedbackLine.onDrag(gestureInfo, { mouseX, mouseY });
      }
      if (isRelease) {
        onDrag?.(gestureInfo, "end");
      } else if (!started) {
        started = true;
        onDragStart?.(gestureInfo);
        onDrag?.(gestureInfo, "start");
      } else {
        onDrag?.(gestureInfo, "middle");
      }
    };

    const release = ({
      xAtRelease = gestureInfo.x,
      yAtRelease = gestureInfo.y,
      interactionType = "programmatic",
    } = {}) => {
      drag(xAtRelease, yAtRelease, {
        isRelease: true,
        interactionType,
      });
      for (const teardownCallback of teardownCallbackSet) {
        teardownCallback();
      }
      onRelease?.(gestureInfo);
    };

    onGrab?.(gestureInfo);

    return {
      drag,
      release,
      gestureInfo,
    };
  };

  const grabViaMousedown = (mousedownEvent, { element, ...options } = {}) => {
    if (mousedownEvent.button !== 0) {
      return null;
    }
    const target = mousedownEvent.target;
    if (!target.closest) {
      return null;
    }

    const positionedParent = getPositionedParent(element);
    const parentRect = positionedParent.getBoundingClientRect();
    const mouseEventRelativeCoords = (mouseEvent) => {
      const xViewport = mouseEvent.clientX;
      const yViewport = mouseEvent.clientY;
      const xRelative = xViewport - parentRect.left;
      const yRelative = yViewport - parentRect.top;
      return [xRelative, yRelative];
    };

    const [xAtStart, yAtStart] = mouseEventRelativeCoords(mousedownEvent);
    const dragGesture = grab(element, {
      xAtStart,
      yAtStart,
      interactionType: "mousedown",
      ...options,
    });

    const handleMouseMove = (mousemoveEvent) => {
      const [x, y] = mouseEventRelativeCoords(mousemoveEvent);
      dragGesture.drag(x, y, {
        mouseX: mousemoveEvent.clientX,
        mouseY: mousemoveEvent.clientY,
        interactionType: "mousemove",
      });
    };

    const handleMouseUp = (mouseupEvent) => {
      const [x, y] = mouseEventRelativeCoords(mouseupEvent);
      dragGesture.release({
        x,
        y,
        interactionType: "mouseup",
      });
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    addTeardown(() => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    });
    return dragGesture;
  };

  return {
    grab,
    grabViaMousedown,
    addTeardown,
  };
};

export const createDragToMoveGesture = (options) => {
  const dragToMoveGesture = createDragGesture({
    ...options,
    lifecycle: {
      drag: (
        gestureInfo,
        { direction, positionedParent, scrollableParent },
      ) => {
        const {
          leftAtStart,
          topAtStart,
          visualOffsetX,
          visualOffsetY,
          isGoingDown,
          isGoingUp,
          isGoingLeft,
          isGoingRight,
          elementToImpact,
          elementVisuallyImpacted,
          visibleArea,
        } = gestureInfo;

        // Calculate initial position for elementToImpact (initialLeft/initialTop are now visual coordinates)
        const initialLeftToImpact = leftAtStart - visualOffsetX;
        const initialTopToImpact = topAtStart - visualOffsetY;
        const elementVisuallyImpactedRect =
          elementVisuallyImpacted.getBoundingClientRect();
        const elementWidth = elementVisuallyImpactedRect.width;
        const elementHeight = elementVisuallyImpactedRect.height;

        // Calculate where element bounds would be in viewport coordinates
        const parentRect = positionedParent.getBoundingClientRect();

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
        }) => {
          keep_into_view: {
            if (isGoingPositive) {
              if (desiredElementEnd > visibleAreaEnd) {
                const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
                const scroll = currentScroll + scrollAmountNeeded;
                scrollableParent[scrollProperty] = scroll;
              }
            } else if (isGoingNegative) {
              if (desiredElementStart < visibleAreaStart) {
                const scrollAmountNeeded =
                  visibleAreaStart - desiredElementStart;
                const scroll = Math.max(0, currentScroll - scrollAmountNeeded);
                scrollableParent[scrollProperty] = scroll;
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
          const desiredElementLeftRelative = leftAtStart + gestureInfo.xMove;
          const desiredElementLeft =
            desiredElementLeftRelative + parentRect.left;
          const desiredElementRight = desiredElementLeft + elementWidth;
          moveAndKeepIntoView({
            // axis: "x",
            isGoingPositive: isGoingRight,
            isGoingNegative: isGoingLeft,
            desiredElementStart: desiredElementLeft,
            desiredElementEnd: desiredElementRight,
            visibleAreaStart: visibleArea.left,
            visibleAreaEnd: visibleArea.right,
            currentScroll: scrollableParent.scrollLeft,
            initialPosition: initialLeftToImpact,
            moveAmount: gestureInfo.xMove,
            scrollProperty: "scrollLeft",
            styleProperty: "left",
          });
        }

        // Vertical auto-scroll
        if (direction.y) {
          const desiredElementTopRelative = topAtStart + gestureInfo.yMove;
          const desiredElementTop = desiredElementTopRelative + parentRect.top;
          const desiredElementBottom = desiredElementTop + elementHeight;
          moveAndKeepIntoView({
            // axis: "y",
            isGoingPositive: isGoingDown,
            isGoingNegative: isGoingUp,
            desiredElementStart: desiredElementTop,
            desiredElementEnd: desiredElementBottom,
            visibleAreaStart: visibleArea.top,
            visibleAreaEnd: visibleArea.bottom,
            currentScroll: scrollableParent.scrollTop,
            initialPosition: initialTopToImpact,
            moveAmount: gestureInfo.yMove,
            scrollProperty: "scrollTop",
            styleProperty: "top",
          });
        }
      },
    },
  });
  return dragToMoveGesture;
};

const createScrollableAreaConstraint = (
  scrollableParent,
  { customLeftBound, customRightBound, customTopBound, customBottomBound } = {},
) => {
  return ({ elementWidth, elementHeight }) => {
    // Handle floating point precision issues between getBoundingClientRect() and scroll dimensions
    // - elementWidth/elementHeight: floats from getBoundingClientRect() (e.g., 2196.477294921875)
    // - scrollWidth/scrollHeight: integers from browser's internal calculations (e.g., 2196)
    //
    // When element dimensions exceed or equal scroll dimensions due to precision differences,
    // we cap the constraint bounds to prevent negative positioning that would push elements
    // outside their intended scrollable area.

    const scrollWidth = scrollableParent.scrollWidth;
    const scrollHeight = scrollableParent.scrollHeight;

    // Calculate horizontal bounds: element can be positioned from left=0 to right=constraint
    let left;
    if (customLeftBound === undefined) {
      left = 0;
    } else {
      left = customLeftBound;
    }
    let right;
    if (customRightBound === undefined) {
      if (elementWidth >= scrollWidth) {
        // Element fills or exceeds container width - constraint to left edge only
        right = scrollWidth;
      } else {
        // Normal case: element can move within available space
        right = scrollWidth - elementWidth;
      }
    } else {
      right = customRightBound;
    }

    // Calculate vertical bounds: element can be positioned from top=0 to bottom=constraint
    let top;
    if (customTopBound === undefined) {
      top = 0;
    } else {
      top = customTopBound;
    }
    let bottom;
    if (customBottomBound === undefined) {
      if (elementHeight >= scrollHeight) {
        // Element fills or exceeds container height - constraint to top edge only
        bottom = scrollHeight;
      } else {
        // Normal case: element can move within available space
        bottom = scrollHeight - elementHeight;
      }
    } else {
      bottom = customBottomBound;
    }

    return createBoundConstraint(
      { left, top, right, bottom },
      {
        element: scrollableParent,
        name: "scrollable area",
      },
    );
  };
};

const definePropertyAsReadOnly = (object, propertyName) => {
  Object.defineProperty(object, propertyName, {
    writable: false,
    value: object[propertyName],
  });
};
