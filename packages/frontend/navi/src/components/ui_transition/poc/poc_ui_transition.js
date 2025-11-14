/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects
 */

import.meta.css = /* css */ `
  .transition-container {
    --transition-duration: 3000ms;
    --justify-content: center;
    --align-items: center;
    --background-color: white;

    --x-transition-duration: var(--transition-duration);
    --x-justify-content: var(--justify-content);
    --x-align-items: var(--align-items);

    position: relative;
    background: var(--background-color);
    border: 8px dashed #ccc;
    border-radius: 8px;
    /* Transition sur les dimensions avec variable CSS */
    transition:
      width var(--x-transition-duration) ease,
      height var(--x-transition-duration) ease;
    /* Overflow hidden pour que le contenu soit coupé pendant la transition */
    overflow: hidden;
  }

  /* Content wrapper - container for all slots */
  .content-wrapper {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

  /* Alignment controls */
  .transition-container[data-align-x="start"] {
    --x-justify-content: flex-start;
  }
  .transition-container[data-align-x="center"] {
    --x-justify-content: center;
  }
  .transition-container[data-align-x="end"] {
    --x-justify-content: flex-end;
  }
  .transition-container[data-align-y="start"] {
    --x-align-items: flex-start;
  }
  .transition-container[data-align-y="center"] {
    --x-align-items: center;
  }
  .transition-container[data-align-y="end"] {
    --x-align-items: flex-end;
  }

  /* Content slot - for regular content */
  .content-slot {
    position: relative;
  }

  /* Phase slot - for phase states, positioned above content */
  .phase-slot {
    position: absolute;
  }

  /* Old content slot - for fade-out content */
  .old-content-slot {
    position: absolute;
  }

  /* Old phase slot - for fade-out phases */
  .old-phase-slot {
    position: absolute;
  }

  /* Styles for content in old slots */
  .old-content-slot > *,
  .old-phase-slot > * {
    position: static !important;
    z-index: auto !important;
    pointer-events: none !important;
  }

  /* Hide slots when empty */
  .content-slot:empty,
  .phase-slot:empty,
  .old-content-slot:empty,
  .old-phase-slot:empty {
    display: none;
  }
`;

