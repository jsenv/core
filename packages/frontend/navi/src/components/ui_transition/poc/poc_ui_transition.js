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
 * A MON AVIS LE FIX POUR LE CONTENU QUI SE DECALE LORSQUE CENTER (mais ca le fait meme sur start/end)
 *
 * -> il y a quelque chose a faire pour qu'en gros lorsque le slot fait plus que son conteneur
 * on force la taille, ou on désactive le flex positionement pour éviter le décalage par ex
 * oui c'est ca, s'il est plus gros alors on met start sur cet axe
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
  getElementSignature,
  preventIntermediateScrollbar,
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
  /* When content overflows (bigger than parent) on a given axis */
  /* Flexbox would still try to position it ¯_(ツ)_/¯ */
  /* It causes slot content to overflow outside the box leading to content being out of view */
  /* So for this case we disable flexbox positioning (and there is no need for positioning anyway as slot takes the whole space */
  .ui_transition[data-slot-overflow-x] {
    --x-justify-content: flex-start;
  }
  .ui_transition[data-slot-overflow-y] {
    --x-align-items: flex-start;
  }

  .active_group {
    position: relative;
    display: flex;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

  .target_slot {
    position: relative;
  }

  .ui_transition[data-transitioning] .target_slot,
  .ui_transition[data-transitioning] .previous_target_slot {
    min-width: 0;
    min-height: 0;
    flex-shrink: 0;
  }

  .outgoing_slot {
    position: absolute;
    top: 0;
    left: 0;
  }

  .previous_group {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }

  .ui_transition[data-only-previous-group] .previous_group {
    position: relative;
    height: 100%;
  }
`;

const UNSET = {
  domNodes: [],
  isEmpty: true,

  type: "unset",
  contentId: "unset",
  contentPhase: undefined,
  isContentPhase: false,
  isContent: false,
  toString: () => "unset",
};
const createConfiguration = (domNodes, { contentId, contentPhase } = {}) => {
  if (!domNodes) {
    return UNSET;
  }
  const isEmpty = domNodes.length === 0;
  contentId = contentId || getElementSignature(domNodes[0]);
  if (!contentPhase && isEmpty) {
    // Imagine code rendering null while switching to a new content
    // or even while staying on the same content.
    // In the UI we want to consider this as an "empty" phase.
    // meaning the ui will keep the same size until something else happens
    // This prevent layout shifts of code not properly handling
    // intermediate states.
    contentPhase = "empty";
  }
  if (contentPhase) {
    return {
      domNodes,
      isEmpty,

      type: "content_phase",
      contentId,
      contentPhase,
      isContentPhase: true,
      isContent: false,
      toString: () => `content(${contentId}).phase(${contentPhase})`,
    };
  }
  return {
    domNodes,
    isEmpty,

    type: "content",
    contentId,
    contentPhase: undefined,
    isContentPhase: false,
    isContent: true,
    toString: () => `content(${contentId})`,
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
  let previousTargetSlotConfiguration = UNSET;
  let previousOutgoingSlotConfiguration = UNSET;
  // dimensions of the container
  let containerWidth;
  let containerHeight;
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
    if (targetSlotConfiguration.isEmpty && outgoingSlotConfiguration.isEmpty) {
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

    if (slotConfig.isEmpty) {
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
  if (!targetSlotConfiguration.isEmpty) {
    measureSlot(targetSlot);
    containerWidth = targetSlotWidth;
    containerHeight = targetSlotHeight;
  }
  if (!outgoingSlotConfiguration.isEmpty) {
    measureSlot(outgoingSlot);
  }

  const setSlotDimensions = (slot, width, height) => {
    if (width === undefined) {
      if (!slot.style.width) {
        return;
      }
      debugSize(`cleatSlotDimensions(".${slot.className}")`);
      container.removeAttribute("data-slot-overflow-x");
      container.removeAttribute("data-slot-overflow-y");
      slot.style.width = "";
      slot.style.height = "";
      return;
    }
    if (
      slot.style.width === `${width}px` &&
      slot.style.height === `${height}px`
    ) {
      return;
    }
    debugSize(`setSlotDimensions(".${slot.className}", ${width}, ${height})`);
    if (width > containerWidth) {
      container.setAttribute("data-slot-overflow-x", "");
    } else {
      container.removeAttribute("data-slot-overflow-x");
    }
    if (height > containerHeight) {
      container.setAttribute("data-slot-overflow-y", "");
    } else {
      container.removeAttribute("data-slot-overflow-y");
    }
    slot.style.width = `${width}px`;
    slot.style.height = `${height}px`;
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
    // debugBreakpoints: [0.95],
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

  const updateContainerDimensions = (newWidth, newHeight) => {
    const fromWidth = containerWidth || 0;
    const fromHeight = containerHeight || 0;
    debugSize(
      `transition from [${fromWidth}x${fromHeight}] to [${newWidth}x${newHeight}]`,
    );

    const restoreOverflow = preventIntermediateScrollbar(container, {
      fromWidth,
      fromHeight,
      toWidth: newWidth,
      toHeight: newHeight,
      onPrevent: ({ x, y, scrollContainer }) => {
        if (x) {
          debugSize(
            `Temporarily hiding horizontal overflow during transition on ${getElementSignature(scrollContainer)}`,
          );
        }
        if (y) {
          debugSize(
            `Temporarily hiding vertical overflow during transition on ${getElementSignature(scrollContainer)}`,
          );
        }
      },
      onRestore: () => {
        debugSize(`Restored overflow after transition`);
      },
    });

    let widthTransitionFinished = false;
    let heightTransitionFinished = false;
    const onWidthTransitionFinished = () => {
      widthTransitionFinished = true;
      if (heightTransitionFinished) {
        onSizeTransitionFinished();
      }
    };
    const onHeightTransitionFinished = () => {
      heightTransitionFinished = true;
      if (widthTransitionFinished) {
        onSizeTransitionFinished();
      }
    };
    const onSizeTransitionFinished = () => {
      // uiTransitionStyleController.delete(targetSlot, "transform.translateY");
      // Restore overflow when transition is complete
      restoreOverflow();
      // let target slot take natural size now container is done
      setSlotDimensions(targetSlot, undefined, undefined);
    };

    const widthTransition = createWidthTransition(container, newWidth, {
      from: fromWidth,
      duration,
      styleSynchronizer: "inline_style",
      onUpdate: (widthTransition) => {
        containerWidth = widthTransition.value;
      },
      onFinish: (widthTransition) => {
        widthTransition.cancel();
        onWidthTransitionFinished();
      },
    });
    const heightTransition = createHeightTransition(container, newHeight, {
      from: fromHeight,
      duration,
      styleSynchronizer: "inline_style",
      onUpdate: (heightTransition) => {
        containerHeight = heightTransition.value;
      },
      onFinish: (heightTransition) => {
        heightTransition.cancel();
        onHeightTransitionFinished();
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
    outgoingSlotBecomes(UNSET);
    targetSlotBecomes(toConfiguration);
    const transitions = [
      ...updateContainerDimensions(targetSlotWidth, targetSlotHeight),
      fadeInTargetSlot(),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        setSlotConfiguration(previousTargetSlot, UNSET);
        setSlotConfiguration(previousOutgoingSlot, UNSET);
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
        setSlotConfiguration(outgoingSlot, UNSET);

        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // any_to_empty transition
  const applyToEmptyTransition = () => {
    targetSlotBecomes(UNSET);
    outgoingSlotBecomes(UNSET);
    const transitions = [
      ...updateContainerDimensions(0, 0),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        setSlotDimensions(targetSlot, undefined, undefined);
        setSlotConfiguration(previousTargetSlot, UNSET);
        setSlotConfiguration(previousOutgoingSlot, UNSET);
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
    if (toConfiguration.isEmpty) {
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
    setSlotConfiguration(previousTargetSlot, UNSET);
    setSlotConfiguration(previousOutgoingSlot, UNSET);
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
