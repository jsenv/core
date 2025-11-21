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
 *   <div class="ui_transition_active_group">
 *     <div class="ui_transition_target_slot"></div>
 *     <div class="ui_transition_outgoing_slot"></div>
 *   </div>
 *   <div class="ui_transition_previous_group">
 *     <div class="ui_transition_previous_target_slot"></div>
 *     <div class="ui_transition_previous_outgoing_slot"></div>
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
 * - content phase se comporte comme le contenu tant qu'on a pas vu de contenu
 * des qu'on voit un contenu il doit respecter les dimensions du dernier contenu
 * qu'on connait
 * (meme si le content id change, on garde les dimensions du contenu "actuel" en attendant de voir le nouveau)
 *
 *
 */

import {
  createGroupTransitionController,
  createOpacityTransition,
  createPubSub,
  getBorderRadius,
  getElementSignature,
  preventIntermediateScrollbar,
} from "@jsenv/dom";
import { monitorItemsOverflow } from "./monitor_items_overflow.js";

import.meta.css = /* css */ `
  * {
    box-sizing: border-box;
  }

  .ui_transition {
    --transition-duration: 300ms;
    --justify-content: center;
    --align-items: center;

    --x-transition-duration: var(--transition-duration);
    --x-justify-content: var(--justify-content);
    --x-align-items: var(--align-items);

    position: relative;
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

  .ui_transition,
  .ui_transition_active_group,
  .ui_transition_previous_group,
  .ui_transition_target_slot,
  .ui_transition_previous_target_slot,
  .ui_transition_outgoing_slot,
  .ui_transition_previous_outgoing_slot {
    width: 100%;
    height: 100%;
  }

  .ui_transition_target_slot,
  .ui_transition_outgoing_slot,
  .ui_transition_previous_target_slot,
  .ui_transition_previous_outgoing_slot {
    display: flex;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .ui_transition_target_slot[data-items-width-overflow],
  .ui_transition_previous_target_slot[data-items-width-overflow],
  .ui_transition_previous_target_slot[data-items-width-overflow],
  .ui_transition_previous_outgoing_slot[data-items-width-overflow] {
    --x-justify-content: flex-start;
  }
  .ui_transition_target_slot[data-items-height-overflow],
  .ui_transition_previous_slot[data-items-height-overflow],
  .ui_transition_previous_target_slot[data-items-height-overflow],
  .ui_transition_previous_outgoing_slot[data-items-height-overflow] {
    --x-align-items: flex-start;
  }

  .ui_transition_active_group {
    position: relative;
  }
  .ui_transition_target_slot {
    position: relative;
  }
  .ui_transition_outgoing_slot,
  .ui_transition_previous_outgoing_slot {
    position: absolute;
    top: 0;
    left: 0;
  }
  .ui_transition_previous_group {
    position: absolute;
    inset: 0;
  }
  .ui_transition[data-only-previous-group] .ui_transition_previous_group {
    position: relative;
  }

  .ui_transition_target_slot_background {
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    display: none;
    width: var(--target-slot-width, 100%);
    height: var(--target-slot-height, 100%);
    background: var(--target-slot-background, transparent);
    pointer-events: none;
  }
  .ui_transition[data-transitioning] .ui_transition_target_slot_background {
    display: block;
  }
`;

const CONTENT_ID_ATTRIBUTE = "data-content-id";
const CONTENT_PHASE_ATTRIBUTE = "data-content-phase";
const UNSET = {
  domNodes: [],
  domNodesClone: [],
  isEmpty: true,

  type: "unset",
  contentId: "unset",
  contentPhase: undefined,
  isContentPhase: false,
  isContent: false,
  toString: () => "unset",
};

const isSameConfiguration = (configA, configB) => {
  return configA.toString() === configB.toString();
};

