/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects between ui states
 *
 * Required HTML structure:
 *
 * <div class="ui_transition">
 *   <div class="active_group">
 *     <div class="target_slot"></div>
 *     <div class="outgoing_slot"></div>
 *   </div>
 *   <div class="previous_group"></div>
 * </div>
 *
 * Architecture Overview:
 *
 * .ui_transition
 *   The main container that handles dimensional transitions. Its width and height animate
 *   smoothly from current to target dimensions. Has overflow:hidden to clip ui during transitions.
 *
 * .active_group
 *   Contains the UI that should be active after the transition completes. Groups both the target
 *   ui (.target_slot) and transitional ui (.outgoing_slot) as a single unit that can
 *   be manipulated together (e.g., applying transforms or slides).
 *
 * .target_slot
 *   Always contains the target ui - what should be visible at the end of the transition.
 *   Whether transitioning to regular content or content-phase, this slot receives the new ui.
 *   Receives fade-in transitions (opacity 0 → 1) during all transition types.
 *
 * .outgoing_slot
 *   Holds content-phase that's being replaced during content-phase transitions. When transitioning
 *   from one content-phase to another, or from content-phase to content, the old content-phase moves
 *   here for fade-out. Receives fade-out transitions (opacity 1 → 0).
 *
 * .previous_group
 *   Used for content-to-content transitions. When switching between regular content (not phases),
 *   the entire .active_group childNodes are cloned here to fade out while the new content fades in.
 *   Can slide out when sliding transitions are enabled, otherwise fades out.
 *
 * Transition Logic:
 * - Content → Content: Clone active_group to previous_group, transition between groups
 * - Content-phase → Content-phase: Move current content to outgoing_slot, cross-fade within active_group
 * - Content → Content-phase: Use outgoing_slot for cross-fade
 * - Content-phase → Content: Use outgoing_slot for cross-fade
 *
 * Size Transition Handling:
 * During dimensional transitions, both .target_slot and .outgoing_slot have their dimensions
 * explicitly set to prevent content reflow and maintain visual consistency.
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
    /* Overflow hidden so content is clipped during transition */
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

  .active-layer {
    position: relative;
  }

  .active-slot {
    position: relative;
  }

  .active-slot-old {
    position: absolute;
    top: 0;
    left: 0;
  }

  .previous-layer {
    position: absolute;
    top: 0;
    left: 0;
  }

  .transition-container[data-only-previous-layer] .previous-layer {
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
  const activeLayer = container.querySelector(".active-layer");
  const activeSlot = container.querySelector(".active-slot");
  const activeSlotOld = container.querySelector(".active-slot-old");
  const previousLayer = container.querySelector(".previous-layer");

  if (
    !container ||
    !activeLayer ||
    !activeSlot ||
    !activeSlotOld ||
    !previousLayer
  ) {
    throw new Error(
      "createUITransitionController requires container with active-layer, active-slot, active-slot-old, and previous-layer elements",
    );
  }

  activeSlotOld.setAttribute("inert", "");
  previousLayer.setAttribute("inert", "");

  // Internal state
  let isTransitioning = false;
  let isInPhaseState = false;
  let width;
  let height;
  let targetWidth;
  let targetHeight;

  // Slot tracking with IDs
  let activeSlotId = EMPTY;
  let activeSlotOldId = EMPTY;
  let transitionType = EMPTY; // Debug string for current transition type

  // Capture initial content from active slot
  const initialContent = activeSlot.firstElementChild
    ? activeSlot.firstElementChild.cloneNode(true)
    : null;

  // Helper to update slot positioning based on active content
  const updateSlotAttributes = () => {
    // The new structure is simpler - we just track if we're transitioning
    // No complex positioning logic needed with the new layer structure
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

  const measureActiveSlot = () => {
    if (activeSlotId === EMPTY) {
      targetWidth = undefined;
      targetHeight = undefined;
      return;
    }
    const dimensions = getSlotDimensions(activeSlot);
    targetWidth = dimensions.width;
    targetHeight = dimensions.height;
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

  // Content to content transition (using previous layer)
  const applyContentToContentTransition = () => {
    const transitions = [];

    // Clone current active layer content to previous layer
    if (activeSlot.firstElementChild) {
      const clonedContent = activeSlot.firstElementChild.cloneNode(true);
      previousLayer.innerHTML = "";
      previousLayer.appendChild(clonedContent);

      // Set previous layer dimensions to current dimensions
      if (width !== undefined && height !== undefined) {
        previousLayer.style.width = `${width}px`;
        previousLayer.style.height = `${height}px`;
      }
    }

    // Measure new content dimensions
    measureActiveSlot();

    // Set active layer to target dimensions
    if (targetWidth !== undefined && targetHeight !== undefined) {
      activeLayer.style.width = `${targetWidth}px`;
      activeLayer.style.height = `${targetHeight}px`;
    }

    dimension: {
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
      if (previousLayer.firstElementChild) {
        previousLayer.style.opacity = "1";
        transitions.push(
          createOpacityTransition(previousLayer, 0, {
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
      activeSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(activeSlot, 1, {
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }

    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        activeLayer.style.width = "";
        activeLayer.style.height = "";
        previousLayer.innerHTML = "";
        previousLayer.style.opacity = "0";
        previousLayer.style.width = "";
        previousLayer.style.height = "";
      },
    });
    transition.play();
  };

  // Content phase to content phase transition (using active-slot-old)
  const applyContentPhaseToContentPhaseTransition = () => {
    const transitions = [];

    // Move current active content to active-slot-old
    if (activeSlot.firstElementChild) {
      const currentContent = activeSlot.firstElementChild;
      activeSlotOld.innerHTML = "";
      activeSlotOld.appendChild(currentContent);
      activeSlotOldId = activeSlotId;

      // Set old slot dimensions to current dimensions
      if (width !== undefined && height !== undefined) {
        activeSlotOld.style.width = `${width}px`;
        activeSlotOld.style.height = `${height}px`;
      }
    }

    // Measure new content dimensions
    measureActiveSlot();

    // Set active slot to target dimensions
    if (targetWidth !== undefined && targetHeight !== undefined) {
      activeSlot.style.width = `${targetWidth}px`;
      activeSlot.style.height = `${targetHeight}px`;
    }

    dimension: {
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
      if (activeSlotOld.firstElementChild) {
        activeSlotOld.style.opacity = "1";
        transitions.push(
          createOpacityTransition(activeSlotOld, 0, {
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
      activeSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(activeSlot, 1, {
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }

    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        activeSlot.style.width = "";
        activeSlot.style.height = "";
        activeSlotOld.innerHTML = "";
        activeSlotOld.style.opacity = "0";
        activeSlotOld.style.width = "";
        activeSlotOld.style.height = "";
        activeSlotOldId = EMPTY;
      },
    });
    transition.play();
  };

  // Transition to empty
  const applyToEmptyTransition = () => {
    const transitions = [];

    // Move current content to appropriate old slot
    if (isInPhaseState) {
      // Move phase content to active-slot-old
      if (activeSlot.firstElementChild) {
        const currentContent = activeSlot.firstElementChild;
        activeSlotOld.innerHTML = "";
        activeSlotOld.appendChild(currentContent);
      }
    } else if (activeSlot.firstElementChild) {
      const clonedContent = activeSlot.firstElementChild.cloneNode(true);
      previousLayer.innerHTML = "";
      previousLayer.appendChild(clonedContent);
      if (width !== undefined && height !== undefined) {
        previousLayer.style.width = `${width}px`;
        previousLayer.style.height = `${height}px`;
      }
    }

    targetWidth = 0;
    targetHeight = 0;

    dimension: {
      transitions.push(
        createWidthTransition(container, {
          from: width,
          to: targetWidth,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: ({ value }) => {
            width = value;
          },
        }),
        createHeightTransition(container, {
          from: height,
          to: targetHeight,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: ({ value }) => {
            height = value;
          },
        }),
      );
    }

    opacity: {
      const oldSlot = isInPhaseState ? activeSlotOld : previousLayer;
      if (oldSlot.firstElementChild) {
        oldSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(oldSlot, {
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
        previousLayer.innerHTML = "";
        previousLayer.style.opacity = "0";
        previousLayer.style.width = "";
        previousLayer.style.height = "";
        activeSlotOld.innerHTML = "";
        activeSlotOld.style.opacity = "0";
        activeSlotOld.style.width = "";
        activeSlotOld.style.height = "";
        activeSlotOldId = EMPTY;
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

    const fromId = activeSlotId;
    const toId = id;

    if (fromId === toId) {
      console.log(`transitionTo() ignored (already in desired state: ${toId})`);
      return;
    }

    // Determine transition type for debugging
    const fromState = isInPhaseState ? "phase" : "content";
    const toState = isContentPhase ? "phase" : "content";
    transitionType = `${fromState}_to_${toState}`;
    console.debug(`Transition type: ${transitionType} (${fromId} -> ${toId})`);

    if (toId === EMPTY) {
      // Transitioning to empty - clear active slot
      if (activeSlotId !== EMPTY) {
        // Will be handled by applyToEmptyTransition
      }
      activeSlot.innerHTML = "";
      activeSlotId = EMPTY;
      isInPhaseState = false;
      applyToEmptyTransition();
      return;
    }

    if (isContentPhase) {
      // Transitioning to phase content
      if (isInPhaseState) {
        // Phase to phase - use active-slot-old
        activeSlot.innerHTML = "";
        activeSlot.appendChild(newContentElement);
        activeSlotId = id;
        isInPhaseState = true;
        applyContentPhaseToContentPhaseTransition();
      } else {
        // Content to phase - use previous layer
        activeSlot.innerHTML = "";
        activeSlot.appendChild(newContentElement);
        activeSlotId = id;
        isInPhaseState = true;
        applyContentToContentTransition(); // This will handle content->phase
      }
      return;
    }

    // Transitioning to regular content
    if (isInPhaseState) {
      // Phase to content - use active-slot-old
      activeSlot.innerHTML = "";
      activeSlot.appendChild(newContentElement);
      activeSlotId = id;
      isInPhaseState = false;
      applyContentPhaseToContentPhaseTransition(); // This will handle phase->content
      return;
    }

    // Regular content to content transition - use previous layer
    activeSlot.innerHTML = "";
    activeSlot.appendChild(newContentElement);
    activeSlotId = id;
    applyContentToContentTransition();
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    // Clear phase state
    isInPhaseState = false;
    targetWidth = undefined;
    targetHeight = undefined;

    // Set CSS variable for transition duration
    container.style.setProperty("--x-transition-duration", `${duration}ms`);

    // Reset to initial content if it exists
    if (initialContent) {
      activeSlot.innerHTML = "";
      activeSlot.appendChild(initialContent.cloneNode(true));
      activeSlotId = getElementId(initialContent);
    } else {
      // No initial content, clear everything
      activeSlot.innerHTML = "";
      activeSlotId = EMPTY;
    }

    // Measure current dimensions
    measureActiveSlot();

    // Clear all other slots
    activeSlotOld.innerHTML = "";
    previousLayer.innerHTML = "";

    transitionController.cancel();

    // Reset opacity styles
    activeSlot.style.opacity = "";
    activeSlot.removeAttribute("aria-hidden");
    activeSlot.style.pointerEvents = "";
    activeSlotOld.style.opacity = "";
    previousLayer.style.opacity = "";

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
    return activeSlot?.firstElementChild || null;
  };

  const getIsInPhaseState = () => {
    return isInPhaseState;
  };

  // Initialize controller
  container.style.setProperty("--x-transition-duration", `${duration}ms`);
  updateAlignment();

  if (activeSlot.firstElementChild) {
    activeSlotId = getElementId(activeSlot.firstElementChild);
    measureActiveSlot();
    width = targetWidth;
    height = targetHeight;
  } else {
    activeSlotId = EMPTY;
  }

  updateSlotAttributes();

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
      activeSlotId,
      activeSlotOldId,
      isInPhaseState,
      transitionType,
    }),
  };
};
