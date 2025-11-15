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
 *     <div class="phase-slot"></div>     <!-- Phase content: direct child, positioned based on container[data-no-content] -->
 *     <div class="old-phase-slot"></div> <!-- Fade-out phase: absolute positioning for cross-fade transitions -->
 *   </div>
 * </div>
 *
 * Architecture principles:
 * - Container: Provides smooth dimensional transitions (visual animation)
 * - Content dimensions wrapper: Set to target size immediately (prevent content adaptation during animation)
 * - Phase slots: Direct children of container, individually sized for fluid behavior
 * - Phase positioning: Dynamic (relative when no content, absolute when overlaying content)
 */

import {
  createGroupTransitionController,
  createHeightTransition,
  createOpacityTransition,
  createWidthTransition,
} from "@jsenv/dom";

import.meta.css = /* css */ `
  * {
    box-sizing: border-box;
  }

  .transition-container {
    --transition-duration: 3000ms;
    --justify-content: center;
    --align-items: center;
    --background-color: white;

    --x-transition-duration: var(--transition-duration);
    --x-justify-content: var(--justify-content);
    --x-align-items: var(--align-items);

    position: relative;

    /* in case we set border on this element his size must include borders */
    box-sizing: content-box;
    background: var(--background-color);
    border: 8px dashed #ccc;
    border-radius: 8px;
    /* Overflow hidden pour que le contenu soit coupé pendant la transition */
    overflow: hidden;
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

  .content-dimensions {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .content-slot {
    position: relative;
  }
  .old-content-slot {
    position: absolute;
  }
  .phase-dimensions {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    width: 100%;
    height: 100%;
    flex-shrink: 0; /* Prevent phase slots from adapting to container size */
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .phase-slot {
    position: relative;
  }
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

  /* Boolean data attributes for single slot states */
  .transition-container[data-only-content-phase] .content-dimensions,
  .transition-container[data-only-old-content-phase] .content-dimensions {
    position: absolute;
  }
  .transition-container[data-only-content-phase] .phase-dimensions,
  .transition-container[data-only-old-content-phase] .phase-dimensions {
    position: relative;
  }
  .transition-container[data-only-old-content-phase] .phase-slot {
    position: absolute;
  }
  .transition-container[data-only-old-content-phase] .old-phase-slot {
    position: relative;
  }

  .transition-container[data-only-old-content] .content-slot {
    position: absolute;
  }
  .transition-container[data-only-old-content] .old-content-slot {
    position: relative;
  }
`;

