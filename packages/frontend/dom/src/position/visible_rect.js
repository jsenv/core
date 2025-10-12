import { createPubSub } from "../pub_sub.js";
import { getScrollableParent } from "../scroll/parent_scroll.js";

// Creates a visible rect effect that tracks how much of an element is visible within its scrollable parent
// and within the document viewport. This is useful for implementing overlays, lazy loading, or any UI
// that needs to react to element visibility changes.
//
// The function returns two visibility ratios:
// - scrollVisibilityRatio: Visibility ratio relative to the scrollable parent (0-1)
// - visibilityRatio: Visibility ratio relative to the document viewport (0-1)
//
// When scrollable parent is the document, both ratios will be the same.
// When scrollable parent is a custom container, scrollVisibilityRatio might be 1.0 (fully visible
// within the container) while visibilityRatio could be 0.0 (container is scrolled out of viewport).
// A bit like https://tetherjs.dev/ but different
export const visibleRectEffect = (element, update) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollableParent = getScrollableParent(element);
  const scrollableParentIsDocument =
    scrollableParent === document.documentElement;
  let lastMeasuredWidth;
  let lastMeasuredHeight;
  const check = (reason) => {
    console.group(`visibleRect.check("${reason}")`);

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollableParent;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollableParentIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const containerRect = scrollableParent.getBoundingClientRect();
      elementAbsoluteLeft = elementRect.left - containerRect.left + scrollLeft;
      elementAbsoluteTop = elementRect.top - containerRect.top + scrollTop;
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
    if (!scrollableParentIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollableParent.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    lastMeasuredWidth = width;
    lastMeasuredHeight = height;
    const visibleAreaWidth = scrollableParent.clientWidth;
    const visibleAreaHeight = scrollableParent.clientHeight;
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

    // Calculate visibility ratios
    const scrollVisibilityRatio =
      (widthVisible * heightVisible) / (width * height);
    // Calculate visibility ratio relative to document viewport
    let documentVisibilityRatio;
    if (scrollableParentIsDocument) {
      documentVisibilityRatio = scrollVisibilityRatio;
    } else {
      // For custom containers, calculate visibility relative to document viewport
      const elementRect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Calculate how much of the element is visible in the document viewport
      const elementLeft = Math.max(0, elementRect.left);
      const elementTop = Math.max(0, elementRect.top);
      const elementRight = Math.min(viewportWidth, elementRect.right);
      const elementBottom = Math.min(viewportHeight, elementRect.bottom);
      const documentVisibleWidth = Math.max(0, elementRight - elementLeft);
      const documentVisibleHeight = Math.max(0, elementBottom - elementTop);
      documentVisibilityRatio =
        (documentVisibleWidth * documentVisibleHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio: documentVisibilityRatio,
      scrollVisibilityRatio,
    };

    console.log(`update(${JSON.stringify(visibleRect, null, "  ")})`);
    console.groupEnd();
    update(visibleRect, {
      width,
      height,
    });
  };

  check("initialization");

  auto_check: {
    const [beforeCheck, onBeforeCheck] = createPubSub();
    const autoCheck = (reason) => {
      const beforeCheckResults = beforeCheck(reason);
      check(reason);
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
      const onDocumentScroll = () => {
        autoCheck("document_scroll");
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollableParentIsDocument) {
        const onScroll = () => {
          autoCheck("scrollable_parent_scroll");
        };
        scrollableParent.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollableParent.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    on_window_resize: {
      const onWindowResize = () => {
        autoCheck("window_size_change");
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    on_element_resize: {
      const resizeObserver = new ResizeObserver(() => {
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
        autoCheck(`element_size_change (${width}x${height})`);
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeCheck(() => {
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
          autoCheck("element_intersection_with_document_change");
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
      if (!scrollableParentIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck("element_intersection_with_scroll_change");
          },
          {
            root: scrollableParent,
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
      const onWindowTouchMove = () => {
        autoCheck("window_touchmove");
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
    disconnect: () => {
      teardown();
    },
  };
};

export const pickPositionRelativeTo = (element, target) => {
  if (
    import.meta.dev &&
    getScrollableParent(element) !== document.documentElement
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

  // Get viewport-relative positions
  const elementRect = element.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Get document scroll to convert to document-relative coordinates
  const { scrollLeft: documentScrollLeft, scrollTop: documentScrollTop } =
    document.documentElement;

  // Convert target position to document-relative coordinates
  const targetDocumentLeft = targetRect.left + documentScrollLeft;
  const targetDocumentTop = targetRect.top + documentScrollTop;
  const targetDocumentRight = targetRect.right + documentScrollLeft;
  const targetDocumentBottom = targetRect.bottom + documentScrollTop;

  // Viewport dimensions
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  const {
    left: elementLeft,
    right: elementRight,
    top: elementTop,
    bottom: elementBottom,
  } = elementRect;
  const {
    left: targetLeft,
    right: targetRight,
    top: targetTop,
    bottom: targetBottom,
  } = targetRect;

  const elementWidth = elementRight - elementLeft;
  const elementHeight = elementBottom - elementTop;
  const targetWidth = targetRight - targetLeft;

  // Calculate horizontal position (document-relative)
  let elementDocumentLeft;

  // Check if target element is wider than viewport
  const targetIsWiderThanViewport = targetWidth > viewportWidth;
  if (targetIsWiderThanViewport) {
    const targetLeftIsVisible = targetLeft >= 0;
    const targetRightIsVisible = targetRight <= viewportWidth;

    if (!targetLeftIsVisible && targetRightIsVisible) {
      // Target extends beyond left edge but right side is visible
      const viewportCenter = viewportWidth / 2;
      const distanceFromRightEdge = viewportWidth - targetRight;
      const viewportRelativeLeft =
        viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
      elementDocumentLeft = viewportRelativeLeft + documentScrollLeft;
    } else if (targetLeftIsVisible && !targetRightIsVisible) {
      // Target extends beyond right edge but left side is visible
      const viewportCenter = viewportWidth / 2;
      const distanceFromLeftEdge = -targetLeft;
      const viewportRelativeLeft =
        viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
      elementDocumentLeft = viewportRelativeLeft + documentScrollLeft;
    } else {
      // Target extends beyond both edges or is fully visible (center in viewport)
      const viewportRelativeLeft = viewportWidth / 2 - elementWidth / 2;
      elementDocumentLeft = viewportRelativeLeft + documentScrollLeft;
    }
  } else {
    // Target fits within viewport width - center element relative to target
    elementDocumentLeft =
      targetDocumentLeft + targetWidth / 2 - elementWidth / 2;

    // Special handling when element is wider than target
    const elementIsWiderThanTarget = elementWidth > targetWidth;
    if (elementIsWiderThanTarget) {
      const targetIsNearLeftEdge = targetLeft < 20;
      if (targetIsNearLeftEdge) {
        elementDocumentLeft = documentScrollLeft; // Left edge of viewport in document coordinates
      }
    }
  }

  // Constrain horizontal position to viewport boundaries (in document coordinates)
  const viewportLeftInDocument = documentScrollLeft;
  const viewportRightInDocument = documentScrollLeft + viewportWidth;

  if (elementDocumentLeft < viewportLeftInDocument) {
    elementDocumentLeft = viewportLeftInDocument;
  } else if (elementDocumentLeft + elementWidth > viewportRightInDocument) {
    elementDocumentLeft = viewportRightInDocument - elementWidth;
  }

  // Calculate vertical position (document-relative)
  const spaceAboveTarget = targetTop;
  const spaceBelowTarget = viewportHeight - targetBottom;

  const elementFitsAbove = spaceAboveTarget >= elementHeight;
  const elementFitsBelow = spaceBelowTarget >= elementHeight;

  // Prefer below, but use above if it doesn't fit below and does fit above
  const shouldPlaceAbove = !elementFitsBelow && elementFitsAbove;
  let elementDocumentTop;
  let position;

  if (shouldPlaceAbove) {
    position = "above";
    // Calculate top position when placing above target
    const idealTopWhenAbove = targetDocumentTop - elementHeight;
    const minimumTopInViewport = documentScrollTop;
    elementDocumentTop =
      idealTopWhenAbove < minimumTopInViewport
        ? minimumTopInViewport
        : idealTopWhenAbove;
  } else {
    position = "below";
    // Calculate top position when placing below target (ensure whole pixels)
    const idealTopWhenBelow = targetDocumentBottom;
    elementDocumentTop =
      idealTopWhenBelow % 1 === 0
        ? idealTopWhenBelow
        : Math.floor(idealTopWhenBelow) + 1;
  }

  return {
    position,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    targetLeft: targetDocumentLeft,
    targetTop: targetDocumentTop,
    targetRight: targetDocumentRight,
    targetBottom: targetDocumentBottom,
    elementFitsAbove,
    elementFitsBelow,
  };
};
