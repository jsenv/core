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
 * - finir le truc avec le background
 * puis faire la meme avec le border-color et le radius
 *
 * - padding
 *
 * - border radius
 *
 * - vérification des backgrounds (on peut appliquer des backgrounds
 * et ils prennents bien la taille attendu (meme si le contenr "overflow"))
 *
 * - content phase se comporte comme le contenu tant qu'on a pas vu de contenu
 * des qu'on voit un contenu il doit respecter les dimensions du dernier contenu
 * qu'on connait
 * (meme si le content id change, on garde les dimensions du contenu "actuel" en attendant de voir le nouveau)
 *
 *
 */

import {
  createBackgroundTransition,
  createBorderRadiusTransition,
  createBorderTransition,
  createGroupTransitionController,
  createOpacityTransition,
  getBackground,
  getBorderRadius,
  getElementSignature,
  getScrollContainer,
  measureScrollbar,
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
    --background-color: transparent;
    --border-radius: 0;

    --x-transition-duration: var(--transition-duration);
    --x-justify-content: var(--justify-content);
    --x-align-items: var(--align-items);
    --x-background-color: var(--background-color);
    --x-border-radius: var(--border-radius);

    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
    background-color: var(--x-background-color);
    border-radius: var(--x-border-radius);
  }

  .ui_transition_container {
    /* in case CSS sets border on this element his size must include borders */
    box-sizing: border-box;
    /* max-width/max-height saves use from content going outside parent boundaries by flexbox positioning */
    max-width: 100%;
    max-height: 100%;
  }

  .ui_transition[data-transitioning] .ui_transition_container {
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
  .active_group[data-slot-overflow-x],
  .previous_group[data-slot-overflow-x] {
    --x-justify-content: flex-start;
  }
  .active_group[data-slot-overflow-y],
  .previous_group[data-slot-overflow-y] {
    --x-align-items: flex-start;
  }

  .active_group,
  .previous_group {
    display: flex;
    min-height: 100%;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .active_group {
    position: relative;
  }
  .target_slot {
    position: relative;
  }
  .ui_transition[data-transitioning] .active_group,
  .ui_transition[data-transitioning] .previous_group {
    height: 100%;
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
  }
  .ui_transition[data-only-previous-group] .previous_group {
    position: relative;
  }

  .ui_transition[data-transitioning] .target_slot > *,
  .ui_transition[data-transitioning] .outgoing_slot > *,
  .ui_transition[data-transitioning] .previous_target_slot > *,
  .ui_transition[data-transitioning] .previous_outgoing_slot > * {
    background-image: none !important;
    background-color: transparent !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }
`;

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
    for (const domNode of domNodes) {
      if (domNode.nodeType === Node.TEXT_NODE) {
        textNodeCount++;
      } else {
        if (!firstElementNode) {
          firstElementNode = domNode;
        }
        elementNodeCount++;
      }
      const domNodeClone = domNode.cloneNode(true);
      domNodesClone.push(domNodeClone);
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

  let isTransitioning = false;
  let transitionType = "none";
  const groupTransitionOptions = {
    // debugBreakpoints: [0.25],
    pauseBreakpoints,
    lifecycle: {
      setup: () => {
        updateSlotAttributes();
        root.setAttribute("data-transitioning", "");
        isTransitioning = true;
        onStateChange({ isTransitioning: true });
        return {
          teardown: () => {
            root.removeAttribute("data-transitioning");
            isTransitioning = false;
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
      const fromBorderRadius = previousTargetSlotConfiguration.borderRadius;
      const toBorderRadius = targetSlotConfiguration.borderRadius;
      const borderRadiusTransition = createBorderRadiusTransition(
        container,
        toBorderRadius,
        {
          from: fromBorderRadius,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: () => {},
          onFinish: (borderRadiusTransition) => {
            borderRadiusTransition.cancel();
          },
        },
      );
      morphTransitions.push(borderRadiusTransition);
    }
    border: {
      const fromBorder = previousTargetSlotConfiguration.border;
      const toBorder = targetSlotConfiguration.border;
      const borderTransition = createBorderTransition(container, toBorder, {
        from: fromBorder,
        duration,
        styleSynchronizer: "inline_style",
        onFinish: (borderTransition) => {
          borderTransition.cancel();
        },
      });
      morphTransitions.push(borderTransition);
    }
    background: {
      const fromBackground = previousTargetSlotConfiguration.background;
      const toBackground = targetSlotConfiguration.background;
      const backgroundTransition = createBackgroundTransition(
        container,
        toBackground,
        {
          from: fromBackground,
          duration,
          styleSynchronizer: "inline_style",
          onUpdate: () => {},
          onFinish: () => {
            backgroundTransition.cancel();
          },
        },
      );
      morphTransitions.push(backgroundTransition);
    }
    dimensions: {
      // let containerWidth;
      // let containerHeight;
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

      // Set final dimensions immediately
      container.style.width = `${toWidth}px`;
      container.style.height = `${toHeight}px`;
      container.style.contain = "paint";

      // https://emilkowal.ski/ui/the-magic-of-clip-path
      // Analyze each dimension independently
      const widthIsGrowing = toWidth > fromWidth;
      const heightIsGrowing = toHeight > fromHeight;

      let startClipPath;
      let endClipPath;

      // Set container to the larger of from/to dimensions to accommodate the animation
      const containerWidth = Math.max(fromWidth, toWidth);
      const containerHeight = Math.max(fromHeight, toHeight);

      container.style.width = `${containerWidth}px`;
      container.style.height = `${containerHeight}px`;

      // Calculate start rectangle (from dimensions, centered in container)
      const startWidth = fromWidth;
      const startHeight = fromHeight;
      const startLeft = (containerWidth - startWidth) / 2;
      const startTop = (containerHeight - startHeight) / 2;
      const startRight = startLeft + startWidth;
      const startBottom = startTop + startHeight;

      // Calculate end rectangle (to dimensions, centered in container)
      const endWidth = toWidth;
      const endHeight = toHeight;
      const endLeft = (containerWidth - endWidth) / 2;
      const endTop = (containerHeight - endHeight) / 2;
      const endRight = endLeft + endWidth;
      const endBottom = endTop + endHeight;

      // Use pixel values directly
      startClipPath = `polygon(${startLeft}px ${startTop}px, ${startRight}px ${startTop}px, ${startRight}px ${startBottom}px, ${startLeft}px ${startBottom}px)`;
      endClipPath = `polygon(${endLeft}px ${endTop}px, ${endRight}px ${endTop}px, ${endRight}px ${endBottom}px, ${endLeft}px ${endBottom}px)`;

      debugSize(
        `Transition: ${fromWidth}x${fromHeight} → ${toWidth}x${toHeight} (width ${widthIsGrowing ? "growing" : "shrinking"}, height ${heightIsGrowing ? "growing" : "shrinking"}) in container ${containerWidth}x${containerHeight}`,
      );

      // Create clip-path animation using Web Animations API
      const clipAnimation = container.animate(
        [{ clipPath: startClipPath }, { clipPath: endClipPath }],
        {
          duration,
          easing: "ease",
          fill: "forwards",
        },
      );

      // Initialize global pause/resume mechanism if not exists
      if (!window.pausedTransitions) {
        window.pausedTransitions = new Set();
      }
      if (!window.resumeTransitions) {
        window.resumeTransitions = () => {
          window.pausedTransitions.forEach((animation) => {
            animation.play();
          });
          window.pausedTransitions.clear();
          console.debug("Resumed all paused transitions");
        };
      } else {
        // Override existing function but call the previous version
        const originalResumeTransitions = window.resumeTransitions;
        window.resumeTransitions = () => {
          // Call original function first
          originalResumeTransitions();
          // Then handle our clip-path animations
          window.pausedTransitions.forEach((animation) => {
            animation.play();
          });
          window.pausedTransitions.clear();
          console.debug("Resumed all paused transitions including clip-path");
        };
      }

      // Pause at 80% progress
      setTimeout(() => {
        clipAnimation.pause();
        window.pausedTransitions.add(clipAnimation);
        console.debug(
          "Transition paused at 80% - call window.resumeTransitions() to continue",
        );
      }, duration * 0.8);

      // Handle finish
      clipAnimation.finished
        .then(() => {
          // Remove from paused set if completed
          window.pausedTransitions.delete(clipAnimation);
          // let container take natural dimensions now
          container.style.width = ``;
          container.style.height = ``;
          // Clear clip-path to restore normal behavior
          container.style.clipPath = "";
          clipAnimation.cancel();
          onSizeTransitionFinished();
        })
        .catch(() => {
          // Animation was cancelled
          window.pausedTransitions.delete(clipAnimation);
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
    if (isTransitioning) {
      console.log("Transition already in progress, ignoring");
      return;
    }

    if (newContentElement) {
      targetSlot.innerHTML = "";
      targetSlot.appendChild(newContentElement);
    } else {
      targetSlot.innerHTML = "";
    }

    const fromConfiguration = targetSlotConfiguration;
    const toConfiguration = detectConfiguration(targetSlot, {
      contentPhase,
      contentId,
    });
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
    moveConfigurationIntoSlot(targetSlotInitialConfiguration, targetSlot);
    moveConfigurationIntoSlot(outgoingSlotInitialConfiguration, outgoingSlot);
    moveConfigurationIntoSlot(UNSET, previousTargetSlot);
    moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
  };

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
    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    updateAlignment,
    setPauseBreakpoints: (value) => {
      groupTransitionOptions.pauseBreakpoints = value;
    },
  };
};
