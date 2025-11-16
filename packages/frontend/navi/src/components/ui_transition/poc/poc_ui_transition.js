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

/**
 *
 * TODO:
 *
 * - vérifier le comportement lorsque la transition s'applique au "document"
 * c'est a dire que le container veut faire la taille de la page
 *
 * - content phase se comporte comme le contenu tant qu'on a pas vu de contenu
 * des qu'on voit un contenu il doit respecter les dimensions du dernier contenu
 * qu'on connait
 * (meme si le content id change, on garde les dimensions du contenu "actuel" en attendant de voir le nouveau)
 *
 * - vérification des backgrounds (on peut appliquer des backgrounds
 * et ils prennents bien la taille attendu (meme si le contenr "overflow"))
 *
 * - positionement des slots (centrage nottament)
 *
 *
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
  }

  .ui_transition[data-transitioning] {
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
  contentPhase: undefined,
  domNodes: [],
  type: "empty",
  isContentPhase: false,
  isContent: false,
  toString: () => "empty",
};
const createConfiguration = (domNodes, { contentId, contentPhase } = {}) => {
  if (!domNodes || domNodes.length === 0) {
    return EMPTY;
  }
  contentId = contentId || getElementId(domNodes[0]);
  if (contentPhase) {
    return {
      domNodes,
      contentId,
      contentPhase,
      type: "content_phase",
      isContentPhase: true,
      isContent: false,
      toString: () => `content_phase:${contentId}`,
    };
  }
  return {
    domNodes,
    contentId,
    contentPhase: undefined,
    type: "content",
    isContentPhase: false,
    isContent: true,
    toString: () => `content:${contentId}`,
  };
};
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
  const debugConfig = {
    detection: container.hasAttribute("data-debug-detection"),
    size: container.hasAttribute("data-debug-size"),
  };
  const hasDebugLogs = debugConfig.size;
  const debugDetection = (message) => {
    if (!debugConfig.detection) return;
    console.debug(`[detection]`, message);
  };
  const debugSize = (message) => {
    if (!debugConfig.size) return;
    console.debug(`[size]`, message);
  };

  const activeGroup = container.querySelector(".active_group");
  const targetSlot = container.querySelector(".target_slot");
  const outgoingSlot = container.querySelector(".outgoing_slot");
  const previousGroup = container.querySelector(".previous_group");
  const previousTargetSlot = previousGroup?.querySelector(
    ".previous_target_slot",
  );
  const previousOutgoingSlot = previousGroup?.querySelector(
    ".previous_outgoing_slot",
  );

  if (
    !container ||
    !activeGroup ||
    !targetSlot ||
    !outgoingSlot ||
    !previousGroup ||
    !previousTargetSlot ||
    !previousOutgoingSlot
  ) {
    throw new Error(
      "createUITransitionController requires container with active_group, target_slot, outgoing_slot, previous_group, previous_target_slot, and previous_outgoing_slot elements",
    );
  }

  container.style.setProperty("--x-transition-duration", `${duration}ms`);
  outgoingSlot.setAttribute("inert", "");
  previousGroup.setAttribute("inert", "");

  const targetSlotInitialConfiguration = createConfiguration(
    Array.from(targetSlot.childNodes),
  );
  const outgoingSlotInitialConfiguration = createConfiguration(
    Array.from(outgoingSlot.childNodes),
    { contentPhase: true },
  );

  let targetSlotConfiguration = targetSlotInitialConfiguration;
  let outgoingSlotConfiguration = outgoingSlotInitialConfiguration;
  let previousTargetSlotConfiguration = EMPTY;
  let previousOutgoingSlotConfiguration = EMPTY;
  // dimensions of the container
  let width;
  let height;
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
  const measureSlot = (slot) => {
    const slotConfig =
      slot === targetSlot ? targetSlotConfiguration : outgoingSlotConfiguration;

    if (slotConfig === EMPTY) {
      debugSize(`measureSlot(".${slot.className}") -> it is empty`);
      if (slot === targetSlot) {
        targetSlotWidth = undefined;
        targetSlotHeight = undefined;
      } else {
        outgoingSlotWidth = undefined;
        outgoingSlotHeight = undefined;
      }
      return;
    }
    const dimensions = getSlotDimensions(targetSlot);
    const slotWidth = dimensions.width;
    const slotHeight = dimensions.height;
    debugSize(
      `measureSlot(".${slot.className}") -> [${slotWidth}x${slotHeight}]`,
    );
    if (slot === targetSlot) {
      targetSlotWidth = slotWidth;
      targetSlotHeight = slotHeight;
    } else {
      outgoingSlotWidth = slotWidth;
      outgoingSlotHeight = slotHeight;
    }
  };

  updateAlignment();
  updateSlotAttributes();
  if (targetSlotConfiguration !== EMPTY) {
    measureSlot(targetSlot);
    width = targetSlotWidth;
    height = targetSlotHeight;
  }
  if (outgoingSlotConfiguration !== EMPTY) {
    measureSlot(outgoingSlot);
  }

  const setSlotDimensions = (slot, width, height) => {
    if (width === undefined) {
      if (slot.style.width) {
        debugSize(`cleatSlotDimensions(".${slot.className}")`);
        slot.style.width = "";
        slot.style.height = "";
      }
      return;
    }
    if (
      slot.style.width !== `${width}px` ||
      slot.style.height !== `${height}px`
    ) {
      debugSize(`setSlotDimensions(".${slot.className}", ${width}, ${height})`);
      slot.style.width = `${width}px`;
      slot.style.height = `${height}px`;
    }
  };
  const setSlotConfiguration = (slot, configuration) => {
    slot.innerHTML = "";
    for (const domNode of configuration.domNodes) {
      slot.appendChild(domNode);
    }

    if (slot === targetSlot) {
      targetSlotConfiguration = configuration;
      measureSlot(slot);
      setSlotDimensions(slot, targetSlotWidth, targetSlotHeight);
      return;
    }

    if (slot === outgoingSlot) {
      outgoingSlotConfiguration = configuration;
      measureSlot(slot);
      setSlotDimensions(slot, outgoingSlotWidth, outgoingSlotHeight);
      return;
    }

    if (slot === previousTargetSlot) {
      previousTargetSlotConfiguration = configuration;
      setSlotDimensions(slot, targetSlotWidth, targetSlotHeight);
      return;
    }

    if (slot === previousOutgoingSlot) {
      previousOutgoingSlotConfiguration = configuration;
      setSlotDimensions(slot, outgoingSlotWidth, outgoingSlotHeight);
      return;
    }

    throw new Error("Unknown slot for applyConfiguration");
  };
  const targetSlotBecomes = (newConfiguration) => {
    setSlotConfiguration(previousTargetSlot, targetSlotConfiguration);
    setSlotConfiguration(targetSlot, newConfiguration);
  };
  const outgoingSlotBecomes = (newConfiguration) => {
    setSlotConfiguration(previousOutgoingSlot, outgoingSlotConfiguration);
    setSlotConfiguration(outgoingSlot, newConfiguration);
  };
  const targetSlotBecomesViaOutgoing = (newConfiguration) => {
    setSlotConfiguration(outgoingSlot, targetSlotConfiguration);
    setSlotConfiguration(targetSlot, newConfiguration);
  };

  let isTransitioning = false;
  let transitionType = "none";
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

  // Smart overflow management during transitions
  const manageTransitionOverflow = (
    fromWidth,
    fromHeight,
    toWidth,
    toHeight,
  ) => {
    const bodyRect = document.body.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const currentBodyWidth = bodyRect.width;
    const currentBodyHeight = bodyRect.height;

    // Check if current state has scrollbars
    const hasHorizontalScrollbar = currentBodyWidth > viewportWidth;
    const hasVerticalScrollbar = currentBodyHeight > viewportHeight;

    // Check if target state will have scrollbars
    const willHaveHorizontalScrollbar = toWidth > viewportWidth;
    const willHaveVerticalScrollbar = toHeight > viewportHeight;

    // Detect if transition will create temporary unwanted scrollbars
    const willCreateTempHorizontalScrollbar =
      !hasHorizontalScrollbar &&
      !willHaveHorizontalScrollbar &&
      Math.max(fromWidth, toWidth) > viewportWidth;
    const willCreateTempVerticalScrollbar =
      !hasVerticalScrollbar &&
      !willHaveVerticalScrollbar &&
      Math.max(fromHeight, toHeight) > viewportHeight;

    const originalOverflowX = document.body.style.overflowX;
    const originalOverflowY = document.body.style.overflowY;

    if (
      !willCreateTempHorizontalScrollbar &&
      !willCreateTempVerticalScrollbar
    ) {
      return () => {};
    }

    // Temporarily hide overflow if needed
    if (willCreateTempHorizontalScrollbar) {
      document.body.style.overflowX = "hidden";
      debugSize("Temporarily hiding horizontal overflow during transition");
    }
    if (willCreateTempVerticalScrollbar) {
      document.body.style.overflowY = "hidden";
      debugSize("Temporarily hiding vertical overflow during transition");
    }

    return () => {
      if (willCreateTempHorizontalScrollbar) {
        document.body.style.overflowX = originalOverflowX;
        debugSize("Restored horizontal overflow after transition");
      }
      if (willCreateTempVerticalScrollbar) {
        document.body.style.overflowY = originalOverflowY;
        debugSize("Restored vertical overflow after transition");
      }
    };
  };

  const updateContainerDimensions = (newWidth, newHeight) => {
    const fromWidth = width || 0;
    const fromHeight = height || 0;
    debugSize(
      `transition from [${fromWidth}x${fromHeight}] to [${newWidth}x${newHeight}]`,
    );

    // Apply smart overflow management
    const restoreOverflow = manageTransitionOverflow(
      fromWidth,
      fromHeight,
      newWidth,
      newHeight,
    );

    const widthTransition = createWidthTransition(container, newWidth, {
      from: fromWidth,
      duration,
      styleSynchronizer: "inline_style",
      onUpdate: (widthTransition) => {
        width = widthTransition.value;
      },
      onFinish: (widthTransition) => {
        widthTransition.cancel();
      },
    });
    const heightTransition = createHeightTransition(container, newHeight, {
      from: fromHeight,
      duration,
      styleSynchronizer: "inline_style",
      onUpdate: (heightTransition) => {
        height = heightTransition.value;
      },
      onFinish: (heightTransition) => {
        heightTransition.cancel();
        // Restore overflow when transition is complete
        restoreOverflow();
      },
    });
    return [widthTransition, heightTransition];
  };
  const fadeInTargetSlot = () => {
    return createOpacityTransition(targetSlot, 1, {
      from: 0,
      duration,
      styleSynchronizer: "inline_style",
      onFinish: (targetSlotOpacityTransition) => {
        targetSlotOpacityTransition.cancel();
      },
    });
  };
  const fadeOutPreviousGroup = () => {
    return createOpacityTransition(previousGroup, 0, {
      from: 1,
      duration,
      styleSynchronizer: "inline_style",
      onFinish: (previousGroupOpacityTransition) => {
        previousGroupOpacityTransition.cancel();
        previousGroup.style.opacity = "0"; // keep previous group visually hidden
      },
    });
  };
  const fadeOutOutgoingSlot = () => {
    return createOpacityTransition(outgoingSlot, 0, {
      duration,
      from: 1,
      styleSynchronizer: "inline_style",
      onFinish: (outgoingSlotOpacityTransition) => {
        outgoingSlotOpacityTransition.cancel();
        outgoingSlot.style.opacity = "0"; // keep outgoing slot visually hidden
      },
    });
  };

  // content_to_content transition (uses previous_group)
  const applyContentToContentTransition = (toConfiguration) => {
    outgoingSlotBecomes(EMPTY);
    targetSlotBecomes(toConfiguration);
    const transitions = [
      ...updateContainerDimensions(targetSlotWidth, targetSlotHeight),
      fadeInTargetSlot(),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        setSlotConfiguration(previousTargetSlot, EMPTY);
        setSlotConfiguration(previousOutgoingSlot, EMPTY);
        // let target slot take natural size now container is done
        setSlotDimensions(targetSlot, undefined, undefined);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // content_phase_to_content_phase transition (uses outgoing_slot)
  const applyContentPhaseToContentPhaseTransition = (toConfiguration) => {
    targetSlotBecomesViaOutgoing(toConfiguration);
    const transitions = [
      ...updateContainerDimensions(targetSlotWidth, targetSlotHeight),
      fadeInTargetSlot(),
      fadeOutOutgoingSlot(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        setSlotDimensions(targetSlot, undefined, undefined);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // any_to_empty transition
  const applyToEmptyTransition = () => {
    targetSlotBecomes(EMPTY);
    outgoingSlotBecomes(EMPTY);
    const transitions = [
      ...updateContainerDimensions(0, 0),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        setSlotDimensions(targetSlot, undefined, undefined);
        setSlotConfiguration(previousTargetSlot, EMPTY);
        setSlotConfiguration(previousOutgoingSlot, EMPTY);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // Main transition method
  const transitionTo = (
    newContentElement,
    { contentPhase, contentId } = {},
  ) => {
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return;
    }

    const fromConfiguration = targetSlotConfiguration;
    const toConfiguration = createConfiguration(
      newContentElement ? [newContentElement] : null,
      {
        contentPhase,
        contentId,
      },
    );
    if (hasDebugLogs) {
      console.group(`transitionTo(${toConfiguration.contentId})`);
    }
    if (isSameConfiguration(fromConfiguration, toConfiguration)) {
      debugDetection(`ignored (already in desired state)`);
      if (hasDebugLogs) {
        console.groupEnd();
      }
      return;
    }
    const fromConfigType = fromConfiguration.type;
    const toConfigType = toConfiguration.type;
    transitionType = `${fromConfigType}_to_${toConfigType}`;
    debugDetection(
      `Prepare "${transitionType}" transition (${fromConfiguration} -> ${toConfiguration})`,
    );
    // content_to_empty / content_phase_to_empty
    if (toConfiguration === EMPTY) {
      applyToEmptyTransition();
      return;
    }
    // content_phase_to_content_phase
    if (fromConfiguration.isContentPhase && toConfiguration.isContentPhase) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_phase_to_content
    if (fromConfiguration.isContentPhase && toConfiguration.isContent) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_to_content_phase
    if (fromConfiguration.isContent && toConfiguration.isContentPhase) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_to_content (default case)
    applyContentToContentTransition(toConfiguration);
  };

  // Reset to initial content
  const resetContent = () => {
    if (isTransitioning) return;

    transitionController.cancel();
    setSlotConfiguration(targetSlot, targetSlotInitialConfiguration);
    setSlotConfiguration(outgoingSlot, outgoingSlotInitialConfiguration);
    setSlotConfiguration(previousTargetSlot, EMPTY);
    setSlotConfiguration(previousOutgoingSlot, EMPTY);
  };

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

  return {
    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    updateAlignment,
    previousTargetSlotConfiguration: () => previousTargetSlotConfiguration,
    previousOutgoingSlotConfiguration: () => previousOutgoingSlotConfiguration,
  };
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
