import {
  allowWheelThrough,
  createPubSub,
  createStyleController,
  createValueEffect,
  dispatchCustomEvent,
  dispatchPublicCustomEvent,
  findEvent,
  findFocusable,
  findFocusDelegateTarget,
  getBorderSizes,
  getElementSignature,
  getFirstVisuallyVisibleAncestor,
  getPaddingSizes,
  getVisuallyVisibleInfo,
  measureLongestVisualLineWidth,
  pickPositionRelativeTo,
  resolveCSSColor,
  visibleRectEffect,
} from "@jsenv/dom";
import { isValidElement } from "preact";

import { findControlHost, findControlRoot } from "../../control_dom.js";
import { findControlProxy } from "../../control_proxy.js";
import { renderIntoCallout } from "./callout.jsx";

/**
 * A callout component that mimics native browser validation messages.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow automatically shows when pointing at a valid anchor element
 * - Centers in viewport when no anchor element provided or anchor is too big
 */

const css = /* css */ `
  @layer navi {
    .navi_callout {
      --callout-success-color: #4caf50;
      --callout-info-color: #2196f3;
      --callout-warning-color: #ff9800;
      --callout-error-color: #f44336;

      --callout-background-color: white;
      --callout-icon-color: black;
      --callout-padding: 8px;
      --callout-z-index: 1000;
    }
  }

  .navi_callout {
    --x-callout-border-color: var(--x-callout-status-color);
    --x-callout-background-color: var(--callout-background-color);
    --x-callout-icon-color: var(--x-callout-status-color);

    /* Popover resets */
    position: absolute;
    inset: auto;
    top: 0;
    left: 0;
    /* Callout styles */
    display: block;
    height: auto;
    margin: 0;
    padding: 0;
    color: revert; /* Do no inherit element color, callout is inside the element it should use document color though */
    font-size: initial; /* Callout fells disconnected from the element, font size should be predictible and stable */
    background: transparent;
    border: none;
    outline: none; /* programmatic focus may land here briefly before being redirected to close button */
    opacity: 0;
    /* will be positioned with transform: translate */
    transition: opacity 0.2s ease-in-out;
    cursor: initial; /* Do not inherit element cursor, inside the element but should use regular cursor */
    pointer-events: auto; /* Must be interactive to be closabled (overrid list item pointer-events none for instance)  */
    overflow: visible;

    &[data-status="success"] {
      --x-callout-status-color: var(--callout-success-color);
    }
    &[data-status="info"] {
      --x-callout-status-color: var(--callout-info-color);
    }
    &[data-status="warning"] {
      --x-callout-status-color: var(--callout-warning-color);
    }
    &[data-status="error"] {
      --x-callout-status-color: var(--callout-error-color);
    }

    .navi_callout_box {
      position: relative;
      border-style: solid;
      border-color: transparent;

      .navi_callout_frame {
        position: absolute;
        filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
        pointer-events: none;

        svg {
          position: absolute;
          inset: 0;
          overflow: visible;

          .navi_callout_border {
            fill: var(--x-callout-border-color);
          }
          .navi_callout_background {
            fill: var(--x-callout-background-color);
          }
        }
      }

      .navi_callout_body {
        --callout-icon-height: round(1.5em, 1px);

        position: relative;
        display: flex;
        /* 85vw on small screens (<500px), then 47vw to not grow too large capped at 1000px */
        max-width: min(85dvw, max(47dvw, 500px), 1000px);
        padding: var(--callout-padding);
        flex-direction: row;
        gap: 10px;

        .navi_callout_icon {
          display: flex;
          aspect-ratio: 1/1;
          height: var(--callout-icon-height);
          flex-shrink: 0;
          align-items: center;
          align-self: flex-start;
          justify-content: center;
          background-color: var(--x-callout-icon-color);
          border-radius: 2px;

          svg {
            width: 16px;
            height: 12px;
            color: white;
          }
        }

        .navi_callout_message {
          position: relative;
          display: block;
          box-sizing: border-box;
          box-decoration-break: clone;
          align-self: center;
          white-space: normal; /* Override in case ancetor sets nowrap */
          word-break: break-word;
          overflow-wrap: anywhere;

          .navi_callout_error_stack {
            max-height: 200px;
            overflow: auto;
          }
          iframe {
            display: block;
            margin: 0;
          }
        }
      }
    }

    .navi_callout_close_button_column {
      display: flex;
      height: var(--callout-icon-height);
      align-self: flex-start;

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

        &:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        &:focus-visible,
        .navi_callout:focus-visible & {
          outline: auto;
        }

        .navi_callout_close_button_svg {
          width: 100%;
          height: 100%;
        }
      }
    }
  }
`;

/**
 * Shows a callout attached to the specified element
 * @param {string} message - HTML content for the callout
 * @param {Object} options - Configuration options
 * @param {HTMLElement} [options.anchorElement] - Element the callout should follow. If not provided or too big, callout will be centered in viewport
 * @param {string} [options.status=""] - Callout status: "info" | "warning" | "error" | "success"
 * @param {Function} [options.onClose] - Callback when callout is closed
 * @param {boolean} [options.closeOnClickOutside] - Whether to close on outside clicks (defaults to true for "info" status)
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Object} - Callout object with properties:
 *   - {Function} close - Function to close the callout
 *   - {Function} update - Function to update message and options
 *   - {Function} updatePosition - Function to update position
 *   - {HTMLElement} element - The callout DOM element
 *   - {boolean} opened - Whether the callout is currently open
 */