const EMPTY = { id: "empty", toString: () => "empty" };

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
  // Dimension we take/will take, can be content or content phase
  let width;
  let height;
  let targetWidth;
  let targetHeight;
  // content phase dimension
  let phaseWidth;
  let phaseHeight;
  // content dimensions
  let contentWidth;
  let contentHeight;

  // Slot tracking with IDs
  let contentSlotId = EMPTY;
  let phaseSlotId = EMPTY;
  let oldContentSlotId = EMPTY;
  let oldPhaseSlotId = EMPTY;
  let activeSlot = "content"; // "content" or "phase"
  let transitionType = EMPTY; // Debug string for current transition type

  // Capture initial content from content slot
  const initialContent = contentSlot.firstElementChild
    ? contentSlot.firstElementChild.cloneNode(true)
    : null;

  // Helper to update slot positioning based on active content
  const updateSlotAttributes = () => {
    const hasContent = contentSlotId !== EMPTY;
    const hasPhase = phaseSlotId !== EMPTY;
    const hasOldContent = oldContentSlotId !== EMPTY;
    const hasOldPhase = oldPhaseSlotId !== EMPTY;

    // Clear all boolean attributes first
    container.removeAttribute("data-only-content");
    container.removeAttribute("data-only-content-phase");
    container.removeAttribute("data-only-old-content");
    container.removeAttribute("data-only-old-content-phase");

    if (isTransitioning) {
      // During transitions, determine which old slot is active
      if (hasOldContent && !hasOldPhase) {
        container.setAttribute("data-only-old-content", "");
      } else if (hasOldPhase && !hasOldContent) {
        container.setAttribute("data-only-old-content-phase", "");
      }
    } else if (hasContent && !hasPhase) {
      container.setAttribute("data-only-content", "");
    } else if (hasPhase && !hasContent) {
      container.setAttribute("data-only-content-phase", "");
    }
  };
  // Helper to get element signature or use provided ID
  const getElementId = (element) => {
    if (!element) return EMPTY;
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
  const getSlotDimensions = (slotElement) => {
    const firstChild = slotElement.firstElementChild;
    if (!firstChild) {
      console.warn("Element not found for dimension measurement");
      return { width: undefined, height: undefined };
    }
    const rect = firstChild.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
    };
  };

  const measureContentSlot = () => {
    if (contentSlotId === EMPTY) {
      contentWidth = undefined;
      contentHeight = undefined;
      return;
    }
    const dimensions = getSlotDimensions(contentSlot);
    contentWidth = dimensions.width;
    contentHeight = dimensions.height;
  };
  const measurePhaseSlot = () => {
    if (phaseSlotId === EMPTY) {
      phaseWidth = undefined;
      phaseHeight = undefined;
      return;
    }
    const dimensions = getSlotDimensions(phaseSlot);
    phaseWidth = dimensions.width;
    phaseHeight = dimensions.height;
  };
  // Start all transitions with single controller
  const transitionController = createGroupTransitionController({
    // debugQuarterBreakpoints: true,
    lifecycle: {
      setup: () => {
        updateSlotAttributes();
        container.setAttribute("data-transitioning", "");
        isTransitioning = true;
        onStateChange({ isTransitioning: true });
        return {
          teardown: () => {
            container.removeAttribute("data-transitioning");
            isTransitioning = false;
            updateSlotAttributes(); // Update positioning after transition
            onStateChange({ isTransitioning: false });
          },
        };
      },
    },
  });

  // Setup cross-fade styling between old and new content
  const applyContentToContentTransition = () => {
    const transitions = [];
    dimension: {
      measureContentSlot();
      targetWidth = contentWidth;
      targetHeight = contentHeight;
      contentDimensions.style.width = `${targetWidth}px`;
      contentDimensions.style.height = `${targetHeight}px`;
      transitions.push(
        createWidthTransition(container, targetWidth, {
          from: width || 0,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: ({ value }) => {
            width = value;
          },
        }),
        createHeightTransition(container, targetHeight, {
          from: height || 0,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: ({ value }) => {
            height = value;
          },
        }),
      );
    }
    opacity: {
      // Set initial opacity state and add opacity transitions
      if (oldContentSlotId !== EMPTY) {
        oldContentSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(oldContentSlot, 0, {
            // from: 1,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
      contentSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(contentSlot, 1, {
          // from: 0,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        oldContentSlot.innerHTML = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        oldContentSlotId = EMPTY;
      },
    });
    transition.play();
  };
  const applyAnyToPhaseTransition = () => {
    // First, capture current phase dimensions before any changes
    const currentPhaseWidth = phaseWidth;
    const currentPhaseHeight = phaseHeight;

    phaseSlot.style.width = "";
    phaseSlot.style.height = "";
    measurePhaseSlot();

    if (contentWidth === undefined) {
      // we don't have any content to use
      // phase slot is allowed to dictate dimensions
      targetWidth = phaseWidth;
      targetHeight = phaseHeight;

      // Set the new phase slot to its natural size (for target dimensions)
      phaseSlot.style.width = `${phaseWidth}px`;
      phaseSlot.style.height = `${phaseHeight}px`;

      // If we have an old phase, freeze it at its original size to prevent distortion
      if (oldPhaseSlot.firstElementChild && currentPhaseWidth !== undefined) {
        oldPhaseSlot.style.width = `${currentPhaseWidth}px`;
        oldPhaseSlot.style.height = `${currentPhaseHeight}px`;
      } else {
        oldPhaseSlot.style.width = "";
        oldPhaseSlot.style.height = "";
      }
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
    const transitions = [];
    dimension: {
      transitions.push(
        createWidthTransition(container, {
          from: width,
          to: targetWidth,
          duration,
          styleSynchronizer: "inline_style",
        }),
        createHeightTransition(container, {
          from: height,
          to: targetHeight,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    opacity: {
      if (isContentPhaseToContentPhase) {
        if (oldPhaseSlot.firstElementChild) {
          oldPhaseSlot.style.opacity = "1";
          transitions.push(
            createOpacityTransition(oldPhaseSlot, {
              from: 1,
              to: 0,
              duration,
              styleSynchronizer: "inline_style",
            }),
          );
        }

        phaseSlot.style.opacity = "0";
        transitions.push(
          createOpacityTransition(phaseSlot, {
            from: 0,
            to: 1,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      } else {
        // content to phase
        phaseSlot.style.opacity = "0";
        contentSlot.style.opacity = "1";

        transitions.push(
          createOpacityTransition(contentSlot, {
            from: 1,
            to: 0,
            duration,
            styleSynchronizer: "inline_style",
          }),
          createOpacityTransition(phaseSlot, {
            from: 0,
            to: 1,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
    }
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        oldPhaseSlot.innerHTML = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseSlot.style.width = "";
        phaseSlot.style.height = "";
        oldPhaseSlot.style.width = "";
        oldPhaseSlot.style.height = "";
        oldPhaseSlotId = EMPTY;
        // Keep content hidden in phase state
        if (isInPhaseState) {
          contentSlot.style.opacity = "0";
          contentSlot.setAttribute("aria-hidden", "true");
          contentSlot.style.pointerEvents = "none";
        }
      },
    });
    transition.play();
  };
  const applyPhaseToContentTransition = () => {
    isInPhaseState = false;
    // Create all transitions
    const transitions = [];

    dimension: {
      // Add dimension transitions
      transitions.push(
        createWidthTransition(container, {
          from: width,
          to: targetWidth,
          duration,
          styleSynchronizer: "inline_style",
        }),
        createHeightTransition(container, {
          from: height,
          to: targetHeight,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    opacity: {
      // Set initial states and add opacity transitions
      if (oldPhaseSlot.firstElementChild) {
        oldPhaseSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(oldPhaseSlot, {
            from: 1,
            to: 0,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }

      contentSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(contentSlot, {
          from: 0,
          to: 1,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        oldPhaseSlot.innerHTML = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseSlot.style.width = "";
        phaseSlot.style.height = "";
        oldPhaseSlot.style.width = "";
        oldPhaseSlot.style.height = "";
        contentSlot.removeAttribute("aria-hidden");
        contentSlot.style.pointerEvents = "";
        oldPhaseSlotId = EMPTY;
      },
    });
    transition.play();
  };
  const applyContentToEmptyTransition = () => {
    const transitions = [];
    dimension: {
      targetWidth = 0;
      targetHeight = 0;
      transitions.push(
        createWidthTransition(container, {
          from: width,
          to: targetWidth,
          duration,
          styleSynchronizer: "inline_style",
        }),
        createHeightTransition(container, {
          from: height,
          to: targetHeight,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    opacity: {
      if (oldContentSlot.firstElementChild) {
        oldContentSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(oldContentSlot, {
            from: 1,
            to: 0,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
    }
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        oldContentSlot.innerHTML = "";
        oldContentSlotId = EMPTY;
      },
    });
    transition.play();
  };
  const applyPhaseToEmptyTransition = () => {
    const transitions = [];
    dimension: {
      targetWidth = 0;
      targetHeight = 0;
      transitions.push(
        createWidthTransition(container, {
          from: width,
          to: targetWidth,
          duration,
          styleSynchronizer: "inline_style",
        }),
        createHeightTransition(container, {
          from: height,
          to: targetHeight,
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }
    opacity: {
      if (oldPhaseSlot.firstElementChild) {
        oldPhaseSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(oldPhaseSlot, {
            from: 1,
            to: 0,
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
    }
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        oldPhaseSlot.innerHTML = "";
        contentDimensions.style.width = "";
        contentDimensions.style.height = "";
        phaseSlot.style.width = "";
        phaseSlot.style.height = "";
        oldPhaseSlot.style.width = "";
        oldPhaseSlot.style.height = "";
        oldPhaseSlotId = EMPTY;
        // Reset content slot when transitioning from phase to empty
        contentSlot.style.opacity = "";
        contentSlot.removeAttribute("aria-hidden");
        contentSlot.style.pointerEvents = "";
      },
    });
    transition.play();
  };

  // Main transition method
  const transitionTo = (
    newContentElement,
    { isContentPhase = false, id = getElementId(newContentElement) } = {},
  ) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return;
    }
    const fromSlot = activeSlot;
    const toSlot = isContentPhase ? "phase" : "content";
    const fromId = activeSlot === "content" ? contentSlotId : phaseSlotId;
    const toId = isContentPhase ? id : id;
    if (fromId === toId) {
      console.log(`transitionTo() ignored (already in desired state: ${toId})`);
      return;
    }
    // Determine transition type for debugging
    transitionType = `${fromSlot}_to_${toSlot}`;
    console.debug(`Transition type: ${transitionType} (${fromId} -> ${toId})`);

    if (toId === EMPTY) {
      // Transitioning to empty - clear both content and phase slots
      if (activeSlot === "content") {
        // Move current content to old content slot if it exists
        if (contentSlotId !== EMPTY) {
          const currentContent = contentSlot.firstElementChild;
          oldContentSlot.innerHTML = "";
          oldContentSlot.appendChild(currentContent);
          oldContentSlotId = contentSlotId;
        }
        if (phaseSlotId !== EMPTY) {
          phaseSlot.innerHTML = "";
          phaseSlotId = EMPTY;
          phaseWidth = undefined;
          phaseHeight = undefined;
        }
        contentSlot.innerHTML = "";
        contentSlotId = EMPTY;
        contentWidth = undefined;
        contentHeight = undefined;
        activeSlot = "content";
        applyContentToEmptyTransition();
        return;
      }
      if (contentSlotId !== EMPTY) {
        contentSlot.innerHTML = "";
        contentSlotId = EMPTY;
        contentWidth = undefined;
        contentHeight = undefined;
      }
      // Move current phase to old phase slot if it exists
      if (phaseSlotId !== EMPTY) {
        const currentPhase = phaseSlot.firstElementChild;
        oldPhaseSlot.innerHTML = "";
        oldPhaseSlot.appendChild(currentPhase);
        oldPhaseSlotId = phaseSlotId;
      }
      phaseSlot.innerHTML = "";
      phaseSlotId = EMPTY;
      phaseWidth = undefined;
      phaseHeight = undefined;
      isInPhaseState = false;
      activeSlot = "content";
      applyPhaseToEmptyTransition();
      return;
    }
    if (isContentPhase) {
      // Capture current phase dimensions before any changes
      const currentPhaseElement = phaseSlot.firstElementChild;
      let capturedPhaseWidth;
      let capturedPhaseHeight;
      if (currentPhaseElement) {
        const rect = currentPhaseElement.getBoundingClientRect();
        capturedPhaseWidth = rect.width;
        capturedPhaseHeight = rect.height;
      }

      // Move any current phase to old phase slot if it exists
      if (phaseSlotId !== EMPTY) {
        const currentPhaseContent = phaseSlot.firstElementChild;
        if (currentPhaseContent) {
          oldPhaseSlot.innerHTML = "";
          oldPhaseSlot.appendChild(currentPhaseContent);
          oldPhaseSlotId = phaseSlotId;

          // Store captured dimensions for the transition function
          if (
            capturedPhaseWidth !== undefined &&
            capturedPhaseHeight !== undefined
          ) {
            phaseWidth = capturedPhaseWidth;
            phaseHeight = capturedPhaseHeight;
          }
        }
      }
      // Insert phase element into phase slot for measurement and transition
      phaseSlot.innerHTML = "";
      phaseSlot.appendChild(newContentElement);
      phaseSlotId = id;
      activeSlot = "phase";
      applyAnyToPhaseTransition();
      return;
    }
    if (isInPhaseState) {
      // Transitioning from phase to content
      // Move current phase to old phase slot for fade-out if it exists
      if (phaseSlotId !== EMPTY) {
        const currentPhase = phaseSlot.firstElementChild;
        oldPhaseSlot.innerHTML = "";
        oldPhaseSlot.appendChild(currentPhase);
        oldPhaseSlotId = phaseSlotId;
      }
      // Clear current phase slot
      phaseSlot.innerHTML = "";
      phaseSlotId = EMPTY;
      // Insert new content into content slot
      contentSlot.innerHTML = "";
      contentSlot.appendChild(newContentElement);
      contentSlotId = id;
      activeSlot = "content";
      measureContentSlot();
      targetWidth = contentWidth;
      targetHeight = contentHeight;
      applyPhaseToContentTransition();
      return;
    }

    // Regular content to content transition
    // Move current content to old content slot for fade-out if it exists
    if (contentSlotId !== EMPTY) {
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
    applyContentToContentTransition();
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
    measureContentSlot();

    // Clear all other slots
    phaseSlot.innerHTML = "";
    oldContentSlot.innerHTML = "";
    oldPhaseSlot.innerHTML = "";

    transitionController.cancel();

    // Reset opacity styles (no transition cleanup needed for JS transitions)
    contentSlot.style.opacity = "";
    contentSlot.removeAttribute("aria-hidden");
    contentSlot.style.pointerEvents = "";
    phaseSlot.style.opacity = "";
    oldContentSlot.style.opacity = "";
    oldPhaseSlot.style.opacity = "";

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

  container.style.setProperty("--x-transition-duration", `${duration}ms`);
  updateAlignment();
  activeSlot = "content";
  if (contentSlot.firstElementChild) {
    contentSlotId = getElementId(contentSlot.firstElementChild);
  } else {
    contentSlotId = EMPTY;
  }
  updateSlotAttributes();
  measureContentSlot();
  width = contentWidth;
  height = contentHeight;

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
