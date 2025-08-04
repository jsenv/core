import {
  createAnimationController,
  createStep,
} from "../animation/create_animation_controller.js";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";

import.meta.css = /* css */ `
  .ui-transition-container {
    position: relative;
  }

  .ui-transition-content {
    position: relative;
  }

  .ui-transition-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  [data-ui-transition-old] {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
`;

const DEBUG = true;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }

  console.debug(...args);
};

export const initUITransition = (container, { resizeDuration = 300 } = {}) => {
  // Validate and get references to required elements
  if (!container.classList.contains("ui-transition-container")) {
    console.error("Element must have ui-transition-container class");
    return { cleanup: () => {} };
  }

  // Required structure:
  // <div class="ui-transition-container">
  //   <div class="ui-transition-outer-wrapper"> <!-- for animation constraints -->
  //     <div class="ui-transition-measure-wrapper"> <!-- for content measurements -->
  //       <div class="ui-transition-content">
  //         <!-- actual content -->
  //       </div>
  //     </div>
  //   </div>
  //   <div class="ui-transition-overlay">
  //     <!-- transition elements (clones) are inserted here -->
  //   </div>
  // </div>

  const outerWrapper = container.querySelector(".ui-transition-outer-wrapper");
  const measureWrapper = container.querySelector(
    ".ui-transition-measure-wrapper",
  );
  const content = container.querySelector(".ui-transition-content");
  const transitionOverlay = container.querySelector(".ui-transition-overlay");

  // Create overlay if it doesn't exist
  if (!transitionOverlay) {
    const overlay = document.createElement("div");
    overlay.className = "ui-transition-overlay";
    container.appendChild(overlay);
  }
  if (!outerWrapper || !measureWrapper || !content) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const sizeAnimationController = createAnimationController({
    duration: resizeDuration,
  });
  let transitionAnimation = null;

  // Track dimensions and UI state
  let lastContentWidth = 0; // Last known content state width
  let lastContentHeight = 0; // Last known content state height
  let currentWidth = 0; // Current width we're animating from
  let currentHeight = 0; // Current height we're animating from
  let lastUIKey = null; // Track the last UI key to detect content changes
  let wasInheritingDimensions = false; // Track if previous content was inheriting dimensions
  let resizeObserver = null;

  const measureSize = () => {
    // We measure the inner wrapper which is not constrained by animations
    // This gives us the natural content size
    return [getWidth(measureWrapper), getHeight(measureWrapper)];
  };

  const updateLastContentDimensions = () => {
    // Measure natural size using measure wrapper which has no constraints
    // No need to remove constraints since measureWrapper is always unconstrained
    const [newWidth, newHeight] = measureSize();
    debug("📊 Content natural size from ResizeObserver:", {
      width: `${lastContentWidth} → ${newWidth}`,
      height: `${lastContentHeight} → ${newHeight}`,
    });
    lastContentWidth = newWidth;
    lastContentHeight = newHeight;

    // If we have an ongoing size animation, update it
    if (sizeAnimationController.pending) {
      debug(
        "🎯 Updating animation target height to match content:",
        newHeight,
        `(current: ${currentHeight})`,
      );
      // Start animation from current constrained height to new height
      animateSize(newWidth, newHeight, {
        onEnd: () => {
          letContentSelfManage("size animation completed");
        },
      });
    } else {
      currentWidth = newWidth;
      currentHeight = newHeight;
    }
  };

  const stopObservingResize = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };

  const startObservingResize = () => {
    resizeObserver = new ResizeObserver(() => {
      updateLastContentDimensions(content);
    });
    resizeObserver.observe(measureWrapper);
  };

  const letContentSelfManage = (reason) => {
    debug(`↕️ Letting content self-manage size (${reason})`);
    // First measure the current size while constrained
    const [beforeWidth, beforeHeight] = measureSize();
    // Release constraints
    outerWrapper.style.width = "";
    outerWrapper.style.height = "";
    outerWrapper.style.overflow = "";
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

  const animateSize = (targetWidth, targetHeight, { onEnd } = {}) => {
    debug("🎬 Starting size animation", {
      width: `${currentWidth} → ${targetWidth}`,
      height: `${currentHeight} → ${targetHeight}`,
    });
    outerWrapper.style.overflow = "hidden";

    const steps = [];
    if (targetWidth !== currentWidth) {
      steps.push(
        createStep({
          element: outerWrapper,
          property: "width",
          target: targetWidth,
          sideEffect: (value) => {
            // debug(`📏 Width updated: ${currentWidth} → ${value}`);
            currentWidth = value;
          },
        }),
      );
    }
    if (targetHeight !== currentHeight) {
      steps.push(
        createStep({
          element: outerWrapper,
          property: "height",
          target: targetHeight,
          sideEffect: (value) => {
            // debug(`📏 Height updated: ${currentHeight} → ${value}`);
            currentHeight = value;
          },
        }),
      );
    }
    sizeAnimationController.animateAll(steps, {
      onEnd,
    });
  };

  [currentWidth, currentHeight] = measureSize();
  outerWrapper.style.width = `${currentWidth}px`;
  outerWrapper.style.height = `${currentHeight}px`;
  outerWrapper.style.overflow = "hidden";

  let isUpdating = false;
  let previousContent = null; // Track previous content for transitions

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

      // Cancel any ongoing animations
      sizeAnimationController.cancel();
      // No need to remove constraints from outerWrapper since we measure the inner wrapper
      const [newWidth, newHeight] = measureSize();
      debug(`📐 Measured size: ${newWidth}x${newHeight}`);
      // Make sure outer wrapper has current constraints
      outerWrapper.style.width = `${currentWidth}px`;
      outerWrapper.style.height = `${currentHeight}px`;

      debug("🏷️ Content info:", {
        currentUIKey,
        lastUIKey,
        inheritContentDimensions,
        lastContentWidth,
        lastContentHeight,
      });

      // Handle resize observation based on content type
      stopObservingResize(); // Always cleanup first
      if (
        firstChild &&
        !firstChild.hasAttribute("data-inherit-content-dimensions")
      ) {
        startObservingResize();
        debug("👀 ResizeObserver: Observing content");
      } else {
        debug(
          "👀 ResizeObserver: Skipping observation for loading/error state",
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

      // Handle transitions between UI states if we have content
      if (firstChild) {
        let oldContent = null;
        if (previousContent) {
          // Clone and prepare the old content before creating steps
          oldContent = previousContent.cloneNode(true);
          oldContent.removeAttribute("data-ui-key");
          oldContent.setAttribute("data-ui-transition-old", "");
          transitionOverlay.appendChild(oldContent);
        }
        // Cancel any ongoing transition before starting a new one
        if (transitionAnimation) {
          transitionAnimation.cancel();
        }
        transitionAnimation = animateTransition(oldContent, firstChild);
      }

      // Store the current content for next transition
      // We must clone it before any mutations occur
      previousContent = firstChild ? firstChild.cloneNode(true) : null;

      // Detect state transitions before updating state
      const becomesContent =
        wasInheritingDimensions && !inheritContentDimensions;

      // Store current state for next update
      lastUIKey = currentUIKey;
      wasInheritingDimensions = inheritContentDimensions;

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
          letContentSelfManage("no size change needed");
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
      if (becomesContent || (isUIKeyChange && !inheritContentDimensions)) {
        // Animate when:
        // 1. New content with different key
        // 2. Transitioning from loading/error state (wasInheriting) to actual content (!inheriting)
        debug("🎭 Transitioning to actual content, animating size");
        animateSize(targetWidth, targetHeight, {
          onEnd: () => {
            letContentSelfManage("all animations completed");
          },
        });
      } else if (isUIKeyChange || inheritContentDimensions) {
        // Either:
        // 1. UI key changed but we want to inherit content dimensions (loading/error state)
        // 2. Same UI key but inherit dimensions requested
        animateSize(targetWidth, targetHeight, {
          onEnd: () => {
            letContentSelfManage("all animations completed");
          },
        });
      } else {
        // Same UI key, no special states: no need to animate, let content handle its own size
        letContentSelfManage("direct content update");
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
      stopObservingResize();
      sizeAnimationController.cancel();
      if (transitionAnimation) {
        transitionAnimation.cancel();
      }
    },
    pause: () => {
      if (transitionAnimation) {
        transitionAnimation.pause();
      }
    },
    resume: () => {
      if (transitionAnimation) {
        transitionAnimation.resume();
      }
    },
    getState: () => ({
      isPaused: transitionAnimation?.isPaused() || false,
      transitionInProgress: Boolean(transitionAnimation),
      opacity: transitionAnimation?.animatedValues.opacity || null,
    }),
    // Additional methods could be added here for direct control
    // setContent: (content) => {...}
    // transition: (from, to) => {...}
  };
};

const animateTransition = (
  oldContent,
  newElement,
  { type = "cross-fade", onEnd } = {},
) => {
  if (type !== "cross-fade") {
    return null;
  }

  // Get transition duration from data attribute or use default
  const duration =
    parseInt(
      newElement.closest("[data-ui-transition-duration]")?.dataset
        .uiTransitionDuration,
      10,
    ) || 300;
  const animation = createAnimationController({
    duration,
  });

  // Get the current opacity of old content (if any) to use as starting point
  const startOpacity = oldContent
    ? parseFloat(getComputedStyle(oldContent).opacity)
    : 0;

  // Setup initial state
  if (oldContent) {
    oldContent.style.opacity = startOpacity.toString();
  }
  newElement.style.opacity = startOpacity.toString();

  if (!oldContent) {
    // Case 1: Empty -> Content (fade in only)
    animation.animateAll([
      createStep({
        element: newElement,
        property: "opacity",
        target: 1,
        sideEffect: (_, { timing }) => {
          if (timing === "end") {
            newElement.style.opacity = "";
            onEnd?.();
          }
        },
      }),
    ]);
    return animation;
  }

  // Case 2 & 3: Cross-fade between states
  animation.animateAll([
    createStep({
      element: oldContent,
      property: "opacity",
      target: 0,
    }),
    createStep({
      element: newElement,
      property: "opacity",
      target: 1,
      sideEffect: (_, { timing }) => {
        if (timing === "end") {
          newElement.style.opacity = "";
          onEnd?.();
        }
      },
    }),
  ]);
  return animation;
};
