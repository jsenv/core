import {
  allowWheelThrough,
  createPubSub,
  createStyleController,
  getBorderSizes,
  pickPositionRelativeTo,
  visibleRectEffect,
} from "@jsenv/dom";

/**
 * A callout component that mimics native browser validation messages.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow points at the target element
 */

/**
 * Shows a callout attached to the specified element
 * @param {HTMLElement} targetElement - Element the callout should follow
 * @param {string} message - HTML content for the callout
 * @param {Object} options - Configuration options
 * @param {boolean} options.scrollIntoView - Whether to scroll the target element into view
 * @returns {Function} - Function to hide and remove the callout
 */
export const openCallout = (
  message,
  {
    anchor,
    // "info" | "warning" | "error"
    // "info": polite announcement
    // -> "This element cannot be modified"
    // "warning": expected failure, requires user attention, likely acitonable
    // -> "field is required"
    // "error": unexpected failure, requires user attention, might not be actionable
    // -> "Server error"
    level = "warning",
    onClose,
    closeOnClickOutside = level === "info",
    debug = false,
  } = {},
) => {
  const callout = {
    opened: true,
    close: null,
    level: undefined,

    update: null,
    updatePosition: null,

    element: null,
  };

  if (debug) {
    console.debug("open callout on", anchor, {
      message,
      level,
    });
  }

  const [teardown, addTeardown] = createPubSub(true);
  const close = (reason) => {
    if (!callout.opened) {
      return;
    }
    if (debug) {
      console.debug(`callout closed (reason: ${reason})`);
    }
    callout.opened = false;
    teardown(reason);
  };

  // Create and add callout to document
  const calloutElement = createCalloutElement();
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );
  const calloutCloseButton = calloutElement.querySelector(
    ".navi_callout_close_button",
  );
  calloutCloseButton.onclick = () => {
    close("click_close_button");
  };
  const calloutId = `navi_callout_${Date.now()}`;
  calloutElement.id = calloutId;
  calloutStyleController.set(calloutElement, { opacity: 0 });
  allowWheelThrough(calloutElement, anchor);
  anchor.setAttribute("data-callout", calloutId);
  addTeardown(() => {
    anchor.removeAttribute("data-callout");
  });

  const resetAccessibilityAttributes = () => {
    if (callout.level === "info") {
      anchor.removeAttribute("aria-describedby");
    } else {
      anchor.removeAttribute("aria-errormessage");
      anchor.removeAttribute("aria-invalid");
    }
  };
  const update = (newMessage, options = {}) => {
    // Connect callout with target element for accessibility
    if (options.level && options.level !== callout.level) {
      calloutElement.setAttribute("data-level", level);
      if (callout.level) {
        resetAccessibilityAttributes();
      }
      if (level === "info") {
        calloutElement.setAttribute("role", "status");
        anchor.setAttribute("aria-describedby", calloutId);
      } else {
        calloutElement.setAttribute("role", "alert");
        anchor.setAttribute("aria-errormessage", calloutId);
        anchor.setAttribute("aria-invalid", "true");
      }
      anchor.style.setProperty("--callout-color", `var(--navi-${level}-color)`);
      callout.level = level;
    }

    if (options.closeOnClickOutside) {
      closeOnClickOutside = options.closeOnClickOutside;
    }

    if (Error.isError(newMessage)) {
      const error = newMessage;
      newMessage = error.message;
      newMessage += `<pre class="navi_callout_error_stack">${escapeHtml(error.stack)}</pre>`;
    }
    calloutMessageElement.innerHTML = newMessage;
  };
  update(message, { level });
  addTeardown(() => {
    resetAccessibilityAttributes();
    anchor.style.removeProperty("--callout-color");
  });

  document.body.appendChild(calloutElement);
  addTeardown(() => {
    calloutElement.remove();
  });

  const positionFollower = stickCalloutToAnchor(calloutElement, anchor, {
    debug,
  });
  addTeardown(() => {
    positionFollower.stop();
  });

  if (onClose) {
    addTeardown(onClose);
  }
  close_on_target_focus: {
    const onfocus = () => {
      if (level === "error") {
        // error messages must be explicitely closed by the user
        return;
      }
      if (anchor.hasAttribute("data-callout-stay-on-focus")) {
        return;
      }
      close("target_element_focus");
    };
    anchor.addEventListener("focus", onfocus);
    addTeardown(() => {
      anchor.removeEventListener("focus", onfocus);
    });
  }

  close_on_click_outside: {
    const handleClickOutside = (event) => {
      if (!closeOnClickOutside) {
        return;
      }

      const clickTarget = event.target;
      if (
        clickTarget === calloutElement ||
        calloutElement.contains(clickTarget)
      ) {
        return;
      }
      // if (
      //   clickTarget === targetElement ||
      //   targetElement.contains(clickTarget)
      // ) {
      //   return;
      // }
      close("click_outside");
    };
    document.addEventListener("click", handleClickOutside, true);
    addTeardown(() => {
      document.removeEventListener("click", handleClickOutside, true);
    });
  }

  Object.assign(callout, {
    calloutElement,
    update,
    close,
    updatePosition: positionFollower.updatePosition,
  });
  anchor.callout = callout;
  addTeardown(() => {
    delete anchor.callout;
  });
  return callout;
};

