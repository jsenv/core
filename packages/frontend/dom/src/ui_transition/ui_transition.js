/**
 * Required HTML structure for UI transitions with smooth size and phase/content animations:
 *
 * <div
 *   class="ui_transition_container"   <!-- Main container with relative positioning and overflow hidden -->
 *   data-size-transition              <!-- Optional: enable size animations -->
 *   data-size-transition-duration     <!-- Optional: size transition duration, default 300ms -->
 *   data-content-transition           <!-- Content transition type: cross-fade, slide-left -->
 *   data-content-transition-duration  <!-- Content transition duration -->
 *   data-phase-transition             <!-- Phase transition type: cross-fade only -->
 *   data-phase-transition-duration    <!-- Phase transition duration -->
 * >
 *   <div class="ui_transition_outer_wrapper"> <!-- Size animation target: width/height constraints are applied here during transitions -->
 *     <div class="ui_transition_measure_wrapper"> <!-- Content measurement layer: ResizeObserver watches this to detect natural content size changes -->
 *       <div class="ui_transition_slot" data-content-key></div> <!-- Content slot: actual content is here -->
 *       <div class="ui_transition_phase_overlay"> <!-- Used to transition to new phase: crossfade to new phase -->
 *         <!-- Clone of ".ui_transition_slot" children for phase transition -->
 *      </div>
 *     </div>
 *   </div>
 *
 *   <div class="ui_transition_content_overlay"> <!-- Used to transition to new content: crossfade/slide to new content -->
 *     <!-- Clone of ".ui_transition_slot" children for content transition -->
 *   </div>
 * </div>
 *
 * This separation allows:
 * - Optional smooth size transitions by constraining outer-wrapper dimensions (when data-size-transition is present)
 * - Instant size updates by default
 * - Accurate content measurement via measure-wrapper ResizeObserver
 * - Content transitions (slide, etc.) that operate at container level and can outlive content phase changes
 * - Phase transitions (cross-fade only) that operate on individual elements for loading/error states
 * - Independent content updates in the slot without affecting ongoing animations
 */

import { getElementSignature } from "../element_signature.js";
import { getHeight } from "../size/get_height.js";
import { getInnerWidth } from "../size/get_inner_width.js";
import { getWidth } from "../size/get_width.js";
import {
  createHeightTransition,
  createOpacityTransition,
  createTranslateXTransition,
  createWidthTransition,
  getOpacity,
  getOpacityWithoutTransition,
  getTranslateX,
  getTranslateXWithoutTransition,
} from "../transition/dom_transition.js";
import { createGroupTransitionController } from "../transition/group_transition.js";

import.meta.css = /* css */ `
  .ui_transition_container,
  .ui_transition_outer_wrapper,
  .ui_transition_measure_wrapper,
  .ui_transition_slot,
  .ui_transition_phase_overlay,
  .ui_transition_content_overlay {
    display: inline-flex;
    width: 100%;
    height: 100%;
  }

  .ui_transition_measure_wrapper[data-transition-translate-x] {
    overflow: hidden;
  }

  .ui_transition_container,
  .ui_transition_slot {
    position: relative;
  }

  .ui_transition_phase_overlay,
  .ui_transition_content_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
`;

const DEBUG = {
  size: false,
  transition: false,
  transition_updates: false,
};

// Utility function to format content key states consistently for debug logs
const formatContentKeyState = (
  contentKey,
  hasChildren,
  hasTextNode = false,
) => {
  if (hasTextNode) {
    return "[text]";
  }
  if (!hasChildren) {
    return "[empty]";
  }
  if (contentKey === null || contentKey === undefined) {
    return "[unkeyed]";
  }
  return `[data-content-key="${contentKey}"]`;
};

const SIZE_TRANSITION_DURATION = 150; // Default size transition duration
const SIZE_DIFF_EPSILON = 0.5; // Ignore size transition when difference below this (px)
const CONTENT_TRANSITION = "cross-fade"; // Default content transition type
const CONTENT_TRANSITION_DURATION = 300; // Default content transition duration
const PHASE_TRANSITION = "cross-fade";
const PHASE_TRANSITION_DURATION = 300; // Default phase transition duration

