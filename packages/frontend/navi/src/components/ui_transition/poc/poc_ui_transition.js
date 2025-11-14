/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects
 */

import.meta.css = /* css */ `
  .transition-container {
    position: relative;
    /* Dimensions seront définies dynamiquement */
    background: white;
    border: 8px dashed #ccc;
    border-radius: 8px;
    /* Transition sur les dimensions */
    transition:
      width 3s ease,
      height 3s ease;
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

  /* Wrapper qui applique l'alignement au contenu */
  .content-wrapper {
    position: relative; /* Pour permettre le positionnement absolu des éléments en transition */
    display: flex;
    width: 100%;
    height: 100%;
    /* Alignement sera mis à jour dynamiquement par JavaScript */
    align-items: center;

    justify-content: center;
  }

  /* Éléments en transition avec cross-fade */
  .content-transitioning {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: inherit;
    justify-content: inherit;
    transition: opacity 0ms ease; /* Durée sera définie dynamiquement */
  }

  .content-old {
    z-index: 1;
    opacity: 1;
  }

  .content-new {
    z-index: 2;
    opacity: 0;
  }

  .content-old.fading-out {
    opacity: 0;
  }

  .content-new.fading-in {
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
`;

export function initUITransition(container, options = {}) {
  // Required elements
  const oldContentContainer = container.querySelector("#old-content-container");
  const newContentContainer = container.querySelector("#new-content-container");
  const wrapper = container.querySelector("#wrapper");

  if (!container || !oldContentContainer || !newContentContainer || !wrapper) {
    throw new Error(
      "initUITransition requires container, oldContentContainer, newContentContainer, and wrapper elements",
    );
  }

  // Configuration
  let duration = options.duration || 3000;
  let alignX = options.alignX || "center"; // "start", "center", "end"
  let alignY = options.alignY || "center"; // "start", "center", "end"
  const onStateChange = options.onStateChange || (() => {});

  // Internal state
  let isTransitioning = false;

  // Update alignment of content within the transition area
  function updateAlignment() {
    // Convert alignment values to CSS flexbox properties
    const alignMap = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
    };

    // Apply alignment to wrapper (for positioning content)
    if (wrapper) {
      wrapper.style.justifyContent = alignMap[alignX] || "center";
      wrapper.style.alignItems = alignMap[alignY] || "center";
    }
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

    // Prepare clone for transition area
    clone.style.position = "static";
    clone.style.zIndex = "auto";
    clone.style.pointerEvents = "none";
    clone.style.transition = "none";

    // Preserve dimensions
    const sourceRect = sourceElement.getBoundingClientRect();
    clone.style.width = `${sourceRect.width}px`;
    clone.style.height = `${sourceRect.height}px`;
    clone.style.flexShrink = "0";

    return clone;
  }

  // Setup cross-fade between old and new content
  function setupCrossFade(oldContentClone, newClone) {
    // Configure old container with saved clone
    if (oldContentClone) {
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(oldContentClone);
    }
    oldContentContainer.style.display = "flex";
    oldContentContainer.style.opacity = "1";
    oldContentContainer.style.transition = `opacity ${duration}ms ease`;
    oldContentContainer.className = "content-transitioning content-old";

    // Configure new container
    newContentContainer.innerHTML = "";
    newContentContainer.appendChild(newClone);
    newContentContainer.style.display = "flex";
    newContentContainer.style.opacity = "0";
    newContentContainer.style.transition = `opacity ${duration}ms ease`;
    newContentContainer.className = "content-transitioning content-new";

    // Apply alignment immediately
    updateAlignment();
  }

  // Finalize cross-fade by swapping containers
  function finalizeCrossFade() {
    // Move new content to old container
    const newContent = newContentContainer.firstElementChild;
    if (newContent) {
      // Reset new content styles
      newContent.style.position = "static";
      newContent.style.opacity = "1";

      // Place it in old container
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(newContent);
      oldContentContainer.style.display = "flex";
      oldContentContainer.style.opacity = "1";
      oldContentContainer.style.transition = "";
      oldContentContainer.className = "content-transitioning content-old";
      oldContentContainer.classList.remove("fading-out");
    }

    // Clear and hide new container
    newContentContainer.innerHTML = "";
    newContentContainer.style.display = "none";
    newContentContainer.style.opacity = "0";
    newContentContainer.style.transition = "";
    newContentContainer.className = "content-transitioning content-new";
    newContentContainer.classList.remove("fading-in");
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
      container.style.transition = `width ${duration}ms ease, height ${duration}ms ease`;
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

        // Start cross-fade
        oldContentContainer.classList.add("fading-out");
        newContentContainer.classList.add("fading-in");
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

    // Measure current dimensions
    const currentDimensions = getCurrentContentDimensions();

    // Set starting point
    container.style.transition = `width ${duration}ms ease, height ${duration}ms ease`;
    container.style.width = `${currentDimensions.width}px`;
    container.style.height = `${currentDimensions.height}px`;

    // Create empty content element if provided
    if (emptyContent) {
      oldContentContainer.innerHTML = "";
      oldContentContainer.appendChild(emptyContent);
      oldContentContainer.style.display = "flex";
      oldContentContainer.style.opacity = "1";
    }

    // Ensure new container is hidden
    newContentContainer.style.display = "none";
    newContentContainer.innerHTML = "";

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
