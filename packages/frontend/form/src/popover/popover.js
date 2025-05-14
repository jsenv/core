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

.popover_content-wrapper {
  position: relative;
  padding-top: 8px;    /* Space for top arrow */
  padding-bottom: 8px; /* Space for bottom arrow */
}

.popover_content {
  position: relative;
  padding: 5px;
  border: 1px solid #333;
  background: white;
  border-radius: 3px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

/* Top arrow container - shown when popover is below element */
.popover_arrow-top-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 0;
  overflow: visible;
  z-index: 2;
}

.popover_arrow-top {
  position: absolute;
  top: 0px;
  left: 50%;
  transform: translateX(-50%) translateY(-100%);
}

/* Bottom arrow container - shown when popover is above the element */
.popover_arrow-bottom-container {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0;
  overflow: visible;
  z-index: 2;
}

.popover_arrow-bottom {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%) translateY(100%) rotate(180deg);
}
`;

const svgArrow = `<svg width="16" height="8" viewBox="0 0 16 8" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 0L16 8H0L8 0Z" fill="white"/>
  <path d="M8 0L16 8H0L8 0Z" stroke="#333" stroke-width="1" fill="none"/>
</svg>`;

const html = /* html */ `
  <div class="popover">
    <style>
      ${css}
    </style>
    <div class="popover_content-wrapper">
      <!-- Top arrow container - shown when popover is below element -->
      <div class="popover_arrow-top-container">
        <div class="popover_arrow-top">${svgArrow}</div>
      </div>

      <!-- The actual popover content -->
      <div class="popover_content">
        <div class="popover_content-inner">Default message</div>
      </div>

      <!-- Bottom arrow container - shown when popover is above element -->
      <div class="popover_arrow-bottom-container">
        <div class="popover_arrow-bottom">${svgArrow}</div>
      </div>
    </div>
  </div>
`;

const createPopover = (content) => {
  const div = document.createElement("div");
  div.innerHTML = html;
  const popover = div.querySelector(".popover");
  const contentElement = popover.querySelector(".popover_content-inner");
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

  const arrowTopContainer = element.querySelector(
    ".popover_arrow-top-container",
  );
  const arrowBottomContainer = element.querySelector(
    ".popover_arrow-bottom-container",
  );
  const arrowTop = element.querySelector(".popover_arrow-top");
  const arrowBottom = element.querySelector(".popover_arrow-bottom");

  const updatePosition = () => {
    const elementRect = elementToFollow.getBoundingClientRect();
    element.style.position = "fixed";

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const popoverHeight = element.offsetHeight;
    const margin = 20; // Small margin for visual spacing
    const isNearBottom =
      elementRect.bottom + popoverHeight + margin > viewportHeight;

    // Show/hide appropriate arrow based on position
    if (isNearBottom) {
      // Position above the element instead of below
      element.style.top = `${elementRect.top - element.offsetHeight}px`;
      arrowTopContainer.style.display = "none";
      arrowBottomContainer.style.display = "block";
    } else {
      element.style.top = `${elementRect.bottom}px`;
      arrowTopContainer.style.display = "block";
      arrowBottomContainer.style.display = "none";
    }

    // Calculate the ideal horizontal position (centered)
    let leftPos = elementRect.left + elementRect.width / 2;
    const popoverWidth = element.offsetWidth;
    const halfPopoverWidth = popoverWidth / 2;

    // Ensure popover doesn't go outside viewport on left or right
    if (leftPos - halfPopoverWidth < 0) {
      leftPos = halfPopoverWidth;
    } else if (leftPos + halfPopoverWidth > viewportWidth) {
      leftPos = viewportWidth - halfPopoverWidth;
    }

    // Update arrow horizontal position to point at the element
    const targetCenter = elementRect.left + elementRect.width / 2;
    const popoverLeft = leftPos - halfPopoverWidth;
    const arrowPos = targetCenter - popoverLeft;

    // Constrain arrow position to stay within popover bounds
    const arrowMin = 8; // Min distance from edge
    const arrowMax = popoverWidth - 8;
    const constrainedArrowPos = Math.max(
      arrowMin,
      Math.min(arrowPos, arrowMax),
    );

    arrowTop.style.left = `${constrainedArrowPos}px`;
    arrowBottom.style.left = `${constrainedArrowPos}px`;

    // Position the popover
    element.style.left = `${leftPos}px`;
    element.style.transform = "translateX(-50%)";
  };

  updatePosition();

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