export const initUITransition = (container) => {
  const localDebug = {
    ...DEBUG,
    transition: container.hasAttribute("data-debug-transition"),
  };

  const debug = (type, ...args) => {
    if (localDebug[type]) {
      console.debug(`[${type}]`, ...args);
    }
  };

  if (!container.classList.contains("ui_transition_container")) {
    console.error("Element must have ui_transition_container class");
    return { cleanup: () => {} };
  }

  const outerWrapper = container.querySelector(".ui_transition_outer_wrapper");
  const measureWrapper = container.querySelector(
    ".ui_transition_measure_wrapper",
  );
  const slot = container.querySelector(".ui_transition_slot");
  let phaseOverlay = measureWrapper.querySelector(
    ".ui_transition_phase_overlay",
  );
  let contentOverlay = container.querySelector(
    ".ui_transition_content_overlay",
  );

  if (
    !outerWrapper ||
    !measureWrapper ||
    !slot ||
    !phaseOverlay ||
    !contentOverlay
  ) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const transitionController = createGroupTransitionController();

  // Transition state
  let activeContentTransition = null;
  let activeContentTransitionType = null;
  let activePhaseTransition = null;
  let activePhaseTransitionType = null;
  let isPaused = false;

  // Size state
  let naturalContentWidth = 0; // Natural size of actual content (not loading/error states)
  let naturalContentHeight = 0;
  let constrainedWidth = 0; // Current constrained dimensions (what outer wrapper is set to)
  let constrainedHeight = 0;
  let sizeTransition = null;
  let resizeObserver = null;
  let sizeHoldActive = false; // Hold previous dimensions during content transitions when size transitions are disabled

  // Prevent reacting to our own constrained size changes while animating
  let suppressResizeObserver = false;
  let pendingResizeSync = false; // ensure one measurement after suppression ends

  // Handle size updates based on content state
  let hasSizeTransitions = container.hasAttribute("data-size-transition");
  const initialTransitionEnabled = container.hasAttribute(
    "data-initial-transition",
  );
  let hasPopulatedOnce = false; // track if we've already populated once (null → something)

  // Child state
  let lastContentKey = null;
  let previousChildNodes = null;
  let isContentPhase = false; // Current state: true when showing content phase (loading/error)
  let wasContentPhase = false; // Previous state for comparison

  const measureContentSize = () => {
    return [getWidth(measureWrapper), getHeight(measureWrapper)];
  };

  const updateContentDimensions = () => {
    const [newWidth, newHeight] = measureContentSize();
    debug("size", "Content size changed:", {
      width: `${naturalContentWidth} → ${newWidth}`,
      height: `${naturalContentHeight} → ${newHeight}`,
    });

    updateNaturalContentSize(newWidth, newHeight);

    if (sizeTransition) {
      debug("size", "Updating animation target:", newHeight);
      updateToSize(newWidth, newHeight);
    } else {
      constrainedWidth = newWidth;
      constrainedHeight = newHeight;
    }
  };

  const stopResizeObserver = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };

  const startResizeObserver = () => {
    resizeObserver = new ResizeObserver(() => {
      if (!hasSizeTransitions) {
        return;
      }
      if (suppressResizeObserver) {
        pendingResizeSync = true;
        debug("size", "Resize ignored (suppressed during size transition)");
        return;
      }
      updateContentDimensions();
    });
    resizeObserver.observe(measureWrapper);
  };

  const releaseConstraints = (reason) => {
    debug("size", `Releasing constraints (${reason})`);
    const [beforeWidth, beforeHeight] = measureContentSize();
    outerWrapper.style.width = "";
    outerWrapper.style.height = "";
    outerWrapper.style.overflow = "";
    const [afterWidth, afterHeight] = measureContentSize();
    debug("size", "Size after release:", {
      width: `${beforeWidth} → ${afterWidth}`,
      height: `${beforeHeight} → ${afterHeight}`,
    });
    constrainedWidth = afterWidth;
    constrainedHeight = afterHeight;
    naturalContentWidth = afterWidth;
    naturalContentHeight = afterHeight;
    // Defer a sync if suppression just ended; actual dispatch will come from resize observer
    if (!suppressResizeObserver && pendingResizeSync) {
      pendingResizeSync = false;
      updateContentDimensions();
    }
  };

  const updateToSize = (targetWidth, targetHeight) => {
    if (
      constrainedWidth === targetWidth &&
      constrainedHeight === targetHeight
    ) {
      return;
    }

    const shouldAnimate = container.hasAttribute("data-size-transition");
    const widthDiff = Math.abs(targetWidth - constrainedWidth);
    const heightDiff = Math.abs(targetHeight - constrainedHeight);

    if (widthDiff <= SIZE_DIFF_EPSILON && heightDiff <= SIZE_DIFF_EPSILON) {
      // Both diffs negligible; just sync styles if changed and bail
      if (widthDiff > 0) {
        outerWrapper.style.width = `${targetWidth}px`;
        constrainedWidth = targetWidth;
      }
      if (heightDiff > 0) {
        outerWrapper.style.height = `${targetHeight}px`;
        constrainedHeight = targetHeight;
      }
      debug(
        "size",
        `Skip size animation entirely (diffs width:${widthDiff.toFixed(4)}px height:${heightDiff.toFixed(4)}px)`,
      );
      return;
    }

    if (!shouldAnimate) {
      // No size transitions - just update dimensions instantly
      debug("size", "Updating size instantly:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
      });
      suppressResizeObserver = true;
      outerWrapper.style.width = `${targetWidth}px`;
      outerWrapper.style.height = `${targetHeight}px`;
      constrainedWidth = targetWidth;
      constrainedHeight = targetHeight;
      // allow any resize notifications to settle then re-enable
      requestAnimationFrame(() => {
        suppressResizeObserver = false;
        if (pendingResizeSync) {
          pendingResizeSync = false;
          updateContentDimensions();
        }
      });
      return;
    }

    // Animated size transition
    debug("size", "Animating size:", {
      width: `${constrainedWidth} → ${targetWidth}`,
      height: `${constrainedHeight} → ${targetHeight}`,
    });

    const duration = parseInt(
      container.getAttribute("data-size-transition-duration") ||
        SIZE_TRANSITION_DURATION,
    );

    outerWrapper.style.overflow = "hidden";
    const transitions = [];

    // heightDiff & widthDiff already computed earlier in updateToSize when deciding to skip entirely
    if (heightDiff <= SIZE_DIFF_EPSILON) {
      // Treat as identical
      if (heightDiff > 0) {
        debug(
          "size",
          `Skip height transition (negligible diff ${heightDiff.toFixed(4)}px)`,
        );
      }
      outerWrapper.style.height = `${targetHeight}px`;
      constrainedHeight = targetHeight;
    } else if (targetHeight !== constrainedHeight) {
      transitions.push(
        createHeightTransition(outerWrapper, targetHeight, {
          duration,
          onUpdate: ({ value }) => {
            constrainedHeight = value;
          },
        }),
      );
    }

    if (widthDiff <= SIZE_DIFF_EPSILON) {
      if (widthDiff > 0) {
        debug(
          "size",
          `Skip width transition (negligible diff ${widthDiff.toFixed(4)}px)`,
        );
      }
      outerWrapper.style.width = `${targetWidth}px`;
      constrainedWidth = targetWidth;
    } else if (targetWidth !== constrainedWidth) {
      transitions.push(
        createWidthTransition(outerWrapper, targetWidth, {
          duration,
          onUpdate: ({ value }) => {
            constrainedWidth = value;
          },
        }),
      );
    }

    if (transitions.length > 0) {
      suppressResizeObserver = true;
      sizeTransition = transitionController.animate(transitions, {
        onFinish: () => {
          releaseConstraints("animated size transition completed");
          // End suppression next frame to avoid RO loop warnings
          requestAnimationFrame(() => {
            suppressResizeObserver = false;
            if (pendingResizeSync) {
              pendingResizeSync = false;
              updateContentDimensions();
            }
          });
        },
      });
      sizeTransition.play();
    } else {
      debug(
        "size",
        "No size transitions created (identical or negligible differences)",
      );
    }
  };

  const applySizeConstraints = (targetWidth, targetHeight) => {
    debug("size", "Applying size constraints:", {
      width: `${constrainedWidth} → ${targetWidth}`,
      height: `${constrainedHeight} → ${targetHeight}`,
    });

    outerWrapper.style.width = `${targetWidth}px`;
    outerWrapper.style.height = `${targetHeight}px`;
    outerWrapper.style.overflow = "hidden";
    constrainedWidth = targetWidth;
    constrainedHeight = targetHeight;
  };

  const updateNaturalContentSize = (newWidth, newHeight) => {
    debug("size", "Updating natural content size:", {
      width: `${naturalContentWidth} → ${newWidth}`,
      height: `${naturalContentHeight} → ${newHeight}`,
    });
    naturalContentWidth = newWidth;
    naturalContentHeight = newHeight;
  };

  let isUpdating = false;

  // Shared transition setup function
  const setupTransition = ({
    isPhaseTransition = false,
    overlay,
    needsOldChildNodesClone,
    previousChildNodes,
    childNodes,
    attributeToRemove = [],
  }) => {
    let cleanup = () => {};
    let elementToImpact;

    if (overlay.chilNodes.length > 0) {
      elementToImpact = overlay.firstChild;
      cleanup = () => elementToImpact.remove();

      debug(
        "transition",
        `Continuing from current ${isPhaseTransition ? "phase" : "content"} transition element`,
      );
    } else if (needsOldChildNodesClone) {
      overlay.innerHTML = "";

      const cloneContainer = document.createElement("div");
      cloneContainer.style.display = "contents";
      for (const previousChildNode of previousChildNodes) {
        const previousChildClone = previousChildNode.cloneNode(true);
        for (const attrToRemove of attributeToRemove) {
          previousChildClone.removeAttribute(attrToRemove);
        }
        previousChildClone.setAttribute("data-ui-transition-clone", "");
        cloneContainer.appendChild(previousChildClone);
      }
      elementToImpact = cloneContainer;
      overlay.appendChild(elementToImpact);
      cleanup = () => elementToImpact.remove();
      debug(
        "transition",
        `Cloned previous child for ${isPhaseTransition ? "phase" : "content"} transition:`,
        getElementSignature(previousChildNodes),
      );
    } else {
      overlay.innerHTML = "";
      debug(
        "transition",
        `No old child to clone for ${isPhaseTransition ? "phase" : "content"} transition`,
      );
    }

    // Determine which elements to return based on transition type:
    // - Phase transitions: operate on individual elements (cross-fade between specific elements)
    // - Content transitions: operate at container level (slide entire containers, outlive content phases)
    let oldElement;
    let newElement;
    if (isPhaseTransition) {
      // Phase transitions work on individual elements
      oldElement = elementToImpact;
      newElement = slot;
    } else {
      // Content transitions work at container level and can outlive content phase changes
      oldElement = previousChildNodes.legnth ? elementToImpact : null;
      newElement = childNodes.length ? measureWrapper : null;
    }

    return {
      cleanup,
      oldElement,
      newElement,
    };
  };

  // Initialize with current size
  [constrainedWidth, constrainedHeight] = measureContentSize();

  const handleChildSlotMutation = (reason = "mutation") => {
    if (isUpdating) {
      debug("transition", "Preventing recursive update");
      return;
    }

    hasSizeTransitions = container.hasAttribute("data-size-transition");

    try {
      isUpdating = true;
      const childNodes = Array.from(slot.childNodes);
      if (localDebug.transition) {
        const updateLabel =
          childNodes.length === 0
            ? "cleared/empty"
            : childNodes.length === 1
              ? getElementSignature(childNodes[0])
              : getElementSignature(slot);
        console.group(`UI Update: ${updateLabel} (reason: ${reason})`);
      }

      // Determine transition scenarios early for early registration check
      // Prepare phase info early so logging can be unified (even for early return)
      wasContentPhase = isContentPhase;
      const hadChild = previousChildNodes.length > 0;
      const hasChild = childNodes.length > 0;

      // Prefer data-content-key on child, fallback to slot
      let currentContentKey = null;
      let slotContentKey = slot.getAttribute("data-content-key");
      let childContentKey;

      if (childNodes.length === 0) {
        childContentKey = null;
        isContentPhase = true; // empty (no child) is treated as content phase
      } else {
        for (const childNode of childNodes) {
          if (childNode.nodeType === Node.TEXT_NODE) {
          } else if (childNode.hasAttribute("data-content-key")) {
            childContentKey = childNode.getAttribute("data-content-key");
          } else if (childNode.hasAttribute("data-content-phase")) {
            isContentPhase = true;
          }
        }
      }
      if (childContentKey && slotContentKey) {
        console.warn(
          `Slot and slot child both have a [data-content-key]. Slot is ${slotContentKey} and child is ${childContentKey}, using the child.`,
        );
      }
      currentContentKey = childContentKey || slotContentKey || null;
      // Compute formatted content key states ONCE per mutation (requirement: max 2 calls)
      const previousContentKeyState = formatContentKeyState(
        lastContentKey,
        hadChild,
      );
      const currentContentKeyState = formatContentKeyState(
        currentContentKey,
        hasChild,
      );
      // Track previous key before any potential early registration update
      const prevKeyBeforeRegistration = lastContentKey;
      const previousIsContentPhase = !hadChild || wasContentPhase;
      const currentIsContentPhase = !hasChild || isContentPhase;

      // Early conceptual registration path: empty slot
      const shouldGiveUpEarlyAndJustRegister = !hadChild && !hasChild;
      let earlyAction = null;
      if (shouldGiveUpEarlyAndJustRegister) {
        const prevKey = prevKeyBeforeRegistration;
        const keyChanged = prevKey !== currentContentKey;
        if (!keyChanged) {
          earlyAction = "unchanged";
        } else if (prevKey === null && currentContentKey !== null) {
          earlyAction = "registered";
        } else if (prevKey !== null && currentContentKey === null) {
          earlyAction = "cleared";
        } else {
          earlyAction = "changed";
        }
        // Will update lastContentKey after unified logging
      }

      // Decide which representation to display for previous/current in early case
      const conceptualPrevDisplay =
        prevKeyBeforeRegistration === null
          ? "[unkeyed]"
          : `[data-content-key="${prevKeyBeforeRegistration}"]`;
      const conceptualCurrentDisplay =
        currentContentKey === null
          ? "[unkeyed]"
          : `[data-content-key="${currentContentKey}"]`;
      const previousDisplay = shouldGiveUpEarlyAndJustRegister
        ? conceptualPrevDisplay
        : previousContentKeyState;
      const currentDisplay = shouldGiveUpEarlyAndJustRegister
        ? conceptualCurrentDisplay
        : currentContentKeyState;

      // Build a simple descriptive sentence
      let contentKeysSentence = `Content key: ${previousDisplay} → ${currentDisplay}`;
      debug("transition", contentKeysSentence);

      if (shouldGiveUpEarlyAndJustRegister) {
        // Log decision explicitly (was previously embedded)
        debug("transition", `Decision: EARLY_RETURN (${earlyAction})`);
        // Register new conceptual key & return early (skip rest of transition logic)
        lastContentKey = currentContentKey;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }
      debug(
        "size",
        `Update triggered, size: ${constrainedWidth}x${constrainedHeight}`,
      );

      if (sizeTransition) {
        sizeTransition.cancel();
      }

      const [newWidth, newHeight] = measureContentSize();
      debug("size", `Measured size: ${newWidth}x${newHeight}`);
      outerWrapper.style.width = `${constrainedWidth}px`;
      outerWrapper.style.height = `${constrainedHeight}px`;

      // Handle resize observation
      stopResizeObserver();
      if (hasChild && !isContentPhase) {
        startResizeObserver();
        debug("size", "Observing child resize");
      }

      // Determine transition scenarios (hadChild/hasChild already computed above for logging)

      /**
       * Content Phase Logic: Why empty slots are treated as content phases
       *
       * When there is no child element (React component returns null), it is considered
       * that the component does not render anything temporarily. This might be because:
       * - The component is loading but does not have a loading state
       * - The component has an error but does not have an error state
       * - The component is conceptually unloaded (underlying content was deleted/is not accessible)
       *
       * This represents a phase of the given content: having nothing to display.
       *
       * We support transitions between different contents via the ability to set
       * [data-content-key] on the ".ui_transition_slot". This is also useful when you want
       * all children of a React component to inherit the same data-content-key without
       * explicitly setting the attribute on each child element.
       */

      // Content key change when either slot or child has data-content-key and it changed
      let shouldDoContentTransition = false;
      if (currentContentKey && lastContentKey !== null) {
        shouldDoContentTransition = currentContentKey !== lastContentKey;
      }

      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;
      const isInitialPopulationWithoutTransition =
        becomesPopulated && !hasPopulatedOnce && !initialTransitionEnabled;

      // Content phase change: any transition between content/content-phase/null except when slot key changes
      // This includes: null→loading, loading→content, content→loading, loading→null, etc.
      const shouldDoPhaseTransition =
        !shouldDoContentTransition &&
        (becomesPopulated ||
          becomesEmpty ||
          (hadChild &&
            hasChild &&
            (previousIsContentPhase !== currentIsContentPhase ||
              (previousIsContentPhase && currentIsContentPhase))));

      const contentChange = hadChild && hasChild && shouldDoContentTransition;
      const phaseChange = hadChild && hasChild && shouldDoPhaseTransition;

      // Determine if we only need to preserve an existing content transition (no new change)
      const preserveOnlyContentTransition =
        activeContentTransition !== null &&
        !shouldDoContentTransition &&
        !shouldDoPhaseTransition &&
        !becomesPopulated &&
        !becomesEmpty;

      // Include becomesPopulated in content transition only if it's not a phase transition
      const shouldDoContentTransitionIncludingPopulation =
        shouldDoContentTransition ||
        (becomesPopulated && !shouldDoPhaseTransition);

      const decisions = [];
      if (shouldDoContentTransition) decisions.push("CONTENT TRANSITION");
      if (shouldDoPhaseTransition) decisions.push("PHASE TRANSITION");
      if (preserveOnlyContentTransition)
        decisions.push("PRESERVE CONTENT TRANSITION");
      if (decisions.length === 0) decisions.push("NO TRANSITION");

      debug("transition", `Decision: ${decisions.join(" + ")}`);
      if (preserveOnlyContentTransition) {
        const progress = (activeContentTransition.progress * 100).toFixed(1);
        debug(
          "transition",
          `Preserving existing content transition (progress ${progress}%)`,
        );
      }

      // Early return optimization: if no transition decision and we are not continuing
      // an existing active content transition (animationProgress > 0), we can skip
      // all transition setup logic below.
      if (
        decisions.length === 1 &&
        decisions[0] === "NO TRANSITION" &&
        activeContentTransition === null &&
        activePhaseTransition === null
      ) {
        debug(
          "transition",
          `Early return: no transition or continuation required`,
        );
        // Still ensure size logic executes below (so do not return before size alignment)
      }

      // Handle initial population skip (first null → something): no content or size animations
      if (isInitialPopulationWithoutTransition) {
        debug(
          "transition",
          "Initial population detected: skipping transitions (opt-in with data-initial-transition)",
        );

        // Apply sizes instantly, no animation
        if (isContentPhase) {
          applySizeConstraints(newWidth, newHeight);
        } else {
          updateNaturalContentSize(newWidth, newHeight);
          releaseConstraints("initial population - skip transitions");
        }

        // Register state and mark initial population done
        previousChildNodes = childNodes;
        lastContentKey = currentContentKey;
        hasPopulatedOnce = true;
        if (localDebug.transition) {
          console.groupEnd();
        }
        return;
      }

      // Plan size transition upfront; execution will happen after content/phase transitions
      let sizePlan = {
        action: "none",
        targetWidth: constrainedWidth,
        targetHeight: constrainedHeight,
      };

      size_transition: {
        const getTargetDimensions = () => {
          if (!isContentPhase) {
            return [newWidth, newHeight];
          }
          const shouldUseNewDimensions =
            naturalContentWidth === 0 && naturalContentHeight === 0;
          const targetWidth = shouldUseNewDimensions
            ? newWidth
            : naturalContentWidth || newWidth;
          const targetHeight = shouldUseNewDimensions
            ? newHeight
            : naturalContentHeight || newHeight;
          return [targetWidth, targetHeight];
        };

        const [targetWidth, targetHeight] = getTargetDimensions();
        sizePlan.targetWidth = targetWidth;
        sizePlan.targetHeight = targetHeight;

        if (
          targetWidth === constrainedWidth &&
          targetHeight === constrainedHeight
        ) {
          debug("size", "No size change required");
          // We'll handle potential constraint release in final section (if not holding)
          break size_transition;
        }

        debug("size", "Size change needed:", {
          width: `${constrainedWidth} → ${targetWidth}`,
          height: `${constrainedHeight} → ${targetHeight}`,
        });

        if (isContentPhase) {
          // Content phases (loading/error) always use size constraints for consistent sizing
          sizePlan.action = hasSizeTransitions ? "animate" : "applyConstraints";
        } else {
          // Actual content: update natural content dimensions for future content phases
          updateNaturalContentSize(targetWidth, targetHeight);
          sizePlan.action = hasSizeTransitions ? "animate" : "release";
        }
      }

      content_transition: {
        // Handle content transitions (slide-left, cross-fade for content key changes)
        if (
          decisions.length === 1 &&
          decisions[0] === "NO TRANSITION" &&
          activeContentTransition === null &&
          activePhaseTransition === null
        ) {
          // Skip creating any new transitions entirely
        } else if (
          shouldDoContentTransitionIncludingPopulation &&
          !preserveOnlyContentTransition
        ) {
          const animationProgress = activeContentTransition?.progress || 0;
          if (animationProgress > 0) {
            debug(
              "transition",
              `Preserving content transition progress: ${(animationProgress * 100).toFixed(1)}%`,
            );
          }

          const newTransitionType =
            container.getAttribute("data-content-transition") ||
            CONTENT_TRANSITION;
          const canContinueSmoothly =
            activeContentTransitionType === newTransitionType &&
            activeContentTransition;
          if (canContinueSmoothly) {
            debug(
              "transition",
              "Continuing with same content transition type (restarting due to actual change)",
            );
            activeContentTransition.cancel();
          } else if (
            activeContentTransition &&
            activeContentTransitionType !== newTransitionType
          ) {
            debug(
              "transition",
              "Different content transition type, keeping both",
              `${activeContentTransitionType} → ${newTransitionType}`,
            );
          } else if (activeContentTransition) {
            debug("transition", "Cancelling current content transition");
            activeContentTransition.cancel();
          }

          const needsOldChildNodesClone =
            (contentChange || becomesEmpty) && hadChild;
          const duration = parseInt(
            container.getAttribute("data-content-transition-duration") ||
              CONTENT_TRANSITION_DURATION,
          );
          const type =
            container.getAttribute("data-content-transition") ||
            CONTENT_TRANSITION;

          const setupContentTransition = () =>
            setupTransition({
              isPhaseTransition: false,
              overlay: contentOverlay,
              needsOldChildNodesClone,
              previousChildNodes,
              childNodes,
              attributeToRemove: ["data-content-key"],
            });

          // If size transitions are disabled and the new content is smaller,
          // hold the previous size to avoid cropping during the transition.
          if (!hasSizeTransitions) {
            const willShrinkWidth = constrainedWidth > newWidth;
            const willShrinkHeight = constrainedHeight > newHeight;
            sizeHoldActive = willShrinkWidth || willShrinkHeight;
            if (sizeHoldActive) {
              debug(
                "size",
                `Holding previous size during content transition: ${constrainedWidth}x${constrainedHeight}`,
              );
              applySizeConstraints(constrainedWidth, constrainedHeight);
            }
          }

          activeContentTransition = applyTransition(
            transitionController,
            setupContentTransition,
            {
              duration,
              type,
              animationProgress,
              isPhaseTransition: false,
              fromContentKeyState: previousContentKeyState,
              toContentKeyState: currentContentKeyState,
              onComplete: () => {
                activeContentTransition = null;
                activeContentTransitionType = null;
                if (sizeHoldActive) {
                  // Release the hold after the content transition completes
                  releaseConstraints(
                    "content transition completed - release size hold",
                  );
                  sizeHoldActive = false;
                }
              },
              debug,
            },
          );

          if (activeContentTransition) {
            activeContentTransition.play();
          }
          activeContentTransitionType = type;
        } else if (
          !shouldDoContentTransition &&
          !preserveOnlyContentTransition
        ) {
          // Clean up content overlay if no content transition needed and nothing to preserve
          contentOverlay.innerHTML = "";
          activeContentTransition = null;
          activeContentTransitionType = null;
        }

        // Handle phase transitions (cross-fade for content phase changes)
        if (shouldDoPhaseTransition) {
          const phaseTransitionType =
            container.getAttribute("data-phase-transition") || PHASE_TRANSITION;
          const phaseAnimationProgress = activePhaseTransition?.progress || 0;
          if (phaseAnimationProgress > 0) {
            debug(
              "transition",
              `Preserving phase transition progress: ${(phaseAnimationProgress * 100).toFixed(1)}%`,
            );
          }

          const canContinueSmoothly =
            activePhaseTransitionType === phaseTransitionType &&
            activePhaseTransition;

          if (canContinueSmoothly) {
            debug("transition", "Continuing with same phase transition type");
            activePhaseTransition.cancel();
          } else if (
            activePhaseTransition &&
            activePhaseTransitionType !== phaseTransitionType
          ) {
            debug(
              "transition",
              "Different phase transition type, keeping both",
              `${activePhaseTransitionType} → ${phaseTransitionType}`,
            );
          } else if (activePhaseTransition) {
            debug("transition", "Cancelling current phase transition");
            activePhaseTransition.cancel();
          }

          const needsOldPhaseClone =
            (becomesEmpty || becomesPopulated || phaseChange) && hadChild;
          const phaseDuration = parseInt(
            container.getAttribute("data-phase-transition-duration") ||
              PHASE_TRANSITION_DURATION,
          );

          const setupPhaseTransition = () =>
            setupTransition({
              isPhaseTransition: true,
              overlay: phaseOverlay,
              needsOldChildNodesClone: needsOldPhaseClone,
              previousChildNodes,
              childNodes,
              attributeToRemove: ["data-content-key", "data-content-phase"],
            });

          const fromPhase = !hadChild
            ? "null"
            : wasContentPhase
              ? "content-phase"
              : "content";
          const toPhase = !hasChild
            ? "null"
            : isContentPhase
              ? "content-phase"
              : "content";

          debug(
            "transition",
            `Starting phase transition: ${fromPhase} → ${toPhase}`,
          );

          activePhaseTransition = applyTransition(
            transitionController,
            setupPhaseTransition,
            {
              duration: phaseDuration,
              type: phaseTransitionType,
              animationProgress: phaseAnimationProgress,
              isPhaseTransition: true,
              fromContentKeyState: previousContentKeyState,
              toContentKeyState: currentContentKeyState,
              onComplete: () => {
                activePhaseTransition = null;
                activePhaseTransitionType = null;
                debug("transition", "Phase transition complete");
              },
              debug,
            },
          );

          if (activePhaseTransition) {
            activePhaseTransition.play();
          }
          activePhaseTransitionType = phaseTransitionType;
        }
      }

      // Store current child for next transition
      previousChildNodes = childNodes;
      lastContentKey = currentContentKey;
      if (becomesPopulated) {
        hasPopulatedOnce = true;
      }

      // Execute planned size action, unless holding size during a content transition
      if (!sizeHoldActive) {
        if (
          sizePlan.targetWidth === constrainedWidth &&
          sizePlan.targetHeight === constrainedHeight
        ) {
          // no size changes planned; possibly release constraints
          if (!isContentPhase) {
            releaseConstraints("no size change needed");
          }
        } else if (sizePlan.action === "animate") {
          updateToSize(sizePlan.targetWidth, sizePlan.targetHeight);
        } else if (sizePlan.action === "applyConstraints") {
          applySizeConstraints(sizePlan.targetWidth, sizePlan.targetHeight);
        } else if (sizePlan.action === "release") {
          releaseConstraints("actual content - no size transitions needed");
        }
      }
    } finally {
      isUpdating = false;
      if (localDebug.transition) {
        console.groupEnd();
      }
    }
  };

  // Run once at init to process current slot content (warnings, sizing, transitions)
  handleChildSlotMutation("init");

  // Watch for child changes and attribute changes on children
  const mutationObserver = new MutationObserver((mutations) => {
    let childListMutation = false;
    const attributeMutationSet = new Set();

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        childListMutation = true;
        continue;
      }
      if (mutation.type === "attributes") {
        const { attributeName, target } = mutation;
        if (
          attributeName === "data-content-key" ||
          attributeName === "data-content-phase"
        ) {
          attributeMutationSet.add(attributeName);
          debug(
            "transition",
            `Attribute change detected: ${attributeName} on`,
            getElementSignature(target),
          );
        }
      }
    }

    if (!childListMutation && attributeMutationSet.size === 0) {
      return;
    }
    const reasonParts = [];
    if (childListMutation) {
      reasonParts.push("childList change");
    }
    if (attributeMutationSet.size) {
      for (const attr of attributeMutationSet) {
        reasonParts.push(`[${attr}] change`);
      }
    }
    const reason = reasonParts.join("+");
    handleChildSlotMutation(reason);
  });

  mutationObserver.observe(slot, {
    childList: true,
    attributes: true,
    attributeFilter: ["data-content-key", "data-content-phase"],
    characterData: false,
  });

  return {
    slot,

    cleanup: () => {
      mutationObserver.disconnect();
      stopResizeObserver();
      if (sizeTransition) {
        sizeTransition.cancel();
      }
      if (activeContentTransition) {
        activeContentTransition.cancel();
      }
      if (activePhaseTransition) {
        activePhaseTransition.cancel();
      }
    },
    pause: () => {
      if (activeContentTransition?.pause) {
        activeContentTransition.pause();
        isPaused = true;
      }
      if (activePhaseTransition?.pause) {
        activePhaseTransition.pause();
        isPaused = true;
      }
    },
    resume: () => {
      if (activeContentTransition?.play && isPaused) {
        activeContentTransition.play();
        isPaused = false;
      }
      if (activePhaseTransition?.play && isPaused) {
        activePhaseTransition.play();
        isPaused = false;
      }
    },
    getState: () => ({
      isPaused,
      contentTransitionInProgress: activeContentTransition !== null,
      phaseTransitionInProgress: activePhaseTransition !== null,
    }),
  };
};

