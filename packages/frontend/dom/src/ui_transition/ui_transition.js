import {
  createAnimationController,
  createStep,
} from "../animation/create_animation_controller.js";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";

const DEBUG = true;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }

  console.debug(...args);
};

export const initUITransition = (container, { duration = 300 } = {}) => {
  // Validate and get references to required elements
  if (!container.classList.contains("ui-transition-container")) {
    console.error("Element must have ui-transition-container class");
    return { cleanup: () => {} };
  }

  const wrapper = container.querySelector(".ui-transition-wrapper");
  const content = container.querySelector(".ui-transition-content");
  if (!wrapper || !content) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const animationController = createAnimationController({ duration });

  // Track dimensions and UI state
  let lastContentWidth = 0; // Last known content state width
  let lastContentHeight = 0; // Last known content state height
  let currentWidth = 0; // Current width we're animating from
  let currentHeight = 0; // Current height we're animating from
  let lastUIKey = null; // Track the last UI key to detect content changes
  let resizeObserver = null;

  const updateLastContentDimensions = (element) => {
    // Only track dimensions of actual content (not loading/error states)
    if (!element.hasAttribute("data-inherit-content-dimensions")) {
      const [newWidth, newHeight] = measureSize();
      debug("📊 Content dimensions updated via ResizeObserver:", {
        width: `${lastContentWidth} → ${newWidth}`,
        height: `${lastContentHeight} → ${newHeight}`,
      });
      lastContentWidth = newWidth;
      lastContentHeight = newHeight;
    }
  };

  // Setup resize observer to track content size changes
  const setupResizeObserver = (element) => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    // Only observe actual content elements
    if (!element.hasAttribute("data-inherit-content-dimensions")) {
      resizeObserver = new ResizeObserver(() => {
        updateLastContentDimensions(element);
      });
      resizeObserver.observe(element);
    }
  };

  const measureSize = () => {
    // we can measure the wrapper directly because we don't use padding no border
    // this allows to measure eventual margins used by the content that would overflow and
    // take some space on the wrapper
    return [getWidth(wrapper), getHeight(wrapper)];
  };
  [currentWidth, currentHeight] = measureSize();
  wrapper.style.width = `${currentWidth}px`;
  wrapper.style.height = `${currentHeight}px`;
  wrapper.style.overflow = "hidden";

  let isUpdating = false;

  const onMutation = () => {
    if (isUpdating) {
      debug("⚠️ Preventing recursive update");
      return; // Prevent recursive updates
    }

    try {
      isUpdating = true;
      if (DEBUG) {
        console.group("UI Transition Update");
      }
      debug(
        `🔄 Update triggered, current size: ${currentWidth}x${currentHeight}`,
      );

      // Temporarily remove size constraints to measure true content size
      wrapper.style.width = "";
      wrapper.style.height = "";
      animationController.cancel(); // ensure any ongoing animations are stopped otherwise size measurements will be incorrect
      const [newWidth, newHeight] = measureSize();
      if (newHeight === 92) {
        debugger;
      }
      debug(`📐 Measured size: ${newWidth}x${newHeight}`);
      // Restore current size constraints
      wrapper.style.width = `${currentWidth}px`;
      wrapper.style.height = `${currentHeight}px`;

      // Get current UI key and state information
      const firstChild = content.children[0];
      const currentUIKey = firstChild?.getAttribute("data-ui-key");
      const inheritContentDimensions = firstChild?.hasAttribute(
        "data-inherit-content-dimensions",
      );

      debug("🏷️ Content info:", {
        currentUIKey,
        lastUIKey,
        inheritContentDimensions,
        lastContentWidth,
        lastContentHeight,
      });

      // Setup resize observer for content elements
      if (firstChild) {
        setupResizeObserver(firstChild);
        debug(
          "👀 ResizeObserver:",
          !firstChild.hasAttribute("data-inherit-content-dimensions")
            ? "Observing content"
            : "Skipping non-content element",
        );
      }

      // Determine transition type based on UI key
      const isUIKeyChange = lastUIKey !== null && currentUIKey !== lastUIKey;
      debug("🔄 Transition type:", {
        isUIKeyChange,
        reason: isUIKeyChange
          ? `Key change from ${lastUIKey} to ${currentUIKey}`
          : "Same key",
      });

      // TODO: Handle cross-fade transitions
      // if (isUIKeyChange || (lastUIKey && preserveContentHeight)) {
      //   // 1. Clone current content
      //   // 2. Position it absolutely
      //   // 3. Add new content
      //   // 4. Fade between them
      //   // 5. Clean up after animation
      // }

      // Store current UI key for next update
      lastUIKey = currentUIKey;

      // Skip size animation if no changes
      if (newWidth === currentWidth && newHeight === currentHeight) {
        debug("⏭️ Skipping animation - no size changes");
        console.groupEnd();
        return;
      }

      debug("📏 Size change detected", {
        width: `${currentWidth} → ${newWidth}`,
        height: `${currentHeight} → ${newHeight}`,
      });

      // Handle height inheritance and animation based on state
      if (isUIKeyChange && !inheritContentDimensions) {
        // New content (not a loading/error state): animate to new dimensions and release constraints after
        // Content dimensions will be tracked by ResizeObserver
        wrapper.style.overflow = "hidden";
        animationController.animateAll(
          [
            createStep({
              element: wrapper,
              property: "width",
              target: newWidth,
            }),
            createStep({
              element: wrapper,
              property: "height",
              target: newHeight,
            }),
          ],
          {
            onChange: (changes, isComplete) => {
              if (isComplete) {
                // Remove size constraints after animation completes
                wrapper.style.width = "";
                wrapper.style.height = "";
                wrapper.style.overflow = "";
              }
            },
          },
        );
        currentWidth = newWidth;
        currentHeight = newHeight;
      } else if (isUIKeyChange || inheritContentDimensions) {
        // Either:
        // 1. UI key changed but we want to inherit content dimensions (loading/error state)
        // 2. Same UI key but inherit dimensions requested
        // If we have content dimensions, use those. Otherwise use measured dimensions
        // This ensures we don't collapse to 0 when transitioning between loading/error states
        // before any real content has been shown
        const shouldUseNewDimensions =
          lastContentWidth === 0 && lastContentHeight === 0;
        const nextWidth = shouldUseNewDimensions
          ? newWidth
          : lastContentWidth || newWidth;
        const nextHeight = shouldUseNewDimensions
          ? newHeight
          : lastContentHeight || newHeight;

        debug("📐 Using dimensions:", {
          width: nextWidth,
          height: nextHeight,
          source: shouldUseNewDimensions ? "measured" : "inherited",
        });

        wrapper.style.overflow = "hidden";
        animationController.animateAll([
          createStep({
            element: wrapper,
            property: "width",
            target: nextWidth,
          }),
          createStep({
            element: wrapper,
            property: "height",
            target: nextHeight,
          }),
        ]);
        currentWidth = nextWidth;
        currentHeight = nextHeight;
      } else {
        // Same UI key, no height preservation: don't animate or constrain
        debug("↕️ Removing size constraints - content is self-managing");
        lastContentWidth = newWidth;
        lastContentHeight = newHeight;
        wrapper.style.width = "";
        wrapper.style.height = "";
        wrapper.style.overflow = "";
        currentWidth = newWidth;
        currentHeight = newHeight;
      }
    } finally {
      isUpdating = false;
      if (DEBUG) {
        console.groupEnd();
      }
    }
  };

  // Watch for direct children mutations only in the content area
  // We only care about top-level content changes where data-ui-key lives
  const mutationObserver = new MutationObserver(() => {
    onMutation();
  });

  // Start observing only direct children of the content element
  mutationObserver.observe(content, {
    childList: true, // Only watch for direct children changes
    subtree: false, // Don't watch nested changes
    characterData: false, // Don't watch for text changes
  });

  // Return cleanup function and API
  return {
    cleanup: () => {
      mutationObserver.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      animationController.cancel();
    },
    // Additional methods could be added here for direct control
    // setContent: (content) => {...}
    // transition: (from, to) => {...}
  };
};
