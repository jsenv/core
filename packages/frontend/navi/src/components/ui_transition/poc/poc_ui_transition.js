/**
 * UI Transition - Core Implementation
 * Provides smooth resize transitions with cross-fade effects between content states
 *
 * Content Types and Terminology:
 *
 * - ui: What the user currently sees rendered in the UI
 * - dom_nodes: The actual DOM elements that make up the visual representation
 * - content_id: Unique identifier for a content and its content_phase(s)
 * - content_phase: Intermediate states (loading spinners, error messages, empty states)
 * - content: The primary/final content we want to display (e.g., car details, user profile)
 *
 * Required HTML structure:
 *
 * <div class="ui_transition">
 *   <div class="active_group">
 *     <div class="target_slot"></div>
 *     <div class="outgoing_slot"></div>
 *   </div>
 *   <div class="previous_group">
 *     <div class="previous_target_slot"></div>
 *     <div class="previous_outgoing_slot"></div>
 *   </div>
 * </div>
 *
 * Architecture Overview:
 *
 * .ui_transition
 *   The main container that handles dimensional transitions. Its width and height animate
 *   smoothly from current to target dimensions. Has overflow:hidden to clip ui during transitions.
 *
 * .active_group
 *   Contains the ui that should be active after the transition completes. Groups both the target
 *   ui (.target_slot) and transitional ui (.outgoing_slot) as a single unit that can
 *   be manipulated together (e.g., applying transforms or slides).
 *
 * .target_slot
 *   Always contains the target ui - what should be displayed at the end of the transition.
 *   Whether transitioning to content or content_phase, this slot receives the new dom_nodes.
 *   Receives fade-in transitions (opacity 0 → 1) during all transition types.
 *
 * .outgoing_slot
 *   Holds content_phase that's being replaced during content_phase transitions. When transitioning
 *   from one content_phase to another, or from content_phase to content, the old content_phase moves
 *   here for fade-out. Receives fade-out transitions (opacity 1 → 0).
 *
 * .previous_group
 *   Used for content-to-content transitions. When switching between content (not phases),
 *   the entire .active_group dom_nodes are cloned here to fade out while the new content fades in.
 *   Can slide out when sliding transitions are enabled, otherwise fades out.
 *
 * Transition Scenarios:
 * - content → content: Car A details → Car B details (clone to previous_group)
 * - content_phase → content_phase: Loading state → Error state (move to outgoing_slot, same content_id)
 * - content → content_phase: Car A details → Loading Car B (use outgoing_slot for cross-fade)
 * - content_phase → content: Loading Car B → Car B details (use outgoing_slot for cross-fade)
 *
 * Size Transition Handling:
 * During dimensional transitions, both .target_slot and .outgoing_slot have their dimensions
 * explicitly set to prevent dom_nodes reflow and maintain visual consistency.
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

  .ui_transition {
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
  .ui_transition[data-align-x="start"] {
    --x-justify-content: flex-start;
  }
  .ui_transition[data-align-x="center"] {
    --x-justify-content: center;
  }
  .ui_transition[data-align-x="end"] {
    --x-justify-content: flex-end;
  }
  .ui_transition[data-align-y="start"] {
    --x-align-items: flex-start;
  }
  .ui_transition[data-align-y="center"] {
    --x-align-items: center;
  }
  .ui_transition[data-align-y="end"] {
    --x-align-items: flex-end;
  }

  .active_group {
    position: relative;
  }

  .target_slot {
    position: relative;
  }

  .outgoing_slot {
    position: absolute;
    top: 0;
    left: 0;
  }

  .previous_group {
    position: absolute;
    top: 0;
    left: 0;
  }

  .ui_transition[data-only-previous-group] .previous_group {
    position: relative;
  }
`;

const EMPTY = {
  contentId: "empty",
  type: "empty",
  toString: () => "empty",
};
const createConfiguration = (contentId, isContentPhase) => {
  if (!contentId) {
    return EMPTY;
  }
  if (isContentPhase) {
    return {
      contentId,
      type: "content_phase",
      toString: () => `content_phase:${contentId}`,
    };
  }
  return {
    contentId,
    type: "content",
    toString: () => `content:${contentId}`,
  };
};
const isEmpty = (configuration) => configuration === EMPTY;
const isContentPhase = (configuration) =>
  configuration.type === "content_phase";
const isContent = (configuration) => configuration.type === "content";
const isSameConfiguration = (configA, configB) => {
  return configA.toString() === configB.toString();
};

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
  const activeGroup = container.querySelector(".active_group");
  const targetSlot = container.querySelector(".target_slot");
  const outgoingSlot = container.querySelector(".outgoing_slot");
  const previousGroup = container.querySelector(".previous_group");
  const previousTargetSlot = previousGroup.querySelector(
    ".previous_target_slot",
  );
  const previousOutgoingSlot = previousGroup.querySelector(
    ".previous_outgoing_slot",
  );

  if (
    !container ||
    !activeGroup ||
    !targetSlot ||
    !outgoingSlot ||
    !previousGroup
  ) {
    throw new Error(
      "createUITransitionController requires container with active_group, target_slot, outgoing_slot, and previous_group elements",
    );
  }

  container.style.setProperty("--x-transition-duration", `${duration}ms`);
  outgoingSlot.setAttribute("inert", "");
  previousGroup.setAttribute("inert", "");

  let initialContent;
  let isTransitioning = false;
  let isContentPhase = false;
  let contentId;
  let targetSlotConfiguration;
  let outgoingSlotConfiguration;
  let transitionType = "none";

  // dimensions of the container
  let width;
  let height;
  // dimensions the container wants to take (always the dimensions of the targetSlot?)
  let targetWidth;
  let targetHeight;
  let targetSlotWidth;
  let targetSlotHeight;
  let outgoingSlotWidth;
  let outgoingSlotHeight;

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
  const updateSlotAttributes = () => {
    if (
      targetSlotConfiguration === EMPTY &&
      outgoingSlotConfiguration === EMPTY
    ) {
      container.setAttribute("data-only-previous-group", "");
    } else {
      container.removeAttribute("data-only-previous-group");
    }
  };
  const updateAlignment = () => {
    // Set data attributes for CSS-based alignment
    container.setAttribute("data-align-x", alignX);
    container.setAttribute("data-align-y", alignY);
  };
  const measureTargetSlot = () => {
    if (targetSlotConfiguration === EMPTY) {
      targetWidth = undefined;
      targetHeight = undefined;
      return;
    }
    const dimensions = getSlotDimensions(targetSlot);
    targetWidth = dimensions.width;
    targetHeight = dimensions.height;
  };

  if (targetSlot.firstElementChild) {
    initialContent = targetSlot.firstElementChild.cloneNode(true);
    contentId = getElementId(targetSlot.firstElementChild);
    targetSlotConfiguration = createConfiguration(contentId, false);
  } else {
    targetSlotConfiguration = EMPTY;
  }
  updateAlignment();
  updateSlotAttributes();
  if (!isEmpty(targetSlotConfiguration)) {
    measureTargetSlot();
    width = targetWidth;
    height = targetHeight;
  }
  outgoingSlotConfiguration = EMPTY;

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

  // content_to_content transition (uses previous_group)
  const applyContentToContentTransition = (toConfiguration) => {
    targetSlot.innerHTML = "";
    targetSlot.appendChild(toConfiguration.element);
    targetSlotConfiguration = toConfiguration;
    isContentPhase = true;

    const transitions = [];

    // Move active slots into previous slots
    if (targetSlotConfiguration !== EMPTY) {
      moveDOMNodes(targetSlot, previousTargetSlot);
      previousTargetSlot.style.width = `${targetSlotWidth}px`;
      previousTargetSlot.style.height = `${targetSlotHeight}px`;
    }
    if (outgoingSlotConfiguration !== EMPTY) {
      moveDOMNodes(outgoingSlot, previousOutgoingSlot);
      previousOutgoingSlot.style.width = `${outgoingSlotWidth}px`;
      previousOutgoingSlot.style.height = `${outgoingSlotHeight}px`;
    }

    // Measure new content dimensions
    measureTargetSlot();

    // Set active_group to target dimensions
    if (targetWidth !== undefined && targetHeight !== undefined) {
      activeGroup.style.width = `${targetWidth}px`;
      activeGroup.style.height = `${targetHeight}px`;
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
      if (previousGroup.firstElementChild) {
        previousGroup.style.opacity = "1";
        transitions.push(
          createOpacityTransition(previousGroup, 0, {
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
      targetSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(targetSlot, 1, {
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }

    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        activeGroup.style.width = "";
        activeGroup.style.height = "";
        previousGroup.innerHTML = "";
        previousGroup.style.opacity = "0";
        previousGroup.style.width = "";
        previousGroup.style.height = "";
      },
    });
    transition.play();
  };
  // content_phase_to_content_phase transition (uses outgoing_slot)
  const applyContentPhaseToContentPhaseTransition = (toConfiguration) => {
    // Move current target content to outgoing_slot
    if (targetSlotConfiguration !== EMPTY) {
      moveDOMNodes(targetSlot, outgoingSlot);
      outgoingSlotConfiguration = targetSlotConfiguration;
    }

    // content_phase to content_phase - use outgoing_slot
    targetSlot.innerHTML = "";
    targetSlot.appendChild(toConfiguration.element);
    targetSlotConfiguration = toConfiguration;

    // Measure new content dimensions
    measureTargetSlot();

    const transitions = [];

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
      if (outgoingSlot.firstElementChild) {
        outgoingSlot.style.opacity = "1";
        transitions.push(
          createOpacityTransition(outgoingSlot, 0, {
            duration,
            styleSynchronizer: "inline_style",
          }),
        );
      }
      targetSlot.style.opacity = "0";
      transitions.push(
        createOpacityTransition(targetSlot, 1, {
          duration,
          styleSynchronizer: "inline_style",
        }),
      );
    }

    const transition = transitionController.update(transitions, {
      onFinish: () => {
        transition.cancel();
        targetSlot.style.width = "";
        targetSlot.style.height = "";
        outgoingSlot.innerHTML = "";
        outgoingSlot.style.opacity = "0";
        outgoingSlot.style.width = "";
        outgoingSlot.style.height = "";
        outgoingSlotConfiguration = EMPTY;
      },
    });
    transition.play();
  };
  // any_to_empty
  const applyToEmptyTransition = () => {
    const transitions = [];

    targetSlot.innerHTML = "";
    targetSlotConfiguration = EMPTY;

    // Move current content to appropriate old slot
    if (true) {
      // Move content_phase content to outgoing_slot
      if (targetSlot.firstElementChild) {
        const currentContent = targetSlot.firstElementChild;
        outgoingSlot.innerHTML = "";
        outgoingSlot.appendChild(currentContent);
      }
    } else if (firstElementChild) {
      const clonedContent = targetSlot.firstElementChild.cloneNode(true);
      previousGroup.innerHTML = "";
      previousGroup.appendChild(clonedContent);
      if (width !== undefined && height !== undefined) {
        previousGroup.style.width = `${width}px`;
        previousGroup.style.height = `${height}px`;
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
      const oldSlot = isContentPhase ? outgoingSlot : previousGroup;
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
        previousGroup.innerHTML = "";
        previousGroup.style.opacity = "0";
        previousGroup.style.width = "";
        previousGroup.style.height = "";
        outgoingSlot.innerHTML = "";
        outgoingSlot.style.opacity = "0";
        outgoingSlot.style.width = "";
        outgoingSlot.style.height = "";
        outgoingSlotId = EMPTY;
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

    const fromConfiguration = targetSlotConfiguration;
    const toConfiguration = createConfiguration(id, isContentPhase);
    if (isSameConfiguration(fromConfiguration, toConfiguration)) {
      console.log(
        `transitionTo() ignored (already in desired state: ${toConfiguration})`,
      );
      return;
    }

    // Determine transition type for debugging
    const fromConfigType = targetSlotConfiguration.type;
    const toConfigType = toConfiguration.type;
    transitionType = `${fromConfigType}_to_${toConfigType}`;
    console.debug(
      `Transition type: ${transitionType} (${fromConfiguration} -> ${toConfiguration})`,
    );

    if (toConfiguration === EMPTY) {
      applyToEmptyTransition();
      return;
    }
    if (isContentPhase(fromConfiguration)) {
      if (isContentPhase(toConfiguration)) {
        applyContentPhaseToContentPhaseTransition(toConfiguration);
        return;
      }
      // apply content phase to something (content or content phase)
    }
    applyContentToContentTransition();
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    // Clear content_phase state
    isContentPhase = false;
    targetWidth = undefined;
    targetHeight = undefined;

    // Set CSS variable for transition duration
    container.style.setProperty("--x-transition-duration", `${duration}ms`);

    // Reset to initial content if it exists
    if (initialContent) {
      targetSlot.innerHTML = "";
      targetSlot.appendChild(initialContent.cloneNode(true));
      targetSlotId = getElementId(initialContent);
    } else {
      // No initial content, clear everything
      targetSlot.innerHTML = "";
      targetSlotId = EMPTY;
    }

    // Measure current dimensions
    measureTargetSlot();

    // Clear all other slots
    outgoingSlot.innerHTML = "";
    previousGroup.innerHTML = "";

    transitionController.cancel();

    // Reset opacity styles
    targetSlot.style.opacity = "";
    targetSlot.removeAttribute("aria-hidden");
    targetSlot.style.pointerEvents = "";
    outgoingSlot.style.opacity = "";
    previousGroup.style.opacity = "";

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
    return targetSlot?.firstElementChild || null;
  };

  const getisContentPhase = () => {
    return isContentPhase;
  };

  // Return public API
  return {
    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    getIsTransitioning,
    getCurrentContent,
    getisContentPhase,
    updateAlignment,
    // Slot state getters
    getSlotStates: () => ({
      targetSlotId,
      outgoingSlotId,
      isContentPhase,
      transitionType,
    }),
  };
};

const moveDOMNodes = (from, to) => {
  to.innerHTML = "";
  const nodesToMove = Array.from(from.childNodes);
  nodesToMove.forEach((node) => {
    to.appendChild(node);
  });
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