const applyTransition = (
  transitionController,
  setupTransition,
  {
    type,
    duration,
    animationProgress = 0,
    isPhaseTransition,
    onComplete,
    fromContentKeyState,
    toContentKeyState,
    debug,
  },
) => {
  let transitionType;
  if (type === "cross-fade") {
    transitionType = crossFade;
  } else if (type === "slide-left") {
    transitionType = slideLeft;
  } else {
    return null;
  }

  const { cleanup, oldElement, newElement, onTeardown } = setupTransition();
  // Use precomputed content key states (expected to be provided by caller)
  const fromContentKey = fromContentKeyState;
  const toContentKey = toContentKeyState;

  debug("transition", "Setting up animation:", {
    type,
    from: fromContentKey,
    to: toContentKey,
    progress: `${(animationProgress * 100).toFixed(1)}%`,
  });

  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("transition", `Animation duration: ${remainingDuration}ms`);

  const transitions = transitionType.apply(oldElement, newElement, {
    duration: remainingDuration,
    startProgress: animationProgress,
    isPhaseTransition,
    debug,
  });

  debug(
    "transition",
    `Created ${transitions.length} transition(s) for animation`,
  );

  if (transitions.length === 0) {
    debug("transition", "No transitions to animate, cleaning up immediately");
    cleanup();
    onTeardown?.();
    onComplete?.();
    return null;
  }

  const groupTransition = transitionController.animate(transitions, {
    onFinish: () => {
      groupTransition.cancel();
      cleanup();
      onTeardown?.();
      onComplete?.();
    },
  });

  return groupTransition;
};

