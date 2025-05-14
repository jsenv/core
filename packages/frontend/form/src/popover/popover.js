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
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.popover_border-top, .popover_border-bottom {
  display: none;
}

.popover_content_wrapper {
  border-width: 1px;
  border-style: solid;
  border-color: transparent;
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

.popover[data-position="below"] .popover_border-top {
  display: block;
}
.popover[data-position="below"] .popover_border-bottom {
  display: block;
}  
.popover[data-position="below"] .popover_content_wrapper {
  padding-top: 6px;
}
.popover[data-position="above"] .popover_content_wrapper {
  padding-bottom: 6px;
}
`;

const styleElement = document.createElement("style");
styleElement.textContent = css;
document.head.appendChild(styleElement);

// Function to generate SVG with arrow at bottom
const generateSvgWithBottomArrow = (width, height) => {
  const arrowWidth = 16;
  const arrowHeight = 8;
  const arrowPosition = width / 2;
  const radius = 3;

  return `<svg width="${width}" height="${height + arrowHeight}" viewBox="0 0 ${width} ${height + arrowHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="
      M${radius},0 
      H${width - radius} 
      Q${width},0 ${width},${radius} 
      V${height - radius} 
      Q${width},${height} ${width - radius},${height} 
      H${arrowPosition + arrowWidth / 2} 
      L${arrowPosition},${height + arrowHeight} 
      L${arrowPosition - arrowWidth / 2},${height} 
      H${radius} 
      Q0,${height} 0,${height - radius} 
      V${radius} 
      Q0,0 ${radius},0
    " 
    fill="white" stroke="#333" stroke-width="1" />
  </svg>`;
};

// Function to generate SVG with arrow at top
const generateSvgWithTopArrow = (width, height) => {
  const arrowWidth = 16;
  const arrowHeight = 8;
  const arrowPosition = width / 2;
  const radius = 3;

  return `<svg width="${width}" height="${height + arrowHeight}" viewBox="0 0 ${width} ${height + arrowHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="
      M${radius},${arrowHeight} 
      H${arrowPosition - arrowWidth / 2} 
      L${arrowPosition},0 
      L${arrowPosition + arrowWidth / 2},${arrowHeight} 
      H${width - radius} 
      Q${width},${arrowHeight} ${width},${arrowHeight + radius} 
      V${height + arrowHeight - radius} 
      Q${width},${height + arrowHeight} ${width - radius},${height + arrowHeight} 
      H${radius} 
      Q0,${height + arrowHeight} 0,${height + arrowHeight - radius} 
      V${arrowHeight + radius} 
      Q0,${arrowHeight} ${radius},${arrowHeight}
    " 
    fill="white" stroke="#333" stroke-width="1" />
  </svg>`;
};

const html = /* html */ `
  <div class="popover">
    <div class="popover_border">
      <div class="popover_border-top"></div>
      <div class="popover_border-bottom"></div>
    </div>
    <div class="popover_content_wrapper">
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

  const borderTop = element.querySelector(".popover_border-top");
  const borderBottom = element.querySelector(".popover_border-bottom");
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

    // Position based on whether it's above or below the element
    if (isNearBottom) {
      element.setAttribute("data-position", "above");
      // Position above the element
      element.style.top = `${elementRect.top - contentHeight - arrowHeight}px`;
    } else {
      element.setAttribute("data-position", "below");
      // Position below the element
      element.style.top = `${elementRect.bottom}px`;
    }

    // Calculate the ideal horizontal position (centered)
    let leftPos = elementRect.left + elementRect.width / 2;
    const halfContentWidth = contentWidth / 2;

    // Ensure popover doesn't go outside viewport on left or right
    if (leftPos - halfContentWidth < 0) {
      leftPos = halfContentWidth;
    } else if (leftPos + halfContentWidth > viewportWidth) {
      leftPos = viewportWidth - halfContentWidth;
    }

    // Position the popover
    element.style.left = `${leftPos}px`;
    element.style.transform = "translateX(-50%)";
  };

  const contentWidth = popoverContent.offsetWidth;
  const contentHeight = popoverContent.offsetHeight;
  borderTop.innerHTML = generateSvgWithTopArrow(contentWidth, contentHeight);
  borderBottom.innerHTML = generateSvgWithBottomArrow(
    contentWidth,
    contentHeight,
  );

  // Initial position calculation
  updatePosition();

  // Set up resize observer to update SVG when content size changes
  const resizeObserverContent = new ResizeObserver(() => {
    const popoverContent = element.querySelector(".popover_content");
    const contentWidth = popoverContent.offsetWidth;
    const contentHeight = popoverContent.offsetHeight;

    borderTop.innerHTML = generateSvgWithTopArrow(contentWidth, contentHeight);
    borderBottom.innerHTML = generateSvgWithBottomArrow(
      contentWidth,
      contentHeight,
    );
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
