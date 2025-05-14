import { getPaddingAndBorderSizes, getScrollableParentSet } from "@jsenv/dom";

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
  padding: 5px; 
  position: relative;
  border-radius: 3px;
  max-width: fit-content; /* Allow content to determine width */
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: normal;
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

const arrowWidth = 16;
const arrowHeight = 8;
const arrowSpacing = 8;
const radius = 3;
const borderWidth = 1;

const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  const arrowLeft = arrowWidth / 2 + radius + borderWidth + arrowSpacing;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - arrowHeight;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + arrowHeight;

  // For small border widths (like 1px), we want the inner arrow to be almost the same size
  // For larger borders, we need a small adjustment to maintain visual balance
  const innerArrowWidthReduction = Math.min(borderWidth * 0.3, 1);

  // For rounded corners, create similar double-path structure
  // Outer path (border)
  const outerPath = `
      M${radius},${arrowHeight} 
      H${constrainedArrowPos - arrowWidth / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      H${width - radius} 
      Q${width},${arrowHeight} ${width},${arrowHeight + radius} 
      V${adjustedHeight - radius} 
      Q${width},${adjustedHeight} ${width - radius},${adjustedHeight} 
      H${radius} 
      Q0,${adjustedHeight} 0,${adjustedHeight - radius} 
      V${arrowHeight + radius} 
      Q0,${arrowHeight} ${radius},${arrowHeight}
    `;

  // Inner path (content) - keep arrow width almost the same
  const innerRadius = Math.max(0, radius - borderWidth);
  const innerPath = `
    M${innerRadius + borderWidth},${arrowHeight + borderWidth} 
    H${constrainedArrowPos - arrowWidth / 2 + innerArrowWidthReduction} 
    L${constrainedArrowPos},${borderWidth} 
    L${constrainedArrowPos + arrowWidth / 2 - innerArrowWidthReduction},${arrowHeight + borderWidth} 
    H${width - innerRadius - borderWidth} 
    Q${width - borderWidth},${arrowHeight + borderWidth} ${width - borderWidth},${arrowHeight + innerRadius + borderWidth} 
    V${adjustedHeight - innerRadius - borderWidth} 
    Q${width - borderWidth},${adjustedHeight - borderWidth} ${width - innerRadius - borderWidth},${adjustedHeight - borderWidth} 
    H${innerRadius + borderWidth} 
    Q${borderWidth},${adjustedHeight - borderWidth} ${borderWidth},${adjustedHeight - innerRadius - borderWidth} 
    V${arrowHeight + innerRadius + borderWidth} 
    Q${borderWidth},${arrowHeight + borderWidth} ${innerRadius + borderWidth},${arrowHeight + borderWidth}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  const arrowLeft = arrowWidth / 2 + radius + borderWidth + arrowSpacing;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - arrowHeight;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + arrowHeight;

  // For small border widths, keep inner arrow nearly the same size as outer
  const innerArrowWidthReduction = Math.min(borderWidth * 0.3, 1);

  // For rounded corners, create similar double-path structure
  const outerPath = `
      M${radius},0 
      H${width - radius} 
      Q${width},0 ${width},${radius} 
      V${contentHeight - radius} 
      Q${width},${contentHeight} ${width - radius},${contentHeight} 
      H${constrainedArrowPos + arrowWidth / 2} 
      L${constrainedArrowPos},${adjustedHeight} 
      L${constrainedArrowPos - arrowWidth / 2},${contentHeight} 
      H${radius} 
      Q0,${contentHeight} 0,${contentHeight - radius} 
      V${radius} 
      Q0,0 ${radius},0
    `;

  // Fixed inner path with correct arrow direction and color
  const innerRadius = Math.max(0, radius - borderWidth);
  const innerPath = `
    M${innerRadius + borderWidth},${borderWidth} 
    H${width - innerRadius - borderWidth} 
    Q${width - borderWidth},${borderWidth} ${width - borderWidth},${innerRadius + borderWidth} 
    V${contentHeight - innerRadius - borderWidth} 
    Q${width - borderWidth},${contentHeight - borderWidth} ${width - innerRadius - borderWidth},${contentHeight - borderWidth} 
    H${constrainedArrowPos + arrowWidth / 2 - innerArrowWidthReduction} 
    L${constrainedArrowPos},${adjustedHeight - borderWidth} 
    L${constrainedArrowPos - arrowWidth / 2 + innerArrowWidthReduction},${contentHeight - borderWidth} 
    H${innerRadius + borderWidth} 
    Q${borderWidth},${contentHeight - borderWidth} ${borderWidth},${contentHeight - innerRadius - borderWidth} 
    V${innerRadius + borderWidth} 
    Q${borderWidth},${borderWidth} ${innerRadius + borderWidth},${borderWidth}
  `;

  return `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="${outerPath}" fill="#333" />
      <path d="${innerPath}" fill="white" />
    </svg>`;
};

const html = /* html */ `
  <div class="popover">
    <div class="popover_content_wrapper">
      <div class="popover_border"></div>
      <div class="popover_content">Default message</div>
    </div>
  </div>
