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

  /* Wrapper qui applique l'alignement au contenu via CSS variables */
  .content-wrapper {
    position: relative; /* Pour permettre le positionnement absolu des éléments en transition */
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

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

  /* Éléments en transition avec cross-fade - styles statiques */
  .content-new,
  .content-old {
    position: absolute;
    opacity: 1;
    transition: opacity var(--x-transition-duration) ease;
  }

  .content-new {
    opacity: 1;
    transition: opacity var(--x-transition-duration) ease;
  }

  /* During transition states */
  .transition-container[data-transitioning="true"] .content-old {
    opacity: 1; /* Old content starts visible */
  }

  .transition-container[data-transitioning="true"] .content-new {
    opacity: 0; /* New content starts hidden */
  }

  /* Cross-fade states */
  .transition-container[data-fade="out"] .content-old {
    opacity: 0; /* Fade out old content */
  }

  .transition-container[data-fade="in"] .content-new {
    opacity: 1; /* Fade in new content */
  }

  /* Styles for old content clones */
  .content-old > * {
    position: static !important;
    z-index: auto !important;
    /* flex-shrink: 0 !important; */
    /* transition: none !important; */
    pointer-events: none !important;
  }
`;

export function initUITransition(
  container,
  {
    duration = 300,
    alignX = "center",
    alignY = "center",
    onStateChange = () => {},
  } = {},
) {
  // Required elements
  const oldContentContainer = container.querySelector(".content-old"); // For fade-out during transitions
  const currentContentContainer = container.querySelector(".content-new"); // For current content display
  const wrapper = container.querySelector(".content-wrapper");

  if (
    !container ||
    !oldContentContainer ||
    !currentContentContainer ||
    !wrapper
  ) {
    throw new Error(
      "initUITransition requires container, oldContentContainer, currentContentContainer, and wrapper elements",
    );
  }

  // Internal state
  let isTransitioning = false;

  // Capture initial content from current content container
  const initialContent = currentContentContainer.firstElementChild
    ? currentContentContainer.firstElementChild.cloneNode(true)
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
    const currentContent = currentContentContainer?.firstElementChild;
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
  const setupCrossFade = (oldContentClone, newClone) => {
    // Configure old container with saved clone
    if (oldContentClone) {
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(oldContentClone);
    }

    // Configure current container with new content
    currentContentContainer.innerHTML = "";
    currentContentContainer.appendChild(newClone);

    // Set transition state - old visible, new hidden initially
    container.setAttribute("data-transitioning", "true");

    // Apply alignment immediately
    updateAlignment();
  };

  // Finalize cross-fade by swapping containers
  const finalizeCrossFade = () => {
    // Current content is already in the right place (currentContentContainer)
    // Just clear the old container
    oldContentContainer.innerHTML = "";

    // Remove all transition data attributes
    container.removeAttribute("data-transitioning");
    container.removeAttribute("data-fade");
  };

  // Main transition method
  const transitionTo = (newContentElement) => {
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

      // 1. Clone current content before any visual modifications
      const currentContent = currentContentContainer.firstElementChild;
      const oldContentClone = currentContent
        ? currentContent.cloneNode(true)
        : null;

      // 2. Create new content clone
      const newClone = cloneElementForTransition(newContentElement);

      // 3. Set current container dimensions (starting point)
      container.style.width = `${currentDimensions.width}px`;
      container.style.height = `${currentDimensions.height}px`;

      // 4. Prepare cross-fade: move current to old slot, new to current slot
      setupCrossFade(oldContentClone, newClone);

      // 5. Force reflow to stabilize dimensions
      const forceReflow = newClone.offsetHeight;
      console.debug("Reflow forced:", forceReflow);

      // 6. Start container animation and cross-fade
      setTimeout(() => {
        // Animate container dimensions
        container.style.width = `${targetDimensions.width}px`;
        container.style.height = `${targetDimensions.height}px`;

        // Start cross-fade: fade out old, fade in new
        container.setAttribute("data-fade", "out");
        container.setAttribute("data-fade", "in");
      }, 50);

      onStateChange({ isTransitioning: true });

      // 7. Clean up after transition
      setTimeout(() => {
        finalizeCrossFade();
        isTransitioning = false;
        onStateChange({ isTransitioning: false });
        resolve();
      }, duration + 100);
    });
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    // Set CSS variable for transition duration
    container.style.setProperty("--x-transition-duration", `${duration}ms`);

    // Measure current dimensions
    const currentDimensions = getCurrentContentDimensions();

    // Set starting point
    container.style.width = `${currentDimensions.width}px`;
    container.style.height = `${currentDimensions.height}px`;

    // Reset to initial content if it exists
    if (initialContent) {
      currentContentContainer.innerHTML = "";
      currentContentContainer.appendChild(initialContent.cloneNode(true));
    } else {
      // No initial content, clear everything
      currentContentContainer.innerHTML = "";
    }

    // Clear old container
    oldContentContainer.innerHTML = "";

    // Remove any transition states
    container.removeAttribute("data-transitioning");
    container.removeAttribute("data-fade");

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
    return currentContentContainer?.firstElementChild || null;
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
    resetContent,
    setDuration,
    setAlignment,
    getIsTransitioning,
    getCurrentContent,
    updateAlignment,
  };
}
