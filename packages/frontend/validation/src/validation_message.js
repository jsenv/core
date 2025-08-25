import { getBorderSizes, getScrollableParentSet } from "@jsenv/dom";

/**
 * A validation message component that mimics native browser validation messages.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow points at the target element
 */

/**
 * Shows a validation message attached to the specified element
 * @param {HTMLElement} targetElement - Element the validation message should follow
 * @param {string} message - HTML content for the validation message
 * @param {Object} options - Configuration options
 * @param {boolean} options.scrollIntoView - Whether to scroll the target element into view
 * @returns {Function} - Function to hide and remove the validation message
 */

import.meta.css = /* css */ `
  .validation_message {
    display: block;
    overflow: visible;
    height: auto;
    position: fixed;
    z-index: 1;
    opacity: 0;
    transition: opacity 0.2s ease-in-out;
  }

  .validation_message_border {
    position: absolute;
    pointer-events: none;
    filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
  }

  .validation_message_body_wrapper {
    border-style: solid;
    border-color: transparent;
    position: relative;
  }

  .validation_message_body {
    padding: 8px;
    position: relative;
    max-width: 47vw;
    display: flex;
    flex-direction: row;
    gap: 10px;
  }

  .validation_message_icon {
    display: flex;
    align-self: flex-start;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .validation_message_exclamation_svg {
    width: 16px;
    height: 12px;
    color: white;
  }

  .validation_message[data-level="info"] .validation_message_icon {
    background-color: #2196f3;
  }
  .validation_message[data-level="warning"] .validation_message_icon {
    background-color: #ff9800;
  }
  .validation_message[data-level="error"] .validation_message_icon {
    background-color: #f44336;
  }

  .validation_message_content {
    align-self: center;
    word-break: break-word;
  }

  .validation_message_border svg {
    position: absolute;
    inset: 0;
    overflow: visible;
  }

  .border_path {
    fill: var(--border-color);
  }

  .background_path {
    fill: var(--background-color);
  }

  .validation_message_close_button_column {
    display: flex;
    height: 22px;
  }
  .validation_message_close_button {
    border: none;
    background: none;
    padding: 0;
    width: 1em;
    height: 1em;
    font-size: inherit;
    cursor: pointer;
    border-radius: 0.2em;
    align-self: center;
    color: currentColor;
  }
  .validation_message_close_button:hover {
    background: rgba(0, 0, 0, 0.1);
  }
  .close_svg {
    width: 100%;
    height: 100%;
  }

  .error_stack {
    overflow: auto;
    max-height: 200px;
  }
`;

