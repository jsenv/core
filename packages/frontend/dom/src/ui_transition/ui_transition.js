import {
  createAnimationController,
  createStep,
} from "../animation/create_animation_controller.js";
import { getInnerHeight } from "../size/get_inner_height.js";
import { getInnerWidth } from "../size/get_inner_width.js";

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
      lastContentWidth = getInnerWidth(element);
      lastContentHeight = getInnerHeight(element);
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
    return [getInnerWidth(content), getInnerHeight(content)];
  };
  [currentWidth, currentHeight] = measureSize();
  wrapper.style.width = `${currentWidth}px`;
  wrapper.style.height = `${currentHeight}px`;
  wrapper.style.overflow = "hidden";

  let isUpdating = false;

  const updateSize = () => {
    if (isUpdating) {
      return; // Prevent recursive updates
    }

    try {
      isUpdating = true;

      // Temporarily remove size constraints to measure true content size
      wrapper.style.width = "";
      wrapper.style.height = "";
      animationController.cancel(); // ensure any ongoing animations are stopped otherwise size measurements will be incorrect
      const [newWidth, newHeight] = measureSize();
      // Restore current size constraints
      wrapper.style.width = `${currentWidth}px`;
      wrapper.style.height = `${currentHeight}px`;

      // Get current UI key and state information
      const firstChild = content.children[0];
      const currentUIKey = firstChild?.getAttribute("data-ui-key");
      const inheritContentDimensions = firstChild?.hasAttribute(
        "data-inherit-content-dimensions",
      );

      // Setup resize observer for content elements
      if (firstChild) {
        setupResizeObserver(firstChild);
      }

      // Determine transition type based on UI key
      const isUIKeyChange = lastUIKey !== null && currentUIKey !== lastUIKey;

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
        return;
      }

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
        // In both cases: maintain last known content dimensions
        const nextWidth = lastContentWidth || newWidth;
        const nextHeight = lastContentHeight || newHeight;

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
    }
  };

  // Watch for direct children mutations only in the content area
  // We only care about top-level content changes where data-ui-key lives
  const mutationObserver = new MutationObserver(() => {
    updateSize();
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
