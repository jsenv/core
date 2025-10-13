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

import { createPubSub } from "../pub_sub.js";
import { getScrollContainer } from "../scroll/scroll_container.js";
import {
  elementToFixedCoords,
  elementToStickyCoords,
} from "../scroll/scrollable_rect.js";
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

// Coordinate conversion helpers
const { documentElement } = document;

// Helper to convert document coordinates to positioned parent coordinates
const documentCoordsToPositionedParentCoords = (
  leftDocument,
  topDocument,
  element,
) => {
  // Use the same logic as the original scrollableCoordsToPositionedParentCoords
  // but specifically for document coordinates (which is what the "document case" was)
  const positionedParent = element.offsetParent || document.body;
  const positionedParentRect = positionedParent.getBoundingClientRect();
  const { scrollLeft, scrollTop } = documentElement;

  // Convert document coordinates to positioned-parent-relative coordinates
  const positionedParentLeftInDocument = positionedParentRect.left + scrollLeft;
  const positionedParentTopInDocument = positionedParentRect.top + scrollTop;
  const leftPositioned = leftDocument - positionedParentLeftInDocument;
  const topPositioned = topDocument - positionedParentTopInDocument;

  return [leftPositioned, topPositioned];
};

// Helper to get element rect in document-relative coordinates with position info
const getElementDocumentRect = (element) => {
  const viewportRect = element.getBoundingClientRect();
  const documentScrollLeft = documentElement.scrollLeft;
  const documentScrollTop = documentElement.scrollTop;
  const computedStyle = getComputedStyle(element);

  // Check position type
  const isFixed = computedStyle.position === "fixed";
  const isSticky = computedStyle.position === "sticky";

  let fromStickyLeft;
  let fromStickyTop;
  let fromStickyLeftAttr;
  let fromStickyTopAttr;

  if (isSticky) {
    const isStickyLeft = computedStyle.left !== "auto";
    const isStickyTop = computedStyle.top !== "auto";
    fromStickyLeft = isStickyLeft
      ? { value: parseFloat(computedStyle.left) || 0 }
      : undefined;
    fromStickyTop = isStickyTop
      ? { value: parseFloat(computedStyle.top) || 0 }
      : undefined;
    fromStickyLeftAttr = isStickyLeft ? computedStyle.left : undefined;
    fromStickyTopAttr = isStickyTop ? computedStyle.top : undefined;
  }

  return {
    left: viewportRect.left + documentScrollLeft,
    top: viewportRect.top + documentScrollTop,
    right: viewportRect.right + documentScrollLeft,
    bottom: viewportRect.bottom + documentScrollTop,
    width: viewportRect.width,
    height: viewportRect.height,
    fromFixed: isFixed,
    fromStickyLeft,
    fromStickyTop,
    fromStickyLeftAttr,
    fromStickyTopAttr,
  };
};

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
    areaConstraintElement,
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
    event = new CustomEvent("programmatic"),
    {
      xAtStart = 0, // Document coordinates
      yAtStart = 0, // Document coordinates
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
    const scrollContainer = getScrollContainer(element);
    const scrollContainertIsDocument = scrollContainer === documentElement;
    const scrollLeftAtStart = scrollContainer.scrollLeft;
    const scrollTopAtStart = scrollContainer.scrollTop;

    // Convert all element coordinates to document-relative coordinates
    const elementToImpactDocumentRect = getElementDocumentRect(elementToImpact);
    const elementVisuallyImpactedDocumentRect = getElementDocumentRect(
      elementVisuallyImpacted,
    );

    const { left: elementToImpactLeft, top: elementToImpactTop } =
      elementToImpactDocumentRect;
    const {
      left,
      top,
      width,
      height,
      fromFixed,
      fromStickyLeft,
      fromStickyTop,
      fromStickyLeftAttr,
      fromStickyTopAttr,
    } = elementVisuallyImpactedDocumentRect;

    // Calculate offset to translate visual movement to elementToImpact movement
    // This offset is applied only when setting elementToImpact position (xMoveToApply, yMoveToApply)
    // All constraint calculations use visual coordinates (xMove, yMove)
    let visualOffsetX = left - elementToImpactLeft;
    let visualOffsetY = top - elementToImpactTop;
    let leftAtStart = left;
    let topAtStart = top;

    let isStickyLeftOrHasStickyLeftAttr;
    let isStickyTopOrHasStickyTopAttr;
    if (isThresholdOnly) {
    } else if (fromFixed) {
      const stylesToSet = {
        position: "absolute",
        left: `${leftAtStart}px`,
        top: `${topAtStart}px`,
        transform: "none",
      };
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const [leftFixed, topFixed] = elementToFixedCoords(element);
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
        isStickyLeftOrHasStickyLeftAttr = true;
        stylesToSet.left = `${left}px`;
      }
      if (isStickyTop) {
        isStickyTopOrHasStickyTopAttr = true;
        stylesToSet.top = `${top}px`;
      }
      const restoreStyles = setStyles(element, stylesToSet);
      addTeardown(() => {
        const [leftSticky, topSticky] = elementToStickyCoords(
          element,
          scrollContainer,
          { isStickyLeft, isStickyTop },
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
        isStickyLeftOrHasStickyLeftAttr = true;
        if (scrollContainertIsDocument) {
          // For document scrolling with sticky elements, calculate the position as it would be at zero scroll
          // The current 'left' is the scrollable coordinate, which includes scroll offset
          // The position at zero scroll would be: left + scrollLeftAtStart
          const positionAtZeroScroll = left + scrollLeftAtStart;
          visualOffsetX = positionAtZeroScroll - elementToImpactLeft;
        }
      }
      if (fromStickyTopAttr) {
        isStickyTopOrHasStickyTopAttr = true;
        if (scrollContainertIsDocument) {
          const positionAtZeroScroll = top + scrollTopAtStart;
          visualOffsetY = positionAtZeroScroll - elementToImpactTop;
        }
      }
    }

    const gestureInfo = {
      direction,
      element,
      elementToImpact,
      elementVisuallyImpacted,
      scrollContainer,

      // Store both viewport and document coordinates for reference
      xAtStart, // Document coordinates (already converted)
      yAtStart, // Document coordinates (already converted)
      leftAtStart, // Document coordinates (already converted)
      topAtStart, // Document coordinates (already converted)
      scrollLeftAtStart,
      scrollTopAtStart,
      documentScrollLeftAtStart: documentElement.scrollLeft,
      documentScrollTopAtStart: documentElement.scrollTop,
      visualOffsetX,
      visualOffsetY,
      isStickyLeftOrHasStickyLeftAttr,
      isStickyTopOrHasStickyTopAttr,

      x: xAtStart, // Current position in document coordinates
      y: yAtStart, // Current position in document coordinates
      xMove: 0,
      yMove: 0,
      xChanged: false,
      yChanged: false,

      isGoingUp: undefined,
      isGoingDown: undefined,
      isGoingLeft: undefined,
      isGoingRight: undefined,
      elementVisuallyImpactedWidth: width,
      elementVisuallyImpactedHeight: height,

      // Track whether elements have entered visible area once
      // Elements may start outside the visible area (mostly when sticky + sticky frontiers)
      // In that case until they cross the visible sides
      // they won't trigger auto-scroll and sticky obstacles can collide independently of the scroll
      hasCrossedVisibleAreaLeftOnce: false,
      hasCrossedVisibleAreaTopOnce: false,

      interactionType: event.type,
      started: !threshold,
      status: "grabbed",
      grabEvent: event,
      dragEvent: null,
      releaseEvent: null,
    };
    definePropertyAsReadOnly(gestureInfo, "direction");
    definePropertyAsReadOnly(gestureInfo, "xAtStart");
    definePropertyAsReadOnly(gestureInfo, "yAtStart");
    definePropertyAsReadOnly(gestureInfo, "leftAtStart");
    definePropertyAsReadOnly(gestureInfo, "topAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollLeftAtStart");
    definePropertyAsReadOnly(gestureInfo, "scrollTopAtStart");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetX");
    definePropertyAsReadOnly(gestureInfo, "visualOffsetY");
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

    if (areaConstraint === "scroll") {
      // Capture scroll container dimensions at drag start to ensure consistency
      const scrollWidthAtStart = scrollContainer.scrollWidth;
      const scrollHeightAtStart = scrollContainer.scrollHeight;
      const scrollContainerDocumentRectAtStart = scrollContainertIsDocument
        ? { left: 0, top: 0 }
        : getElementDocumentRect(scrollContainer);

      const scrollAreaConstraintFunction = ({
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

        // Use consistent scroll dimensions captured at drag start
        const left = scrollContainerDocumentRectAtStart.left;
        const top = scrollContainerDocumentRectAtStart.top;
        // Right bound should be the rightmost position where the element can start (not end)
        // So it's containerLeft + (scrollWidth - elementWidth)
        const right = left + getRightBound(elementWidth, scrollWidthAtStart);
        const bottom = top + getBottomBound(elementHeight, scrollHeightAtStart);

        console.log(
          `Scroll area constraint: container left=${scrollContainerDocumentRectAtStart.left}, scrollWidth=${scrollWidthAtStart}, elementWidth=${elementWidth}`,
        );
        console.log(
          `Calculated bounds: left=${left}, right=${right}. Element starts at leftAtStart=${leftAtStart}`,
        );

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
      const visibleAreaConstraintFunction = ({
        elementWidth,
        elementHeight,
      }) => {
        const visibleConstraintElement =
          areaConstraintElement || scrollContainer;
        let bounds;
        if (visibleConstraintElement === documentElement) {
          const { clientWidth, clientHeight } = documentElement;
          // For document scrolling, visible area is the current viewport in scrollable coordinates
          // This accounts for the current scroll position to allow dragging in the visible area
          const scrollLeft = documentElement.scrollLeft;
          const scrollTop = documentElement.scrollTop;
          const left = scrollLeft;
          const top = scrollTop;
          bounds = {
            left,
            top,
            right: left + getRightBound(elementWidth, clientWidth),
            bottom: top + getBottomBound(elementHeight, clientHeight),
          };
        } else {
          // Use helper function to get element coordinates in document space
          const elementRect = getElementDocumentRect(visibleConstraintElement);
          const left = elementRect.left;
          const top = elementRect.top;
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
          element: visibleConstraintElement,
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
        createObstacleConstraintsFromQuerySelector(
          areaConstraintElement || scrollContainer,
          {
            name,
            obstacleAttributeName,
            gestureInfo,
            isDraggedElementSticky:
              isStickyLeftOrHasStickyLeftAttr || isStickyTopOrHasStickyTopAttr,
          },
        );
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
        if (scrollContainer === document.documentElement) {
          drag(
            gestureInfo.xAtStart + documentElement.scrollLeft,
            gestureInfo.yAtStart + documentElement.scrollTop,
            scrollEvent,
          );
        } else {
          drag(
            gestureInfo.xAtStart +
              documentElement.scrollLeft +
              scrollContainer.scrollLeft,
            gestureInfo.yAtStart +
              documentElement.scrollTop +
              scrollContainer.scrollTop,
            scrollEvent,
          );
        }
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

    const determineDragData = (
      xDocument, // Document-relative coordinates
      yDocument, // Document-relative coordinates
      dragEvent,
      { isRelease = false },
    ) => {
      const interactionType = event.type;

      // Get current element dimensions for dynamic constraint calculation
      const currentRect = elementVisuallyImpacted.getBoundingClientRect();
      const availableWidth = scrollContainer.clientWidth;
      const availableHeight = scrollContainer.clientHeight;
      // Calculate base visible area in document-relative coordinates
      // Convert everything to document-relative coords for consistency
      const borderSizes = getBorderSizes(scrollContainer);
      const visibleAreaBase = {
        left: null,
        top: null,
        right: null,
        bottom: null,
      };
      if (scrollContainertIsDocument) {
        // For document scrolling, visible area is the current viewport in document coordinates
        const scrollLeft = documentElement.scrollLeft;
        const scrollTop = documentElement.scrollTop;
        const left = scrollLeft;
        const top = scrollTop;
        const right = left + availableWidth;
        const bottom = top + availableHeight;
        visibleAreaBase.left = left;
        visibleAreaBase.top = top;
        visibleAreaBase.right = right;
        visibleAreaBase.bottom = bottom;
      } else {
        // For custom scroll containers, get the visible area in document-relative coordinates
        const scrollContainerViewportRect =
          scrollContainer.getBoundingClientRect();
        const documentScrollLeft = documentElement.scrollLeft;
        const documentScrollTop = documentElement.scrollTop;
        const left =
          scrollContainerViewportRect.left +
          documentScrollLeft +
          borderSizes.left;
        const top =
          scrollContainerViewportRect.top + documentScrollTop + borderSizes.top;
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

      const [xDocumentConstrained, yDocumentConstrained] = applyConstraints(
        constraints,
        xDocument,
        yDocument,
        {
          gestureInfo,
          elementWidth: currentRect.width,
          elementHeight: currentRect.height,
          direction,
          interactionType,
        },
      );

      const x = xDocument;
      const y = yDocument;
      const xMoveRaw = xDocument - gestureInfo.xAtStart;
      const yMoveRaw = yDocument - gestureInfo.yAtStart;
      // Calculate constrained xMove/yMove based on constrained document coordinates
      const xMoveConstrained = xDocumentConstrained - gestureInfo.xAtStart;
      const yMoveConstrained = yDocumentConstrained - gestureInfo.yAtStart;
      // Calculate direction based on where the element is trying to move (relative to previous position)
      const previousXMove = previousGestureInfo ? previousGestureInfo.xMove : 0;
      const previousYMove = previousGestureInfo ? previousGestureInfo.yMove : 0;
      const isGoingLeft = xMoveRaw < previousXMove;
      const isGoingRight = xMoveRaw > previousXMove;
      const isGoingUp = yMoveRaw < previousYMove;
      const isGoingDown = yMoveRaw > previousYMove;

      visualMarkers.onDrag({
        constraints,
        visibleArea,
        elementWidth: currentRect.width,
        elementHeight: currentRect.height,
      });

      const dragData = {
        x,
        y,
        xMove: xMoveConstrained,
        yMove: yMoveConstrained,
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
      };
      const elementLeftRelative = leftAtStart + xMoveConstrained;
      const elementLeft = elementLeftRelative;
      const elementTopRelative = topAtStart + yMoveConstrained;
      const elementTop = elementTopRelative;
      if (
        !gestureInfo.hasCrossedVisibleAreaLeftOnce &&
        elementLeft >= visibleArea.left
      ) {
        dragData.hasCrossedVisibleAreaLeftOnce = true;
      }
      if (
        !gestureInfo.hasCrossedVisibleAreaTopOnce &&
        elementTop >= visibleArea.top
      ) {
        dragData.hasCrossedVisibleAreaTopOnce = true;
      }

      if (isRelease) {
        return dragData;
      }
      if (!gestureInfo.started && threshold) {
        const deltaX = Math.abs(xMoveRaw);
        const deltaY = Math.abs(yMoveRaw);
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
      xDocument, // Document-relative X coordinate
      yDocument, // Document-relative Y coordinate
      event = new CustomEvent("programmatic"),
      { isRelease = false } = {},
    ) => {
      const dragData = determineDragData(xDocument, yDocument, event, {
        isRelease,
      });
      previousGestureInfo = { ...gestureInfo };
      // Calculate xChanged/yChanged based on previous gesture info
      const xChanged = previousGestureInfo
        ? dragData.xMove !== previousGestureInfo.xMove
        : true;
      const yChanged = previousGestureInfo
        ? dragData.yMove !== previousGestureInfo.yMove
        : true;
      console.log(
        `Gesture update: before xMove=${gestureInfo.xMove}, after xMove=${dragData.xMove}`,
      );

      Object.assign(gestureInfo, { xChanged, yChanged });
      Object.assign(gestureInfo, dragData);

      console.log(`Final gesture xMove=${gestureInfo.xMove}`);
      const someChange = xChanged || yChanged;
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

    const release = (
      event = new CustomEvent("programmatic"),
      { xAtRelease = gestureInfo.x, yAtRelease = gestureInfo.y } = {},
    ) => {
      drag(xAtRelease, yAtRelease, event, { isRelease: true });
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

    const mouseEventCoords = (mouseEvent) => {
      // Convert immediately to document coordinates for consistency
      const documentScrollLeft = documentElement.scrollLeft;
      const documentScrollTop = documentElement.scrollTop;
      return [
        mouseEvent.clientX + documentScrollLeft,
        mouseEvent.clientY + documentScrollTop,
      ];
    };

    const [xAtStart, yAtStart] = mouseEventCoords(mouseEvent);
    const dragGesture = grab(element, mouseEvent, {
      xAtStart,
      yAtStart,
      ...options,
    });

    const dragViaMouse = (mousemoveEvent) => {
      const [xDocument, yDocument] = mouseEventCoords(mousemoveEvent);
      dragGesture.drag(xDocument, yDocument, mousemoveEvent);
    };

    const releaseViaMouse = (mouseupEvent) => {
      const [xDocument, yDocument] = mouseEventCoords(mouseupEvent);
      dragGesture.release(mouseupEvent, {
        xAtRelease: xDocument,
        yAtRelease: yDocument,
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
          leftAtStart,
          topAtStart,
          visualOffsetX,
          visualOffsetY,
          isStickyLeftOrHasStickyLeftAttr,
          isStickyTopOrHasStickyTopAttr,
          isGoingDown,
          isGoingUp,
          isGoingLeft,
          isGoingRight,
          elementToImpact,
          elementVisuallyImpacted,
          elementVisuallyImpactedWidth,
          elementVisuallyImpactedHeight,
          visibleArea,
          hasCrossedVisibleAreaLeftOnce,
          hasCrossedVisibleAreaTopOnce,
        } = gestureInfo;

        // Calculate initial position for elementToImpact using document-relative coordinates
        // Since all coordinates are now in document space, we can use them directly
        let leftForPositioning = leftAtStart;
        let topForPositioning = topAtStart;

        // For sticky elements, we may need to adjust positioning
        if (isStickyLeftOrHasStickyLeftAttr) {
          // Document-relative coordinates already account for scroll position
          leftForPositioning = leftAtStart;
        }
        if (isStickyTopOrHasStickyTopAttr) {
          // Document-relative coordinates already account for scroll position
          topForPositioning = topAtStart;
        }

        // Convert from document-relative coordinates to positioned parent coordinates
        const [initialLeftToImpact, initialTopToImpact] =
          documentCoordsToPositionedParentCoords(
            leftForPositioning - visualOffsetX,
            topForPositioning - visualOffsetY,
            elementToImpact,
          );

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
                scrollContainer[scrollProperty] = scroll;
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
                scrollContainer[scrollProperty] = scroll;
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
          const desiredElementLeft = desiredElementLeftRelative;
          const desiredElementRight =
            desiredElementLeft + elementVisuallyImpactedWidth;

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
          const desiredElementTopRelative = topAtStart + gestureInfo.yMove;
          const desiredElementTop = desiredElementTopRelative;
          const desiredElementBottom =
            desiredElementTop + elementVisuallyImpactedHeight;

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