// HTML template for the validation message
const validationMessageTemplate = /* html */ `
  <div
    class="validation_message"
    role="alert"
    aria-live="assertive"
  >
    <div class="validation_message_body_wrapper">
      <div class="validation_message_border"></div>
      <div class="validation_message_body">
        <div class="validation_message_icon">
          <svg
            class="validation_message_exclamation_svg"
            viewBox="0 0 125 300"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="currentColor"
              d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
            />
          </svg>
        </div>
        <div class="validation_message_content">Default message</div>
        <div class="validation_message_close_button_column">
          <button class="validation_message_close_button">
            <svg
              class="close_svg"
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

export const openValidationMessage = (
  targetElement,
  message,
  {
    level = "warning",
    onClose,
    closeOnClickOutside = level === "info",
    canClickThrough = level === "info",
    debug = false,
  } = {},
) => {
  let _closeOnClickOutside = closeOnClickOutside;

  if (debug) {
    console.debug("open validation message on", targetElement, {
      message,
      level,
    });
  }

  let opened = true;
  const closeCallbackSet = new Set();
  const close = (reason) => {
    if (!opened) {
      return;
    }
    if (debug) {
      console.debug(`validation message closed (reason: ${reason})`);
    }
    opened = false;
    for (const closeCallback of closeCallbackSet) {
      closeCallback();
    }
    closeCallbackSet.clear();
  };

  // Create and add validation message to document
  const jsenvValidationMessage = createValidationMessage();
  const jsenvValidationMessageContent = jsenvValidationMessage.querySelector(
    ".validation_message_content",
  );
  const jsenvValidationMessageCloseButton =
    jsenvValidationMessage.querySelector(".validation_message_close_button");
  jsenvValidationMessageCloseButton.onclick = () => {
    close("click_close_button");
  };

  const update = (
    newMessage,
    {
      level = "warning",
      closeOnClickOutside = level === "info",
      canClickThrough = level === "info",
    } = {},
  ) => {
    _closeOnClickOutside = closeOnClickOutside;
    const borderColor =
      level === "info" ? "blue" : level === "warning" ? "grey" : "red";
    const backgroundColor = "white";

    jsenvValidationMessage.style.pointerEvents = canClickThrough
      ? "none"
      : "auto";
    jsenvValidationMessage.style.setProperty("--border-color", borderColor);
    jsenvValidationMessage.style.setProperty(
      "--background-color",
      backgroundColor,
    );

    if (Error.isError(newMessage)) {
      const error = newMessage;
      newMessage = error.message;
      newMessage += `<pre class="error_stack">${escapeHtml(error.stack)}</pre>`;
    }

    jsenvValidationMessage.setAttribute("data-level", level);
    jsenvValidationMessageContent.innerHTML = newMessage;
  };
  update(message, { level });

  jsenvValidationMessage.style.opacity = "0";

  jsenvValidationMessage.style.pointerEvents = canClickThrough
    ? "none"
    : "auto";

  // Connect validation message with target element for accessibility
  const validationMessageId = `validation_message-${Date.now()}`;
  jsenvValidationMessage.id = validationMessageId;
  targetElement.setAttribute("aria-invalid", "true");
  targetElement.setAttribute("aria-errormessage", validationMessageId);
  closeCallbackSet.add(() => {
    targetElement.removeAttribute("aria-invalid");
    targetElement.removeAttribute("aria-errormessage");
  });

  document.body.appendChild(jsenvValidationMessage);
  closeCallbackSet.add(() => {
    if (document.body.contains(jsenvValidationMessage)) {
      document.body.removeChild(jsenvValidationMessage);
    }
  });

  const positionFollower = followPosition(
    jsenvValidationMessage,
    targetElement,
    { debug },
  );
  closeCallbackSet.add(() => {
    positionFollower.stop();
  });

  if (onClose) {
    closeCallbackSet.add(onClose);
  }
  close_on_target_focus: {
    const onfocus = () => {
      if (level === "error") {
        // error messages must be explicitely closed by the user
        return;
      }
      if (targetElement.hasAttribute("data-validation-message-stay-on-focus")) {
        return;
      }
      close("target_element_focus");
    };
    targetElement.addEventListener("focus", onfocus);
    closeCallbackSet.add(() => {
      targetElement.removeEventListener("focus", onfocus);
    });
  }

  close_on_click_outside: {
    const handleClickOutside = (event) => {
      if (!_closeOnClickOutside) {
        return;
      }

      const clickTarget = event.target;
      if (
        clickTarget === jsenvValidationMessage ||
        jsenvValidationMessage.contains(clickTarget)
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
    closeCallbackSet.add(() => {
      document.removeEventListener("click", handleClickOutside, true);
    });
  }

  const validationMessage = {
    jsenvValidationMessage,
    update,
    close,
    updatePosition: positionFollower.updatePosition,
  };
  targetElement.jsenvValidationMessage = validationMessage;
  closeCallbackSet.add(() => {
    delete targetElement.jsenvValidationMessage;
  });
  return validationMessage;
};

// Configuration parameters for validation message appearance
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const CORNER_RADIUS = 3;
const BORDER_WIDTH = 1;
const ARROW_SPACING = 8;

/**
 * Generates SVG path for validation message with arrow on top
 * @param {number} width - Validation message width
 * @param {number} height - Validation message height
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
      <path d="${outerPath}" class="border_path" />
      <path d="${innerPath}" class="background_path" />
    </svg>`;
};

