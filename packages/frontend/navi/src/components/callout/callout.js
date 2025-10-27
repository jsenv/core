import {
  allowWheelThrough,
  createPubSub,
  createStyleController,
  getBorderSizes,
  pickPositionRelativeTo,
  visibleRectEffect,
} from "@jsenv/dom";

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

// Configuration parameters for validation message appearance
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

    /* Ensure the validation message CANNOT cause overflow */
    /* might be important to ensure it cannot create scrollbars in the document */
    /* When measuring the size it should take */
    .navi_callout {
      position: fixed;
      inset: 0;
      overflow: hidden;
    }

    .navi_callout_message {
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

    .jsenv_validation_message_border {
      position: absolute;
      filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
      pointer-events: none;
    }

    .jsenv_validation_message_body_wrapper {
      position: relative;
      border-style: solid;
      border-color: transparent;
    }

    .jsenv_validation_message_body {
      position: relative;
      display: flex;
      max-width: 47vw;
      padding: 8px;
      flex-direction: row;
      gap: 10px;
    }

    .jsenv_validation_message_icon {
      display: flex;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      border-radius: 2px;
    }

    .jsenv_validation_message_exclamation_svg {
      width: 16px;
      height: 12px;
      color: white;
    }

    .navi_callout_message[data-level="info"] .border_path {
      fill: var(--navi-info-color);
    }
    .navi_callout_message[data-level="info"] .jsenv_validation_message_icon {
      background-color: var(--navi-info-color);
    }
    .navi_callout_message[data-level="warning"] .border_path {
      fill: var(--navi-warning-color);
    }
    .navi_callout_message[data-level="warning"] .jsenv_validation_message_icon {
      background-color: var(--navi-warning-color);
    }
    .navi_callout_message[data-level="error"] .border_path {
      fill: var(--navi-error-color);
    }
    .navi_callout_message[data-level="error"] .jsenv_validation_message_icon {
      background-color: var(--navi-error-color);
    }

    .jsenv_validation_message_content {
      min-width: 0;
      align-self: center;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .jsenv_validation_message_border svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }

    .background_path {
      fill: var(--navi-callout-background-color);
    }

    .jsenv_validation_message_close_button_column {
      display: flex;
      height: 22px;
    }
    .jsenv_validation_message_close_button {
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
    .jsenv_validation_message_close_button:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    .close_svg {
      width: 100%;
      height: 100%;
    }

    .error_stack {
      max-height: 200px;
      overflow: auto;
    }
  }
`;

// HTML template for the validation message
const validationMessageTemplate = /* html */ `
<div class="navi_callout">
    <div class="navi_callout_message" role="alert" aria-live="assertive">
      <div class="jsenv_validation_message_body_wrapper">
        <div class="jsenv_validation_message_border"></div>
        <div class="jsenv_validation_message_body">
          <div class="jsenv_validation_message_icon">
            <svg
              class="jsenv_validation_message_exclamation_svg"
              viewBox="0 0 125 300"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="currentColor"
                d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
              />
            </svg>
          </div>
          <div class="jsenv_validation_message_content">Default message</div>
          <div class="jsenv_validation_message_close_button_column">
            <button class="jsenv_validation_message_close_button">
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
  </div>
`;

const validationMessageStyleController =
  createStyleController("validation_message");

export const openCallout = (
  message,
  {
    anchor: targetElement,
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
  let _closeOnClickOutside = closeOnClickOutside;

  if (debug) {
    console.debug("open validation message on", targetElement, {
      message,
      level,
    });
  }

  const [teardown, addTeardown] = createPubSub(true);
  let opened = true;
  const close = (reason) => {
    if (!opened) {
      return;
    }
    if (debug) {
      console.debug(`validation message closed (reason: ${reason})`);
    }
    opened = false;
    teardown(reason);
  };

  // Create and add validation message to document
  const jsenvValidationMessage = createValidationMessage();
  const jsenvValidationMessageContent = jsenvValidationMessage.querySelector(
    ".jsenv_validation_message_content",
  );
  const jsenvValidationMessageCloseButton =
    jsenvValidationMessage.querySelector(
      ".jsenv_validation_message_close_button",
    );
  jsenvValidationMessageCloseButton.onclick = () => {
    close("click_close_button");
  };

  const update = (
    newMessage,
    { level = "warning", closeOnClickOutside = level === "info" } = {},
  ) => {
    _closeOnClickOutside = closeOnClickOutside;

    if (Error.isError(newMessage)) {
      const error = newMessage;
      newMessage = error.message;
      newMessage += `<pre class="error_stack">${escapeHtml(error.stack)}</pre>`;
    }

    jsenvValidationMessage.setAttribute("data-level", level);
    jsenvValidationMessageContent.innerHTML = newMessage;
  };
  update(message, { level });

  validationMessageStyleController.set(jsenvValidationMessage, { opacity: 0 });

  allowWheelThrough(jsenvValidationMessage, targetElement);

  // Connect validation message with target element for accessibility
  const validationMessageId = `navi_callout_message_${Date.now()}`;
  jsenvValidationMessage.id = validationMessageId;

  if (level === "info") {
    jsenvValidationMessage.setAttribute("role", "status");
    targetElement.setAttribute("aria-describedby", validationMessageId);
    addTeardown(() => {
      targetElement.removeAttribute("aria-describedby");
    });
  } else {
    jsenvValidationMessage.setAttribute("role", "alert");
    targetElement.setAttribute("aria-errormessage", validationMessageId);
    targetElement.setAttribute("aria-invalid", "true");
    addTeardown(() => {
      targetElement.removeAttribute("aria-errormessage");
      targetElement.removeAttribute("aria-invalid");
    });
  }
  targetElement.setAttribute("data-callout", validationMessageId);
  targetElement.style.setProperty(
    "--callout-color",
    `var(--navi-${level}-color)`,
  );
  addTeardown(() => {
    targetElement.removeAttribute("data-callout");
    targetElement.style.removeProperty("--callout-color");
  });

  document.body.appendChild(jsenvValidationMessage);
  addTeardown(() => {
    jsenvValidationMessage.remove();
  });

  const positionFollower = stickValidationMessageToTarget(
    jsenvValidationMessage,
    targetElement,
    {
      debug,
    },
  );
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
      if (targetElement.hasAttribute("data-validation-message-stay-on-focus")) {
        return;
      }
      close("target_element_focus");
    };
    targetElement.addEventListener("focus", onfocus);
    addTeardown(() => {
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
    addTeardown(() => {
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
  addTeardown(() => {
    delete targetElement.jsenvValidationMessage;
  });
  return validationMessage;
};

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
  const validationMessage = div.querySelector(".navi_callout_message");
  return validationMessage;
};

const stickValidationMessageToTarget = (validationMessage, targetElement) => {
  // Get references to validation message parts
  const validationMessageBodyWrapper = validationMessage.querySelector(
    ".jsenv_validation_message_body_wrapper",
  );
  const validationMessageBorder = validationMessage.querySelector(
    ".jsenv_validation_message_border",
  );
  const validationMessageContent = validationMessage.querySelector(
    ".jsenv_validation_message_content",
  );

  // Set initial border styles
  validationMessageBodyWrapper.style.borderWidth = `${BORDER_WIDTH}px`;
  validationMessageBorder.style.left = `-${BORDER_WIDTH}px`;
  validationMessageBorder.style.right = `-${BORDER_WIDTH}px`;

  const targetVisibleRectEffect = visibleRectEffect(
    targetElement,
    ({ left: targetLeft, right: targetRight, visibilityRatio }) => {
      // reset max height and overflow because it impacts the element size
      // and we need to re-check if we need to have an overflow or not.
      // to avoid visual impact we do this on an invisible clone.
      // It's ok to do this because the element is absolutely positioned
      const validationMessageClone = validationMessage.cloneNode(true);
      validationMessageClone.style.visibility = "hidden";
      const validationMessageContentClone =
        validationMessageClone.querySelector(
          ".jsenv_validation_message_content",
        );
      validationMessageContentClone.style.maxHeight = "";
      validationMessageContentClone.style.overflowY = "";
      validationMessage.parentNode.appendChild(validationMessageClone);
      const {
        position,
        left: validationMessageLeft,
        top: validationMessageTop,
        width: validationMessageWidth,
        height: validationMessageHeight,
        spaceAboveTarget,
        spaceBelowTarget,
      } = pickPositionRelativeTo(validationMessageClone, targetElement, {
        alignToViewportEdgeWhenTargetNearEdge: 20,
        // when fully to the left, the border color is collé to the browser window making it hard to see
        minLeft: 1,
      });

      // Get element padding and border to properly position arrow
      const targetBorderSizes = getBorderSizes(targetElement);

      // Calculate arrow position to point at target element
      let arrowLeftPosOnValidationMessage;
      // Determine arrow target position based on attribute
      const arrowPositionAttribute = targetElement.getAttribute(
        "data-validation-message-arrow-x",
      );
      let arrowTargetLeft;
      if (arrowPositionAttribute === "center") {
        // Target the center of the element
        arrowTargetLeft = (targetLeft + targetRight) / 2;
      } else {
        // Default behavior: target the left edge of the element (after borders)
        arrowTargetLeft = targetLeft + targetBorderSizes.left;
      }

      // Calculate arrow position within the validation message
      if (validationMessageLeft < arrowTargetLeft) {
        // Validation message is left of the target point, move arrow right
        const diff = arrowTargetLeft - validationMessageLeft;
        arrowLeftPosOnValidationMessage = diff;
      } else if (
        validationMessageLeft + validationMessageWidth <
        arrowTargetLeft
      ) {
        // Edge case: target point is beyond right edge of validation message
        arrowLeftPosOnValidationMessage = validationMessageWidth - ARROW_WIDTH;
      } else {
        // Target point is within validation message width
        arrowLeftPosOnValidationMessage =
          arrowTargetLeft - validationMessageLeft;
      }

      // Ensure arrow stays within validation message bounds with some padding
      const minArrowPos = CORNER_RADIUS + ARROW_WIDTH / 2 + ARROW_SPACING;
      const maxArrowPos = validationMessageWidth - minArrowPos;
      arrowLeftPosOnValidationMessage = Math.max(
        minArrowPos,
        Math.min(arrowLeftPosOnValidationMessage, maxArrowPos),
      );

      // Force content overflow when there is not enough space to display
      // the entirety of the validation message
      const spaceAvailable =
        position === "below" ? spaceBelowTarget : spaceAboveTarget;
      let spaceAvailableForContent = spaceAvailable;
      spaceAvailableForContent -= ARROW_HEIGHT;
      spaceAvailableForContent -= BORDER_WIDTH * 2;
      spaceAvailableForContent -= 16; // padding * 2
      let contentHeight = validationMessageHeight;
      contentHeight -= ARROW_HEIGHT;
      contentHeight -= BORDER_WIDTH * 2;
      contentHeight -= 16; // padding * 2
      const spaceRemainingAfterContent =
        spaceAvailableForContent - contentHeight;
      if (spaceRemainingAfterContent < 2) {
        const maxHeight = spaceAvailableForContent;
        validationMessageContent.style.maxHeight = `${maxHeight}px`;
        validationMessageContent.style.overflowY = "scroll";
      } else {
        validationMessageContent.style.maxHeight = "";
        validationMessageContent.style.overflowY = "";
      }

      const { width, height } = validationMessage.getBoundingClientRect();
      if (position === "above") {
        // Position above target element
        validationMessageBodyWrapper.style.marginTop = "";
        validationMessageBodyWrapper.style.marginBottom = `${ARROW_HEIGHT}px`;
        validationMessageBorder.style.top = `-${BORDER_WIDTH}px`;
        validationMessageBorder.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        validationMessageBorder.innerHTML = generateSvgWithBottomArrow(
          width,
          height,
          arrowLeftPosOnValidationMessage,
        );
      } else {
        validationMessageBodyWrapper.style.marginTop = `${ARROW_HEIGHT}px`;
        validationMessageBodyWrapper.style.marginBottom = "";
        validationMessageBorder.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        validationMessageBorder.style.bottom = `-${BORDER_WIDTH}px`;
        validationMessageBorder.innerHTML = generateSvgWithTopArrow(
          width,
          height,
          arrowLeftPosOnValidationMessage,
        );
      }

      validationMessage.setAttribute("data-position", position);
      validationMessageStyleController.set(validationMessage, {
        opacity: visibilityRatio ? 1 : 0,
        transform: {
          translateX: validationMessageLeft,
          translateY: validationMessageTop,
        },
      });
      validationMessageClone.remove();
    },
  );
  const messageSizeChangeObserver = observeValidationMessageSizeChange(
    validationMessageContent,
    (width, height) => {
      targetVisibleRectEffect.check(`content_size_change (${width}x${height})`);
    },
  );
  targetVisibleRectEffect.onBeforeAutoCheck(() => {
    // prevent feedback loop because check triggers size change which triggers check...
    messageSizeChangeObserver.disable();
    return () => {
      messageSizeChangeObserver.enable();
    };
  });

  return {
    updatePosition: targetVisibleRectEffect.check,
    stop: () => {
      messageSizeChangeObserver.disconnect();
      targetVisibleRectEffect.disconnect();
    },
  };
};

const observeValidationMessageSizeChange = (elementSizeToObserve, callback) => {
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
