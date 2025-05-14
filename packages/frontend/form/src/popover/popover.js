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
  pointer-events: none;
}
.popover_border-top, .popover_border-bottom {
  display: none;
}

.popover_content_wrapper {
  border-style: solid;
  border-color: transparent;
  position: relative;
}
.popover_content {
  /* padding: 5px; */
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
const arrowHeight = 12; // Increased from 8 to 12 for a more pronounced arrow
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

  // Adjust the SVG viewBox and path to account for the border width
  const halfBorder = borderWidth / 2;
  const adjustedWidth = width;
  const adjustedHeight = height + arrowHeight;

  let path;

  if (radius === 0) {
    // Path with sharp corners (no radius)
    // Make the top arrow more pronounced by increasing its height
    path = `M${halfBorder},${arrowHeight} 
      L${constrainedArrowPos - arrowWidth / 2},${arrowHeight} 
      L${constrainedArrowPos},${halfBorder} 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      L${width - halfBorder},${arrowHeight} 
      L${width - halfBorder},${height + arrowHeight - halfBorder} 
      L${halfBorder},${height + arrowHeight - halfBorder} 
      Z`;
  } else {
    // Path with rounded corners
    path = `
      M${radius + halfBorder},${arrowHeight} 
      H${constrainedArrowPos - arrowWidth / 2} 
      L${constrainedArrowPos},${halfBorder} 
      L${constrainedArrowPos + arrowWidth / 2},${arrowHeight} 
      H${width - radius - halfBorder} 
      Q${width - halfBorder},${arrowHeight} ${width - halfBorder},${arrowHeight + radius} 
      V${height + arrowHeight - radius - halfBorder} 
      Q${width - halfBorder},${height + arrowHeight - halfBorder} ${width - radius - halfBorder},${height + arrowHeight - halfBorder} 
      H${radius + halfBorder} 
      Q${halfBorder},${height + arrowHeight - halfBorder} ${halfBorder},${height + arrowHeight - radius - halfBorder} 
      V${arrowHeight + radius} 
      Q${halfBorder},${arrowHeight} ${radius + halfBorder},${arrowHeight}
    `;
  }

  return `<svg
    width="${adjustedWidth}"
    height="${adjustedHeight}"
    viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
>
    <path
      d="${path}"
      fill="white"
      stroke="#333"
      stroke-width="${borderWidth}"
      stroke-linejoin="round"
      stroke-linecap="square"
    />
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

  // Adjust for border width
  const halfBorder = borderWidth / 2;
  const adjustedWidth = width;
  const adjustedHeight = height + arrowHeight;

  let path;

  if (radius === 0) {
    // Path with sharp corners (no radius)
    path = `M${halfBorder},${halfBorder} 
      L${width - halfBorder},${halfBorder} 
      L${width - halfBorder},${height - halfBorder} 
      L${constrainedArrowPos + arrowWidth / 2},${height - halfBorder} 
      L${constrainedArrowPos},${height + arrowHeight - halfBorder} 
      L${constrainedArrowPos - arrowWidth / 2},${height - halfBorder} 
      L${halfBorder},${height - halfBorder} 
      Z`;
  } else {
    // Path with rounded corners
    path = `
      M${radius + halfBorder},${halfBorder} 
      H${width - radius - halfBorder} 
      Q${width - halfBorder},${halfBorder} ${width - halfBorder},${radius + halfBorder} 
      V${height - radius - halfBorder} 
      Q${width - halfBorder},${height - halfBorder} ${width - radius - halfBorder},${height - halfBorder} 
      H${constrainedArrowPos + arrowWidth / 2} 
      L${constrainedArrowPos},${height + arrowHeight - halfBorder} 
      L${constrainedArrowPos - arrowWidth / 2},${height - halfBorder} 
      H${radius + halfBorder} 
      Q${halfBorder},${height - halfBorder} ${halfBorder},${height - radius - halfBorder} 
      V${radius + halfBorder} 
      Q${halfBorder},${halfBorder} ${radius + halfBorder},${halfBorder}
    `;
  }

  return `<svg
    width="${adjustedWidth}"
    height="${adjustedHeight}"
    viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="${path}"
      fill="white"
      stroke="#333"
      stroke-width="${borderWidth}"
      stroke-linejoin="round"
      stroke-linecap="square"
    />
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
  popoverContentWrapper.style.marginTop = `${arrowHeight}px`;

  popoverBorder.style.top = `-${borderWidth + arrowHeight}px`;
  popoverBorder.style.bottom = `-${borderWidth}px`;
  popoverBorder.style.left = `-${borderWidth}px`;
  popoverBorder.style.right = `-${borderWidth}px`;

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
      // Position above the element, accounting for the larger border and taller arrow
      element.style.top = `${elementRect.top - contentHeight - arrowHeight - 2 * borderWidth}px`;
      popoverBorder.innerHTML = generateSvgWithBottomArrow(
        popoverBorder.offsetWidth,
        popoverBorder.offsetHeight,
        arrowPos,
      );
    } else {
      element.setAttribute("data-position", "below");
      // Position below the element with taller arrow
      element.style.top = `${elementRect.bottom}px`;
      popoverBorder.innerHTML = generateSvgWithTopArrow(
        popoverBorder.offsetWidth,
        popoverBorder.offsetHeight,
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
  resizeObserverContent.observe(popoverContentWrapper);
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