/**
 * Generates SVG path for validation message with arrow on bottom
 * @param {number} width - Validation message width
 * @param {number} height - Validation message height
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
      <path d="${outerPath}" class="border_path" />
      <path d="${innerPath}" class="background_path" />
    </svg>`;
};

/**
 * Creates a new validation message element with specified content
 * @param {string} content - HTML content for the validation message
 * @returns {HTMLElement} - The validation message element
 */
const createValidationMessage = () => {
  const div = document.createElement("div");
  div.innerHTML = validationMessageTemplate;
  const validationMessage = div.querySelector(".validation_message");
  return validationMessage;
};

/**
 * Sets up position tracking between a validation message and its target element
 * @param {HTMLElement} validationMessage - The validation message element
 * @param {HTMLElement} targetElement - The element the validation message should follow
 * @returns {Function} - Cleanup function to stop position tracking
 */
const followPosition = (validationMessage, targetElement, { debug }) => {
  const cleanupCallbackSet = new Set();
  const stop = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  // Get references to validation message parts
  const validationMessageBodyWrapper = validationMessage.querySelector(
    ".validation_message_body_wrapper",
  );
  const validationMessageBorder = validationMessage.querySelector(
    ".validation_message_border",
  );
  const validationMessageContent = validationMessage.querySelector(
    ".validation_message_content",
  );

  // Set initial border styles
  validationMessageBodyWrapper.style.borderWidth = `${BORDER_WIDTH}px`;
  validationMessageBorder.style.left = `-${BORDER_WIDTH}px`;
  validationMessageBorder.style.right = `-${BORDER_WIDTH}px`;

  /**
   * Update validation message position relative to target element
   * This is called on scroll, resize, and other events
   */
  const updatePosition = () => {
    // Get viewport and element dimensions
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const contentHeight = validationMessageContent.offsetHeight;
    const validationMessageRect =
      validationMessageBorder.getBoundingClientRect();
    const targetElementRect = targetElement.getBoundingClientRect();

    // Get element padding and border to properly position arrow
    const elementBorderSizes = getBorderSizes(targetElement);
    const elementLeft = targetElementRect.left;
    const elementWidth = targetElementRect.width;
    const validationMessageWidth = validationMessageRect.width;

    // Determine horizontal position based on element size and position
    let validationMessageLeftPos;

    // Handle extra-wide elements (wider than viewport)
    if (elementWidth > viewportWidth) {
      const elementRight = targetElementRect.right;
      const elementLeft = targetElementRect.left;
      if (elementRight < viewportWidth) {
        // Element extends beyond left edge but right side is visible
        const viewportCenter = viewportWidth / 2;
        const diff = viewportWidth - elementRight;
        validationMessageLeftPos =
          viewportCenter - diff / 2 - validationMessageWidth / 2;
      } else if (elementLeft > 0) {
        // Element extends beyond right edge but left side is visible
        const viewportCenter = viewportWidth / 2;
        const diff = -elementLeft;
        validationMessageLeftPos =
          viewportCenter - diff / 2 - validationMessageWidth / 2;
      } else {
        // Element extends beyond both edges
        validationMessageLeftPos =
          viewportWidth / 2 - validationMessageWidth / 2;
      }
    } else {
      // Standard case: element within viewport width
      // Center the validation message relative to the element
      validationMessageLeftPos =
        elementLeft + elementWidth / 2 - validationMessageWidth / 2;

      // If validation message is wider than element, adjust position based on document boundaries
      if (validationMessageWidth > elementWidth) {
        // If element is near left edge, align validation message with document left
        if (elementLeft < 20) {
          validationMessageLeftPos = 0;
        }
      }
    }

    // Constrain to document boundaries
    if (validationMessageLeftPos < 0) {
      validationMessageLeftPos = 0;
    } else if (
      validationMessageLeftPos + validationMessageWidth >
      viewportWidth
    ) {
      validationMessageLeftPos = viewportWidth - validationMessageRect.width;
    }

    // Calculate arrow position to point at target element
    let arrowLeftPosOnValidationMessage;
    // Determine arrow target position based on attribute
    const arrowPositionAttribute = targetElement.getAttribute(
      "data-validation-message-arrow-x",
    );
    let arrowTargetLeft;

    if (arrowPositionAttribute === "center") {
      // Target the center of the element
      arrowTargetLeft = elementLeft + elementWidth / 2;
    } else {
      // Default behavior: target the left edge of the element (after borders)
      arrowTargetLeft = elementLeft + elementBorderSizes.left;
    }

    // Calculate arrow position within the validation message
    if (validationMessageLeftPos < arrowTargetLeft) {
      // Validation message is left of the target point, move arrow right
      const diff = arrowTargetLeft - validationMessageLeftPos;
      arrowLeftPosOnValidationMessage = diff;
    } else if (
      validationMessageLeftPos + validationMessageWidth <
      arrowTargetLeft
    ) {
      // Edge case: target point is beyond right edge of validation message
      arrowLeftPosOnValidationMessage = validationMessageWidth - ARROW_WIDTH;
    } else {
      // Target point is within validation message width
      arrowLeftPosOnValidationMessage =
        arrowTargetLeft - validationMessageLeftPos;
    }

    // Ensure arrow stays within validation message bounds with some padding
    const minArrowPos = CORNER_RADIUS + ARROW_WIDTH / 2 + ARROW_SPACING;
    const maxArrowPos = validationMessageWidth - minArrowPos;
    arrowLeftPosOnValidationMessage = Math.max(
      minArrowPos,
      Math.min(arrowLeftPosOnValidationMessage, maxArrowPos),
    );

    // Calculate vertical space available
    const spaceBelow = viewportHeight - targetElementRect.bottom;
    const spaceAbove = targetElementRect.top;
    const totalValidationMessageHeight =
      contentHeight + ARROW_HEIGHT + BORDER_WIDTH * 2;

    // Determine if validation message fits above or below
    const fitsBelow = spaceBelow >= totalValidationMessageHeight;
    const fitsAbove = spaceAbove >= totalValidationMessageHeight;
    const showAbove = !fitsBelow && fitsAbove;

    let validationMessageTopPos;

    if (showAbove) {
      // Position above target element
      validationMessage.setAttribute("data-position", "above");
      validationMessageTopPos = Math.max(
        0,
        targetElementRect.top - totalValidationMessageHeight,
      );
      validationMessageBodyWrapper.style.marginTop = undefined;
      validationMessageBodyWrapper.style.marginBottom = `${ARROW_HEIGHT}px`;
      validationMessageBorder.style.top = `-${BORDER_WIDTH}px`;
      validationMessageBorder.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
      validationMessageBorder.innerHTML = generateSvgWithBottomArrow(
        validationMessageRect.width,
        validationMessageRect.height,
        arrowLeftPosOnValidationMessage,
      );
    } else {
      // Position below target element
      validationMessage.setAttribute("data-position", "below");
      validationMessageTopPos = Math.ceil(targetElementRect.bottom);
      validationMessageBodyWrapper.style.marginTop = `${ARROW_HEIGHT}px`;
      validationMessageBodyWrapper.style.marginBottom = undefined;
      validationMessageBorder.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
      validationMessageBorder.style.bottom = `-${BORDER_WIDTH}px`;
      validationMessageBorder.innerHTML = generateSvgWithTopArrow(
        validationMessageRect.width,
        validationMessageRect.height,
        arrowLeftPosOnValidationMessage,
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
          validationMessageContent.style.maxHeight = `${availableHeight}px`;
          validationMessageContent.style.overflowY = "auto";
        }
      }
    }

    // Apply calculated position
    validationMessage.style.left = `${validationMessageLeftPos}px`;
    validationMessage.style.top = `${validationMessageTopPos}px`;
  };

  // Initial position calculation
  updatePosition();
  if (debug) {
    console.debug("initial validation message position updated");
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
        resizeObserverContent.observe(validationMessageContent);
      }

      if (debug) {
        console.debug(
          `validation message position updated (reason: ${reason})`,
        );
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
    resizeObserverContent.observe(validationMessageContent);
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
        validationMessage.style.opacity = 1;
        schedulePositionUpdate("becomes_intersecting");
        positionCheck.start();
      } else {
        validationMessage.style.opacity = 0;
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

  return { updatePosition, stop };
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