// Configuration parameters for callout appearance
const BORDER_WIDTH = 1;
const CORNER_RADIUS = 3;
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const ARROW_SPACING = 8;

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-callout-background-color: white;
    }

    .navi_callout {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      display: block;
      height: auto;
      opacity: 0;
      /* will be positioned with transform: translate */
      transition: opacity 0.2s ease-in-out;
      overflow: visible;
    }

    .navi_callout_frame {
      position: absolute;
      filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
      pointer-events: none;
    }
    .navi_callout[data-level="info"] .navi_callout_border_path {
      fill: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_border_path {
      fill: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_border_path {
      fill: var(--navi-error-color);
    }
    .navi_callout_frame svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
    .navi_callout_background_path {
      fill: var(--navi-callout-background-color);
    }

    .navi_callout_box {
      position: relative;
      border-style: solid;
      border-color: transparent;
    }
    .navi_callout_body {
      position: relative;
      display: flex;
      max-width: 47vw;
      padding: 8px;
      flex-direction: row;
      gap: 10px;
    }
    .navi_callout_icon {
      display: flex;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      border-radius: 2px;
    }
    .navi_callout_icon_svg {
      width: 16px;
      height: 12px;
      color: white;
    }
    .navi_callout[data-level="info"] .navi_callout_icon {
      background-color: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_icon {
      background-color: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_icon {
      background-color: var(--navi-error-color);
    }
    .navi_callout_message {
      min-width: 0;
      align-self: center;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .navi_callout_close_button_column {
      display: flex;
      height: 22px;
    }
    .navi_callout_close_button {
      width: 1em;
      height: 1em;
      padding: 0;
      align-self: center;
      color: currentColor;
      font-size: inherit;
      background: none;
      border: none;
      border-radius: 0.2em;
      cursor: pointer;
    }
    .navi_callout_close_button:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    .navi_callout_close_button_svg {
      width: 100%;
      height: 100%;
    }
    .navi_callout_error_stack {
      max-height: 200px;
      overflow: auto;
    }
  }
`;

// HTML template for the callout
const calloutTemplate = /* html */ `
  <div class="navi_callout">
    <div class="navi_callout_box">
      <div class="navi_callout_frame"></div>
      <div class="navi_callout_body">
        <div class="navi_callout_icon">
          <svg
            class="navi_callout_icon_svg"
            viewBox="0 0 125 300"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="currentColor"
              d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
            />
          </svg>
        </div>
        <div class="navi_callout_message">Default message</div>
        <div class="navi_callout_close_button_column">
          <button class="navi_callout_close_button">
            <svg
              class="navi_callout_close_button_svg"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const calloutStyleController = createStyleController("callout");

/**
 * Generates SVG path for callout with arrow on top
 * @param {number} width - Callout width
 * @param {number} height - Callout height
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

  return /*html */ `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border_path" />
      <path d="${innerPath}" class="navi_callout_background_path" />
    </svg>`;
};

/**
 * Generates SVG path for callout with arrow on bottom
 * @param {number} width - Callout width
 * @param {number} height - Callout height
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

  return /*html */ `<svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border_path" />
      <path d="${innerPath}" class="navi_callout_background_path" />
    </svg>`;
};

/**
 * Creates a new callout element with specified content
 * @param {string} content - HTML content for the callout
 * @returns {HTMLElement} - The callout element
 */
const createCalloutElement = () => {
  const div = document.createElement("div");
  div.innerHTML = calloutTemplate;
  const calloutElement = div.firstElementChild;
  return calloutElement;
};

const stickCalloutToAnchor = (calloutElement, anchorElement) => {
  // Get references to callout parts
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Set initial border styles
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;

  const anchorVisibleRectEffect = visibleRectEffect(
    anchorElement,
    ({ left: anchorLeft, right: anchorRight, visibilityRatio }) => {
      // reset max height and overflow because it impacts the element size
      // and we need to re-check if we need to have an overflow or not.
      // to avoid visual impact we do this on an invisible clone.
      // It's ok to do this because the element is absolutely positioned
      const calloutElementClone = calloutElement.cloneNode(true);
      calloutElementClone.style.visibility = "hidden";
      const calloutMessageElementClone = calloutElementClone.querySelector(
        ".navi_callout_message",
      );
      calloutMessageElementClone.style.maxHeight = "";
      calloutMessageElementClone.style.overflowY = "";
      calloutElement.parentNode.appendChild(calloutElementClone);
      const {
        position,
        left: calloutLeft,
        top: calloutTop,
        width: calloutWidth,
        height: calloutHeight,
        spaceAboveTarget,
        spaceBelowTarget,
      } = pickPositionRelativeTo(calloutElementClone, anchorElement, {
        alignToViewportEdgeWhenTargetNearEdge: 20,
        // when fully to the left, the border color is collé to the browser window making it hard to see
        minLeft: 1,
      });

      // Calculate arrow position to point at anchor element
      let arrowLeftPosOnCallout;
      // Determine arrow target position based on attribute
      const arrowPositionAttribute = anchorElement.getAttribute(
        "data-callout-arrow-x",
      );
      let arrowAnchorLeft;
      if (arrowPositionAttribute === "center") {
        // Target the center of the anchor element
        arrowAnchorLeft = (anchorLeft + anchorRight) / 2;
      } else {
        const anchorBorderSizes = getBorderSizes(anchorElement);
        // Default behavior: target the left edge of the anchor element (after borders)
        arrowAnchorLeft = anchorLeft + anchorBorderSizes.left;
      }

      // Calculate arrow position within the callout
      if (calloutLeft < arrowAnchorLeft) {
        // Callout is left of the target point, move arrow right
        const diff = arrowAnchorLeft - calloutLeft;
        arrowLeftPosOnCallout = diff;
      } else if (calloutLeft + calloutWidth < arrowAnchorLeft) {
        // Edge case: target point is beyond right edge of callout
        arrowLeftPosOnCallout = calloutWidth - ARROW_WIDTH;
      } else {
        // Target point is within callout width
        arrowLeftPosOnCallout = arrowAnchorLeft - calloutLeft;
      }

      // Ensure arrow stays within callout bounds with some padding
      const minArrowPos = CORNER_RADIUS + ARROW_WIDTH / 2 + ARROW_SPACING;
      const maxArrowPos = calloutWidth - minArrowPos;
      arrowLeftPosOnCallout = Math.max(
        minArrowPos,
        Math.min(arrowLeftPosOnCallout, maxArrowPos),
      );

      // Force content overflow when there is not enough space to display
      // the entirety of the callout
      const spaceAvailable =
        position === "below" ? spaceBelowTarget : spaceAboveTarget;
      let spaceAvailableForContent = spaceAvailable;
      spaceAvailableForContent -= ARROW_HEIGHT;
      spaceAvailableForContent -= BORDER_WIDTH * 2;
      spaceAvailableForContent -= 16; // padding * 2
      let contentHeight = calloutHeight;
      contentHeight -= ARROW_HEIGHT;
      contentHeight -= BORDER_WIDTH * 2;
      contentHeight -= 16; // padding * 2
      const spaceRemainingAfterContent =
        spaceAvailableForContent - contentHeight;
      if (spaceRemainingAfterContent < 2) {
        const maxHeight = spaceAvailableForContent;
        calloutMessageElement.style.maxHeight = `${maxHeight}px`;
        calloutMessageElement.style.overflowY = "scroll";
      } else {
        calloutMessageElement.style.maxHeight = "";
        calloutMessageElement.style.overflowY = "";
      }

      const { width, height } = calloutElement.getBoundingClientRect();
      if (position === "above") {
        // Position above target element
        calloutBoxElement.style.marginTop = "";
        calloutBoxElement.style.marginBottom = `${ARROW_HEIGHT}px`;
        calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.innerHTML = generateSvgWithBottomArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      } else {
        calloutBoxElement.style.marginTop = `${ARROW_HEIGHT}px`;
        calloutBoxElement.style.marginBottom = "";
        calloutFrameElement.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;
        calloutFrameElement.innerHTML = generateSvgWithTopArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      }

      calloutElement.setAttribute("data-position", position);
      calloutStyleController.set(calloutElement, {
        opacity: visibilityRatio ? 1 : 0,
        transform: {
          translateX: calloutLeft,
          translateY: calloutTop,
        },
      });
      calloutElementClone.remove();
    },
  );
  const calloutSizeChangeObserver = observeCalloutSizeChange(
    calloutMessageElement,
    (width, height) => {
      anchorVisibleRectEffect.check(`callout_size_change (${width}x${height})`);
    },
  );
  anchorVisibleRectEffect.onBeforeAutoCheck(() => {
    // prevent feedback loop because check triggers size change which triggers check...
    calloutSizeChangeObserver.disable();
    return () => {
      calloutSizeChangeObserver.enable();
    };
  });

  return {
    updatePosition: anchorVisibleRectEffect.check,
    stop: () => {
      calloutSizeChangeObserver.disconnect();
      anchorVisibleRectEffect.disconnect();
    },
  };
};

const observeCalloutSizeChange = (elementSizeToObserve, callback) => {
  let lastContentWidth;
  let lastContentHeight;
  const resizeObserver = new ResizeObserver((entries) => {
    const [entry] = entries;
    const { width, height } = entry.contentRect;
    // Debounce tiny changes that are likely sub-pixel rounding
    if (lastContentWidth !== undefined) {
      const widthDiff = Math.abs(width - lastContentWidth);
      const heightDiff = Math.abs(height - lastContentHeight);
      const threshold = 1; // Ignore changes smaller than 1px
      if (widthDiff < threshold && heightDiff < threshold) {
        return;
      }
    }
    lastContentWidth = width;
    lastContentHeight = height;
    callback(width, height);
  });
  resizeObserver.observe(elementSizeToObserve);

  return {
    disable: () => {
      resizeObserver.unobserve(elementSizeToObserve);
    },
    enable: () => {
      resizeObserver.observe(elementSizeToObserve);
    },
    disconnect: () => {
      resizeObserver.disconnect();
    },
  };
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
