/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects
 */

export class UITransition {
  constructor(options = {}) {
    // Required elements
    this.container = options.container;
    this.oldContentContainer = options.oldContentContainer;
    this.newContentContainer = options.newContentContainer;
    this.wrapper = options.wrapper;

    if (
      !this.container ||
      !this.oldContentContainer ||
      !this.newContentContainer ||
      !this.wrapper
    ) {
      throw new Error(
        "UITransition requires container, oldContentContainer, newContentContainer, and wrapper elements",
      );
    }

    // Configuration
    this.duration = options.duration || 3000;
    this.alignX = options.alignX || "center"; // "start", "center", "end"
    this.alignY = options.alignY || "center"; // "start", "center", "end"
    this.onStateChange = options.onStateChange || (() => {});

    // Internal state
    this.isTransitioning = false;

    // Initialize
    this.updateAlignment();
  }

  // Update alignment of content within the transition area
  updateAlignment() {
    // Convert alignment values to CSS flexbox properties
    const alignMap = {
      start: "flex-start",
      center: "center",
      end: "flex-end",
    };

    // Apply alignment to wrapper (for positioning content)
    if (this.wrapper) {
      this.wrapper.style.justifyContent = alignMap[this.alignX] || "center";
      this.wrapper.style.alignItems = alignMap[this.alignY] || "center";
    }
  }

  // Get dimensions of an element
  getDimensions(element) {
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
  getCurrentContentDimensions() {
    const currentContent = this.oldContentContainer?.firstElementChild;
    return this.getDimensions(currentContent);
  }

  // Clone element for transition use
  cloneElementForTransition(sourceElement) {
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

  // Main transition method
  transitionTo(newContentElement) {
    if (this.isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.isTransitioning = true;
      this.onStateChange({ isTransitioning: true });

      // Get dimensions
      const currentDimensions = this.getCurrentContentDimensions();
      const targetDimensions = this.getDimensions(newContentElement);

      // 1. Clone current content before any visual modifications
      const currentContent = this.oldContentContainer.firstElementChild;
      const oldContentClone = currentContent
        ? currentContent.cloneNode(true)
        : null;

      // 2. Create new content clone
      const newClone = this.cloneElementForTransition(newContentElement);

      // 3. Set current container dimensions (starting point)
      this.container.style.transition = `width ${this.duration}ms ease, height ${this.duration}ms ease`;
      this.container.style.width = `${currentDimensions.width}px`;
      this.container.style.height = `${currentDimensions.height}px`;

      // 4. Prepare cross-fade with existing containers
      this.setupCrossFade(oldContentClone, newClone);

      // 5. Force reflow to stabilize dimensions
      const forceReflow = newClone.offsetHeight;
      console.debug("Reflow forced:", forceReflow);

      // 6. Start container animation and cross-fade
      setTimeout(() => {
        // Animate container dimensions
        this.container.style.width = `${targetDimensions.width}px`;
        this.container.style.height = `${targetDimensions.height}px`;

        // Start cross-fade
        this.oldContentContainer.classList.add("fading-out");
        this.newContentContainer.classList.add("fading-in");
      }, 50);

      // 7. Clean up after transition
      setTimeout(() => {
        this.finalizeCrossFade();
        this.isTransitioning = false;
        this.onStateChange({ isTransitioning: false });
        resolve();
      }, this.duration + 100);
    });
  }

  // Setup cross-fade between old and new content
  setupCrossFade(oldContentClone, newClone) {
    // Configure old container with saved clone
    if (oldContentClone) {
      this.oldContentContainer.innerHTML = "";
      this.oldContentContainer.appendChild(oldContentClone);
    }
    this.oldContentContainer.style.display = "flex";
    this.oldContentContainer.style.opacity = "1";
    this.oldContentContainer.style.transition = `opacity ${this.duration}ms ease`;
    this.oldContentContainer.className = "content-transitioning content-old";

    // Configure new container
    this.newContentContainer.innerHTML = "";
    this.newContentContainer.appendChild(newClone);
    this.newContentContainer.style.display = "flex";
    this.newContentContainer.style.opacity = "0";
    this.newContentContainer.style.transition = `opacity ${this.duration}ms ease`;
    this.newContentContainer.className = "content-transitioning content-new";

    // Apply alignment immediately
    this.updateAlignment();
  }

  // Finalize cross-fade by swapping containers
  finalizeCrossFade() {
    // Move new content to old container
    const newContent = this.newContentContainer.firstElementChild;
    if (newContent) {
      // Reset new content styles
      newContent.style.position = "static";
      newContent.style.opacity = "1";

      // Place it in old container
      this.oldContentContainer.innerHTML = "";
      this.oldContentContainer.appendChild(newContent);
      this.oldContentContainer.style.display = "flex";
      this.oldContentContainer.style.opacity = "1";
      this.oldContentContainer.style.transition = "";
      this.oldContentContainer.className = "content-transitioning content-old";
      this.oldContentContainer.classList.remove("fading-out");
    }

    // Clear and hide new container
    this.newContentContainer.innerHTML = "";
    this.newContentContainer.style.display = "none";
    this.newContentContainer.style.opacity = "0";
    this.newContentContainer.style.transition = "";
    this.newContentContainer.className = "content-transitioning content-new";
    this.newContentContainer.classList.remove("fading-in");
  }

  // Reset to empty state
  resetToEmpty(emptyContent = null) {
    if (this.isTransitioning) return;

    // Measure current dimensions
    const currentDimensions = this.getCurrentContentDimensions();

    // Set starting point
    this.container.style.transition = `width ${this.duration}ms ease, height ${this.duration}ms ease`;
    this.container.style.width = `${currentDimensions.width}px`;
    this.container.style.height = `${currentDimensions.height}px`;

    // Create empty content element if provided
    if (emptyContent) {
      this.oldContentContainer.innerHTML = "";
      this.oldContentContainer.appendChild(emptyContent);
      this.oldContentContainer.style.display = "flex";
      this.oldContentContainer.style.opacity = "1";
    }

    // Ensure new container is hidden
    this.newContentContainer.style.display = "none";
    this.newContentContainer.innerHTML = "";

    // Apply alignment
    this.updateAlignment();

    // Measure new dimensions and animate
    if (emptyContent) {
      const targetDimensions = this.getCurrentContentDimensions();
      setTimeout(() => {
        this.container.style.width = `${targetDimensions.width}px`;
        this.container.style.height = `${targetDimensions.height}px`;
      }, 50);
    }
  }

  // Update configuration
  setDuration(duration) {
    this.duration = duration;
  }

  setAlignment(alignX, alignY) {
    this.alignX = alignX;
    this.alignY = alignY;
    this.updateAlignment();
  }

  // Getters
  getIsTransitioning() {
    return this.isTransitioning;
  }

  getCurrentContent() {
    return this.oldContentContainer?.firstElementChild || null;
  }
}
