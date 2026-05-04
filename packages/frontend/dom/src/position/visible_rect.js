import { getScrollContainer } from "../interaction/scroll/scroll_container.js";
import { createPubSub } from "../pub_sub.js";

const DEBUG = false;

/**
 * Tracks how much of an element is visible within its scrollable parent and within the
 * document viewport. Calls update() on initialization and whenever visibility changes
 * (scroll, resize, intersection changes).
 *
 * The update callback receives a visibleRect object with:
 * - left, top, right, bottom, width, height: the visible portion of the element,
 *   clipped to its scroll container's bounds and expressed in overlay coordinates
 * - visibilityRatio: fraction of the element's area that is truly visible on screen (0–1).
 *   For document scroll containers this is the viewport-clipped fraction.
 *   For custom containers this is the fraction clipped by both the container AND the viewport
 *   (so an element scrolled out of its container correctly reports 0, not 1).
 *
 * A bit like https://tetherjs.dev/ but different
 */
export const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  let lastMeasuredWidth;
  let lastMeasuredHeight;
  const check = (event) => {
    if (DEBUG) {
      console.group(`visibleRect.check("${event.type}")`);
    }

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft =
        elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop =
        elementRect.top - scrollContainerRect.top + scrollTop;
    }

    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    lastMeasuredWidth = width;
    lastMeasuredHeight = height;
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    // Calculate visibilityRatio: fraction of element area truly visible on screen.
    // For custom containers we intersect the container-clipped visible size (widthVisible x
    // heightVisible) with the viewport bounds, so an element scrolled out of its container
    // correctly reports 0 rather than the raw viewport intersection of its bounding rect.
    let visibilityRatio;
    if (scrollContainerIsDocument) {
      visibilityRatio = (widthVisible * heightVisible) / (width * height);
    } else {
      // widthVisible/heightVisible are already clipped to the scroll container.
      // Now clip their viewport-relative counterparts against the viewport.
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Container-clipped visible rect in viewport coordinates
      const visibleLeft = overlayLeft;
      const visibleTop = overlayTop;
      const visibleRight = overlayLeft + widthVisible;
      const visibleBottom = overlayTop + heightVisible;
      // Intersect with viewport
      const clippedLeft = visibleLeft < 0 ? 0 : visibleLeft;
      const clippedTop = visibleTop < 0 ? 0 : visibleTop;
      const clippedRight =
        visibleRight > viewportWidth ? viewportWidth : visibleRight;
      const clippedBottom =
        visibleBottom > viewportHeight ? viewportHeight : visibleBottom;
      const clippedWidth =
        clippedRight > clippedLeft ? clippedRight - clippedLeft : 0;
      const clippedHeight =
        clippedBottom > clippedTop ? clippedBottom - clippedTop : 0;
      visibilityRatio = (clippedWidth * clippedHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio,
    };

    if (DEBUG) {
      console.log(`update(${JSON.stringify(visibleRect, null, "  ")})`);
      console.groupEnd();
    }
    update(visibleRect, {
      event,
      width,
      height,
    });
  };

  check(new CustomEvent("initialization"));

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  auto_check: {
    const autoCheck = (event) => {
      const beforeCheckResults = publishBeforeAutoCheck(event);
      check(event);
      for (const beforeCheckResult of beforeCheckResults) {
        if (typeof beforeCheckResult === "function") {
          beforeCheckResult();
        }
      }
    };
    // let rafId = null;
    // const scheduleCheck = (reason) => {
    //   cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(() => {
    //     autoCheck(reason);
    //   });
    // };
    // addTeardown(() => {
    //   cancelAnimationFrame(rafId);
    // });

    on_scroll: {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = (e) => {
        autoCheck(e);
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = (e) => {
          autoCheck(e);
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    on_window_resize: {
      const onWindowResize = (e) => {
        autoCheck(e);
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    on_element_resize: {
      let handlingResize = true;
      const resizeObserver = new ResizeObserver(() => {
        if (handlingResize) {
          return;
        }
        // we use directly the result of getBoundingClientRect() instead of the resizeEntry.contentRect or resizeEntry.borderBoxSize
        // so that:
        // - We can compare the dimensions measure in the last check and the current one
        // - We don't have to check element boz-sizing to know what to compare
        // - resizeEntry.borderBoxSize browser support is not that great
        const { width, height } = element.getBoundingClientRect();
        const widthDiff = Math.abs(width - lastMeasuredWidth);
        const heightDiff = Math.abs(height - lastMeasuredHeight);
        if (widthDiff === 0 && heightDiff === 0) {
          return;
        }
        handlingResize = true;
        autoCheck(
          new CustomEvent("element_size_change", { detail: { width, height } }),
        );
        handlingResize = false;
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // This triggers a new call to the resive observer that will be ignored thanks to
          // the widthDiff/heightDiff early return
          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
    on_intersection_change: {
      const documentIntersectionObserver = new IntersectionObserver(
        () => {
          autoCheck(
            new CustomEvent("element_intersection_with_document_change"),
          );
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: [0, 0.1, 0.9, 1],
        },
      );
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck(
              new CustomEvent("element_intersection_with_scroll_change"),
            );
          },
          {
            root: scrollContainer,
            rootMargin: "0px",
            threshold: [0, 0, 1, 0.9, 1],
          },
        );
        scrollIntersectionObserver.observe(element);
        addTeardown(() => {
          scrollIntersectionObserver.disconnect();
        });
      }
    }
    on_window_touchmove: {
      const onWindowTouchMove = (e) => {
        autoCheck(e);
      };
      window.addEventListener("touchmove", onWindowTouchMove, {
        passive: true,
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true,
        });
      });
    }
  }

  return {
    check,
    onBeforeAutoCheck,
    disconnect: () => {
      teardown();
    },
  };
};

/**
 * Places element relative to anchor with independent control of horizontal and vertical axes.
 *
 * Horizontal axis — positionX / positionXFixed (left → right):
 *   "to-the-left"   element.right  = anchor.left   (sits entirely to the left of anchor)
 *   "left-aligned"  element.left   = anchor.left   (left edges aligned)
 *   "center"        element centered horizontally over anchor  (default)
 *   "right-aligned" element.right  = anchor.right  (right edges aligned)
 *   "to-the-right"  element.left   = anchor.right  (sits entirely to the right of anchor)
 *
 * Vertical axis — positionY / positionYFixed (top → bottom):
 *   "above"         element.bottom = anchor.top    (sits above, no overlap)
 *   "above-overlap" element.bottom = anchor.bottom (sits above, overlapping anchor)
 *   "center"        element centered vertically over anchor
 *   "below-overlap" element.top    = anchor.top    (sits below, overlapping anchor)
 *   "below"         element.top    = anchor.bottom (sits below, no overlap)  (default)
 *
 * positionX / positionY attempt the requested placement and automatically flip to the
 * logical opposite when the element does not fit in the viewport:
 *   above ↔ below,   above-overlap ↔ below-overlap
 *
 * positionXFixed / positionYFixed skip the fit check entirely.
 *
 * The resolved X and Y are persisted as data-position-x-current / data-position-y-current
 * on the element so subsequent calls start from the last resolved position (avoids
 * flickering when the element is near the flip threshold). Fixed axes are not persisted.
 *
 * @param {HTMLElement} element - The element to position (must be document-relative)
 * @param {HTMLElement} anchor - The anchor element to position against
 * @param {object} [options]
 * @param {string} [options.positionX="center"] - Preferred X placement, with viewport fallback.
 * @param {string} [options.positionY="below"] - Preferred Y placement, with viewport fallback.
 * @param {string} [options.positionXFixed] - Force X placement, skipping the fit-check.
 * @param {string} [options.positionYFixed] - Force Y placement, skipping the fit-check.
 * @param {number} [options.alignToViewportEdgeWhenAnchorNearEdge=0] - Snap to viewport left
 *   edge when anchor is within this many px of the left edge and element is wider than anchor.
 * @param {number} [options.minLeft=0] - Minimum left coordinate (document-relative).
 * @returns {{ positionX, positionY, left, top, width, height, anchorLeft, anchorTop, anchorRight, anchorBottom, spaceAbove, spaceBelow }}
 */
export const pickPositionRelativeTo = (
  element,
  anchor,
  {
    positionX = "center",
    positionY = "below",
    positionXFixed,
    positionYFixed,
    alignToViewportEdgeWhenAnchorNearEdge = 0,
    minLeft = 0,
  } = {},
) => {
  if (
    import.meta.dev &&
    getScrollContainer(element) !== document.documentElement
  ) {
    // The idea behind this warning is that pickPositionRelativeTo is meant to position a tooltip/dropdown etc
    // And for this use case the element to position should be document-relative
    // (position: absolute with first scrollable parent being the document)
    // Because this is how you achieve the best results:
    // 1. The element naturally follow document scroll
    // Which gives the best experience when user scrolls the page or the container
    // 2. The element can take more visible size in case target is within a scrollable container
    // or uses overflow: hidden somewhere in its ancestor chain
    console.warn(
      "pickPositionRelativeTo should be used only for document-relative element",
    );
  }

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  // Get viewport-relative positions
  const elementRect = element.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const {
    left: elementLeft,
    right: elementRight,
    top: elementTop,
    bottom: elementBottom,
  } = elementRect;
  const {
    left: anchorLeft,
    right: anchorRight,
    top: anchorTop,
    bottom: anchorBottom,
  } = anchorRect;
  const elementWidth = elementRight - elementLeft;
  const elementHeight = elementBottom - elementTop;
  const anchorWidth = anchorRight - anchorLeft;
  const anchorHeight = anchorBottom - anchorTop;

  const spaceAbove = anchorTop;
  const spaceBelow = viewportHeight - anchorBottom;

  // Resolve active X and Y, and whether each is fixed (no flip fallback)
  let activeX;
  let activeY;
  const xIsFixed = Boolean(positionXFixed);
  const yIsFixed = Boolean(positionYFixed);
  if (xIsFixed) {
    activeX = positionXFixed;
  } else {
    const storedX = element.getAttribute("data-position-x-current");
    activeX = storedX ?? positionX;
  }
  if (yIsFixed) {
    activeY = positionYFixed;
  } else {
    const storedY = element.getAttribute("data-position-y-current");
    activeY = storedY ?? positionY;
  }

  // Resolve final Y — flip to opposite when requested Y does not fit
  let finalY;
  {
    const oppositeY = {
      "above": "below",
      "below": "above",
      "above-overlap": "below-overlap",
      "below-overlap": "above-overlap",
    };
    if (yIsFixed || activeY === "center") {
      finalY = activeY;
    } else if (activeY === "above" || activeY === "above-overlap") {
      const minContentVisibilityRatio = 0.6;
      const fitsAbove = spaceAbove / elementHeight >= minContentVisibilityRatio;
      if (fitsAbove) {
        finalY = activeY;
      } else {
        finalY = oppositeY[activeY];
      }
    } else {
      // "below" or "below-overlap"
      const fitsBelow = spaceBelow >= elementHeight;
      if (fitsBelow) {
        finalY = activeY;
      } else {
        finalY = oppositeY[activeY];
      }
    }
  }

  // Final X has no flip fallback
  const finalX = activeX;

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    if (finalX === "to-the-left") {
      elementPositionLeft = anchorLeft - elementWidth;
    } else if (finalX === "left-aligned") {
      elementPositionLeft = anchorLeft;
    } else if (finalX === "center") {
      // Complex logic handles wide anchors and viewport-edge snapping
      const anchorIsWiderThanViewport = anchorWidth > viewportWidth;
      if (anchorIsWiderThanViewport) {
        const anchorLeftIsVisible = anchorLeft >= 0;
        const anchorRightIsVisible = anchorRight <= viewportWidth;
        if (!anchorLeftIsVisible && anchorRightIsVisible) {
          const viewportCenter = viewportWidth / 2;
          const distanceFromRightEdge = viewportWidth - anchorRight;
          elementPositionLeft =
            viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
        } else if (anchorLeftIsVisible && !anchorRightIsVisible) {
          const viewportCenter = viewportWidth / 2;
          const distanceFromLeftEdge = -anchorLeft;
          elementPositionLeft =
            viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
        } else {
          elementPositionLeft = viewportWidth / 2 - elementWidth / 2;
        }
      } else {
        elementPositionLeft = anchorLeft + anchorWidth / 2 - elementWidth / 2;
        if (alignToViewportEdgeWhenAnchorNearEdge) {
          const elementIsWiderThanAnchor = elementWidth > anchorWidth;
          const anchorIsNearLeftEdge =
            anchorLeft < alignToViewportEdgeWhenAnchorNearEdge;
          if (elementIsWiderThanAnchor && anchorIsNearLeftEdge) {
            elementPositionLeft = minLeft;
          }
        }
      }
    } else if (finalX === "right-aligned") {
      elementPositionLeft = anchorRight - elementWidth;
    } else {
      // "to-the-right"
      elementPositionLeft = anchorRight;
    }
    // Constrain horizontal position to viewport boundaries
    if (elementPositionLeft < 0) {
      elementPositionLeft = 0;
    } else if (elementPositionLeft + elementWidth > viewportWidth) {
      elementPositionLeft = viewportWidth - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let elementPositionTop;
  {
    if (finalY === "above") {
      const idealTop = anchorTop - elementHeight;
      elementPositionTop = idealTop < 0 ? 0 : idealTop;
    } else if (finalY === "above-overlap") {
      const idealTop = anchorBottom - elementHeight;
      elementPositionTop = idealTop < 0 ? 0 : idealTop;
    } else if (finalY === "center") {
      elementPositionTop = anchorTop + anchorHeight / 2 - elementHeight / 2;
    } else if (finalY === "below-overlap") {
      const idealTop = anchorTop;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    } else {
      // "below"
      const idealTop = anchorBottom;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    }
  }

  // Persist resolved X/Y so subsequent calls start from here (avoids flickering).
  // Fixed axes are not persisted.
  if (!xIsFixed) {
    element.setAttribute("data-position-x-current", finalX);
  }
  if (!yIsFixed) {
    element.setAttribute("data-position-y-current", finalY);
  }

  // Get document scroll for final coordinate conversion
  const { scrollLeft, scrollTop } = document.documentElement;
  const elementDocumentLeft = elementPositionLeft + scrollLeft;
  const elementDocumentTop = elementPositionTop + scrollTop;
  const anchorDocumentLeft = anchorLeft + scrollLeft;
  const anchorDocumentTop = anchorTop + scrollTop;
  const anchorDocumentRight = anchorRight + scrollLeft;
  const anchorDocumentBottom = anchorBottom + scrollTop;

  return {
    positionX: finalX,
    positionY: finalY,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    anchorLeft: anchorDocumentLeft,
    anchorTop: anchorDocumentTop,
    anchorRight: anchorDocumentRight,
    anchorBottom: anchorDocumentBottom,
    spaceAbove,
    spaceBelow,
  };
};