export const createUITransitionController = (
  container,
  {
    duration = 300,
    alignX = "center",
    alignY = "center",
    onStateChange = () => {},
  } = {},
) => {
  // Required elements
  const contentSlot = container.querySelector(".content-slot");
  const phaseSlot = container.querySelector(".phase-slot");
  const oldContentSlot = container.querySelector(".old-content-slot");
  const oldPhaseSlot = container.querySelector(".old-phase-slot");
  const wrapper = container.querySelector(".content-wrapper");

  if (
    !container ||
    !contentSlot ||
    !phaseSlot ||
    !oldContentSlot ||
    !oldPhaseSlot ||
    !wrapper
  ) {
    throw new Error(
      "createUITransitionController requires container with content-slot, phase-slot, old-content-slot, old-phase-slot, and content-wrapper elements",
    );
  }

  // Internal state
  let isTransitioning = false;
  let isInPhaseState = false;
  // Dimension tracking
  let width;
  let height;
  let contentWidth;
  let contentHeight;
  let phaseWidth;
  let phaseHeight;
  let targetWidth;
  let targetHeight;

  // Capture initial content from content slot
  const initialContent = contentSlot.firstElementChild
    ? contentSlot.firstElementChild.cloneNode(true)
    : null;

  // Update alignment of content within the transition area
  const updateAlignment = () => {
    // Set data attributes for CSS-based alignment
    container.setAttribute("data-align-x", alignX);
    container.setAttribute("data-align-y", alignY);
  };

  // Get dimensions of an element
  const getDimensions = (element) => {
    if (!element) {
      console.warn("Element not found for dimension measurement");
      return { width: undefined, height: undefined };
    }
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  };

  const updateContentDimensions = () => {
    const currentContent = contentSlot?.firstElementChild;
    const dimensions = getDimensions(currentContent);
    contentWidth = dimensions.width;
    contentHeight = dimensions.height;
  };
  const updatePhaseDimensions = () => {
    const currentPhase = phaseSlot?.firstElementChild;
    const dimensions = getDimensions(currentPhase);
    phaseWidth = dimensions.width;
    phaseHeight = dimensions.height;
  };

  // Setup cross-fade styling between old and new content
  const applyContentToContentTransition = () => {
    dimension: {
      updateContentDimensions();
      targetWidth = contentWidth;
      targetHeight = contentHeight;

      // Apply dimension transition
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      requestAnimationFrame(() => {
        // Start dimension transition
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
      });
    }
    opacity: {
      // Set initial state: old content visible, new content hidden
      if (oldContentSlot.firstElementChild) {
        oldContentSlot.style.opacity = "1";
        oldContentSlot.style.transition = "none";
      }
      contentSlot.style.opacity = "0";
      contentSlot.style.transition = "none";

      requestAnimationFrame(() => {
        if (oldContentSlot.firstElementChild) {
          oldContentSlot.style.transition = `opacity ${duration}ms ease`;
          oldContentSlot.style.opacity = "0"; // Fade out old
        }
        contentSlot.style.transition = `opacity ${duration}ms ease`;
        contentSlot.style.opacity = "1"; // Fade in new
      });
    }
    // Set transition state marker
    container.setAttribute("data-transitioning", "true");
    // Force reflow to stabilize DOM
    const reflow = contentSlot.offsetHeight;
    console.debug("Content transition reflow:", reflow);
    return {
      cleanupOpacity: () => {
        oldContentSlot.innerHTML = "";
        oldContentSlot.style.opacity = "";
        oldContentSlot.style.transition = "";
        contentSlot.style.opacity = "";
        contentSlot.style.transition = "";
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };
  const applySomethingToPhaseTransition = () => {
    phaseSlot.style.width = "";
    phaseSlot.style.height = "";
    updatePhaseDimensions();

    // Use any known content dimension
    if (contentWidth === undefined) {
      // we don't have any content to use
      // phase slot is allowed to dictate dimensions
      targetWidth = phaseWidth;
      targetHeight = phaseHeight;
    } else {
      // force phase dimensions to content
      phaseSlot.style.width = `${contentWidth}px`;
      phaseSlot.style.height = `${contentHeight}px`;
      targetWidth = contentWidth;
      targetHeight = contentHeight;
    }
    // Determine if this is a phase-to-phase or content-to-phase transition
    const wasAlreadyInPhaseState = isInPhaseState;
    // Mark as in phase state
    isInPhaseState = true;

    dimension: {
      // Apply dimension transition
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      requestAnimationFrame(() => {
        // Start dimension transition
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
      });
    }
    opacity: {
      if (wasAlreadyInPhaseState) {
        // phase to phase

        if (oldPhaseSlot.firstElementChild) {
          oldPhaseSlot.style.opacity = "1";
          oldPhaseSlot.style.transition = "none";
        }
        phaseSlot.style.opacity = "0";
        phaseSlot.style.transition = "none";
      } else {
        // content to phase

        phaseSlot.style.opacity = "0";
        phaseSlot.style.transition = "none";

        // Content starts visible, will fade out
        contentSlot.style.opacity = "1";
        contentSlot.style.transition = "none";
      }

      // Start transitions
      requestAnimationFrame(() => {
        // Start opacity transitions
        if (oldPhaseSlot.firstElementChild) {
          oldPhaseSlot.style.transition = `opacity ${duration}ms ease`;
          oldPhaseSlot.style.opacity = "0"; // Fade out old phase
        }
        phaseSlot.style.transition = `opacity ${duration}ms ease`;
        phaseSlot.style.opacity = "1"; // Fade in new phase
      });
    }

    // Set transition state marker
    container.setAttribute("data-transitioning", "true");
    // Force reflow
    const reflow = phaseSlot.offsetHeight;
    console.debug("Phase to phase reflow:", reflow);

    // Return cleanup functions
    return {
      cleanupOpacity: () => {
        oldPhaseSlot.innerHTML = "";
        oldPhaseSlot.style.opacity = "";
        oldPhaseSlot.style.transition = "";
        phaseSlot.style.opacity = "";
        phaseSlot.style.transition = "";
        // Keep content hidden in phase state
        if (isInPhaseState) {
          contentSlot.style.opacity = "0";
          contentSlot.setAttribute("aria-hidden", "true");
          contentSlot.style.pointerEvents = "none";
        }
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };
  // Setup phase to content transition styling
  const applyPhaseToContentTransition = () => {
    isInPhaseState = false;
    dimension: {
      // Apply dimension transition
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      // Start transitions
      requestAnimationFrame(() => {
        // Start dimension transition
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
      });
    }
    opacity: {
      // Set initial states
      if (oldPhaseSlot.firstElementChild) {
        oldPhaseSlot.style.opacity = "1";
        oldPhaseSlot.style.transition = "none";
      }
      contentSlot.style.opacity = "0";
      contentSlot.style.transition = "none";
      requestAnimationFrame(() => {
        // Start opacity transitions
        if (oldPhaseSlot.firstElementChild) {
          oldPhaseSlot.style.transition = `opacity ${duration}ms ease`;
          oldPhaseSlot.style.opacity = "0"; // Fade out old phase
        }
        contentSlot.style.transition = `opacity ${duration}ms ease`;
        contentSlot.style.opacity = "1"; // Fade in new content
      });
    }

    // Set transition state marker
    container.setAttribute("data-transitioning", "true");

    // Force reflow
    const reflow = contentSlot.offsetHeight;
    console.debug("Phase to content reflow:", reflow);

    // Return cleanup functions
    return {
      cleanupOpacity: () => {
        oldPhaseSlot.innerHTML = "";
        oldPhaseSlot.style.opacity = "";
        oldPhaseSlot.style.transition = "";
        contentSlot.style.opacity = "";
        contentSlot.style.transition = "";
        contentSlot.removeAttribute("aria-hidden");
        contentSlot.style.pointerEvents = "";
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };

  // Main transition method
  const transitionTo = (newContentElement, { isContentPhase = false } = {}) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let cleanupCallbacks;
      if (isContentPhase) {
        const currentPhaseContent = phaseSlot.firstElementChild;
        if (currentPhaseContent) {
          // move any current phase to old phase slot
          oldPhaseSlot.innerHTML = "";
          oldPhaseSlot.appendChild(currentPhaseContent);
        }
        // Insert phase element into phase slot for measurement and transition
        phaseSlot.innerHTML = "";
        phaseSlot.appendChild(newContentElement);
        cleanupCallbacks = applySomethingToPhaseTransition();
      } else if (isInPhaseState) {
        // Transitioning from phase to content
        // Move current phase to old phase slot for fade-out
        const currentPhase = phaseSlot.firstElementChild;
        if (currentPhase) {
          oldPhaseSlot.innerHTML = "";
          oldPhaseSlot.appendChild(currentPhase);
        }
        // Clear current phase slot
        phaseSlot.innerHTML = "";
        // Insert new content into content slot
        contentSlot.innerHTML = "";
        contentSlot.appendChild(newContentElement);
        updateContentDimensions();
        targetWidth = contentWidth;
        targetHeight = contentHeight;
        cleanupCallbacks = applyPhaseToContentTransition();
      } else {
        // Regular content to content transition
        // Move current content to old content slot for fade-out
        const currentContent = contentSlot.firstElementChild;
        if (currentContent) {
          oldContentSlot.innerHTML = "";
          oldContentSlot.appendChild(currentContent);
        }
        // Insert new content into content slot
        contentSlot.innerHTML = "";
        contentSlot.appendChild(newContentElement);
        cleanupCallbacks = applyContentToContentTransition();
      }

      isTransitioning = true;
      onStateChange({ isTransitioning: true });
      setTimeout(() => {
        cleanupCallbacks.cleanupOpacity();
        cleanupCallbacks.cleanupDimension();
        isTransitioning = false;
        onStateChange({ isTransitioning: false });
        resolve();
      }, duration + 100);
    });
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    // Clear phase state
    isInPhaseState = false;
    contentWidth = undefined;
    contentHeight = undefined;
    targetWidth = undefined;
    targetHeight = undefined;

    // Set CSS variable for transition duration
    container.style.setProperty("--x-transition-duration", `${duration}ms`);

    // Reset to initial content if it exists
    if (initialContent) {
      contentSlot.innerHTML = "";
      contentSlot.appendChild(initialContent.cloneNode(true));
    } else {
      // No initial content, clear everything
      contentSlot.innerHTML = "";
    }

    // Update and measure current dimensions
    updateContentDimensions();

    // Clear all other slots
    phaseSlot.innerHTML = "";
    oldContentSlot.innerHTML = "";
    oldPhaseSlot.innerHTML = "";

    // Reset opacity and transition styles
    contentSlot.style.opacity = "";
    contentSlot.style.transition = "";
    contentSlot.removeAttribute("aria-hidden");
    contentSlot.style.pointerEvents = "";
    phaseSlot.style.opacity = "";
    phaseSlot.style.transition = "";
    oldContentSlot.style.opacity = "";
    oldContentSlot.style.transition = "";
    oldPhaseSlot.style.opacity = "";
    oldPhaseSlot.style.transition = "";

    // Remove any transition states
    container.removeAttribute("data-transitioning");

    // Apply alignment
    updateAlignment();
  };

  // Update configuration
  const setDuration = (newDuration) => {
    duration = newDuration;
    // Update CSS variable immediately
    container.style.setProperty("--x-transition-duration", `${duration}ms`);
  };

  const setAlignment = (newAlignX, newAlignY) => {
    alignX = newAlignX;
    alignY = newAlignY;
    updateAlignment();
  };

  // Getters
  const getIsTransitioning = () => {
    return isTransitioning;
  };

  const getCurrentContent = () => {
    return contentSlot?.firstElementChild || null;
  };

  const getIsInPhaseState = () => {
    return isInPhaseState;
  };

  // Initialize with visible content
  updateAlignment();

  // Set initial dimensions based on current content to ensure visibility
  updateContentDimensions();
  width = contentWidth;
  height = contentHeight;

  // Set CSS variable for duration
  container.style.setProperty("--x-transition-duration", `${duration}ms`);

  // Return public API
  return {
    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    getIsTransitioning,
    getCurrentContent,
    getIsInPhaseState,
    updateAlignment,
  };
};