`;

const createPopover = (content) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const popover = div.querySelector(".popover");
  const contentElement = popover.querySelector(".popover_content");
  contentElement.innerHTML = content;
  return popover;
};

const followPosition = (element, elementToFollow) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const popoverContentWrapper = element.querySelector(
    ".popover_content_wrapper",
  );
  const popoverBorder = element.querySelector(".popover_border");
  const popoverContent = element.querySelector(".popover_content");

  popoverContentWrapper.style.borderWidth = `${borderWidth}px`;
  popoverBorder.style.bottom = `-${borderWidth}px`;
  popoverBorder.style.left = `-${borderWidth}px`;
  popoverBorder.style.right = `-${borderWidth}px`;

  const updatePosition = () => {
    // Get viewport and document dimensions
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const contentHeight = popoverContent.offsetHeight;
    const popoverRect = popoverBorder.getBoundingClientRect();
    const elementToFollowRect = elementToFollow.getBoundingClientRect();
    const elementPaddingAndBorderSizes =
      getPaddingAndBorderSizes(elementToFollow);
    const elementLeft = elementToFollowRect.left;

    let popoverLeftPos;
    let arrowLeftPosOnPopover;

    if (popoverRect.width > elementToFollowRect.width) {
      // popover bigger than element
      popoverLeftPos = elementToFollowRect.left - 12;
      arrowLeftPosOnPopover = 0;
    } else {
      // popover smaller than element
      popoverLeftPos =
        elementToFollowRect.left +
        elementToFollowRect.width / 2 -
        popoverRect.width / 2;
      arrowLeftPosOnPopover = 0;
    }
    if (popoverLeftPos < 0) {
      popoverLeftPos = 0;
    } else if (popoverLeftPos + popoverRect.width > viewportWidth) {
      popoverLeftPos = viewportWidth - popoverRect.width;
    }

    const arrowTargetLeft =
      elementLeft + elementPaddingAndBorderSizes.borderSizes.left;
    const arrowLeft = popoverLeftPos + arrowLeftPosOnPopover;
    if (arrowLeft < arrowTargetLeft) {
      const diff = arrowTargetLeft - arrowLeft;
      arrowLeftPosOnPopover += diff; // increase the arrow left pos on the popover
    }

    // Calculate vertical space
    const spaceBelow = viewportHeight - elementToFollowRect.bottom;
    const spaceAbove = elementToFollowRect.top;
    const totalPopoverHeight = contentHeight + arrowHeight + borderWidth * 2;
    const fitsBelow = spaceBelow >= totalPopoverHeight;
    const fitsAbove = spaceAbove >= totalPopoverHeight;
    const showAbove = !fitsBelow && fitsAbove;

    let popoverTopPos;

    if (showAbove) {
      // Position above element
      element.setAttribute("data-position", "above");
      popoverTopPos = Math.max(0, elementToFollowRect.top - totalPopoverHeight);
      popoverContentWrapper.style.marginTop = undefined;
      popoverContentWrapper.style.marginBottom = `${arrowHeight}px`;
      popoverBorder.style.top = `-${borderWidth}px`;
      popoverBorder.style.bottom = `-${borderWidth + arrowHeight}px`;
      popoverBorder.innerHTML = generateSvgWithBottomArrow(
        popoverRect.width,
        popoverRect.height,
        arrowLeftPosOnPopover,
      );
    } else {
      // Position below element
      element.setAttribute("data-position", "below");
      popoverTopPos = Math.ceil(elementToFollowRect.bottom);
      popoverContentWrapper.style.marginTop = `${arrowHeight}px`;
      popoverContentWrapper.style.marginBottom = undefined;
      popoverBorder.style.top = `-${borderWidth + arrowHeight}px`;
      popoverBorder.style.bottom = `-${borderWidth}px`;
      popoverBorder.innerHTML = generateSvgWithTopArrow(
        popoverRect.width,
        popoverRect.height,
        arrowLeftPosOnPopover,
      );

      // Handle overflow at bottom with scrolling if needed
      if (!fitsBelow && !fitsAbove) {
        const availableHeight =
          viewportHeight -
          elementToFollowRect.bottom -
          arrowHeight -
          borderWidth * 2;
        if (availableHeight > 50) {
          popoverContent.style.maxHeight = `${availableHeight}px`;
          popoverContent.style.overflowY = "auto";
        }
      }
    }

    // Position the popover
    element.style.left = `${popoverLeftPos}px`;
    element.style.top = `${popoverTopPos}px`;
  };

  // Initial position calculation
  updatePosition();

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
        schedulePositionUpdate();
      } else {
        element.style.opacity = 0;
      }
    }, options);
    intersectionObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      intersectionObserver.disconnect();
    });
  }

  update_on_scroll: {
    const handleScroll = () => {
      schedulePositionUpdate();
    };

    const scrollableParentSet = getScrollableParentSet(elementToFollow);
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

  update_on_target_size_change: {
    const resizeObserver = new ResizeObserver(() => {
      schedulePositionUpdate();
    });
    resizeObserver.observe(elementToFollow);
    cleanupCallbackSet.add(() => {
      resizeObserver.unobserve(elementToFollow);
    });
  }

  return stop;
};

export const showPopover = (elementToFollow, innerHtml) => {
  const jsenvPopover = createPopover(innerHtml);
  jsenvPopover.style.opacity = "0";
  document.body.appendChild(jsenvPopover);
  const stopFollowingPosition = followPosition(jsenvPopover, elementToFollow);

  // Use requestAnimationFrame to ensure the popover is positioned before checking visibility
  requestAnimationFrame(() => {
    // Check if element is visible first
    const elementRect = elementToFollow.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // If element is not visible at all, no need to scroll
    const isElementVisible =
      elementRect.top < viewportHeight &&
      elementRect.bottom > 0 &&
      elementRect.left < viewportWidth &&
      elementRect.right > 0;

    if (isElementVisible) {
      // Element is at least partially visible, check popover visibility
      const popoverRect = jsenvPopover.getBoundingClientRect();

      // Check if popover is even partially out of view (by 1px or more)
      const isPartiallyOutOfViewHorizontally =
        popoverRect.left < 0 || popoverRect.right > viewportWidth;

      const isPartiallyOutOfViewVertically =
        popoverRect.top < 0 || popoverRect.bottom > viewportHeight;

      if (isPartiallyOutOfViewHorizontally || isPartiallyOutOfViewVertically) {
        // Scroll to make the popover fully visible
        jsenvPopover.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
      }
    }

    // Show the popover regardless of scrolling
    jsenvPopover.style.opacity = "1";
  });

  return () => {
    stopFollowingPosition();
    if (document.body.contains(jsenvPopover)) {
      document.body.removeChild(jsenvPopover);
    }
  };
};
