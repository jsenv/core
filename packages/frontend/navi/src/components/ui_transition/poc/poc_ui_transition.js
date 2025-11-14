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
  let phaseStateDimensions = null;

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
      return { width: 200, height: 100 }; // fallback
    }

    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  };

  // Get dimensions of current content
  const getCurrentContentDimensions = () => {
    const currentContent = contentSlot?.firstElementChild;
    return getDimensions(currentContent);
  };

  // Clone element for transition use
  const cloneElementForTransition = (sourceElement) => {
    const sourceRect = sourceElement.getBoundingClientRect();
    const clone = sourceElement.cloneNode(true);

    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;

    return clone;
  };

  // Setup cross-fade between old and new content
  const setupContentCrossFade = (oldContentClone, newClone) => {
    // Configure old content slot with saved clone
    if (oldContentClone) {
      oldContentSlot.innerHTML = "";
      oldContentSlot.appendChild(oldContentClone);
      // Set initial state: old content visible, NO TRANSITION YET
      oldContentSlot.style.opacity = "1";
      oldContentSlot.style.transition = "none";
    }

    // Configure content slot with new content
    contentSlot.innerHTML = "";
    contentSlot.appendChild(newClone);
    // Set initial state: new content hidden, NO TRANSITION YET
    contentSlot.style.opacity = "0";

    // Set transition state marker
    container.setAttribute("data-transitioning", "true");

    // Apply alignment immediately
    updateAlignment();

    // Force reflow to stabilize DOM
    const reflow = contentSlot.offsetHeight;
    console.debug("Content transition reflow:", reflow);

    if (oldContentClone) {
      oldContentSlot.style.transition = `opacity ${duration}ms ease`;
    }
    contentSlot.style.transition = `opacity ${duration}ms ease`;

    if (oldContentClone) {
      oldContentSlot.style.opacity = "0"; // Fade out old
    }
    contentSlot.style.opacity = "1"; // Fade in new
  };

  // Finalize content cross-fade
  const finalizeContentCrossFade = () => {
    // Clear the old content slot
    oldContentSlot.innerHTML = "";

    // Reset to CSS defaults: new content visible, old content hidden
    oldContentSlot.style.opacity = "";
    oldContentSlot.style.transition = "";
    contentSlot.style.opacity = "";
    contentSlot.style.transition = "";

    // Remove transition data attributes
    container.removeAttribute("data-transitioning");
  };

  // Setup phase transition
  const setupPhaseTransition = (phaseElement) => {
    // For phase transition, fade out content and fade in phase
    phaseSlot.innerHTML = "";
    phaseSlot.appendChild(phaseElement);

    // Phase starts hidden
    phaseSlot.style.opacity = "0";
    phaseSlot.style.transition = "none";

    // Content starts visible, will fade out
    contentSlot.style.opacity = "1";
    contentSlot.style.transition = "none";

    // Set transition state marker
    container.setAttribute("data-transitioning", "true");

    // Apply alignment
    updateAlignment();

    // Force reflow
    const reflow = phaseSlot.offsetHeight;
    console.debug("Phase transition reflow:", reflow);

    // Start transitions: fade out content, fade in phase
    contentSlot.style.transition = `opacity ${duration}ms ease`;
    phaseSlot.style.transition = `opacity ${duration}ms ease`;

    contentSlot.style.opacity = "0.3"; // Fade out content (keep slightly visible)
    phaseSlot.style.opacity = "1"; // Fade in phase
  }; // Setup phase to content transition
  const setupPhaseToContentTransition = (oldPhaseClone, newContentClone) => {
    // Move current phase to old phase slot for fade-out
    if (oldPhaseClone) {
      oldPhaseSlot.innerHTML = "";
      oldPhaseSlot.appendChild(oldPhaseClone);
      oldPhaseSlot.style.opacity = "1";
      oldPhaseSlot.style.transition = "none";
    }

    // Put new content in content slot
    contentSlot.innerHTML = "";
    contentSlot.appendChild(newContentClone);
    contentSlot.style.opacity = "0";
    contentSlot.style.transition = "none";

    // Clear current phase slot
    phaseSlot.innerHTML = "";

    // Set transition state marker
    container.setAttribute("data-transitioning", "true");
    updateAlignment();

    // Force reflow
    const reflow = contentSlot.offsetHeight;
    console.debug("Phase to content reflow:", reflow);

    // Start transitions
    if (oldPhaseClone) {
      oldPhaseSlot.style.transition = `opacity ${duration}ms ease`;
      oldPhaseSlot.style.opacity = "0"; // Fade out old phase
    }
    contentSlot.style.transition = `opacity ${duration}ms ease`;
    contentSlot.style.opacity = "1"; // Fade in new content
  };

  // Finalize phase transitions
  const finalizePhaseTransition = () => {
    // Clear old slots
    oldPhaseSlot.innerHTML = "";
    oldContentSlot.innerHTML = "";

    // Reset styles
    phaseSlot.style.opacity = "";
    phaseSlot.style.transition = "";
    contentSlot.style.opacity = "";
    contentSlot.style.transition = "";
    oldPhaseSlot.style.opacity = "";
    oldPhaseSlot.style.transition = "";

    // Remove transition marker
    container.removeAttribute("data-transitioning");
  };

  // Main transition method
  const transitionTo = (newContentElement, { isPhase = false } = {}) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      isTransitioning = true;

      // Set CSS variable for transition duration
      container.style.setProperty("--x-transition-duration", `${duration}ms`);

      // Get dimensions
      const currentDimensions = getCurrentContentDimensions();
      const targetDimensions = getDimensions(newContentElement);

      // Set current container dimensions (starting point)
      container.style.width = `${currentDimensions.width}px`;
      container.style.height = `${currentDimensions.height}px`;

      if (isPhase) {
        // Phase transition - keep content in background
        isInPhaseState = true;
        setupPhaseTransition(newContentElement.cloneNode(true));
      } else if (isInPhaseState) {
        // Transitioning from phase to content
        const currentPhase = phaseSlot.firstElementChild;
        const oldPhaseClone = currentPhase
          ? currentPhase.cloneNode(true)
          : null;
        const newContentClone = cloneElementForTransition(newContentElement);

        setupPhaseToContentTransition(oldPhaseClone, newContentClone);
        isInPhaseState = false;
      } else {
        // Regular content to content transition
        const currentContent = contentSlot.firstElementChild;
        const oldContentClone = currentContent
          ? currentContent.cloneNode(true)
          : null;
        const newClone = cloneElementForTransition(newContentElement);

        setupContentCrossFade(oldContentClone, newClone);
      }

      // Start container animation
      requestAnimationFrame(() => {
        container.style.width = `${targetDimensions.width}px`;
        container.style.height = `${targetDimensions.height}px`;
      });

      onStateChange({ isTransitioning: true });

      // Clean up after transition
      setTimeout(() => {
        if (isPhase) {
          // We just transitioned to a phase
          finalizePhaseTransition();
        } else if (
          phaseSlot.firstElementChild ||
          oldPhaseSlot.firstElementChild
        ) {
          // We have phase-related content to clean up
          finalizePhaseTransition();
        } else {
          // Regular content transition
          finalizeContentCrossFade();
        }
        isTransitioning = false;
        onStateChange({ isTransitioning: false });
        resolve();
      }, duration + 100);
    });
  }; // Transition to a phase with dimension preservation
  const transitionToPhase = (phaseElement) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring phase transition");
      return Promise.resolve();
    }

    // Store current dimensions if we have content and not already in phase
    const currentContent = getCurrentContent();
    if (currentContent && !isInPhaseState) {
      const rect = currentContent.getBoundingClientRect();
      phaseStateDimensions = { width: rect.width, height: rect.height };
      console.debug("Stored phase dimensions:", phaseStateDimensions);
    }

    // Apply stored dimensions to the phase element if we have them
    if (phaseStateDimensions) {
      phaseElement.style.width = `${phaseStateDimensions.width}px`;
      phaseElement.style.height = `${phaseStateDimensions.height}px`;
      phaseElement.style.boxSizing = "border-box";
    }

    // Use transition with phase flag
    return transitionTo(phaseElement, { isPhase: true });
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    // Clear phase state
    isInPhaseState = false;
    phaseStateDimensions = null;

    // Set CSS variable for transition duration
    container.style.setProperty("--x-transition-duration", `${duration}ms`);

    // Measure current dimensions
    const currentDimensions = getCurrentContentDimensions();

    // Set starting point
    container.style.width = `${currentDimensions.width}px`;
    container.style.height = `${currentDimensions.height}px`;

    // Reset to initial content if it exists
    if (initialContent) {
      contentSlot.innerHTML = "";
      contentSlot.appendChild(initialContent.cloneNode(true));
    } else {
      // No initial content, clear everything
      contentSlot.innerHTML = "";
    }

    // Clear all other slots
    phaseSlot.innerHTML = "";
    oldContentSlot.innerHTML = "";
    oldPhaseSlot.innerHTML = "";

    // Reset opacity and transition styles
    contentSlot.style.opacity = "";
    contentSlot.style.transition = "";
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

    // Measure new dimensions and animate
    if (initialContent) {
      const targetDimensions = getCurrentContentDimensions();
      setTimeout(() => {
        container.style.width = `${targetDimensions.width}px`;
        container.style.height = `${targetDimensions.height}px`;
      }, 50);
    }
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

  const getPhaseStateDimensions = () => {
    return phaseStateDimensions;
  };

  // Initialize with visible content
  updateAlignment();

  // Set initial dimensions based on current content to ensure visibility
  const initialDimensions = getCurrentContentDimensions();
  container.style.width = `${initialDimensions.width}px`;
  container.style.height = `${initialDimensions.height}px`;

  // Set CSS variable for duration
  container.style.setProperty("--x-transition-duration", `${duration}ms`);

  // Return public API
  return {
    transitionTo,
    transitionToPhase,
    resetContent,
    setDuration,
    setAlignment,
    getIsTransitioning,
    getCurrentContent,
    getIsInPhaseState,
    getPhaseStateDimensions,
    updateAlignment,
  };
};
