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

export const initUITransition = (container, { duration = 3000 } = {}) => {
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
    if (element.hasAttribute("data-inherit-content-dimensions")) {
      // Only track dimensions of actual content (not loading/error states)
      return;
    }
    const [newWidth, newHeight] = measureSize();
    debug("📊 Content dimensions updated via ResizeObserver:", {
      width: `${lastContentWidth} → ${newWidth}`,
      height: `${lastContentHeight} → ${newHeight}`,
    });
    lastContentWidth = newWidth;
    lastContentHeight = newHeight;

    // If we have an ongoing animation and content has data-animate-height,
    // update the animation target to match the new content height
    if (animationController.pending) {
      debug(
        "🎯 Updating animation target height to match content:",
        newHeight,
        `(current: ${currentHeight})`,
      );
      // Start animation from current constrained height to new height
      animateSize(newWidth, newHeight, { releaseConstraintsAfter: true });
    } else {
      currentWidth = newWidth;
      currentHeight = newHeight;
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

  const letContentSelfManage = () => {
    debug("↕️ Letting content self-manage size");
    // First measure the current size while constrained
    const [beforeWidth, beforeHeight] = measureSize();
    // Release constraints
    wrapper.style.width = "";
    wrapper.style.height = "";
    wrapper.style.overflow = "";
    // Measure actual size after releasing constraints
    const [afterWidth, afterHeight] = measureSize();
    debug("📏 Size after self-manage:", {
      width: `${beforeWidth} → ${afterWidth}`,
      height: `${beforeHeight} → ${afterHeight}`,
    });
    // Update with actual measured values
    currentWidth = afterWidth;
    currentHeight = afterHeight;
    lastContentWidth = afterWidth;
    lastContentHeight = afterHeight;
  };

  const animateSize = (
    targetWidth,
    targetHeight,
    { releaseConstraintsAfter = false } = {},
  ) => {
    debug("🎬 Animating size", {
      width: `${currentWidth} → ${targetWidth}`,
      height: `${currentHeight} → ${targetHeight}`,
      releaseConstraints: releaseConstraintsAfter,
    });
    wrapper.style.overflow = "hidden";
    animationController.animateAll(
      [
        createStep({
          element: wrapper,
          property: "width",
          target: targetWidth,
        }),
        createStep({
          element: wrapper,
          property: "height",
          target: targetHeight,
        }),
      ],
      {
        onChange: (changes) => {
          // Update current dimensions based on animation progress
          for (const change of changes) {
            if (change.property === "width") {
              currentWidth = change.value;
            }
            if (change.property === "height") {
              currentHeight = change.value;
            }
          }
        },
        onEnd: () => {
          if (releaseConstraintsAfter) {
            letContentSelfManage();
          }
        },
      },
    );
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
      // Get current UI key and state information
      const firstChild = content.children[0];
      const childUIName = firstChild?.getAttribute("data-ui-name");
      const currentUIKey = firstChild?.getAttribute("data-ui-key");
      const inheritContentDimensions = firstChild?.hasAttribute(
        "data-inherit-content-dimensions",
      );

      if (DEBUG) {
        console.group(`UI Transition Update (${childUIName})`);
      }
      debug(
        `🔄 Update triggered, current size: ${currentWidth}x${currentHeight}`,
      );

      // Temporarily remove size constraints to measure true content size
      animationController.cancel(); // ensure any ongoing animations are stopped otherwise size measurements will be incorrect
      wrapper.style.width = "";
      wrapper.style.height = "";
      const [newWidth, newHeight] = measureSize();
      debug(`📐 Measured size: ${newWidth}x${newHeight}`);
      // Restore current size constraints
      wrapper.style.width = `${currentWidth}px`;
      wrapper.style.height = `${currentHeight}px`;

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

      const getTargetDimensions = () => {
        if (!inheritContentDimensions) {
          return [newWidth, newHeight];
        }
        const shouldUseNewDimensions =
          lastContentWidth === 0 && lastContentHeight === 0;
        const targetWidth = shouldUseNewDimensions
          ? newWidth
          : lastContentWidth || newWidth;
        const targetHeight = shouldUseNewDimensions
          ? newHeight
          : lastContentHeight || newHeight;
        return [targetWidth, targetHeight];
      };

      const [targetWidth, targetHeight] = getTargetDimensions();

      // Skip animation if no size changes needed
      if (targetWidth === currentWidth && targetHeight === currentHeight) {
        debug("⏭️ No size change required");
        // Even with no changes, we should release constraints for regular content
        // This is important for elements that manage their own height animation
        if (!inheritContentDimensions) {
          letContentSelfManage();
        }
        if (DEBUG) {
          console.groupEnd();
        }
        return;
      }

      debug("📏 Size change needed", {
        width: `${currentWidth} → ${targetWidth}`,
        height: `${currentHeight} → ${targetHeight}`,
      });

      // Handle height inheritance and animation based on state
      if (isUIKeyChange && !inheritContentDimensions) {
        // New content (not a loading/error state): animate to new dimensions and release constraints after
        // Content dimensions will be tracked by ResizeObserver
        animateSize(targetWidth, targetHeight, {
          releaseConstraintsAfter: true,
        });
      } else if (isUIKeyChange || inheritContentDimensions) {
        // Either:
        // 1. UI key changed but we want to inherit content dimensions (loading/error state)
        // 2. Same UI key but inherit dimensions requested
        animateSize(targetWidth, targetHeight);
      } else {
        // Same UI key, no height preservation: don't animate or constrain
        letContentSelfManage();
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
