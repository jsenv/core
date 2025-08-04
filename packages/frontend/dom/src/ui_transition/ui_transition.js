import {
  createAnimationController,
  createStep,
} from "../animation/create_animation_controller.js";
import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";

import.meta.css = /* css */ `
  .ui-transition-content {
    position: relative;
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

export const initUITransition = (container, { duration = 300 } = {}) => {
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
  // </div>

  const outerWrapper = container.querySelector(".ui-transition-outer-wrapper");
  const measureWrapper = container.querySelector(
    ".ui-transition-measure-wrapper",
  );
  const content = container.querySelector(".ui-transition-content");
  if (!outerWrapper || !measureWrapper || !content) {
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

    // If we have an ongoing animation and content has data-animate-height,
    // update the animation target to match the natural content height
    if (animationController.pending) {
      debug(
        "🎯 Updating animation target height to match content:",
        newHeight,
        `(current: ${currentHeight})`,
      );
      // Start animation from current constrained height to new height
      const sizeSteps = createSizeSteps(newWidth, newHeight);
      if (sizeSteps.length > 0) {
        animationController.animateAll(sizeSteps, {
          onEnd: () => {
            letContentSelfManage("size animation completed");
          },
        });
      }
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

  const createSizeSteps = (targetWidth, targetHeight) => {
    debug("🎬 Creating size animation steps", {
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
    return steps;
  };

  [currentWidth, currentHeight] = measureSize();
  outerWrapper.style.width = `${currentWidth}px`;
  outerWrapper.style.height = `${currentHeight}px`;
  outerWrapper.style.overflow = "hidden";

  let isUpdating = false;
  let previousContent = null; // Track previous content for transitions

  const createTransitionSteps = (
    oldElement,
    newElement,
    { type = "none" } = {},
  ) => {
    const steps = [];
    if (type === "cross-fade") {
      if (!oldElement) {
        // Case 1: Empty -> Content (fade in only)
        newElement.style.opacity = "0";
        steps.push(
          createStep({
            element: newElement,
            property: "opacity",
            target: 1,
            sideEffect: (_, { timing }) => {
              if (timing === "end") {
                newElement.style.opacity = "";
              }
            },
          }),
        );
        return steps;
      }

      // Case 2 & 3: Cross-fade between states
      const oldContent = oldElement.cloneNode(true);
      oldContent.removeAttribute("data-ui-key");
      oldContent.setAttribute("data-ui-transition-old", "");
      oldContent.style.opacity = "1";
      oldContent.classList.add("ui-transition-old-content");
      content.insertBefore(oldContent, newElement);
      newElement.style.opacity = "0";

      steps.push(
        createStep({
          element: oldContent,
          property: "opacity",
          target: 0,
          sideEffect: (_, { timing }) => {
            if (timing === "end" && oldContent.parentNode) {
              oldContent.remove();
            }
          },
        }),
        createStep({
          element: newElement,
          property: "opacity",
          target: 1,
          sideEffect: (_, { timing }) => {
            if (timing === "end") {
              newElement.style.opacity = "";
            }
          },
        }),
      );
    }
    return steps;
  };

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
      animationController.cancel(); // ensure any ongoing animations are stopped
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

      // Prepare animation steps
      const animationSteps = [];

      // Handle transitions between UI states if we have content
      if (firstChild) {
        // Use the tracked previous content for transition
        const transitionSteps = createTransitionSteps(
          previousContent,
          firstChild,
        );
        animationSteps.push(...transitionSteps);
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
        const sizeSteps = createSizeSteps(targetWidth, targetHeight);
        animationSteps.push(...sizeSteps);
      } else if (isUIKeyChange || inheritContentDimensions) {
        // Either:
        // 1. UI key changed but we want to inherit content dimensions (loading/error state)
        // 2. Same UI key but inherit dimensions requested
        const sizeSteps = createSizeSteps(targetWidth, targetHeight);
        animationSteps.push(...sizeSteps);
      } else {
        // Same UI key, no special states: no need to animate, let content handle its own size
        letContentSelfManage("direct content update");
      }

      // Execute all animation steps together
      if (animationSteps.length > 0) {
        animationController.animateAll(animationSteps, {
          onEnd: () => {
            letContentSelfManage("all animations completed");
          },
        });
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
      animationController.cancel();
    },
    // Additional methods could be added here for direct control
    // setContent: (content) => {...}
    // transition: (from, to) => {...}
  };
};
