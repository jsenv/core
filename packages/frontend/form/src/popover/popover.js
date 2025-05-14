import { getPaddingAndBorderSizes, getScrollableParentSet } from "@jsenv/dom";

/**
 * A popover component that mimics native browser validation popovers.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow points at the target element
 */

const css = /*css*/ `
.popover {
  display: block;
  overflow: visible;
  height: auto;
  position: fixed;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  pointer-events: none; 
}

.popover_border {
  position: absolute;
  pointer-events: none;
  filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
}

.popover_content_wrapper {
  border-style: solid;
  border-color: transparent;
  position: relative;
}

.popover_content {
  padding: 8px; 
  position: relative;
  max-width: 47vw;
}

.popover_border svg {
  position: absolute;
  inset: 0;
  overflow: visible;
}
`;
const styleElement = document.createElement("style");
styleElement.textContent = css;
document.head.appendChild(styleElement);

// Configuration parameters for popover appearance
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const CORNER_RADIUS = 3;
const BORDER_WIDTH = 1;
const ARROW_SPACING = 8;

/**
 * Generates SVG path for popover with arrow on top
 * @param {number} width - Popover width
 * @param {number} height - Popover height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // Slight adjustment for visual balance
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path (border)
  const outerPath = `
      M${CORNER_RADIUS},${ARROW_HEIGHT} 
      H${constrainedArrowPos - ARROW_WIDTH / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + ARROW_WIDTH / 2},${ARROW_HEIGHT} 
      H${width - CORNER_RADIUS} 
      Q${width},${ARROW_HEIGHT} ${width},${ARROW_HEIGHT + CORNER_RADIUS} 
      V${adjustedHeight - CORNER_RADIUS} 
      Q${width},${adjustedHeight} ${width - CORNER_RADIUS},${adjustedHeight} 
      H${CORNER_RADIUS} 
      Q0,${adjustedHeight} 0,${adjustedHeight - CORNER_RADIUS} 
      V${ARROW_HEIGHT + CORNER_RADIUS} 
      Q0,${ARROW_HEIGHT} ${CORNER_RADIUS},${ARROW_HEIGHT}
    `;

  // Inner path (content) - keep arrow width almost the same
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction} 
    L${constrainedArrowPos},${BORDER_WIDTH} 
    L${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${width - BORDER_WIDTH},${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    V${adjustedHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${BORDER_WIDTH},${adjustedHeight - innerRadius - BORDER_WIDTH} 
    V${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

/**
 * Generates SVG path for popover with arrow on bottom
 * @param {number} width - Popover width
 * @param {number} height - Popover height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // For small border widths, keep inner arrow nearly the same size as outer
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path with rounded corners
  const outerPath = `
      M${CORNER_RADIUS},0 
      H${width - CORNER_RADIUS} 
      Q${width},0 ${width},${CORNER_RADIUS} 
      V${contentHeight - CORNER_RADIUS} 
      Q${width},${contentHeight} ${width - CORNER_RADIUS},${contentHeight} 
      H${constrainedArrowPos + ARROW_WIDTH / 2} 
      L${constrainedArrowPos},${adjustedHeight} 
      L${constrainedArrowPos - ARROW_WIDTH / 2},${contentHeight} 
      H${CORNER_RADIUS} 
      Q0,${contentHeight} 0,${contentHeight - CORNER_RADIUS} 
      V${CORNER_RADIUS} 
      Q0,0 ${CORNER_RADIUS},0
    `;

  // Inner path with correct arrow direction and color
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${BORDER_WIDTH} ${width - BORDER_WIDTH},${innerRadius + BORDER_WIDTH} 
    V${contentHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} 
    H${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction} 
    L${constrainedArrowPos},${adjustedHeight - BORDER_WIDTH} 
    L${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction},${contentHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${BORDER_WIDTH},${contentHeight - innerRadius - BORDER_WIDTH} 
    V${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${BORDER_WIDTH}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

// HTML template for the popover
const popoverTemplate = /* html */ `
  <div class="popover" role="tooltip">
    <div class="popover_content_wrapper">
      <div class="popover_border"></div>
      <div class="popover_content">Default message</div>
    </div>
  </div>
`;

