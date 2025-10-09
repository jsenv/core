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

import { getPositionedParent } from "../position/offset_parent.js";
import { getVisualRect } from "../position/visual_rect.js";
import { getScrollableParent } from "../scroll.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
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
  areaConstraint: "none",
  obstacleAttributeName: null,
  showConstraintFeedbackLine: false,
  dragViaScroll: false,
};
// To help dbugging this flag can be used to reduce number of features to the bare minimum
const ENFORCE_BASIC_MODE = false;

const { documentElement } = document;

export const createMouseDragThresholdPromise = (mousedownEvent, threshold) => {
  let _resolve;
  const promise = new Promise((resolve) => {
    _resolve = resolve;
  });
  const dragGestureController = createDragGestureController({
    threshold,
    isThresholdOnly: true,
    onDragStart: (_, mousemoveEvent) => {
      dragGesture.release(); // kill that gesture
      _resolve(mousemoveEvent);
    },
    onRelease: () => {
      // won't happen, what do we do?
    },
  });
  const dragGesture = dragGestureController.grabViaMousedown(mousedownEvent, {
    element: mousedownEvent.target,
  });
  return promise;
};

export const createDragGestureController = (options) => {
  if (ENFORCE_BASIC_MODE) {
    Object.assign(options, BASIC_MODE_OPTIONS);
  }
  let {
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
    isThresholdOnly,

    stickyFrontiers = true,
    areaConstraint = "scrollable",
    areaConstraintElement,
    customAreaConstraint,
    obstacleAttributeName = "data-drag-obstacle",
    dragViaScroll = true,

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
    const parentRect = positionedParentRect;
    const scrollLeftAtStart = scrollableParent.scrollLeft;
    const scrollTopAtStart = scrollableParent.scrollTop;

    const computedStyle = getComputedStyle(elementVisuallyImpacted);
    const usePositionFixed = computedStyle.position === "fixed";
    const usePositionSticky = computedStyle.position === "sticky";
    let isStickyLeft = usePositionSticky && computedStyle.left !== "auto";
    let isStickyTop = usePositionSticky && computedStyle.top !== "auto";
    let leftAtStart;
    let topAtStart;
    if (isThresholdOnly) {
    } else if (usePositionFixed) {
      isStickyLeft = false;
      isStickyTop = false;
      const { left, top } = elementVisuallyImpacted.getBoundingClientRect();
      const { scrollLeft, scrollTop } = documentElement;
      leftAtStart = left + scrollLeft;
      topAtStart = top + scrollTop;
      const stylesToSet = {
        position: "absolute",
        left: `${leftAtStart}px`,
        top: `${topAtStart}px`,
        transform: "none",
      };
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const { left, top } = getVisualRect(element, document.documentElement, {
          isFixed: true,
        });
        restoreStyles();
        setStyles(element, {
          left: `${left}px`,
          top: `${top}px`,
        });
      });
    } else if (isStickyLeft || isStickyTop) {
      const stylesToSet = {
        position: "relative",
      };
      if (isStickyLeft) {
        const left = parseFloat(computedStyle.left) || 0;
        const leftWithScroll = left + scrollLeftAtStart;
        leftAtStart = leftWithScroll;
        stylesToSet.left = `${leftWithScroll}px`;
      }
      if (isStickyTop) {
        const top = parseFloat(computedStyle.top) || 0;
        const topWithScroll = top + scrollTopAtStart;
        topAtStart = topWithScroll;
        stylesToSet.top = `${topWithScroll}px`;
      }
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const stylesToSetOnTeardown = {};
        const elementRect = element.getBoundingClientRect();
        restoreStyles();
        if (isStickyLeft) {
          const leftRelative = elementRect.left - scrollableRect.left;
          stylesToSetOnTeardown.left = `${leftRelative}px`;
        }
        if (isStickyTop) {
          const topRelative = elementRect.top - scrollableRect.top;
          stylesToSetOnTeardown.top = `${topRelative}px`;
        }
        setStyles(element, stylesToSetOnTeardown);
      });
    }

    const elementToImpactRect = elementToImpact.getBoundingClientRect();
    const elementVisuallyImpactedRect =
      elementVisuallyImpacted.getBoundingClientRect();

    if (!isStickyLeft) {
      isStickyLeft = elementVisuallyImpacted.hasAttribute(`data-sticky-left`);
      leftAtStart = elementVisuallyImpactedRect.left - parentRect.left;
    }
    if (!isStickyTop) {
      isStickyTop = elementVisuallyImpacted.hasAttribute(`data-sticky-top`);
      topAtStart = elementVisuallyImpactedRect.top - parentRect.top;
    }
    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    let visualOffsetX =
      elementVisuallyImpactedRect.left - elementToImpactRect.left;
    let visualOffsetY =
      elementVisuallyImpactedRect.top - elementToImpactRect.top;
    // Adjust coordinates for conceptually sticky elements
    // Elements with data-sticky-left appear visually pinned to the left edge regardless of scroll,
    // but their DOM position doesn't reflect this visual behavior. We need to adjust both their
    // starting position and visual offset to account for scroll, ensuring drag calculations
    // work with their apparent visual position rather than their DOM position.
    if (isStickyLeft && !usePositionSticky) {
      leftAtStart += scrollLeftAtStart;
      visualOffsetX += scrollLeftAtStart;
    }
    if (isStickyTop && !usePositionSticky) {
      topAtStart += scrollTopAtStart;
      visualOffsetY += scrollTopAtStart;
    }

    const gestureInfo = {
      direction,
      element,
      elementToImpact,
      elementVisuallyImpacted,
      positionedParent,
      scrollableParent,
      isStickyLeft,
      isStickyTop,

      xAtStart,
      yAtStart,
      leftAtStart,
      topAtStart,
      scrollLeftAtStart,
      scrollTopAtStart,
      interactionTypeAtStart: interactionType,
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
      interactionType,

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
    };
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "leftAtStart");
    definePropertyAsReadOnly(gestureInfo, "topAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollLeftAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollTopAtStart");
    definePropertyAsReadOnly(gestureInfo, "interactionTypeAtStart");
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
      constraintFeedbackLine = setupConstraintFeedbackLine({
        positionedParent,
        scrollLeftAtStart,
        scrollTopAtStart,
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

    const getRightBound = (elementWidth, availableWidth) => {
      if (elementWidth >= availableWidth) {
        // Element fills or exceeds container width - constraint to left edge only
        return availableWidth;
      }
      // Normal case: element can move within available space
      return availableWidth - elementWidth;
    };
    const getBottomBound = (elementHeight, availableHeight) => {
      if (elementHeight >= availableHeight) {
        // Element fills or exceeds container height - constraint to top edge only
        return availableHeight;
      }
      // Normal case: element can move within available space
      return availableHeight - elementHeight;
    };

    if (areaConstraint === "scrollable") {
      const scrollableAreaConstraintFunction = ({
        elementWidth,
        elementHeight,
      }) => {
        // Handle floating point precision issues between getBoundingClientRect() and scroll dimensions
        // - elementWidth/elementHeight: floats from getBoundingClientRect() (e.g., 2196.477294921875)
        // - scrollWidth/scrollHeight: integers from browser's internal calculations (e.g., 2196)
        //
        // When element dimensions exceed or equal scroll dimensions due to precision differences,
        // we cap the constraint bounds to prevent negative positioning that would push elements
        // outside their intended scrollable area.
        const left = 0;
        const right =
          left + getRightBound(elementWidth, scrollableParent.scrollWidth);
        const top = 0;
        const bottom =
          top + getBottomBound(elementHeight, scrollableParent.scrollHeight);
        return createBoundConstraint(
          { left, top, right, bottom },
          {
            leftAtStart,
            topAtStart,
            element: scrollableParent,
            name: "scrollable_area",
          },
        );
      };
      constraintFunctions.push(scrollableAreaConstraintFunction);
    } else if (areaConstraint === "visible") {
      const visibleAreaConstraintFunction = ({
        elementWidth,
        elementHeight,
      }) => {
        const visibleConstraintElement =
          areaConstraintElement || scrollableParent;
        let bounds;
        if (visibleConstraintElement === documentElement) {
          const { clientWidth, clientHeight } = documentElement;
          let left = 0;
          let top = 0;
          left -= positionedParentRect.left;
          top -= positionedParentRect.top;
          bounds = {
            left,
            top,
            right: left + getRightBound(elementWidth, clientWidth),
            bottom: top + getBottomBound(elementHeight, clientHeight),
          };
        } else {
          let { left, top } = getVisualRect(visibleConstraintElement);
          const visibleConstraintParentRect = areaConstraintElement
            ? areaConstraintElement.getBoundingClientRect()
            : positionedParentRect;
          left -= visibleConstraintParentRect.left;
          top -= visibleConstraintParentRect.top;
          if (scrollableParent !== documentElement) {
            left += documentElement.scrollLeft;
            top += documentElement.scrollTop;
          }
          const right =
            left +
            getRightBound(elementWidth, visibleConstraintElement.clientWidth);
          const bottom =
            top +
            getBottomBound(
              elementHeight,
              visibleConstraintElement.clientHeight,
            );
          bounds = {
            left,
            top,
            right,
            bottom,
          };
        }
        return createBoundConstraint(bounds, {
          leftAtStart,
          topAtStart,
          element: visibleConstraintElement,
          name: "visible_area",
        });
      };
      constraintFunctions.push(visibleAreaConstraintFunction);
    }

    if (customAreaConstraint) {
      const customAreaConstraintFunction = () => {
        return createBoundConstraint(customAreaConstraint, {
          leftAtStart,
          topAtStart,
          element: scrollableParent,
          name: "custom_area",
        });
      };
      constraintFunctions.push(customAreaConstraintFunction);
    }

    if (obstacleAttributeName) {
      const obstacleConstraintFunctions =
        createObstacleConstraintsFromQuerySelector(
          areaConstraintElement || scrollableParent,
          {
            name,
            positionedParent,
            obstacleAttributeName,
            gestureInfo,
          },
        );
      constraintFunctions.push(...obstacleConstraintFunctions);
    }

    const visualMarkers = setupVisualMarkers({
      direction,
      element,
      positionedParent,
      scrollableParent,
    });
    addTeardown(() => {
      visualMarkers.onRelease();
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
    if (dragViaScroll) {
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
        const scrollDeltaX = currentScrollLeft - scrollLeftAtStart;
        const scrollDeltaY = currentScrollTop - scrollTopAtStart;

        // For mouse movement, currentXRelative already includes scroll effects
        // So mouse movement = current position - start position - scroll offset
        xMouseMove = x - gestureInfo.xAtStart - scrollDeltaX;
        yMouseMove = y - gestureInfo.yAtStart - scrollDeltaY;
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

      const availableWidth = scrollableParent.clientWidth;
      const availableHeight = scrollableParent.clientHeight;

      // Calculate base visible area accounting for borders
      const borderSizes = getBorderSizes(scrollableParent);
      const visibleAreaBase = {
        left: null,
        top: null,
        right: null,
        bottom: null,
      };
      if (scrollableParent === documentElement) {
        const left = 0;
        const top = 0;
        const right = left + availableWidth;
        const bottom = top + availableHeight;
        visibleAreaBase.left = left;
        visibleAreaBase.top = top;
        visibleAreaBase.right = right;
        visibleAreaBase.bottom = bottom;
      } else {
        const scrollableRect = scrollableParent.getBoundingClientRect();
        const left = scrollableRect.left + borderSizes.left;
        const top = scrollableRect.top + borderSizes.top;
        const right = left + availableWidth;
        const bottom = top + availableHeight;
        visibleAreaBase.left = left;
        visibleAreaBase.top = top;
        visibleAreaBase.right = right;
        visibleAreaBase.bottom = bottom;
      }
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

      const elementLeftRelative = leftAtStart + gestureInfo.xMove;
      const elementLeft = elementLeftRelative + parentRect.left;
      const elementTopRelative = topAtStart + gestureInfo.yMove;
      const elementTop = elementTopRelative + parentRect.top;
      if (
        !gestureInfo.hasCrossedVisibleAreaLeftOnce &&
        elementLeft >= visibleArea.left
      ) {
        gestureInfo.hasCrossedVisibleAreaLeftOnce = true;
      }
      if (
        !gestureInfo.hasCrossedVisibleAreaTopOnce &&
        elementTop >= visibleArea.top
      ) {
        gestureInfo.hasCrossedVisibleAreaTopOnce = true;
      }

      const constraints = prepareConstraints(constraintFunctions, {
        name,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
        visibleArea,
      });

      visualMarkers.onDrag({
        constraints,
        visibleArea,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
      });

      const [finalXMove, finalYMove] = applyConstraints(constraints, {
        gestureInfo,
        xMove,
        yMove,
        elementWidth: currentElementWidth,
        elementHeight: currentElementHeight,
        direction,
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
        interactionType,
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
        mousemoveEvent = null,
      } = {},
    ) => {
      const dragData = determineDragData(currentXRelative, currentYRelative, {
        isRelease,
        interactionType,
      });

      if (!dragData) {
        if (constraintFeedbackLine) {
          constraintFeedbackLine.onDrag(gestureInfo, {
            mouseX,
            mouseY,
          });
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
        constraintFeedbackLine.onDrag(gestureInfo, {
          mouseX,
          mouseY,
          positionedParent,
        });
      }
      if (isRelease) {
        onDrag?.(gestureInfo, "end");
      } else if (!started) {
        started = true;
        onDragStart?.(gestureInfo, mousemoveEvent);
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
      teardownCallbackSet.clear();
      onRelease?.(gestureInfo);
    };

    onGrab?.(gestureInfo);

    const dragGesture = {
      drag,
      release,
      gestureInfo,
    };
    return dragGesture;
  };

  const grabViaMousedown = (mousedownEvent, { element, ...options } = {}) => {
    if (mousedownEvent.button !== 0) {
      return null;
    }
    const target = mousedownEvent.target;
    if (!target.closest) {
      return null;
    }

    const scrollableParent = getScrollableParent(element);
    const positionedParent = getPositionedParent(element);
    const parentRect = positionedParent.getBoundingClientRect();
    const mouseEventRelativeCoords = (mouseEvent) => {
      const xViewport = mouseEvent.clientX;
      const yViewport = mouseEvent.clientY;
      const xRelative =
        xViewport - parentRect.left + scrollableParent.scrollLeft;
      const yRelative = yViewport - parentRect.top + scrollableParent.scrollTop;
      return [xRelative, yRelative];
    };

    const [xAtStart, yAtStart] = mouseEventRelativeCoords(mousedownEvent);
    const dragGesture = grab(element, {
      xAtStart,
      yAtStart,
      interactionType: "mousedown",
      ...options,
    });

    const dragViaMouse = (mousemoveEvent) => {
      const [x, y] = mouseEventRelativeCoords(mousemoveEvent);
      dragGesture.drag(x, y, {
        mouseX: mousemoveEvent.clientX,
        mouseY: mousemoveEvent.clientY,
        interactionType: "mousemove",
        mousemoveEvent,
      });
    };

    const releaseViaMouse = (mouseupEvent) => {
      const [x, y] = mouseEventRelativeCoords(mouseupEvent);
      dragGesture.release({
        x,
        y,
        interactionType: "mouseup",
      });
    };
    document.addEventListener("mousemove", dragViaMouse);
    document.addEventListener("mouseup", releaseViaMouse);
    addTeardown(() => {
      document.removeEventListener("mousemove", dragViaMouse);
      document.removeEventListener("mouseup", releaseViaMouse);
    });

    dragGesture.dragViaMouse = dragViaMouse;
    return dragGesture;
  };

  return {
    grab,
    grabViaMousedown,
    addTeardown,
  };
};

export const createDragToMoveGestureController = (options) => {
  const dragToMoveGestureController = createDragGestureController({
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
          hasCrossedVisibleAreaLeftOnce,
          hasCrossedVisibleAreaTopOnce,
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
          canAutoScrollNegative, // whether auto-scroll is allowed for sticky elements when going negative
        }) => {
          keep_into_view: {
            if (isGoingPositive) {
              if (desiredElementEnd > visibleAreaEnd) {
                const scrollAmountNeeded = desiredElementEnd - visibleAreaEnd;
                const scroll = currentScroll + scrollAmountNeeded;
                scrollableParent[scrollProperty] = scroll;
              }
              // } else {
              //   console.log(
              //     `Auto-scroll NOT needed: desiredEnd=${desiredElementEnd} <= visibleEnd=${visibleAreaEnd}`,
              //   );
              // }
            } else if (isGoingNegative) {
              if (
                canAutoScrollNegative &&
                desiredElementStart < visibleAreaStart
              ) {
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
            visibleAreaEnd: visibleArea.right,
            currentScroll: scrollableParent.scrollLeft,
            initialPosition: initialLeftToImpact,
            moveAmount: gestureInfo.xMove,
            scrollProperty: "scrollLeft",
            styleProperty: "left",
            canAutoScrollNegative: canAutoScrollLeft,
          });
        }

        // Vertical auto-scroll
        if (direction.y) {
          const desiredElementTopRelative = topAtStart + gestureInfo.yMove;
          const desiredElementTop = desiredElementTopRelative + parentRect.top;
          const desiredElementBottom = desiredElementTop + elementHeight;

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
            visibleAreaEnd: visibleArea.bottom,
            currentScroll: scrollableParent.scrollTop,
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
