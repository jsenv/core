/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects
 *
 * Required HTML structure:
 *
 * <div class="transition-container">  <!-- Main container: animates width/height with CSS transitions, has overflow:hidden -->
 *   <div class="content-dimensions"> <!-- Content dimensions wrapper: set to target size immediately to prevent content adaptation -->
 *     <div class="content-slot"></div>     <!-- Regular content slot: relative positioning, dictates container size -->
 *     <div class="old-content-slot"></div> <!-- Fade-out content: absolute positioning for cross-fade transitions -->
 *   </div>
 *
 *   <div class="phase-dimensions">   <!-- Phase dimensions wrapper: dedicated sizing for phase states -->
 *     <div class="phase-slot"></div>     <!-- Phase content: wrapper positioning controlled by container[data-no-content] -->
 *     <div class="old-phase-slot"></div> <!-- Fade-out phase: absolute positioning for cross-fade transitions -->
 *   </div>
 * </div>
 *
 * Architecture principles:
 * - Container: Provides smooth dimensional transitions (visual animation)
 * - Dimension wrappers: Set to target size immediately (prevent content adaptation during animation)
 * - Slots: Hold actual content within appropriately-sized containers
 * - Phase positioning: Dynamic (relative when no content, absolute when overlaying content)
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

  .content-dimensions {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

  .phase-dimensions {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

  /* Phase dimensions in relative position when no content exists */
  .transition-container[data-no-content] .content-dimensions {
    display: none;
  }
  .transition-container[data-no-content] .phase-dimensions {
    position: relative;
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

  /* Phase slot - for phase states */
  .phase-slot {
    position: relative;
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
  const contentDimensions = container.querySelector(".content-dimensions");
  const phaseDimensions = container.querySelector(".phase-dimensions");

  if (
    !container ||
    !contentSlot ||
    !phaseSlot ||
    !oldContentSlot ||
    !oldPhaseSlot ||
    !contentDimensions ||
    !phaseDimensions
  ) {
    throw new Error(
      "createUITransitionController requires container with content-slot, phase-slot, old-content-slot, old-phase-slot, content-dimensions, and phase-dimensions elements",
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

  // Slot tracking with IDs
  let contentSlotId = "empty";
  let phaseSlotId = "empty";
  let oldContentSlotId = "empty";
  let oldPhaseSlotId = "empty";
  let activeSlot = "content"; // "content" or "phase"
  let transitionType = "empty"; // Debug string for current transition type

  // Capture initial content from content slot
  const initialContent = contentSlot.firstElementChild
    ? contentSlot.firstElementChild.cloneNode(true)
    : null;

  // Helper to update phase slot positioning based on content state
  const updatePhaseSlotPositioning = () => {
    const hasContent = contentSlotId !== "empty";
    if (hasContent) {
      container.removeAttribute("data-no-content");
    } else {
      container.setAttribute("data-no-content", "");
    }
  };

  // Helper to get element signature or use provided ID
  const getElementId = (element) => {
    if (!element) return "empty";
    if (element.id) return element.id;
    // Simple signature based on element properties
    const tagName = element.tagName?.toLowerCase() || "unknown";
    const className = element.className || "";
    const textContent = element.textContent?.slice(0, 20) || "";
    return `${tagName}_${className}_${textContent}`.replace(/\s+/g, "_");
  };

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
        oldContentSlotId = "empty";
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

    if (contentWidth === undefined) {
      // we don't have any content to use
      // phase slot is allowed to dictate dimensions
      targetWidth = phaseWidth;
      targetHeight = phaseHeight;
      oldPhaseSlot.style.width = "";
      oldPhaseSlot.style.height = "";

      // Set phase dimensions wrapper to target size immediately
      // This prevents phase content from adapting during transition
      phaseDimensions.style.width = `${targetWidth}px`;
      phaseDimensions.style.height = `${targetHeight}px`;
    } else {
      // force phase dimensions to content
      phaseSlot.style.width = `${contentWidth}px`;
      phaseSlot.style.height = `${contentHeight}px`;
      oldPhaseSlot.style.width = `${contentWidth}px`;
      oldPhaseSlot.style.height = `${contentHeight}px`;
      targetWidth = contentWidth;
      targetHeight = contentHeight;
    }
    // Determine if this is a phase-to-phase or content-to-phase transition
    const isContentPhaseToContentPhase = isInPhaseState;
    // Mark as in phase state
    isInPhaseState = true;

    dimension: {
      // Always animate container dimensions for visual transition
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      requestAnimationFrame(() => {
        // Start dimension transition
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
        // setTimeout(() => {
        //   if (oldPhaseSlotId === "loading") {
        //     debugger;
        //   }
        // }, 200);
      });
    }
    opacity: {
      if (isContentPhaseToContentPhase) {
        if (oldPhaseSlot.firstElementChild) {
          oldPhaseSlot.style.opacity = "1";
          oldPhaseSlot.style.transition = "none";
        }
        phaseSlot.style.opacity = "0";
        phaseSlot.style.transition = "none";

        requestAnimationFrame(() => {
          // Start opacity transitions
          if (oldPhaseSlot.firstElementChild) {
            oldPhaseSlot.style.transition = `opacity ${duration}ms ease`;
            oldPhaseSlot.style.opacity = "0"; // Fade out old phase
          }
          phaseSlot.style.transition = `opacity ${duration}ms ease`;
          phaseSlot.style.opacity = "1"; // Fade in new phase
        });
      } else {
        // content to phase
        phaseSlot.style.opacity = "0";
        phaseSlot.style.transition = "none";
        // Content starts visible, will fade out
        contentSlot.style.opacity = "1";
        contentSlot.style.transition = "none";

        requestAnimationFrame(() => {
          // Start transitions: fade out content, fade in phase
          contentSlot.style.transition = `opacity ${duration}ms ease`;
          phaseSlot.style.transition = `opacity ${duration}ms ease`;
          contentSlot.style.opacity = "0"; // Fade out content
          phaseSlot.style.opacity = "1"; // Fade in phase
        });
      }
    } // Set transition state marker
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
        oldPhaseSlotId = "empty";
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
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseDimensions.style.width = "";
        phaseDimensions.style.height = "";
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
        oldPhaseSlotId = "empty";
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseDimensions.style.width = "";
        phaseDimensions.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };

  // Setup content to empty transition
  const applyContentToEmptyTransition = () => {
    dimension: {
      targetWidth = 0;
      targetHeight = 0;
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      requestAnimationFrame(() => {
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
      });
    }
    opacity: {
      if (oldContentSlot.firstElementChild) {
        oldContentSlot.style.opacity = "1";
        oldContentSlot.style.transition = "none";
        requestAnimationFrame(() => {
          oldContentSlot.style.transition = `opacity ${duration}ms ease`;
          oldContentSlot.style.opacity = "0";
        });
      }
    }
    container.setAttribute("data-transitioning", "true");
    return {
      cleanupOpacity: () => {
        oldContentSlot.innerHTML = "";
        oldContentSlot.style.opacity = "";
        oldContentSlot.style.transition = "";
        oldContentSlotId = "empty";
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };

  // Setup phase to empty transition
  const applyPhaseToEmptyTransition = () => {
    dimension: {
      targetWidth = 0;
      targetHeight = 0;
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      requestAnimationFrame(() => {
        container.style.width = `${targetWidth}px`;
        container.style.height = `${targetHeight}px`;
        width = targetWidth;
        height = targetHeight;
      });
    }
    opacity: {
      if (oldPhaseSlot.firstElementChild) {
        oldPhaseSlot.style.opacity = "1";
        oldPhaseSlot.style.transition = "none";
        requestAnimationFrame(() => {
          oldPhaseSlot.style.transition = `opacity ${duration}ms ease`;
          oldPhaseSlot.style.opacity = "0";
        });
      }
    }
    container.setAttribute("data-transitioning", "true");
    return {
      cleanupOpacity: () => {
        oldPhaseSlot.innerHTML = "";
        oldPhaseSlot.style.opacity = "";
        oldPhaseSlot.style.transition = "";
        oldPhaseSlotId = "empty";
        // Reset content slot when transitioning from phase to empty
        contentSlot.style.opacity = "";
        contentSlot.removeAttribute("aria-hidden");
        contentSlot.style.pointerEvents = "";
      },
      cleanupDimension: () => {
        container.style.width = "";
        container.style.height = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseDimensions.style.width = "";
        phaseDimensions.style.height = "";
        container.removeAttribute("data-transitioning");
      },
    };
  };

  // Main transition method
  const transitionTo = (
    newContentElement,
    { isContentPhase = false, id = getElementId(newContentElement) } = {},
  ) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Determine transition type for debugging
      const fromSlot = activeSlot;
      const fromId = activeSlot === "content" ? contentSlotId : phaseSlotId;
      const toSlot =
        newContentElement === null
          ? "empty"
          : isContentPhase
            ? "phase"
            : "content";
      const toId = id;

      transitionType = `${fromSlot}(${fromId})_to_${toSlot}(${toId})`;
      console.debug("Transition type:", transitionType);

      let cleanupCallbacks;

      if (newContentElement === null) {
        // Transitioning to empty - clear both content and phase slots
        if (activeSlot === "content") {
          // Move current content to old content slot if it exists
          if (contentSlotId !== "empty") {
            const currentContent = contentSlot.firstElementChild;
            oldContentSlot.innerHTML = "";
            oldContentSlot.appendChild(currentContent);
            oldContentSlotId = contentSlotId;
          }
          contentSlot.innerHTML = "";
          contentSlotId = "empty";
          contentWidth = undefined;
          contentHeight = undefined;
          cleanupCallbacks = applyContentToEmptyTransition();
        } else {
          // Move current phase to old phase slot if it exists
          if (phaseSlotId !== "empty") {
            const currentPhase = phaseSlot.firstElementChild;
            oldPhaseSlot.innerHTML = "";
            oldPhaseSlot.appendChild(currentPhase);
            oldPhaseSlotId = phaseSlotId;
          }
          phaseSlot.innerHTML = "";
          phaseSlotId = "empty";
          phaseWidth = undefined;
          phaseHeight = undefined;
          isInPhaseState = false;
          cleanupCallbacks = applyPhaseToEmptyTransition();
        }

        // Also clear the other slot if it has content
        if (activeSlot === "content" && phaseSlotId !== "empty") {
          phaseSlot.innerHTML = "";
          phaseSlotId = "empty";
          phaseWidth = undefined;
          phaseHeight = undefined;
        } else if (activeSlot === "phase" && contentSlotId !== "empty") {
          contentSlot.innerHTML = "";
          contentSlotId = "empty";
          contentWidth = undefined;
          contentHeight = undefined;
        }

        activeSlot = "content";
        updatePhaseSlotPositioning();
      } else if (isContentPhase) {
        // Move any current phase to old phase slot if it exists
        if (phaseSlotId !== "empty") {
          const currentPhaseContent = phaseSlot.firstElementChild;
          oldPhaseSlot.innerHTML = "";
          oldPhaseSlot.appendChild(currentPhaseContent);
          oldPhaseSlotId = phaseSlotId;
        }
        // Insert phase element into phase slot for measurement and transition
        phaseSlot.innerHTML = "";
        phaseSlot.appendChild(newContentElement);
        phaseSlotId = id;
        activeSlot = "phase";
        cleanupCallbacks = applySomethingToPhaseTransition();
      } else if (isInPhaseState) {
        // Transitioning from phase to content
        // Move current phase to old phase slot for fade-out if it exists
        if (phaseSlotId !== "empty") {
          const currentPhase = phaseSlot.firstElementChild;
          oldPhaseSlot.innerHTML = "";
          oldPhaseSlot.appendChild(currentPhase);
          oldPhaseSlotId = phaseSlotId;
        }
        // Clear current phase slot
        phaseSlot.innerHTML = "";
        phaseSlotId = "empty";
        // Insert new content into content slot
        contentSlot.innerHTML = "";
        contentSlot.appendChild(newContentElement);
        contentSlotId = id;
        activeSlot = "content";
        updatePhaseSlotPositioning();
        updateContentDimensions();
        targetWidth = contentWidth;
        targetHeight = contentHeight;
        cleanupCallbacks = applyPhaseToContentTransition();
      } else {
        // Regular content to content transition
        // Move current content to old content slot for fade-out if it exists
        if (contentSlotId !== "empty") {
          const currentContent = contentSlot.firstElementChild;
          oldContentSlot.innerHTML = "";
          oldContentSlot.appendChild(currentContent);
          oldContentSlotId = contentSlotId;
        }
        // Insert new content into content slot
        contentSlot.innerHTML = "";
        contentSlot.appendChild(newContentElement);
        contentSlotId = id;
        activeSlot = "content";
        updatePhaseSlotPositioning();
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

  // Initialize slot tracking
  if (contentSlot.firstElementChild) {
    contentSlotId = getElementId(contentSlot.firstElementChild);
    activeSlot = "content";
  } else {
    contentSlotId = "empty";
    activeSlot = "content";
  }

  // Set initial dimensions based on current content to ensure visibility
  updateContentDimensions();
  width = contentWidth || "auto";
  height = contentHeight || "auto";

  // Set CSS variable for duration
  container.style.setProperty("--x-transition-duration", `${duration}ms`);

  // Initialize phase slot positioning
  updatePhaseSlotPositioning();

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
    // Slot state getters
    getSlotStates: () => ({
      contentSlotId,
      phaseSlotId,
      oldContentSlotId,
      oldPhaseSlotId,
      activeSlot,
      transitionType,
    }),
  };
};