export const createUITransitionController = (
  root,
  {
    duration = 300,
    alignX = "center",
    alignY = "center",
    onStateChange = () => {},
    pauseBreakpoints = [],
  } = {},
) => {
  const debugConfig = {
    detection: root.hasAttribute("data-debug-detection"),
    size: root.hasAttribute("data-debug-size"),
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

  const activeGroup = root.querySelector(".ui_transition_active_group");
  const targetSlot = root.querySelector(".ui_transition_target_slot");
  const outgoingSlot = root.querySelector(".ui_transition_outgoing_slot");
  const previousGroup = root.querySelector(".ui_transition_previous_group");
  const previousTargetSlot = previousGroup?.querySelector(
    ".ui_transition_previous_target_slot",
  );
  const previousOutgoingSlot = previousGroup?.querySelector(
    ".ui_transition_previous_outgoing_slot",
  );

  if (
    !root ||
    !activeGroup ||
    !targetSlot ||
    !outgoingSlot ||
    !previousGroup ||
    !previousTargetSlot ||
    !previousOutgoingSlot
  ) {
    throw new Error(
      "createUITransitionController requires element with .active_group, .target_slot, .outgoing_slot, .previous_group, .previous_target_slot, and .previous_outgoing_slot elements",
    );
  }

  // we maintain a background copy behind target slot to avoid showing
  // the body flashing during the fade-in
  const targetSlotBackground = document.createElement("div");
  targetSlotBackground.className = "ui_transition_target_slot_background";
  activeGroup.insertBefore(targetSlotBackground, targetSlot);

  root.style.setProperty("--x-transition-duration", `${duration}ms`);
  outgoingSlot.setAttribute("inert", "");
  previousGroup.setAttribute("inert", "");

  const detectConfiguration = (slot, { contentId, contentPhase } = {}) => {
    const domNodes = Array.from(slot.childNodes);
    if (!domNodes) {
      return UNSET;
    }

    const isEmpty = domNodes.length === 0;
    let textNodeCount = 0;
    let elementNodeCount = 0;
    let firstElementNode;
    const domNodesClone = [];
    if (isEmpty) {
      if (contentPhase === undefined) {
        contentPhase = "empty";
      }
    } else {
      const contentIdSlotAttr = slot.getAttribute(CONTENT_ID_ATTRIBUTE);
      let contentIdChildAttr;
      for (const domNode of domNodes) {
        if (domNode.nodeType === Node.TEXT_NODE) {
          textNodeCount++;
        } else {
          if (!firstElementNode) {
            firstElementNode = domNode;
          }
          elementNodeCount++;

          if (domNode.hasAttribute("data-content-phase")) {
            const contentPhaseAttr = domNode.getAttribute("data-content-phase");
            contentPhase = contentPhaseAttr || "attr";
          }
          if (domNode.hasAttribute("data-content-key")) {
            contentIdChildAttr = domNode.getAttribute("data-content-key");
          }
        }
        const domNodeClone = domNode.cloneNode(true);
        domNodesClone.push(domNodeClone);
      }

      if (contentIdSlotAttr && contentIdChildAttr) {
        console.warn(
          `Slot and slot child both have a [${CONTENT_ID_ATTRIBUTE}]. Slot is ${contentIdSlotAttr} and child is ${contentIdChildAttr}, using the child.`,
        );
      }
      if (contentId === undefined) {
        contentId = contentIdChildAttr || contentIdSlotAttr || undefined;
      }
    }
    const isOnlyTextNodes = elementNodeCount === 0 && textNodeCount > 1;
    const singleElementNode = elementNodeCount === 1 ? firstElementNode : null;

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

    let width;
    let height;
    let borderRadius;
    let border;
    let background;

    if (isEmpty) {
      debugSize(`measureSlot(".${slot.className}") -> it is empty`);
    } else if (singleElementNode) {
      const visualSelector = singleElementNode.getAttribute(
        "data-visual-selector",
      );
      const visualElement = visualSelector
        ? singleElementNode.querySelector(visualSelector) || singleElementNode
        : singleElementNode;
      const rect = visualElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      debugSize(`measureSlot(".${slot.className}") -> [${width}x${height}]`);
      borderRadius = getBorderRadius(visualElement);
      border = getComputedStyle(visualElement).border;
      background = getComputedStyle(visualElement).background;
    } else {
      // text, multiple elements
      const rect = slot.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      debugSize(`measureSlot(".${slot.className}") -> [${width}x${height}]`);
    }

    const commonProperties = {
      domNodes,
      domNodesClone,
      isEmpty,
      isOnlyTextNodes,
      singleElementNode,

      width,
      height,
      borderRadius,
      border,
      background,

      contentId,
    };

    if (contentPhase) {
      return {
        ...commonProperties,
        type: "content_phase",
        contentPhase,
        isContentPhase: true,
        isContent: false,
        toString: () => `content(${contentId}).phase(${contentPhase})`,
      };
    }
    return {
      ...commonProperties,
      type: "content",
      contentPhase: undefined,
      isContentPhase: false,
      isContent: true,
      toString: () => `content(${contentId})`,
    };
  };

  const targetSlotInitialConfiguration = detectConfiguration(targetSlot);
  const outgoingSlotInitialConfiguration = detectConfiguration(outgoingSlot, {
    contentPhase: "true",
  });
  let targetSlotConfiguration = targetSlotInitialConfiguration;
  let outgoingSlotConfiguration = outgoingSlotInitialConfiguration;
  let previousTargetSlotConfiguration = UNSET;

  const updateSlotAttributes = () => {
    if (targetSlotConfiguration.isEmpty && outgoingSlotConfiguration.isEmpty) {
      root.setAttribute("data-only-previous-group", "");
    } else {
      root.removeAttribute("data-only-previous-group");
    }
  };
  const updateAlignment = () => {
    // Set data attributes for CSS-based alignment
    root.setAttribute("data-align-x", alignX);
    root.setAttribute("data-align-y", alignY);
  };

  const moveConfigurationIntoSlot = (configuration, slot) => {
    slot.innerHTML = "";
    for (const domNode of configuration.domNodesClone) {
      slot.appendChild(domNode);
    }
    // in case border or stuff like that have changed we re-detect the config
    const updatedConfig = detectConfiguration(slot);
    if (slot === targetSlot) {
      targetSlotConfiguration = updatedConfig;
    } else if (slot === outgoingSlot) {
      outgoingSlotConfiguration = updatedConfig;
    } else if (slot === previousTargetSlot) {
      previousTargetSlotConfiguration = updatedConfig;
    } else if (slot === previousOutgoingSlot) {
    } else {
      throw new Error("Unknown slot for applyConfiguration");
    }
  };

  updateAlignment();

  let transitionType = "none";
  const groupTransitionOptions = {
    // debugBreakpoints: [0.25],
    pauseBreakpoints,
    lifecycle: {
      setup: () => {
        updateSlotAttributes();
        root.setAttribute("data-transitioning", "");
        onStateChange({ isTransitioning: true });
        return {
          teardown: () => {
            root.removeAttribute("data-transitioning");
            updateSlotAttributes(); // Update positioning after transition
            onStateChange({ isTransitioning: false });
          },
        };
      },
    },
  };
  const transitionController = createGroupTransitionController(
    groupTransitionOptions,
  );

  const elementToClip = root;
  const morphContainerIntoTarget = () => {
    const morphTransitions = [];
    dimensions: {
      // TODO: ideally when scrollContainer is document AND we transition
      // from a layout with scrollbar to a layout without
      // we have clip path detecting we go from a given width/height to a new width/height
      // that might just be the result of scrollbar appearing/disappearing
      // we should detect when this happens to avoid clipping what correspond to the scrollbar presence toggling
      const fromWidth = previousTargetSlotConfiguration.width || 0;
      const fromHeight = previousTargetSlotConfiguration.height || 0;
      const toWidth = targetSlotConfiguration.width || 0;
      const toHeight = targetSlotConfiguration.height || 0;
      debugSize(
        `transition from [${fromWidth}x${fromHeight}] to [${toWidth}x${toHeight}]`,
      );
      const restoreOverflow = preventIntermediateScrollbar(root, {
        fromWidth,
        fromHeight,
        toWidth,
        toHeight,
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

      const onSizeTransitionFinished = () => {
        // Restore overflow when transition is complete
        restoreOverflow();
      };

      // https://emilkowal.ski/ui/the-magic-of-clip-path
      const elementToClipRect = elementToClip.getBoundingClientRect();
      const elementToClipWidth = elementToClipRect.width;
      const elementToClipHeight = elementToClipRect.height;
      // Calculate where content is positioned within the large container
      const getAlignedPosition = (containerSize, contentSize, align) => {
        switch (align) {
          case "start":
            return 0;
          case "end":
            return containerSize - contentSize;
          case "center":
          default:
            return (containerSize - contentSize) / 2;
        }
      };
      // Position of "from" content within large container
      const fromLeft = getAlignedPosition(
        elementToClipWidth,
        fromWidth,
        alignX,
      );
      const fromTop = getAlignedPosition(
        elementToClipHeight,
        fromHeight,
        alignY,
      );
      // Position of target content within large container
      const targetLeft = getAlignedPosition(
        elementToClipWidth,
        toWidth,
        alignX,
      );
      const targetTop = getAlignedPosition(
        elementToClipHeight,
        toHeight,
        alignY,
      );
      debugSize(
        `Positions in container: from [${fromLeft},${fromTop}] ${fromWidth}x${fromHeight} to [${targetLeft},${targetTop}] ${toWidth}x${toHeight}`,
      );
      // Get border-radius values
      const fromBorderRadius =
        previousTargetSlotConfiguration.borderRadius || 0;
      const toBorderRadius = targetSlotConfiguration.borderRadius || 0;
      const startInsetTop = fromTop;
      const startInsetRight = elementToClipWidth - (fromLeft + fromWidth);
      const startInsetBottom = elementToClipHeight - (fromTop + fromHeight);
      const startInsetLeft = fromLeft;

      const endInsetTop = targetTop;
      const endInsetRight = elementToClipWidth - (targetLeft + toWidth);
      const endInsetBottom = elementToClipHeight - (targetTop + toHeight);
      const endInsetLeft = targetLeft;

      const startClipPath = `inset(${startInsetTop}px ${startInsetRight}px ${startInsetBottom}px ${startInsetLeft}px round ${fromBorderRadius}px)`;
      const endClipPath = `inset(${endInsetTop}px ${endInsetRight}px ${endInsetBottom}px ${endInsetLeft}px round ${toBorderRadius}px)`;
      // Create clip-path animation using Web Animations API
      const clipAnimation = elementToClip.animate(
        [{ clipPath: startClipPath }, { clipPath: endClipPath }],
        {
          duration,
          easing: "ease",
          fill: "forwards",
        },
      );

      // Handle finish
      clipAnimation.finished
        .then(() => {
          // Clear clip-path to restore normal behavior
          elementToClip.style.clipPath = "";
          clipAnimation.cancel();
          onSizeTransitionFinished();
        })
        .catch(() => {
          // Animation was cancelled
        });
      clipAnimation.play();
    }

    return morphTransitions;
  };
  const fadeInTargetSlot = () => {
    targetSlotBackground.style.setProperty(
      "--target-slot-background",
      targetSlotConfiguration.background,
    );
    targetSlotBackground.style.setProperty(
      "--target-slot-width",
      `${targetSlotConfiguration.width || 0}px`,
    );
    targetSlotBackground.style.setProperty(
      "--target-slot-height",
      `${targetSlotConfiguration.height || 0}px`,
    );
    return createOpacityTransition(targetSlot, 1, {
      from: 0,
      duration,
      styleSynchronizer: "inline_style",
      onFinish: (targetSlotOpacityTransition) => {
        targetSlotBackground.style.removeProperty("--target-slot-background");
        targetSlotBackground.style.removeProperty("--target-slot-width");
        targetSlotBackground.style.removeProperty("--target-slot-height");
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
    // 1. move target slot to previous
    moveConfigurationIntoSlot(targetSlotConfiguration, previousTargetSlot);
    targetSlotConfiguration = toConfiguration;
    // 2. move outgoing slot to previous
    moveConfigurationIntoSlot(outgoingSlotConfiguration, previousOutgoingSlot);
    moveConfigurationIntoSlot(UNSET, outgoingSlot);

    const transitions = [
      ...morphContainerIntoTarget(),
      fadeInTargetSlot(),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, previousTargetSlot);
        moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // content_phase_to_content_phase transition (uses outgoing_slot)
  const applyContentPhaseToContentPhaseTransition = (toConfiguration) => {
    // 1. Move target slot to outgoing
    moveConfigurationIntoSlot(targetSlotConfiguration, outgoingSlot);
    targetSlotConfiguration = toConfiguration;

    const transitions = [
      ...morphContainerIntoTarget(),
      fadeInTargetSlot(),
      fadeOutOutgoingSlot(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, outgoingSlot);

        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // any_to_empty transition
  const applyToEmptyTransition = () => {
    // 1. move target slot to previous
    moveConfigurationIntoSlot(targetSlotConfiguration, previousTargetSlot);
    targetSlotConfiguration = UNSET;
    // 2. move outgoing slot to previous
    moveConfigurationIntoSlot(outgoingSlotConfiguration, previousOutgoingSlot);
    outgoingSlotConfiguration = UNSET;

    const transitions = [...morphContainerIntoTarget(), fadeOutPreviousGroup()];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, previousTargetSlot);
        moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
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
    if (contentId) {
      targetSlot.setAttribute(CONTENT_ID_ATTRIBUTE, contentId);
    } else {
      targetSlot.removeAttribute(CONTENT_ID_ATTRIBUTE);
    }
    if (contentPhase) {
      targetSlot.setAttribute(CONTENT_PHASE_ATTRIBUTE, contentPhase);
    } else {
      targetSlot.removeAttribute(CONTENT_PHASE_ATTRIBUTE);
    }
    if (newContentElement) {
      targetSlot.innerHTML = "";
      targetSlot.appendChild(newContentElement);
    } else {
      targetSlot.innerHTML = "";
    }
  };
  // Reset to initial content
  const resetContent = () => {
    transitionController.cancel();
    moveConfigurationIntoSlot(targetSlotInitialConfiguration, targetSlot);
    moveConfigurationIntoSlot(outgoingSlotInitialConfiguration, outgoingSlot);
    moveConfigurationIntoSlot(UNSET, previousTargetSlot);
    moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
  };

  const targetSlotEffect = (reasons) => {
    if (root.hasAttribute("data-disabled")) {
      return;
    }
    const fromConfiguration = targetSlotConfiguration;
    const toConfiguration = detectConfiguration(targetSlot);
    if (hasDebugLogs) {
      console.group(`targetSlotEffect()`);
      console.debug(`reasons:`);
      console.debug(`- ${reasons.join("\n- ")}`);
    }
    if (isSameConfiguration(fromConfiguration, toConfiguration)) {
      debugDetection(
        `already in desired state (${toConfiguration}) -> early return`,
      );
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

  const [teardown, addTeardown] = createPubSub();
  mutation_observer: {
    const mutationObserver = new MutationObserver((mutations) => {
      const reasonParts = [];
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const added = mutation.addedNodes.length;
          const removed = mutation.removedNodes.length;
          if (added && removed) {
            reasonParts.push(`addedNodes(${added}) removedNodes(${removed})`);
          } else if (added) {
            reasonParts.push(`addedNodes(${added})`);
          } else {
            reasonParts.push(`removedNodes(${removed})`);
          }
          continue;
        }
        if (mutation.type === "attributes") {
          const { attributeName } = mutation;
          if (
            attributeName === CONTENT_ID_ATTRIBUTE ||
            attributeName === CONTENT_PHASE_ATTRIBUTE
          ) {
            const { oldValue } = mutation;
            if (oldValue === null) {
              const value = targetSlot.getAttribute(attributeName);
              reasonParts.push(
                value
                  ? `added [${attributeName}=${value}]`
                  : `added [${attributeName}]`,
              );
            } else if (targetSlot.hasAttribute(attributeName)) {
              const value = targetSlot.getAttribute(attributeName);
              reasonParts.push(`[${attributeName}] ${oldValue} -> ${value}`);
            } else {
              reasonParts.push(
                oldValue
                  ? `removed [${attributeName}=${oldValue}]`
                  : `removed [${attributeName}]`,
              );
            }
          }
        }
      }

      if (reasonParts.length === 0) {
        return;
      }
      targetSlotEffect(reasonParts);
    });
    mutationObserver.observe(targetSlot, {
      childList: true,
      attributes: true,
      attributeFilter: [CONTENT_ID_ATTRIBUTE, CONTENT_PHASE_ATTRIBUTE],
      characterData: false,
    });
    addTeardown(() => {
      mutationObserver.disconnect();
    });
  }
  monitor_slots_height_overflow: {
    const slots = [
      targetSlot,
      outgoingSlot,
      previousTargetSlot,
      previousOutgoingSlot,
    ];
    for (const slot of slots) {
      addTeardown(monitorItemsOverflow(slot));
    }
  }

  const setDuration = (newDuration) => {
    duration = newDuration;
    // Update CSS variable immediately
    root.style.setProperty("--x-transition-duration", `${duration}ms`);
  };
  const setAlignment = (newAlignX, newAlignY) => {
    alignX = newAlignX;
    alignY = newAlignY;
    updateAlignment();
  };

  return {
    updateContentId: (value) => {
      if (value) {
        targetSlot.setAttribute(CONTENT_ID_ATTRIBUTE, value);
      } else {
        targetSlot.removeAttribute(CONTENT_ID_ATTRIBUTE);
      }
    },

    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    updateAlignment,
    setPauseBreakpoints: (value) => {
      groupTransitionOptions.pauseBreakpoints = value;
    },
    cleanup: () => {
      teardown();
    },
  };
};
