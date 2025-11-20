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
 *  <div class="ui_transition_container">
 *   <div class="active_group">
 *     <div class="target_slot"></div>
 *     <div class="outgoing_slot"></div>
 *   </div>
 *   <div class="previous_group">
 *     <div class="previous_target_slot"></div>
 *     <div class="previous_outgoing_slot"></div>
 *   </div>
 *  </div>
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
  getBackground,
  getBorderRadius,
  getElementSignature,
  getScrollContainer,
  measureScrollbar,
  preventIntermediateScrollbar,
} from "@jsenv/dom";
import { monitorItemsHeightOverflow } from "./monitor_items_height_overflow.js";

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
  .active_group,
  .previous_group,
  .target_slot,
  .previous_target_slot,
  .outgoing_slot,
  .previous_outgoing_slot {
    width: 100%;
    height: 100%;
  }

  .target_slot,
  .outgoing_slot,
  .previous_target_slot,
  .previous_outgoing_slot {
    display: flex;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .target_slot[data-items-height-overflow],
  .previous_slot[data-items-height-overflow],
  .previous_target_slot[data-items-height-overflow],
  .previous_outgoing_slot[data-items-height-overflow] {
    --x-align-items: flex-start;
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
    inset: 0;
  }
  .ui_transition[data-only-previous-group] .previous_group {
    position: relative;
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

  const container = root.querySelector(".ui_transition_container");
  const activeGroup = root.querySelector(".active_group");
  const targetSlot = root.querySelector(".target_slot");
  const outgoingSlot = root.querySelector(".outgoing_slot");
  const previousGroup = root.querySelector(".previous_group");
  const previousTargetSlot = previousGroup?.querySelector(
    ".previous_target_slot",
  );
  const previousOutgoingSlot = previousGroup?.querySelector(
    ".previous_outgoing_slot",
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

  const scrollContainer = getScrollContainer(root);
  const getRootAvailableDimensions = () => {
    const [scrollbarWidth, scrollbarHeight] = measureScrollbar(scrollContainer);
    const clientWidth = scrollContainer.clientWidth + scrollbarWidth;
    const clientHeight = scrollContainer.clientHeight + scrollbarHeight;
    return [clientWidth, clientHeight];
  };

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
      const rect = singleElementNode.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      debugSize(`measureSlot(".${slot.className}") -> [${width}x${height}]`);
      borderRadius = getBorderRadius(singleElementNode);
      border = getComputedStyle(singleElementNode).border;
      background = getBackground(singleElementNode);
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
  let previousOutgoingSlotConfiguration = UNSET;

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
  let updateSlotOverflowX;
  let updateSlotOverflowY;
  slot_overflow: {
    // We have data attributes per group because one group might overflow x and the other might overflow y
    // and we want the other group to keep positioning correctly
    const updateGroupOverflow = (
      slot,
      isOverflowingRoot,
      { group, axis, overflowingSlotSet },
    ) => {
      const attrName =
        axis === "x" ? "data-slot-overflow-x" : "data-slot-overflow-y";
      const size = overflowingSlotSet.size;
      if (isOverflowingRoot) {
        overflowingSlotSet.add(slot);
        if (size === 0 && overflowingSlotSet.size === 1) {
          debugSize(
            `".${slot.className}" overflowing on ${axis} -> add [${attrName}]`,
          );
        }
        group.setAttribute(
          attrName,
          Array.from(overflowingSlotSet, (s) => `.${s.className}`).join(", "),
        );
      } else {
        overflowingSlotSet.delete(slot);
        if (size === 1 && overflowingSlotSet.size === 0) {
          debugSize(
            `".${slot.className}" not overflowing anymore on ${axis} -> remove [${attrName}]`,
          );
          group.removeAttribute(attrName);
        }
      }
    };

    x_overflow: {
      const xOverflowingActiveSlotSet = new Set();
      const xOverflowingPreviousSlotSet = new Set();
      updateSlotOverflowX = (slot, isOverflowingRootOnX) => {
        if (slot === targetSlot || slot === outgoingSlot) {
          updateGroupOverflow(slot, isOverflowingRootOnX, {
            group: activeGroup,
            axis: "x",
            overflowingSlotSet: xOverflowingActiveSlotSet,
          });
        } else {
          updateGroupOverflow(slot, isOverflowingRootOnX, {
            group: previousGroup,
            axis: "x",
            overflowingSlotSet: xOverflowingPreviousSlotSet,
          });
        }
      };
    }
    y_overflow: {
      const yOverflowingActiveSlotSet = new Set();
      const yOverflowingPreviousSlotSet = new Set();
      updateSlotOverflowY = (slot, isOverflowingRootOnY) => {
        if (slot === targetSlot || slot === outgoingSlot) {
          updateGroupOverflow(slot, isOverflowingRootOnY, {
            group: activeGroup,
            axis: "y",
            overflowingSlotSet: yOverflowingActiveSlotSet,
          });
        } else {
          updateGroupOverflow(slot, isOverflowingRootOnY, {
            group: previousGroup,
            axis: "y",
            overflowingSlotSet: yOverflowingPreviousSlotSet,
          });
        }
      };
    }
  }

  const getSlotConfiguration = (slot) => {
    if (slot === targetSlot) {
      return targetSlotConfiguration;
    }
    if (slot === outgoingSlot) {
      return outgoingSlotConfiguration;
    }
    if (slot === previousTargetSlot) {
      return previousTargetSlotConfiguration;
    }
    if (slot === previousOutgoingSlot) {
      return previousOutgoingSlotConfiguration;
    }
    throw new Error("Unknown slot for getConfiguration");
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
      previousOutgoingSlotConfiguration = updatedConfig;
    } else {
      throw new Error("Unknown slot for applyConfiguration");
    }
    applySlotConfigurationEffects(slot);
  };
  const applySlotConfigurationEffects = (slot) => {
    forceSlotDimensions(slot);
  };
  const forceSlotDimensions = (slot) => {
    const configuration = getSlotConfiguration(slot);
    const { width, height } = configuration;
    setSlotDimensions(slot, width, height);
  };
  const releaseSlotDimensions = (slot) => {
    setSlotDimensions(slot, undefined, undefined);
  };
  const setSlotDimensions = (slot, width, height) => {
    if (width === undefined) {
      if (!slot.style.width) {
        return;
      }
      debugSize(`cleatSlotDimensions(".${slot.className}")`);
      slot.style.width = "";
      slot.style.height = "";
      updateSlotOverflowX(slot, false);
      updateSlotOverflowY(slot, false);
      return;
    }
    if (
      slot.style.width === `${width}px` &&
      slot.style.height === `${height}px`
    ) {
      return;
    }
    debugSize(`setSlotDimensions(".${slot.className}", ${width}, ${height})`);
    const [rootVisibleWidth, rootVisibleHeight] = getRootAvailableDimensions();
    updateSlotOverflowX(slot, width > rootVisibleWidth);
    updateSlotOverflowY(slot, height > rootVisibleHeight);
    slot.style.width = `${width}px`;
    slot.style.height = `${height}px`;
  };

  updateAlignment();
  applySlotConfigurationEffects(targetSlot);
  applySlotConfigurationEffects(outgoingSlot);

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

  const morphContainerIntoTarget = () => {
    const morphTransitions = [];
    border_radius: {
      container.style.borderRadius = targetSlotConfiguration.borderRadius;
    }
    dimensions: {
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
        // Let target slot take natural size now container is done
        releaseSlotDimensions(targetSlot);
      };

      // https://emilkowal.ski/ui/the-magic-of-clip-path
      // Calculate alignment-aware positioning within final container
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
      const startLeft = getAlignedPosition(toWidth, fromWidth, alignX);
      const startTop = getAlignedPosition(toHeight, fromHeight, alignY);
      const startRight = startLeft + fromWidth;
      const startBottom = startTop + fromHeight;
      // End clip rectangle: full container
      const endLeft = 0;
      const endTop = 0;
      const endRight = toWidth;
      const endBottom = toHeight;
      const fromBorderRadius =
        previousTargetSlotConfiguration.borderRadius || 0;
      const toBorderRadius = targetSlotConfiguration.borderRadius || 0;

      let startClipPath;
      let endClipPath;
      const startInsetTop = startTop;
      const startInsetRight = toWidth - startRight;
      const startInsetBottom = toHeight - startBottom;
      const startInsetLeft = startLeft;
      const endInsetTop = endTop;
      const endInsetRight = toWidth - endRight;
      const endInsetBottom = toHeight - endBottom;
      const endInsetLeft = endLeft;
      startClipPath = `inset(${startInsetTop}px ${startInsetRight}px ${startInsetBottom}px ${startInsetLeft}px round ${fromBorderRadius}px)`;
      endClipPath = `inset(${endInsetTop}px ${endInsetRight}px ${endInsetBottom}px ${endInsetLeft}px round ${toBorderRadius}px)`;

      // Create clip-path animation using Web Animations API
      const clipAnimation = container.animate(
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
          container.style.clipPath = "";
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
    // 1. move target slot to previous
    moveConfigurationIntoSlot(targetSlotConfiguration, previousTargetSlot);
    targetSlotConfiguration = toConfiguration;
    applySlotConfigurationEffects(targetSlot);
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
    applySlotConfigurationEffects(targetSlot);

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
      addTeardown(monitorItemsHeightOverflow(slot));
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