export const openCallout = (
  message,
  {
    anchorElement,
    // status determines visual styling and behavior:
    // "info" - polite announcement (e.g., "This element cannot be modified")
    // "warning" - expected failure requiring user action (e.g., "Field is required")
    // "error" - unexpected failure, may not be actionable (e.g., "Server error")
    // "success" - positive feedback (e.g., "Changes saved successfully")
    // "" - neutral information
    status = "",
    onClose,
    closeOnClickOutside = status === "info",
    closeOnFocusLeave = closeOnClickOutside,
    openingEvent,
    showErrorStack,
    skipFocus = false,
    debug = () => {},
  } = {},
) => {
  import.meta.css = css;
  if (debug === true) {
    debug = (e, ...args) => console.debug(`"${e.type}" -> `, ...args);
  }

  const callout = {
    opened: true,
    close: null,
    status: undefined,

    update: null,
    updatePosition: null,

    element: null,
  };

  debug(
    openingEvent,
    `open callout on ${getElementSignature(anchorElement)} (status=${status})`,
  );

  const [teardown, addTeardown] = createPubSub(true);
  const requestClose = (e, reason) => {
    return dispatchCustomEvent(callout.element, "navi_request_close", {
      event: e,
      reason,
    });
  };
  const onRequestClose = (event) => {
    if (!callout.opened) {
      return;
    }
    const { reason } = event.detail;
    const clickOrSpaceOutside =
      reason === "click_outside" || reason === "space_outside";
    if (clickOrSpaceOutside) {
      if (!closeOnClickOutside) {
        return;
      }
      if (callout.status === "error") {
        return;
      }
    } else if (reason === "focus_leave") {
      if (!closeOnFocusLeave || import.meta.dev) {
        return;
      }
      if (callout.status === "error") {
        return;
      }
    }

    if (debug) {
      debug(event, `callout close (reason: ${reason})`);
    }
    const mousedownEvent = findEvent(event, "mousedown");
    if (mousedownEvent) {
      const isInsideCallout =
        callout.element && callout.element.contains(event.target);
      if (isInsideCallout) {
        debug(
          event,
          "preventing mousedown default to avoid focus change on callout close",
        );
        mousedownEvent.preventDefault(); // prevent focus change to the callout, let it on the input
      }
    }
    callout.opened = false;
    teardown({ event, reason });
  };
  if (onClose) {
    addTeardown(({ event, reason }) => {
      let shouldTransferFocusFromCallout = false;
      const focusOut = findEvent(event, "focusout");
      if (focusOut) {
        const relatedTarget = focusOut.relatedTarget;
        if (relatedTarget && callout.element.contains(relatedTarget)) {
          shouldTransferFocusFromCallout = true;
        } else {
          // let focus go away from the callout to new target
        }
      } else {
        const focusInsideCallout = callout.element.contains(
          document.activeElement,
        );
        if (focusInsideCallout) {
          shouldTransferFocusFromCallout = true;
        } else {
          // mousedown to close callout would have given focus to the callout
          // so we can consider focus was inside callout
          const mousedownEvent = findEvent(event, "mousedown");
          if (mousedownEvent) {
            const mousedownInsideCallout =
              callout.element && callout.element.contains(event.target);
            if (mousedownInsideCallout) {
              shouldTransferFocusFromCallout = true;
            }
          }
        }
      }

      onClose({ event, reason, shouldTransferFocusFromCallout });
    });
  }

  const [updateStatus, addStatusEffect, cleanupStatusEffects] =
    createValueEffect(undefined);
  addTeardown(cleanupStatusEffects);

  // Create and add callout to document
  const calloutElement = createCalloutElement();
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );
  const calloutCloseButton = calloutElement.querySelector(
    ".navi_callout_close_button",
  );
  calloutCloseButton.onmousedown = (e) => {
    if (e.button !== 0) {
      return;
    }
    requestClose(e, "mousedown_close_button");
  };
  // "click" is received for enter/space
  calloutCloseButton.onclick = (e) => {
    if (e.button !== 0) {
      return;
    }
    requestClose(e, "click_close_button");
  };
  const calloutId = `navi_callout_${Date.now()}`;
  calloutElement.id = calloutId;
  calloutStyleController.set(calloutElement, { opacity: 0 });
  const update = (newMessage, options = {}) => {
    const prevStatus = callout.status;
    // Connect callout with target element for accessibility
    if (options.status && options.status !== callout.status) {
      callout.status = options.status;
      debug(
        `callout update status: ${prevStatus ?? "(none)"} -> ${options.status}`,
      );
      updateStatus(options.status);
    }

    if (Object.hasOwn(options, "closeOnClickOutside")) {
      closeOnClickOutside = options.closeOnClickOutside;
      if (closeOnClickOutside) {
        closeOnFocusLeave = true;
      }
    }
    if (Object.hasOwn(options, "closeOnFocusLeave")) {
      closeOnFocusLeave = options.closeOnFocusLeave;
    }

    if (isValidElement(newMessage)) {
      debug(`callout update message (jsx)`);
      renderIntoCallout(newMessage, calloutMessageElement, {
        requestClose,
      });
    } else if (newMessage instanceof Node) {
      // Handle DOM node (cloned from CSS selector)
      debug(`callout update message (node)`);
      calloutMessageElement.innerHTML = "";
      calloutMessageElement.appendChild(newMessage);
    } else if (typeof newMessage === "function") {
      debug(`callout update message (function)`);
      calloutMessageElement.innerHTML = "";
      newMessage({
        renderIntoCallout: (jsx) =>
          renderIntoCallout(jsx, calloutMessageElement, { requestClose }),
        requestClose,
      });
    } else {
      if (Error.isError(newMessage)) {
        const error = newMessage;
        newMessage = error.message;
        if (showErrorStack && error.stack) {
          newMessage += `<pre class="navi_callout_error_stack">${escapeHtml(String(error.stack))}</pre>`;
        }
      }

      // Check if the message is a full HTML document (starts with DOCTYPE)
      if (typeof newMessage === "string" && isHtmlDocument(newMessage)) {
        // Create iframe to isolate the HTML document
        const iframe = document.createElement("iframe");
        iframe.style.border = "none";
        iframe.style.width = "100%";
        iframe.style.backgroundColor = "white";
        iframe.srcdoc = newMessage;

        debug(`callout update message (html document iframe)`);
        // Clear existing content and add iframe
        calloutMessageElement.innerHTML = "";
        calloutMessageElement.appendChild(iframe);
      } else {
        debug(
          `callout update message: ${typeof newMessage === "string" ? newMessage.slice(0, 80) : String(newMessage)}`,
        );
        calloutMessageElement.innerHTML = newMessage;
      }
    }
    // After updating content the callout size likely changed — re-position immediately
    // while the resize observer is still settled, to avoid a ResizeObserver loop where
    // the observer fires, triggers a check, which changes the SVG frame, which fires again.
    if (callout.updatePosition) {
      callout.updatePosition();
    }
  };

  const originalAnchorElement = anchorElement;
  if (anchorElement) {
    const proxyElement = findControlProxy(anchorElement);
    if (proxyElement) {
      anchorElement = proxyElement;
    }
    const controlRoot = findControlRoot(anchorElement);
    if (controlRoot) {
      anchorElement = controlRoot;
    }
    const anchorVisuallyVisibleInfo = getVisuallyVisibleInfo(anchorElement, {
      countOffscreenAsVisible: true,
    });
    if (!anchorVisuallyVisibleInfo.visible) {
      anchorElement = getFirstVisuallyVisibleAncestor(anchorElement);
      if (!anchorElement) {
        // anchorElement is not in the DOM anymore, fallback to body
        anchorElement = document.body;
      }
      console.warn(
        `anchor is not visually visible (${anchorVisuallyVisibleInfo.reason}) -> callout will anchor to first visually visible ancestor (${getElementSignature(anchorElement)})`,
      );
    }
  }
  // Resolve the visual anchor for positioning: when data-callout-anchor is set,
  // use the inner element it points to. anchorElement remains the container
  // that receives data-callout and CSS vars.
  let visualAnchorElement = anchorElement;
  if (anchorElement && anchorElement !== document.body) {
    const calloutAnchorSelector = anchorElement.getAttribute(
      "data-callout-anchor",
    );
    if (calloutAnchorSelector) {
      const resolvedAnchor = anchorElement.querySelector(calloutAnchorSelector);
      if (resolvedAnchor) {
        visualAnchorElement = resolvedAnchor;
      }
    }
  }
  const calloutContainer = (() => {
    if (!anchorElement || anchorElement === document.body) {
      return document.body;
    }
    const closestLabel = anchorElement.closest("label");
    if (closestLabel) {
      // Putting callout inside label would be problematic:
      // - Click on callout would be catched by the browser and re-dispatched to the label
      // -> Callout would detect a click outside and close
      // (We could preventDefault but that would prevent click interaction on the callout like selecting callout text)
      // (Even ignoring the click without preventDefault prevent click to select as browser use click for label)
      // -> We put callout inside label aprent
      const labelParent = closestLabel.parentElement;
      return labelParent;
    }
    // Some elements (e.g. <input>) cannot have children
    if (canContainCallout(anchorElement)) {
      return anchorElement;
    }
    return anchorElement.parentNode || document.body;
  })();

  close_on_click_outside: {
    const handleClickOutside = (event) => {
      if (event.button !== 0) {
        // right click
        return;
      }
      const clickTarget = event.target;
      if (
        clickTarget === calloutElement ||
        calloutElement.contains(clickTarget)
      ) {
        return;
      }
      requestClose(event, "click_outside");
    };
    const handleSpaceOutside = (event) => {
      if (event.key !== " ") {
        return;
      }
      const keyTarget = event.target;
      if (keyTarget === calloutElement || calloutElement.contains(keyTarget)) {
        return;
      }
      requestClose(event, "space_outside");
    };

    const registerClickOutsideListener = () => {
      document.addEventListener("click", handleClickOutside, true);
      document.addEventListener("keydown", handleSpaceOutside, true);
      addTeardown(() => {
        document.removeEventListener("click", handleClickOutside, true);
        document.removeEventListener("keydown", handleSpaceOutside, true);
      });
    };
    if (
      closeOnClickOutside &&
      openingEvent &&
      findEvent(openingEvent, "mousedown")
    ) {
      debug(
        openingEvent,
        "deferring click-outside listener registration to avoid immediate close",
      );
      // The callout was opened during a mousedown — wait for the corresponding
      // mouseup before registering the click-outside listener, otherwise the
      // upcoming click event from the same gesture would immediately close it.
      const onMouseUp = () => {
        setTimeout(() => {
          debug(
            openingEvent,
            "registering click-outside listener after mouseup",
          );
          registerClickOutsideListener();
        });
      };
      document.addEventListener("mouseup", onMouseUp, {
        once: true,
        capture: true,
      });
      addTeardown(() => {
        document.removeEventListener("mouseup", onMouseUp, true);
      });
    } else {
      registerClickOutsideListener();
    }
  }
  close_on_focus_leave: {
    if (anchorElement) {
      // Make the callout itself focusable so that when the user clicks on a
      // non-interactive part of it, the browser can transfer focus there.
      // Without this, relatedTarget on focusout would be null (non-focusable
      // elements don't receive focus), making it impossible to distinguish
      // "clicked the callout" from "focus left the document entirely".
      // tabIndex=-1 keeps it out of the natural tab order.
      calloutElement.tabIndex = -1;
      const handleFocusOut = (event) => {
        const { relatedTarget } = event;
        if (relatedTarget && anchorElement.contains(relatedTarget)) {
          return;
        }
        if (relatedTarget && calloutElement.contains(relatedTarget)) {
          return;
        }
        requestClose(event, "focus_leave");
      };
      anchorElement.addEventListener("focusout", handleFocusOut);
      addTeardown(() => {
        anchorElement.removeEventListener("focusout", handleFocusOut);
      });
    }
  }
  close_on_escape_from_anchor: {
    if (!anchorElement) {
      break close_on_escape_from_anchor;
    }
    calloutCloseButton.tabIndex = -1;
    calloutCloseButton.setAttribute("navi-focus-delegate", "");
    const onAnchorKeydown = (e) => {
      if (e.key === "Escape") {
        requestClose(e, "escape_key");
        e.stopPropagation();
        e.preventDefault();
      }
    };
    anchorElement.addEventListener("keydown", onAnchorKeydown);
    addTeardown(() => {
      anchorElement.removeEventListener("keydown", onAnchorKeydown);
    });
    // Also close when Escape reaches the callout itself
    // e.g. when close button is focused
    // Usually callout is inside anchor so the anchor would see the escape being pressed
    // but callout can be appended outside anchor when anchor cannot receive children
    const onCalloutKeydown = (e) => {
      if (e.key === "Escape") {
        requestClose(e, "escape_key");
        e.stopPropagation();
        e.preventDefault();
      }
    };
    calloutElement.addEventListener("keydown", onCalloutKeydown);
    addTeardown(() => {
      calloutElement.removeEventListener("keydown", onCalloutKeydown);
    });
  }
  focus_on_open: {
    if (!anchorElement) {
      break focus_on_open;
    }
    if (skipFocus) {
      break focus_on_open;
    }
    if (anchorElement.closest('[aria-hidden="true"]')) {
      break focus_on_open;
    }
    // If focus is already inside the anchor, don't steal it — the user is
    // actively typing and Escape via close_on_escape_from_anchor will work.
    if (anchorElement.contains(document.activeElement)) {
      break focus_on_open;
    }
    // Move focus into the anchor so the user can immediately press Escape to
    // dismiss the callout. Prefer navi-focus-delegate targets (explicit intent),
    // fall back to first generic focusable, then the callout close button for
    // anchors with no focusable descendants (e.g. a read-only group).
    const focusTarget =
      findFocusDelegateTarget(anchorElement) ||
      findFocusable(anchorElement) ||
      calloutCloseButton;
    focusTarget.focus({ preventScroll: true });
  }
  close_on_custom_event: {
    const handleCustomCloseEvent = (e) => {
      onRequestClose(e);
    };
    calloutElement.addEventListener(
      "navi_request_close",
      handleCustomCloseEvent,
    );
  }
  Object.assign(callout, {
    element: calloutElement,
    update,
    requestClose,
  });
  addStatusEffect((status) => {
    if (status) {
      calloutElement.setAttribute("data-status", status);
    } else {
      calloutElement.removeAttribute("data-status");
    }

    if (!status || status === "info" || status === "success") {
      calloutElement.setAttribute("role", "status");
    } else if (status) {
      calloutElement.setAttribute("role", "alert");
    }
  });

  if (debug) {
    debug(
      openingEvent,
      `append callout into ${getElementSignature(calloutContainer)}`,
    );
  }
  calloutContainer.appendChild(calloutElement);
  calloutElement.showPopover();
  addTeardown(() => {
    calloutElement.remove();
  });

  if (anchorElement) {
    anchorElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    allowWheelThrough(calloutElement, visualAnchorElement);
    anchorElement.setAttribute("data-callout", calloutId);
    addTeardown(() => {
      anchorElement.removeAttribute("data-callout");
    });

    const visualElement = (() => {
      const visualSelector = anchorElement.getAttribute("data-visual-selector");
      if (visualSelector) {
        const visualElement = anchorElement.querySelector(visualSelector);
        if (visualElement) {
          return visualElement;
        }
      }
      return anchorElement;
    })();
    dispatchPublicCustomEvent(visualElement, "navi_callout_open");
    addTeardown(() => {
      dispatchPublicCustomEvent(visualElement, "navi_callout_close");
    });

    addStatusEffect((status) => {
      if (!status) {
        return () => {};
      }
      const statusColor = resolveCSSColor(
        `var(--callout-${status}-color)`,
        calloutElement,
      );
      anchorElement.setAttribute("data-callout-status", status);
      anchorElement.style.setProperty("--callout-color", statusColor);
      return () => {
        anchorElement.removeAttribute("data-callout-status");
        anchorElement.style.removeProperty("--callout-color");
      };
    });
    addStatusEffect((status) => {
      if (!status || status === "info" || status === "success") {
        visualAnchorElement.setAttribute("aria-describedby", calloutId);
        return () => {
          visualAnchorElement.removeAttribute("aria-describedby");
        };
      }
      visualAnchorElement.setAttribute("aria-errormessage", calloutId);
      visualAnchorElement.setAttribute("aria-invalid", "true");
      return () => {
        visualAnchorElement.removeAttribute("aria-errormessage");
        visualAnchorElement.removeAttribute("aria-invalid");
      };
    });
    anchorElement.callout = callout;
    addTeardown(() => {
      delete anchorElement.callout;
    });
  }

  update(message, { status });

  positioning: {
    const documentScrollLeftAtOpen = document.documentElement.scrollLeft;
    const documentScrollTopAtOpen = document.documentElement.scrollTop;

    let positioner;
    let strategy;
    const determine = () => {
      if (!visualAnchorElement) {
        return "centered";
      }
      // Check if anchor element is too big to reasonably position callout relative to it
      const anchorRect = visualAnchorElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const anchorTooBig = anchorRect.height > viewportHeight - 50;
      if (anchorTooBig) {
        return "centered";
      }
      return "anchored";
    };
    const updatePositioner = () => {
      const newStrategy = determine();
      if (newStrategy === strategy) {
        return;
      }
      positioner?.stop();
      if (newStrategy === "centered") {
        positioner = centerCalloutInViewport(calloutElement, {
          documentScrollLeftAtOpen,
          documentScrollTopAtOpen,
        });
      } else {
        positioner = stickCalloutToAnchor(calloutElement, visualAnchorElement, {
          debug,
          originalAnchorElement,
        });
      }
      strategy = newStrategy;
    };
    updatePositioner();
    addTeardown(() => {
      positioner.stop();
    });
    auto_update_positioner: {
      const handleResize = () => {
        updatePositioner();
      };
      window.addEventListener("resize", handleResize);
      addTeardown(() => {
        window.removeEventListener("resize", handleResize);
      });
    }
    callout.updatePosition = () => positioner.update();
  }

  return callout;
};

