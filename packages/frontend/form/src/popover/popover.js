import { getScrollableParentSet } from "@jsenv/dom";

const css = /*css*/ `
.popover {
  display: block;
  overflow: visible;
  height: auto;
  position: relative;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.popover_border {
  position: absolute;
  top: 0px;
  left: -10px;
  right: -10px;
  bottom: -10px;
  pointer-events: none;
}
.popover_border-top, .popover_border-bottom {
  display: none;
}

.popover_content_wrapper {
  border-width: 10px; /* bordeer size */
  border-style: solid;
  border-color: transparent;
  position: relative;
  padding-top: 10px; /* Arrow size  */
}
.popover_content {
  padding: 5px;
  position: relative;
  border-radius: 3px;
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
const radius = 0;
const borderWidth = 10;

const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  // Ensure arrow position is within boundaries
  const minArrowPos = arrowWidth / 2 + radius;
  const maxArrowPos = width - arrowWidth / 2 - radius;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Create different path depending on whether radius is 0 or not
  let path;

  if (radius === 0) {
    // Path with sharp corners (no radius)
    path = `
      M0,${arrowHeight} 
      H${constrainedArrowPos - arrowWidth / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      H${width} 
      V${height + arrowHeight} 
      H0 
      V${arrowHeight}
    `;
  } else {
    // Path with rounded corners
    path = `
      M${radius},${arrowHeight} 
      H${constrainedArrowPos - arrowWidth / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      H${width - radius} 
      Q${width},${arrowHeight} ${width},${arrowHeight + radius} 
      V${height + arrowHeight - radius} 
      Q${width},${height + arrowHeight} ${width - radius},${height + arrowHeight} 
      H${radius} 
      Q0,${height + arrowHeight} 0,${height + arrowHeight - radius} 
      V${arrowHeight + radius} 
      Q0,${arrowHeight} ${radius},${arrowHeight}
    `;
  }

  return `<svg width="${width}" height="${height + arrowHeight}" viewBox="0 0 ${width} ${height + arrowHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${path}" fill="white" stroke="#333" stroke-width="${borderWidth}" />
  </svg>`;
};

const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  // Ensure arrow position is within boundaries
  const minArrowPos = arrowWidth / 2 + radius;
  const maxArrowPos = width - arrowWidth / 2 - radius;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Create different path depending on whether radius is 0 or not
  let path;

  if (radius === 0) {
    // Path with sharp corners (no radius)
    path = `
      M0,0 
      H${width} 
      V${height} 
      H${constrainedArrowPos + arrowWidth / 2} 
      L${constrainedArrowPos},${height + arrowHeight} 
      L${constrainedArrowPos - arrowWidth / 2},${height} 
      H0 
      V0
    `;
  } else {
    // Path with rounded corners
    path = `
      M${radius},0 
      H${width - radius} 
      Q${width},0 ${width},${radius} 
      V${height - radius} 
      Q${width},${height} ${width - radius},${height} 
      H${constrainedArrowPos + arrowWidth / 2} 
      L${constrainedArrowPos},${height + arrowHeight} 
      L${constrainedArrowPos - arrowWidth / 2},${height} 
      H${radius} 
      Q0,${height} 0,${height - radius} 
      V${radius} 
      Q0,0 ${radius},0
    `;
  }

  return `<svg width="${width}" height="${height + arrowHeight}" viewBox="0 0 ${width} ${height + arrowHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="${path}" fill="white" stroke="#333" stroke-width="${borderWidth}" />
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

  const border = element.querySelector(".popover_border");
  const popoverContent = element.querySelector(".popover_content");

  // Arrow dimensions
  const arrowHeight = 8;

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    element.style.position = "fixed";

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const contentWidth = popoverContent.offsetWidth;
    const contentHeight = popoverContent.offsetHeight;
    const margin = 20; // Small margin for visual spacing
    const isNearBottom =
      elementRect.bottom + contentHeight + arrowHeight + margin >
      viewportHeight;

    // Calculate the ideal horizontal position (centered)
    let leftPos = elementRect.left + elementRect.width / 2;
    const halfContentWidth = contentWidth / 2;

    // Define arrow constraints
    const minArrowPos = arrowWidth / 2 + radius + 9; // Minimum safe arrow position from edge

    // Step 1: Calculate popover position (constrained by viewport if needed)
    if (leftPos - halfContentWidth < 0) {
      // Popover is constrained on the left edge
      leftPos = halfContentWidth;
    } else if (leftPos + halfContentWidth > viewportWidth) {
      // Popover is constrained on the right edge
      leftPos = viewportWidth - halfContentWidth;
    }
    // Otherwise popover is not constrained by viewport edges

    // Step 2: Calculate where the arrow should point
    // Use the left edge of the element (plus a small margin) instead of center
    const targetLeftEdge = elementRect.left + 10; // 10px from left edge of target
    const popoverLeft = leftPos - halfContentWidth;

    // Calculate arrow position relative to popover to point at target's left edge
    let arrowPos = targetLeftEdge - popoverLeft;

    // Step 3: Constrain arrow position within valid bounds
    const maxArrowPos = contentWidth - minArrowPos;
    arrowPos = Math.max(minArrowPos, Math.min(arrowPos, maxArrowPos));

    // Position based on whether it's above or below the element
    if (isNearBottom) {
      element.setAttribute("data-position", "above");
      // Position above the element, accounting for the larger border
      element.style.top = `${elementRect.top - contentHeight - arrowHeight - 2 * borderWidth}px`;
      border.innerHTML = generateSvgWithBottomArrow(
        contentWidth,
        contentHeight,
        arrowPos,
      );
    } else {
      element.setAttribute("data-position", "below");
      // Position below the element, accounting for the larger border
      element.style.top = `${elementRect.bottom}px`;
      border.innerHTML = generateSvgWithTopArrow(
        contentWidth,
        contentHeight,
        arrowPos,
      );
    }

    // Position the popover
    element.style.left = `${leftPos}px`;
    element.style.transform = "translateX(-50%)";
  };

  // Initial position calculation
  updatePosition();

  // Set up resize observer to update SVG when content size changes
  const resizeObserverContent = new ResizeObserver(() => {
    updatePosition();
  });
  resizeObserverContent.observe(element.querySelector(".popover_content"));
  cleanupCallbackSet.add(() => {
    resizeObserverContent.disconnect();
  });

  let rafId = null;
  const schedulePositionUpdate = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(updatePosition);
  };
  cleanupCallbackSet.add(() => {
    cancelAnimationFrame(rafId);
  });

  update_after_visibility_change: {
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

  update_after_scroll: {
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

  update_after_resize: {
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

  return () => {
    stopFollowingPosition();
    if (document.body.contains(jsenvPopover)) {
      document.body.removeChild(jsenvPopover);
    }
  };
};
