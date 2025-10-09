import { getScrollableParentSet } from "../scroll/parent_scroll.js";

/**
 * Sets up position tracking between an element and a target element
 * @param {HTMLElement} element - An element
 * @param {HTMLElement} targetElement - The target that element should follow
 * @returns { updatePosition, stop }
 *
 * A bit like https://tetherjs.dev/ but different
 */
export const followPosition = (
  element,
  targetElement,
  { elementSizeToObserve = element, onChange, debug } = {},
) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  /**
   * Update validation message position relative to target element
   * This is called on scroll, resize, and other events
   */
  const updatePosition = () => {
    // Get viewport and element dimensions
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const elementRect = element.getBoundingClientRect();
    const targetElementRect = targetElement.getBoundingClientRect();
    const targetLeft =
      targetElementRect.left + document.documentElement.scrollLeft;
    const targetTop =
      targetElementRect.top + document.documentElement.scrollTop;
    const targetWidth = targetElementRect.width;
    const targetHeight = targetElementRect.height;
    const targetRight = targetLeft + targetWidth;
    const targetBottom = targetTop + targetHeight;

    const elementWidth = elementRect.width;
    const elementHeight = elementRect.height;
    // Determine horizontal position based on element size and position
    let elementLeftPos;

    // Handle extra-wide elements (wider than viewport)
    if (targetWidth > viewportWidth) {
      if (targetRight < viewportWidth) {
        // Element extends beyond left edge but right side is visible
        const viewportCenter = viewportWidth / 2;
        const diff = viewportWidth - targetRight;
        elementLeftPos = viewportCenter - diff / 2 - elementWidth / 2;
      } else if (targetLeft > 0) {
        // Element extends beyond right edge but left side is visible
        const viewportCenter = viewportWidth / 2;
        const diff = -targetLeft;
        elementLeftPos = viewportCenter - diff / 2 - elementWidth / 2;
      } else {
        // Element extends beyond both edges
        elementLeftPos = viewportWidth / 2 - elementWidth / 2;
      }
    } else {
      // Standard case: element within viewport width
      // Center the validation message relative to the element
      elementLeftPos = targetLeft + targetWidth / 2 - elementWidth / 2;

      // If validation message is wider than element, adjust position based on document boundaries
      if (elementWidth > targetWidth) {
        // If element is near left edge, align validation message with document left
        if (targetLeft < 20) {
          elementLeftPos = 0;
        }
      }
    }

    // Constrain to document boundaries
    if (elementLeftPos < 0) {
      elementLeftPos = 0;
    } else if (elementLeftPos + elementWidth > viewportWidth) {
      elementLeftPos = viewportWidth - elementWidth;
    }

    // Calculate vertical space available
    const spaceBelow = viewportHeight - targetBottom;
    const spaceAbove = targetTop;

    // Determine if validation message fits above or below
    const fitsBelow = spaceBelow >= elementHeight;
    const fitsAbove = spaceAbove >= elementHeight;
    const showAbove = !fitsBelow && fitsAbove;

    let elementTopPos;
    if (showAbove) {
      // Position above target element
      element.setAttribute("data-position", "above");
      elementTopPos = Math.max(0, targetTop - elementHeight);
    } else {
      // Position below target element
      element.setAttribute("data-position", "below");
      elementTopPos = Math.ceil(targetBottom);
    }
    // Apply calculated position
    element.style.transform = `translateX(${elementLeftPos}px) translateY(${elementTopPos}px)`;
    onChange?.({
      left: elementLeftPos,
      top: elementTopPos,
      right: elementLeftPos + elementWidth,
      bottom: elementTopPos + elementHeight,
      width: elementWidth,
      height: elementHeight,
      position: showAbove ? "above" : "below",
      fitsBelow,
      fitsAbove,
      targetLeft,
      targetTop,
      targetRight,
      targetBottom,
      targetWidth,
      targetHeight,
    });
  };

  // Initial position calculation
  updatePosition();
  if (debug) {
    console.debug("initial position updated");
  }

  // Request animation frame mechanism for efficient updates
  let rafId = null;
  let resizeObserverContent = null; // Declare at scope level for disconnect/reconnect

  const schedulePositionUpdate = (reason) => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      // Temporarily disconnect ResizeObserver to prevent feedback loops
      if (resizeObserverContent) {
        resizeObserverContent.disconnect();
      }
      updatePosition();

      // Reconnect ResizeObserver after position updates are complete
      if (resizeObserverContent) {
        resizeObserverContent.observe(elementSizeToObserve);
      }
      if (debug) {
        console.debug(`position updated (reason: ${reason})`);
      }
    });
  };
  cleanupCallbackSet.add(() => {
    cancelAnimationFrame(rafId);
  });

  update_on_content_change: {
    let lastContentSize = null;
    resizeObserverContent = new ResizeObserver((entries) => {
      const [entry] = entries;
      const { width, height } = entry.contentRect;

      // Debounce tiny changes that are likely sub-pixel rounding
      if (lastContentSize) {
        const widthDiff = Math.abs(width - lastContentSize.width);
        const heightDiff = Math.abs(height - lastContentSize.height);
        const threshold = 1; // Ignore changes smaller than 1px

        if (widthDiff < threshold && heightDiff < threshold) {
          if (debug) {
            console.debug(
              `content_size_change ignored - too small: ${widthDiff.toFixed(3)}px width, ${heightDiff.toFixed(3)}px height`,
            );
          }
          return;
        }
      }

      lastContentSize = { width, height };
      schedulePositionUpdate(`content_size_change (${width}x${height})`);
    });
    resizeObserverContent.observe(elementSizeToObserve);
    cleanupCallbackSet.add(() => {
      resizeObserverContent.disconnect();
    });
  }

  const positionCheck = {};
  update_on_target_position_change: {
    let lastBoundingRect = null;
    let positionCheckInterval = null;
    const startPositionChecking = () => {
      if (positionCheckInterval) return;
      positionCheckInterval = setInterval(checkPosition, 100); // Check every 100ms
    };

    const stopPositionChecking = () => {
      if (positionCheckInterval) {
        clearInterval(positionCheckInterval);
        positionCheckInterval = null;
      }
    };

    const checkPosition = () => {
      const currentRect = targetElement.getBoundingClientRect();
      const positionChanged =
        !lastBoundingRect ||
        Math.abs(lastBoundingRect.left - currentRect.left) > 0.5 ||
        Math.abs(lastBoundingRect.top - currentRect.top) > 0.5 ||
        Math.abs(lastBoundingRect.width - currentRect.width) > 0.5 ||
        Math.abs(lastBoundingRect.height - currentRect.height) > 0.5;

      if (positionChanged) {
        lastBoundingRect = {
          left: currentRect.left,
          top: currentRect.top,
          width: currentRect.width,
          height: currentRect.height,
        };
        schedulePositionUpdate("position_change");
      }
    };

    Object.assign(positionCheck, {
      start: startPositionChecking,
      stop: stopPositionChecking,
    });

    cleanupCallbackSet.add(() => {
      stopPositionChecking();
    });
  }

  // Show/hide validation message based on target element visibility
  update_on_target_visibility_change: {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: [0, 1],
    };
    const intersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        element.style.opacity = 1;
        schedulePositionUpdate("becomes_intersecting");
        positionCheck.start();
      } else {
        element.style.opacity = 0;
        positionCheck.stop();
      }
    }, options);
    intersectionObserver.observe(targetElement);
    cleanupCallbackSet.add(() => {
      intersectionObserver.disconnect();
    });
  }

  // Update position on scroll events
  update_on_scroll: {
    const handleScroll = () => {
      schedulePositionUpdate("parent_scroll");
    };

    const scrollableParentSet = getScrollableParentSet(targetElement);
    for (const scrollableParent of scrollableParentSet) {
      scrollableParent.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      cleanupCallbackSet.add(() => {
        scrollableParent.removeEventListener("scroll", handleScroll, {
          passive: true,
        });
      });
    }
  }

  // Update position when target element size changes
  update_on_target_size_change: {
    const resizeObserver = new ResizeObserver(() => {
      schedulePositionUpdate("target_size_change");
    });
    resizeObserver.observe(targetElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(targetElement);
    });
  }

  update_on_window_resize: {
    const handleResize = () => {
      schedulePositionUpdate("window_resize");
    };

    window.addEventListener("resize", handleResize);
    cleanupCallbackSet.add(() => {
      window.removeEventListener("resize", handleResize);
    });
  }

  update_on_window_touchmove: {
    const handleTouchmove = () => {
      schedulePositionUpdate("window_touchmove");
    };

    window.addEventListener("touchmove", handleTouchmove);
    cleanupCallbackSet.add(() => {
      window.removeEventListener("touchmove", handleTouchmove);
    });
  }

  return { updatePosition, stop };
};