export const dispatchCalloutCloseEvent = (elementInsideCallout) => {
  const event = new CustomEvent("navi_callout_close", {
    bubbles: true,
  });
  elementInsideCallout.dispatchEvent(event);
};

// Configuration parameters for callout appearance
const BORDER_WIDTH = 1;
const CORNER_RADIUS = 3;
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const ARROW_SPACING = 8;

// HTML template for the callout
const calloutTemplate = /* html */ `
  <div
    class="navi_callout"
    popover="manual"
  >
    <div class="navi_callout_box">
      <div class="navi_callout_frame"></div>
      <div class="navi_callout_body">
        <div class="navi_callout_icon">
          <svg viewBox="0 0 125 300" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
            />
          </svg>
        </div>
        <!-- Keep .navi_callout_message so preact controls it -->
        <div class="navi_callout_message"></div>
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
 * Creates a new callout element from template
 * @returns {HTMLElement} - The callout element
 */
const createCalloutElement = () => {
  const div = document.createElement("div");
  div.innerHTML = calloutTemplate;
  const calloutElement = div.firstElementChild;
  return calloutElement;
};

const centerCalloutInViewport = (
  calloutElement,
  { documentScrollLeftAtOpen, documentScrollTopAtOpen },
) => {
  // Set up initial styles for centered positioning
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Remove any margins and set frame positioning for no arrow
  calloutBoxElement.style.marginTop = "";
  calloutBoxElement.style.marginBottom = "";
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;

  // Generate simple rectangle SVG without arrow and position in center
  const updateCenteredPosition = () => {
    const calloutElementClone =
      cloneCalloutToMeasureNaturalSize(calloutElement);

    const { height } = calloutElementClone.getBoundingClientRect();

    // Handle content overflow when viewport is too small
    const viewportHeight = window.innerHeight;
    const maxAllowedHeight = viewportHeight - 40; // Leave some margin from viewport edges

    let maxHeight;
    if (height > maxAllowedHeight) {
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      const spaceNeededAroundContent = BORDER_WIDTH * 2 + paddingY;
      maxHeight = maxAllowedHeight - spaceNeededAroundContent;
      calloutMessageElement.style.maxHeight = `${maxHeight}px`;
      calloutMessageElement.style.overflowY = "scroll";
    } else {
      calloutMessageElement.style.maxHeight = "";
      calloutMessageElement.style.overflowY = "";
    }

    const optimalBodyWidth = measureOptimalBodyWidth(calloutElementClone, {
      maxHeight,
    });
    calloutElementClone.remove();

    calloutBodyElement.style.width =
      optimalBodyWidth !== null ? `${optimalBodyWidth}px` : "";

    // Get final dimensions after potential overflow adjustments
    const { width: finalWidth, height: finalHeight } =
      calloutElement.getBoundingClientRect();
    calloutFrameElement.innerHTML = generateSvgWithoutArrow(
      finalWidth,
      finalHeight,
    );

    // Center in viewport (accounting for document scroll)
    const viewportWidth = window.innerWidth;
    const left = documentScrollLeftAtOpen + (viewportWidth - finalWidth) / 2;
    const top = documentScrollTopAtOpen + (viewportHeight - finalHeight) / 2;

    calloutStyleController.set(calloutElement, {
      opacity: 1,
      transform: {
        translateX: left,
        translateY: top,
      },
    });
  };

  // Initial positioning
  updateCenteredPosition();
  window.addEventListener("resize", updateCenteredPosition);

  // Return positioning function for dynamic updates
  return {
    update: updateCenteredPosition,
    stop: () => {
      window.removeEventListener("resize", updateCenteredPosition);
    },
  };
};

/**
 * Positions a callout relative to an anchor element with an arrow pointing to it
 * @param {HTMLElement} calloutElement - The callout element to position
 * @param {HTMLElement} anchorElement - The anchor element to stick to
 * @returns {Object} - Object with update and stop functions
 */
const stickCalloutToAnchor = (
  calloutElement,
  anchorElement,
  { debug, originalAnchorElement = anchorElement },
) => {
  // Read an attribute from the original anchor first, then the visual anchor.
  // the anchor to a wrapper element that doesn't carry the data-callout-* attributes.
  const getAnchorAttribute = (name) => {
    return (
      originalAnchorElement.getAttribute(name) ??
      anchorElement.getAttribute(name)
    );
  };
  // Get references to callout parts
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );
  let alignToAnchorBox;
  if (anchorElement.hasAttribute("data-callout-point-to-border-box")) {
    alignToAnchorBox = "border-box";
  } else if (anchorElement.hasAttribute("data-callout-point-to-content-box")) {
    alignToAnchorBox = "content-box";
  } else {
    // Smart default: inputs and buttons are tight boxes where border-box makes sense.
    // For everything else (labels, divs, fieldsets…) content-box maximizes the chance
    // the arrow points at visible text rather than the outer padding/border.
    const controHost = findControlHost(anchorElement) || anchorElement;
    const tagName = controHost.tagName;
    if (tagName === "INPUT" || tagName === "BUTTON" || tagName === "FIELDSET") {
      alignToAnchorBox = "border-box";
    } else {
      alignToAnchorBox = "content-box";
    }
  }

  calloutElement.setAttribute("data-anchor-box", alignToAnchorBox);

  // Set initial border styles
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;

  const anchorVisibleRectEffect = visibleRectEffect(
    anchorElement,
    (
      { left: anchorLeft, right: anchorRight, visibilityRatio },
      { event, ancestorClosed },
    ) => {
      if (ancestorClosed) {
        if (calloutElement.matches(":popover-open")) {
          if (debug) {
            debug(
              event,
              "hiding callout because an ancestor popover/dialog/details is closed",
            );
          }
          calloutElement.hidePopover();
        }
        return;
      }
      if (!calloutElement.matches(":popover-open")) {
        if (debug) {
          debug(event, "showing callout because anchor is visible again");
        }
        calloutElement.showPopover();
      }
      const calloutElementClone =
        cloneCalloutToMeasureNaturalSize(calloutElement);
      const {
        positionY,
        left: calloutLeft,
        top: calloutTop,
        width: calloutWidth,
        height: calloutHeight,
        spaceAbove,
        spaceBelow,
      } = pickPositionRelativeTo(calloutElementClone, anchorElement, {
        alignToContainerEdgeWhenAnchorNearEdge: 20,
        minLeft: 1,
        positionX: "center",
        positionY: getAnchorAttribute("data-callout-position") || "below",
        positionYFixed: getAnchorAttribute("data-callout-position-fixed"),
        marginWithAnchor: ARROW_HEIGHT,
        alignToAnchorBox,
        marginWithContainer:
          originalAnchorElement.hasAttribute("data-callout-viewport-spacing") ||
          anchorElement.hasAttribute("data-callout-viewport-spacing")
            ? Number(getAnchorAttribute("data-callout-viewport-spacing"))
            : 0,
      });
      // data-position-y-current is written to the clone by pickPositionRelativeTo,
      // copy it back to the real element so stickiness works on next call
      const previousPositionY = calloutElement.getAttribute(
        "data-position-y-current",
      );
      const positionYCurrent = calloutElementClone.getAttribute(
        "data-position-y-current",
      );
      if (positionYCurrent) {
        calloutElement.setAttribute(
          "data-position-y-current",
          positionYCurrent,
        );
      } else {
        calloutElement.removeAttribute("data-position-y-current");
      }
      if (debug && positionY !== previousPositionY) {
        const anchorRect = anchorElement.getBoundingClientRect();
        debug(
          event,
          `callout position changed: ${previousPositionY ?? "(none)"} -> ${positionY} (spaceAbove: ${spaceAbove.toFixed(0)}px, spaceBelow: ${spaceBelow.toFixed(0)}px, anchorTop: ${anchorRect.top.toFixed(0)}px, anchorBottom: ${anchorRect.bottom.toFixed(0)}px)`,
        );
      }

      // Calculate arrow position to point at anchorElement element
      let arrowLeftPosOnCallout;
      // Determine arrow target position: explicit attribute wins, otherwise
      // fall back to the computed text-align of the anchor element so the
      // arrow naturally follows where the text starts.
      const arrowPositionAttribute = getAnchorAttribute("data-callout-arrow-x");
      const arrowPosition =
        arrowPositionAttribute ||
        (() => {
          const textAlign = getComputedStyle(anchorElement).textAlign;
          if (textAlign === "center") {
            return "center";
          }
          if (textAlign === "right" || textAlign === "end") {
            return "end";
          }
          return "start";
        })();
      let arrowAnchorLeft;
      calloutElement.setAttribute("data-arrow-x", arrowPosition);
      if (arrowPosition === "start") {
        const anchorBorderSizes = getBorderSizes(anchorElement);
        const anchorPaddingSizes = getPaddingSizes(anchorElement);
        // Target the left edge of the anchorElement text content (after borders + padding)
        arrowAnchorLeft =
          anchorLeft + anchorBorderSizes.left + anchorPaddingSizes.left;
      } else if (arrowPosition === "center") {
        arrowAnchorLeft = (anchorLeft + anchorRight) / 2;
      } else {
        // "end"
        const anchorBorderSizes = getBorderSizes(anchorElement);
        const anchorPaddingSizes = getPaddingSizes(anchorElement);
        // Target the right edge of the anchorElement text content (before borders + padding)
        arrowAnchorLeft =
          anchorRight - anchorBorderSizes.right - anchorPaddingSizes.right;
      }

      // arrowAnchorLeft is viewport-relative (from visibleRectEffect).
      // calloutLeft is document-relative (pickPositionRelativeTo adds scrollLeft).
      // Subtract scrollLeft to bring calloutLeft to viewport coordinates before diffing.
      const calloutViewportLeft =
        calloutLeft - document.documentElement.scrollLeft;
      if (calloutViewportLeft + calloutWidth < arrowAnchorLeft) {
        // Arrow target is beyond the right edge of the callout — pin arrow to far right
        arrowLeftPosOnCallout = calloutWidth - ARROW_WIDTH;
      } else {
        arrowLeftPosOnCallout = arrowAnchorLeft - calloutViewportLeft;
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
        positionY === "above" || positionY === "aligned-bottom"
          ? spaceAbove
          : spaceBelow;
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      // spaceAbove/spaceBelow already exclude ARROW_HEIGHT (via marginWithAnchor: ARROW_HEIGHT passed to pickPositionRelativeTo)
      const spaceNeededAroundContent = BORDER_WIDTH * 2 + paddingY;
      const spaceAvailableForContent =
        spaceAvailable - spaceNeededAroundContent;
      const contentHeight = calloutHeight - BORDER_WIDTH * 2 - paddingY;
      const spaceRemainingAfterContent =
        spaceAvailableForContent - contentHeight;
      let maxHeight;
      if (spaceRemainingAfterContent < 2) {
        maxHeight = spaceAvailableForContent;
        calloutMessageElement.style.maxHeight = `${maxHeight}px`;
        calloutMessageElement.style.overflowY = "scroll";
      } else {
        calloutMessageElement.style.maxHeight = "";
        calloutMessageElement.style.overflowY = "";
      }

      const optimalBodyWidth = measureOptimalBodyWidth(calloutElementClone, {
        maxHeight,
      });
      calloutElementClone.remove();

      calloutBodyElement.style.width =
        optimalBodyWidth !== null ? `${optimalBodyWidth}px` : "";

      const { width, height } = calloutElement.getBoundingClientRect();
      if (positionY === "above" || positionY === "aligned-bottom") {
        // Arrow at bottom, extending below the element
        calloutBoxElement.style.marginTop = "";
        calloutBoxElement.style.marginBottom = "";
        calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.innerHTML = generateSvgWithBottomArrow(
          width,
          height + ARROW_HEIGHT,
          arrowLeftPosOnCallout,
        );
      } else {
        // Arrow at top, extending above the element
        calloutBoxElement.style.marginTop = "";
        calloutBoxElement.style.marginBottom = "";
        calloutFrameElement.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;
        calloutFrameElement.innerHTML = generateSvgWithTopArrow(
          width,
          height + ARROW_HEIGHT,
          arrowLeftPosOnCallout,
        );
      }
      calloutStyleController.set(calloutElement, {
        opacity: visibilityRatio > 0.2 ? 1 : 0,
        transform: {
          translateX: calloutLeft,
          translateY: calloutTop,
        },
      });
    },
  );
  // Re-measures/repositions the callout whenever its own message body
  // changes size (e.g. async content loading in, a filter narrowing the
  // list) — not just when the anchor itself moves/resizes. The feedback-loop
  // guard (re-checking can itself change the message body's size) is handled
  // internally by observeSize.
  anchorVisibleRectEffect.observeSize(calloutMessageElement);

  return {
    update: anchorVisibleRectEffect.check,
    stop: () => {
      anchorVisibleRectEffect.disconnect();
    },
  };
};

// Void elements and replaced elements cannot have children
const VOID_ELEMENT_TAG_NAMES = new Set([
  "AREA",
  "BASE",
  "BR",
  "COL",
  "EMBED",
  "HR",
  "IMG",
  "INPUT",
  "LINK",
  "META",
  "PARAM",
  "SOURCE",
  "TRACK",
  "WBR",
]);
const canContainCallout = (element) => {
  if (VOID_ELEMENT_TAG_NAMES.has(element.tagName)) {
    return false;
  }
  if (element.tagName === "BUTTON") {
    // callout itself contains a button, browser would not let that happen
    return false;
  }
  return true;
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Checks if a string is a full HTML document (starts with DOCTYPE)
 * @param {string} content - The content to check
 * @returns {boolean} - True if it looks like a complete HTML document
 */
const isHtmlDocument = (content) => {
  if (typeof content !== "string") {
    return false;
  }
  // Trim whitespace and check if it starts with DOCTYPE (case insensitive)
  const trimmed = content.trim();
  return /^<!doctype\s+html/i.test(trimmed);
};

// It's ok to do this because the element is absolutely positioned
// maxHeight, when provided, is applied to the clone's message so the measurement
// accounts for the scrollbar width that will appear on the real element.
//
// Goal: shrink-wrap the callout body so it hugs the wrapped text with no blank
// space to the right of shorter lines.
//
// The CSS "shrink-to-fit" algorithm (display:inline-block / fit-content) expands
// the element to the widest line it *could* have given the max-width constraint,
// not to the widest line that actually rendered. This leaves trailing whitespace
// when text wraps at a point shorter than max-width.
// See: https://github.com/w3c/csswg-drafts/issues/191
//
// Fix: use Range.getClientRects() to get one rect per rendered text line, find
// the widest one, and set an explicit width on the body equal to that line width
// (adjusted for the body's box-sizing and the non-message siblings — icon, gap,
// close button). After the explicit width is set the element is exactly as wide
// as its longest line, so no blank area remains to the right of shorter lines.
const measureOptimalBodyWidth = (calloutElementClone, { maxHeight } = {}) => {
  const calloutBodyElement =
    calloutElementClone.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElementClone.querySelector(
    ".navi_callout_message",
  );
  if (maxHeight !== undefined) {
    calloutMessageElement.style.maxHeight = `${maxHeight}px`;
    calloutMessageElement.style.overflowY = "scroll";
  } else {
    calloutMessageElement.style.maxHeight = "";
    calloutMessageElement.style.overflowY = "";
  }
  const longestLineWidth = measureLongestVisualLineWidth(calloutMessageElement);
  if (longestLineWidth === null) {
    return null;
  }
  const messageRect = calloutMessageElement.getBoundingClientRect();
  // bodyRect.width is always the border-box size (content + padding + border).
  // style.width interprets differently depending on box-sizing:
  //   border-box → sets total width (includes padding) → use bodyRect.width directly
  //   content-box → sets content only → subtract body horizontal padding first
  const bodyRect = calloutBodyElement.getBoundingClientRect();
  const bodyStyle = getComputedStyle(calloutBodyElement);
  if (bodyStyle.boxSizing === "border-box") {
    return Math.ceil(bodyRect.width - messageRect.width + longestLineWidth);
  }
  const bodyPaddingH =
    parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight);
  return Math.ceil(
    bodyRect.width - bodyPaddingH - messageRect.width + longestLineWidth,
  );
};

const cloneCalloutToMeasureNaturalSize = (calloutElement) => {
  // Create invisible clone to measure natural size
  const calloutElementClone = calloutElement.cloneNode(true);
  calloutElementClone.style.visibility = "hidden";
  const calloutBodyElementClone =
    calloutElementClone.querySelector(".navi_callout_body");
  const calloutMessageElementClone = calloutElementClone.querySelector(
    ".navi_callout_message",
  );
  // Reset any constrained styles on the clone so it measures natural size
  calloutBodyElementClone.style.width = "";
  calloutMessageElementClone.style.maxHeight = "";
  calloutMessageElementClone.style.overflowY = "";

  // Add clone to DOM to measure
  calloutElement.parentNode.appendChild(calloutElementClone);
  calloutElementClone.showPopover();

  return calloutElementClone;
};

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

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
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

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
    </svg>`;
};

/**
 * Generates SVG path for callout without arrow (simple rectangle)
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @returns {string} - SVG markup
 */
const generateSvgWithoutArrow = (width, height) => {
  return /* html */ `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <rect
        class="navi_callout_border"
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="${CORNER_RADIUS}"
        ry="${CORNER_RADIUS}"
      />
      <rect
        class="navi_callout_background"
        x="${BORDER_WIDTH}"
        y="${BORDER_WIDTH}"
        width="${width - BORDER_WIDTH * 2}"
        height="${height - BORDER_WIDTH * 2}"
        rx="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
        ry="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
      />
    </svg>`;
};