const slideLeft = {
  name: "slide-left",
  apply: (
    oldElement,
    newElement,
    { duration, startProgress = 0, isPhaseTransition = false, debug },
  ) => {
    if (!oldElement && !newElement) {
      return [];
    }

    if (!newElement) {
      // Content -> Empty (slide out left only)
      const currentPosition = getTranslateX(oldElement);
      const containerWidth = getInnerWidth(oldElement.parentElement);
      const from = currentPosition;
      const to = -containerWidth;
      debug("transition", "Slide out to empty:", { from, to });

      return [
        createTranslateXTransition(oldElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide out progress:", value);
            if (timing === "end") {
              debug("transition", "Slide out complete");
            }
          },
        }),
      ];
    }

    if (!oldElement) {
      // Empty -> Content (slide in from right)
      const containerWidth = getInnerWidth(newElement.parentElement);
      const from = containerWidth; // Start from right edge for slide-in effect
      const to = getTranslateXWithoutTransition(newElement);
      debug("transition", "Slide in from empty:", { from, to });
      return [
        createTranslateXTransition(newElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide in progress:", value);
            if (timing === "end") {
              debug("transition", "Slide in complete");
            }
          },
        }),
      ];
    }

    // Content -> Content (slide left)
    // The old content (oldElement) slides OUT to the left
    // The new content (newElement) slides IN from the right

    // Get positions for the slide animation
    const containerWidth = getInnerWidth(newElement.parentElement);
    const oldContentPosition = getTranslateX(oldElement);
    const currentNewPosition = getTranslateX(newElement);
    const naturalNewPosition = getTranslateXWithoutTransition(newElement);

    // For smooth continuation: if newElement is mid-transition,
    // calculate new position to maintain seamless sliding
    let startNewPosition;
    if (currentNewPosition !== 0 && naturalNewPosition === 0) {
      startNewPosition = currentNewPosition + containerWidth;
      debug(
        "transition",
        "Calculated seamless position:",
        `${currentNewPosition} + ${containerWidth} = ${startNewPosition}`,
      );
    } else {
      startNewPosition = naturalNewPosition || containerWidth;
    }

    // For phase transitions, force new content to start from right edge for proper slide-in
    const effectiveFromPosition = isPhaseTransition
      ? containerWidth
      : startNewPosition;

    debug("transition", "Slide transition:", {
      oldContent: `${oldContentPosition} → ${-containerWidth}`,
      newContent: `${effectiveFromPosition} → ${naturalNewPosition}`,
    });

    const transitions = [];

    // Slide old content out
    transitions.push(
      createTranslateXTransition(oldElement, -containerWidth, {
        from: oldContentPosition,
        duration,
        startProgress,
        onUpdate: ({ value }) => {
          debug("transition_updates", "Old content slide out:", value);
        },
      }),
    );

    // Slide new content in
    transitions.push(
      createTranslateXTransition(newElement, naturalNewPosition, {
        from: effectiveFromPosition,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content slide in:", value);
          if (timing === "end") {
            debug("transition", "Slide complete");
          }
        },
      }),
    );

    return transitions;
  },
};