/**
 * Creates a new popover element with specified content
 * @param {string} content - HTML content for the popover
 * @returns {HTMLElement} - The popover element
 */
const createPopover = (content) => {
  const div = document.createElement("div");
  div.innerHTML = popoverTemplate;
  const popover = div.querySelector(".popover");
  const contentElement = popover.querySelector(".popover_content");
  contentElement.innerHTML = content;
  return popover;
};

/**
 * Sets up position tracking between a popover and its target element
 * @param {HTMLElement} popover - The popover element
 * @param {HTMLElement} targetElement - The element the popover should follow
 * @returns {Function} - Cleanup function to stop position tracking
 */
const followPosition = (popover, targetElement) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  // Get references to popover parts
  const popoverContentWrapper = popover.querySelector(
    ".popover_content_wrapper",
  );
  const popoverBorder = popover.querySelector(".popover_border");
  const popoverContent = popover.querySelector(".popover_content");

  // Set initial border styles
  popoverContentWrapper.style.borderWidth = `${BORDER_WIDTH}px`;
  popoverBorder.style.bottom = `-${BORDER_WIDTH}px`;
  popoverBorder.style.left = `-${BORDER_WIDTH}px`;
  popoverBorder.style.right = `-${BORDER_WIDTH}px`;

  /**
   * Update popover position relative to target element
   * This is called on scroll, resize, and other events
   */
  const updatePosition = () => {
    // Get viewport and element dimensions
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const contentHeight = popoverContent.offsetHeight;
    const popoverRect = popoverBorder.getBoundingClientRect();
    const targetElementRect = targetElement.getBoundingClientRect();

    // Get element padding and border to properly position arrow
    const elementPaddingAndBorderSizes =
      getPaddingAndBorderSizes(targetElement);
    const elementLeft = targetElementRect.left;
    const elementWidth = targetElementRect.width;
    const popoverWidth = popoverRect.width;

    // Determine horizontal position based on element size and position
    let popoverLeftPos;

    // Handle extra-wide elements (wider than viewport)
    if (elementWidth > viewportWidth) {
      const elementRight = targetElementRect.right;
      if (elementRight < viewportWidth) {
        // Element extends beyond left edge but right side is visible
        const viewportCenter = viewportWidth / 2;
        const diff = viewportWidth - elementRight;
        popoverLeftPos = viewportCenter - diff / 2 - popoverWidth / 2;
      } else {
        // Element extends beyond both edges
        popoverLeftPos = viewportWidth / 2 - popoverWidth / 2;
      }
    } else {
      // Standard case: element within viewport width
      // Center the popover relative to the element
      popoverLeftPos = elementLeft + elementWidth / 2 - popoverWidth / 2;

      // If popover is wider than element, adjust position based on document boundaries
      if (popoverWidth > elementWidth) {
        // If element is near left edge, align popover with document left
        if (elementLeft < 20) {
          popoverLeftPos = 0;
        }
      }
    }

    // Constrain to document boundaries
    if (popoverLeftPos < 0) {
      popoverLeftPos = 0;
    } else if (popoverLeftPos + popoverWidth > viewportWidth) {
      popoverLeftPos = viewportWidth - popoverRect.width;
    }

    // Calculate arrow position to point at target element
    let arrowLeftPosOnPopover;
    // Target the left edge of the element (after borders)
    const arrowTargetLeft =
      elementLeft + elementPaddingAndBorderSizes.borderSizes.left;

    if (popoverLeftPos < arrowTargetLeft) {
      // Popover is left of the target point, move arrow right
      const diff = arrowTargetLeft - popoverLeftPos;
      arrowLeftPosOnPopover = diff;
    } else {
      // Popover contains or is right of the target point, keep arrow at left
      arrowLeftPosOnPopover = 0;
    }

    // Calculate vertical space available
    const spaceBelow = viewportHeight - targetElementRect.bottom;
    const spaceAbove = targetElementRect.top;
    const totalPopoverHeight = contentHeight + ARROW_HEIGHT + BORDER_WIDTH * 2;

    // Determine if popover fits above or below
    const fitsBelow = spaceBelow >= totalPopoverHeight;
    const fitsAbove = spaceAbove >= totalPopoverHeight;
    const showAbove = !fitsBelow && fitsAbove;

    let popoverTopPos;

    if (showAbove) {
      // Position above target element
      popover.setAttribute("data-position", "above");
      popoverTopPos = Math.max(0, targetElementRect.top - totalPopoverHeight);
      popoverContentWrapper.style.marginTop = undefined;
      popoverContentWrapper.style.marginBottom = `${ARROW_HEIGHT}px`;
      popoverBorder.style.top = `-${BORDER_WIDTH}px`;
      popoverBorder.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT}px`;
      popoverBorder.innerHTML = generateSvgWithBottomArrow(
        popoverRect.width,
        popoverRect.height,
        arrowLeftPosOnPopover,
      );
    } else {
      // Position below target element
      popover.setAttribute("data-position", "below");
      popoverTopPos = Math.ceil(targetElementRect.bottom);
      popoverContentWrapper.style.marginTop = `${ARROW_HEIGHT}px`;
      popoverContentWrapper.style.marginBottom = undefined;
      popoverBorder.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT}px`;
      popoverBorder.style.bottom = `-${BORDER_WIDTH}px`;
      popoverBorder.innerHTML = generateSvgWithTopArrow(
        popoverRect.width,
        popoverRect.height,
        arrowLeftPosOnPopover,
      );

      // Handle overflow at bottom with scrolling if needed
      if (!fitsBelow && !fitsAbove) {
        const availableHeight =
          viewportHeight -
          targetElementRect.bottom -
          ARROW_HEIGHT -
          BORDER_WIDTH * 2;

        // Only apply scrolling if we have reasonable space
        if (availableHeight > 50) {
          popoverContent.style.maxHeight = `${availableHeight}px`;
          popoverContent.style.overflowY = "auto";
        }
      }
    }

    // Apply calculated position
    popover.style.left = `${popoverLeftPos}px`;
    popover.style.top = `${popoverTopPos}px`;
  };

  // Initial position calculation
  updatePosition();

  // Request animation frame mechanism for efficient updates
  let rafId = null;
  const schedulePositionUpdate = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePosition);
  };
  cleanupCallbackSet.add(() => {
    cancelAnimationFrame(rafId);
  });

  update_on_content_change: {
    const resizeObserverContent = new ResizeObserver(() => {
      schedulePositionUpdate();
    });
    resizeObserverContent.observe(popoverContent);
    cleanupCallbackSet.add(() => {
      resizeObserverContent.disconnect();
    });
  }

  // Show/hide popover based on target element visibility
  update_on_target_visibility_change: {
    const options = {
      root: null,
      rootMargin: "0px",
      threshold: [0, 1],
    };
    const intersectionObserver = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        popover.style.opacity = 1;
        schedulePositionUpdate();
      } else {
        popover.style.opacity = 0;
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
      schedulePositionUpdate();
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
      schedulePositionUpdate();
    });
    resizeObserver.observe(targetElement);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(targetElement);
    });
  }

  return stop;
};

/**
 * Shows a popover attached to the specified element
 * @param {HTMLElement} targetElement - Element the popover should follow
 * @param {string} innerHtml - HTML content for the popover
 * @param {Object} options - Configuration options
 * @param {boolean} options.scrollIntoView - Whether to scroll the target element into view
 * @returns {Function} - Function to hide and remove the popover
 */
export const showPopover = (
  targetElement,
  innerHtml,
  { scrollIntoView } = {},
) => {
  // Create and add popover to document
  const jsenvPopover = createPopover(innerHtml);
  jsenvPopover.style.opacity = "0";

  // Connect popover with target element for accessibility
  const popoverId = `popover-${Date.now()}`;
  jsenvPopover.id = popoverId;
  targetElement.setAttribute("aria-describedby", popoverId);

  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, targetElement);

  // Handle scrolling to target element if requested
  if (scrollIntoView) {
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  // Return cleanup function
  return () => {
    stopFollowingPosition();
    if (document.body.contains(jsenvPopover)) {
      targetElement.removeAttribute("aria-describedby");
      document.body.removeChild(jsenvPopover);
    }
  };
};
