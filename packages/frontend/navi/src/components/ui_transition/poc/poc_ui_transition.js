/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects
 */

import.meta.css = /* css */ `
  .transition-container {
    --ui-transition-duration: 3000ms;

    position: relative;
    /* Dimensions seront définies dynamiquement */
    background: white;
    border: 8px dashed #ccc;
    border-radius: 8px;
    /* Transition sur les dimensions avec variable CSS */
    transition:
      width var(--ui-transition-duration) ease,
      height var(--ui-transition-duration) ease;
    /* Overflow hidden pour que le contenu soit coupé pendant la transition */
    overflow: hidden;
  }

  .transition-container.empty {
    display: flex;
    width: 300px;
    height: 80px;
    align-items: center;
    justify-content: center;
    color: #999;
    font-style: italic;
  }

  /* Wrapper qui applique l'alignement au contenu via data attributes */
  .content-wrapper {
    position: relative; /* Pour permettre le positionnement absolu des éléments en transition */
    display: flex;
    width: 100%;
    height: 100%;
    /* Alignement par défaut */
    align-items: center;
    justify-content: center;
  }

  /* Alignement horizontal via data attribute */
  .transition-container[data-align-x="start"] .content-wrapper {
    justify-content: flex-start;
  }
  .transition-container[data-align-x="center"] .content-wrapper {
    justify-content: center;
  }
  .transition-container[data-align-x="end"] .content-wrapper {
    justify-content: flex-end;
  }

  /* Alignement vertical via data attribute */
  .transition-container[data-align-y="start"] .content-wrapper {
    align-items: flex-start;
  }
  .transition-container[data-align-y="center"] .content-wrapper {
    align-items: center;
  }
  .transition-container[data-align-y="end"] .content-wrapper {
    align-items: flex-end;
  }

  /* Éléments en transition avec cross-fade - styles statiques */
  .content-transitioning {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: inherit;
    justify-content: inherit;
    transition: opacity var(--ui-transition-duration) ease;
  }

  /* États par défaut */
  .content-old {
    z-index: 1;
    opacity: 1;
  }

  .content-new {
    z-index: 2;
    display: none;
    opacity: 0;
  }

  /* États dynamiques via data attributes */
  .transition-container[data-transitioning="true"] .content-new {
    display: flex;
  }

  .transition-container[data-fade="out"] .content-old {
    opacity: 0;
  }

  .transition-container[data-fade="in"] .content-new {
    opacity: 1;
  }

  .content {
    box-sizing: border-box;
    padding: 20px;
    border-radius: 4px;
  }

  .content.state-empty {
    color: #666;
    font-style: italic;
  }

  /* Styles pour les clones - forcer certains styles pour éviter les conflits */
  .content-transitioning * {
    position: static !important;
    z-index: auto !important;
    flex-shrink: 0 !important;
    transition: none !important;
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
  const oldContentContainer = container.querySelector("#old-content-container");
  const newContentContainer = container.querySelector("#new-content-container");
  const wrapper = container.querySelector("#wrapper");

  if (!container || !oldContentContainer || !newContentContainer || !wrapper) {
    throw new Error(
      "initUITransition requires container, oldContentContainer, newContentContainer, and wrapper elements",
    );
  }

  // Internal state
  let isTransitioning = false;

  // Update alignment of content within the transition area
  function updateAlignment() {
    // Set data attributes for CSS-based alignment
    container.setAttribute("data-align-x", alignX);
    container.setAttribute("data-align-y", alignY);
  }

  // Get dimensions of an element
  function getDimensions(element) {
    if (!element) {
      console.warn("Element not found for dimension measurement");
      return { width: 200, height: 100 }; // fallback
    }

    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  // Get dimensions of current content
  function getCurrentContentDimensions() {
    const currentContent = oldContentContainer?.firstElementChild;
    return getDimensions(currentContent);
  }

  // Clone element for transition use
  function cloneElementForTransition(sourceElement) {
    const clone = sourceElement.cloneNode(true);

    // Preserve dimensions only - other styles handled by CSS
    const sourceRect = sourceElement.getBoundingClientRect();
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;

    return clone;
  }

  // Setup cross-fade between old and new content
  function setupCrossFade(oldContentClone, newClone) {
    // Configure old container with saved clone
    if (oldContentClone) {
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(oldContentClone);
    }

    // Configure new container
    newContentContainer.innerHTML = "";
    newContentContainer.appendChild(newClone);

    // Set data attributes for CSS to handle display/opacity
    container.setAttribute("data-transitioning", "true");

    // Apply alignment immediately
    updateAlignment();
  }

  // Finalize cross-fade by swapping containers
  function finalizeCrossFade() {
    // Move new content to old container
    const newContent = newContentContainer.firstElementChild;
    if (newContent) {
      // Place it in old container
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(newContent);
    }

    // Clear new container
    newContentContainer.innerHTML = "";

    // Remove transition data attributes
    container.removeAttribute("data-transitioning");
    container.removeAttribute("data-fade");
  }

  // Main transition method
  function transitionTo(newContentElement) {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      isTransitioning = true;
      onStateChange({ isTransitioning: true });

      // Set CSS variable for transition duration
      container.style.setProperty("--ui-transition-duration", `${duration}ms`);

      // Get dimensions
      const currentDimensions = getCurrentContentDimensions();
      const targetDimensions = getDimensions(newContentElement);

      // 1. Clone current content before any visual modifications
      const currentContent = oldContentContainer.firstElementChild;
      const oldContentClone = currentContent
        ? currentContent.cloneNode(true)
        : null;

      // 2. Create new content clone
      const newClone = cloneElementForTransition(newContentElement);

      // 3. Set current container dimensions (starting point)
      container.style.width = `${currentDimensions.width}px`;
      container.style.height = `${currentDimensions.height}px`;

      // 4. Prepare cross-fade with existing containers
      setupCrossFade(oldContentClone, newClone);

      // 5. Force reflow to stabilize dimensions
      const forceReflow = newClone.offsetHeight;
      console.debug("Reflow forced:", forceReflow);

      // 6. Start container animation and cross-fade
      setTimeout(() => {
        // Animate container dimensions
        container.style.width = `${targetDimensions.width}px`;
        container.style.height = `${targetDimensions.height}px`;

        // Start cross-fade via data attributes
        container.setAttribute("data-fade", "out"); // Fade out old
        setTimeout(() => {
          container.setAttribute("data-fade", "in"); // Fade in new
        }, 0);
      }, 50);

      // 7. Clean up after transition
      setTimeout(() => {
        finalizeCrossFade();
        isTransitioning = false;
        onStateChange({ isTransitioning: false });
        resolve();
      }, duration + 100);
    });
  }

  // Reset to empty state
  function resetToEmpty(emptyContent = null) {
    if (isTransitioning) return;

    // Set CSS variable for transition duration
    container.style.setProperty("--ui-transition-duration", `${duration}ms`);

    // Measure current dimensions
    const currentDimensions = getCurrentContentDimensions();

    // Set starting point
    container.style.width = `${currentDimensions.width}px`;
    container.style.height = `${currentDimensions.height}px`;

    // Create empty content element if provided
    if (emptyContent) {
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(emptyContent);
    }

    // Clear new container
    newContentContainer.innerHTML = "";

    // Remove any transition states
    container.removeAttribute("data-transitioning");
    container.removeAttribute("data-fade");

    // Apply alignment
    updateAlignment();

    // Measure new dimensions and animate
    if (emptyContent) {
      const targetDimensions = getCurrentContentDimensions();
      setTimeout(() => {
        container.style.width = `${targetDimensions.width}px`;
        container.style.height = `${targetDimensions.height}px`;
      }, 50);
    }
  }

  // Update configuration
  function setDuration(newDuration) {
    duration = newDuration;
    // Update CSS variable immediately
    container.style.setProperty("--ui-transition-duration", `${duration}ms`);
  }

  function setAlignment(newAlignX, newAlignY) {
    alignX = newAlignX;
    alignY = newAlignY;
    updateAlignment();
  }

  // Getters
  function getIsTransitioning() {
    return isTransitioning;
  }

  function getCurrentContent() {
    return oldContentContainer?.firstElementChild || null;
  }

  // Initialize
  updateAlignment();

  // Return public API
  return {
    transitionTo,
    resetToEmpty,
    setDuration,
    setAlignment,
    getIsTransitioning,
    getCurrentContent,
    updateAlignment,
  };
}