const crossFade = {
  name: "cross-fade",
  apply: (
    oldElement,
    newElement,
    { duration, startProgress = 0, isPhaseTransition = false, debug },
  ) => {
    if (!oldElement && !newElement) {
      return [];
    }

    if (!newElement) {
      // Content -> Empty (fade out only)
      const from = getOpacity(oldElement);
      const to = 0;
      debug("transition", "Fade out to empty:", { from, to });
      return [
        createOpacityTransition(oldElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Content fade out:", value.toFixed(3));
            if (timing === "end") {
              debug("transition", "Fade out complete");
            }
          },
        }),
      ];
    }

    if (!oldElement) {
      // Empty -> Content (fade in only)
      const from = 0;
      const to = getOpacityWithoutTransition(newElement);
      debug("transition", "Fade in from empty:", { from, to });
      return [
        createOpacityTransition(newElement, to, {
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Fade in progress:", value.toFixed(3));
            if (timing === "end") {
              debug("transition", "Fade in complete");
            }
          },
        }),
      ];
    }

    // Content -> Content (cross-fade)
    // Get current opacity for both elements
    const oldOpacity = getOpacity(oldElement);
    const newOpacity = getOpacity(newElement);
    const newNaturalOpacity = getOpacityWithoutTransition(newElement);

    // For phase transitions, always start new content from 0 for clean visual transition
    // For content transitions, check for ongoing transitions to continue smoothly
    let effectiveFromOpacity;
    if (isPhaseTransition) {
      effectiveFromOpacity = 0; // Always start fresh for phase transitions (loading → content, etc.)
    } else {
      // For content transitions: if new element has ongoing opacity transition
      // (indicated by non-zero opacity when natural opacity is different),
      // start from current opacity to continue smoothly, otherwise start from 0
      const hasOngoingTransition =
        newOpacity !== newNaturalOpacity && newOpacity > 0;
      effectiveFromOpacity = hasOngoingTransition ? newOpacity : 0;
    }

    debug("transition", "Cross-fade transition:", {
      oldOpacity: `${oldOpacity} → 0`,
      newOpacity: `${effectiveFromOpacity} → ${newNaturalOpacity}`,
      isPhaseTransition,
    });

    return [
      createOpacityTransition(oldElement, 0, {
        from: oldOpacity,
        duration,
        startProgress,
        onUpdate: ({ value }) => {
          if (value > 0) {
            debug(
              "transition_updates",
              "Old content fade out:",
              value.toFixed(3),
            );
          }
        },
      }),
      createOpacityTransition(newElement, newNaturalOpacity, {
        from: effectiveFromOpacity,
        duration,
        startProgress: isPhaseTransition ? 0 : startProgress, // Phase transitions: new content always starts fresh
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content fade in:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Cross-fade complete");
          }
        },
      }),
    ];
  },
};
