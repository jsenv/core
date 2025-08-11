/**
 * Required HTML structure for UI transitions with smooth size and phase/content animations:
 *
 * <div class="ui_transition_container"
 *      data-size-transition              <!-- Optional: enable size animations -->
 *      data-size-transition-duration     <!-- Optional: size transition duration, default 300ms -->
 *      data-content-transition           <!-- Content transition type: cross-fade, slide-left -->
 *      data-content-transition-duration  <!-- Content transition duration -->
 *      data-phase-transition             <!-- Phase transition type: cross-fade, slide-left -->
 *      data-phase-transition-duration    <!-- Phase transition duration -->
 * >
 *   <!-- Main container with relative positioning and overflow hidden -->
 *
 *   <div class="ui_transition_outer_wrapper">
 *     <!-- Size animation target: width/height constraints are applied here during transitions -->
 *
 *     <div class="ui_transition_measure_wrapper">
 *       <!-- Content measurement layer: ResizeObserver watches this to detect natural content size changes -->
 *
 *       <div class="ui_transition_slot">
 *         <!-- Content slot: actual content is inserted here via children -->
 *       </div>
 *
 *       <div class="ui_transition_phase_overlay">
 *         <!-- Phase transition overlay: clone old content phase is positioned here for content phase transitions (loading/error) -->
 *       </div>
 *     </div>
 *   </div>
 *
 *   <div class="ui_transition_content_overlay">
 *     <!-- Content transition overlay: cloned old content is positioned here for slide/fade animations -->
 *   </div>
 * </div>
 *
 * This separation allows:
 * - Optional smooth size transitions by constraining outer-wrapper dimensions (when data-size-transition is present)
 * - Instant size updates by default
 * - Accurate content measurement via measure-wrapper ResizeObserver
 * - Visual transitions using overlay-positioned clones for both content and phase transitions
 * - Independent content updates in the slot without affecting ongoing animations
 */

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
  .ui_transition_container {
    position: relative;
    overflow: hidden;
  }

  .ui_transition_measure_wrapper {
    overflow: hidden;
  }

  .ui_transition_slot {
    position: relative;
  }

  .ui_transition_phase_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .ui_transition_content_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
`;

const DEBUG = {
  size: true,
  transition: true,
  transition_updates: false,
};

const debug = (type, ...args) => {
  if (DEBUG[type]) {
    console.debug(`[${type}]`, ...args);
  }
};

const SIZE_TRANSITION_DURATION = 150; // Default size transition duration
const CONTENT_TRANSITION = "cross-fade"; // Default content transition type
const CONTENT_TRANSITION_DURATION = 300; // Default content transition duration
const PHASE_TRANSITION = "cross-fade";
const PHASE_TRANSITION_DURATION = 300; // Default phase transition duration

export const initUITransition = (container) => {
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

  if (!phaseOverlay) {
    phaseOverlay = document.createElement("div");
    phaseOverlay.className = "ui_transition_phase_overlay";
    measureWrapper.appendChild(phaseOverlay);
  }
  if (!contentOverlay) {
    contentOverlay = document.createElement("div");
    contentOverlay.className = "ui_transition_content_overlay";
    container.appendChild(contentOverlay);
  }

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

  // Child state
  let lastContentKey = null;
  let previousChild = null;
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
  };

  const updateToSize = (targetWidth, targetHeight) => {
    const shouldAnimate = container.hasAttribute("data-size-transition");

    if (!shouldAnimate) {
      // No size transitions - just update dimensions instantly
      debug("size", "Updating size instantly:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
      });

      outerWrapper.style.width = `${targetWidth}px`;
      outerWrapper.style.height = `${targetHeight}px`;
      constrainedWidth = targetWidth;
      constrainedHeight = targetHeight;
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

    if (targetHeight !== constrainedHeight) {
      transitions.push(
        createHeightTransition(outerWrapper, targetHeight, {
          duration,
          onUpdate: ({ value }) => {
            constrainedHeight = value;
          },
        }),
      );
    }

    if (targetWidth !== constrainedWidth) {
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
      sizeTransition = transitionController.animate(transitions, {
        onFinish: () =>
          releaseConstraints("animated size transition completed"),
      });
      sizeTransition.play();
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
    existingOldContents,
    needsOldChildClone,
    previousChild,
    attributeToRemove = [],
    oldElementAttribute,
    transitionType = "cross-fade",
  }) => {
    let oldChild = null;
    let cleanup = () => {};
    const currentTransitionElement = existingOldContents[0];

    if (currentTransitionElement) {
      oldChild = currentTransitionElement;
      debug(
        "transition",
        `Continuing from current ${isPhaseTransition ? "phase" : "content"} transition element`,
      );
      cleanup = () => oldChild.remove();
    } else if (needsOldChildClone) {
      overlay.innerHTML = "";

      // Always clone individual elements - the slide transition will be applied to measureWrapper
      oldChild = previousChild.cloneNode(true);

      // Remove specified attributes
      attributeToRemove.forEach((attr) => oldChild.removeAttribute(attr));

      oldChild.setAttribute(oldElementAttribute, "");
      overlay.appendChild(oldChild);
      debug(
        "transition",
        `Cloned previous child for ${isPhaseTransition ? "phase" : "content"} transition:`,
        previousChild.getAttribute("data-ui-name") || "unnamed",
      );
      cleanup = () => oldChild.remove();
    } else {
      overlay.innerHTML = "";
      debug(
        "transition",
        `No old child to clone for ${isPhaseTransition ? "phase" : "content"} transition`,
      );
    }

    // Get the transition object to check its impactsBothPhases property
    const transitionObj =
      transitionType === "slide-left" ? slideLeft : crossFade;

    // Determine which elements to return based on the transition's impactsBothPhases property
    let oldElement;
    let newElement;
    if (transitionObj.impactsBothPhases) {
      // For transitions that impact both phases, use the overlay containers
      oldElement = overlay; // Container with old content slides out
      newElement = measureWrapper; // Container with new content slides in
    } else {
      // For transitions that work on individual elements, use the actual elements
      oldElement = oldChild;
      newElement = measureWrapper.children[0]; // The actual new content
    }

    return {
      oldChild,
      cleanup,
      oldElement,
      newElement,
    };
  };

  // Initialize with current size
  [constrainedWidth, constrainedHeight] = measureContentSize();

  // Handle initial child if present
  const initialChild = slot.children[0];
  if (initialChild) {
    debug("size", "Found initial child");
    lastContentKey = initialChild.getAttribute("data-content-key");
    isContentPhase = initialChild.hasAttribute("data-content-phase");

    // Only set natural content dimensions if this is actual content, not a content phase
    if (!isContentPhase) {
      naturalContentWidth = constrainedWidth;
      naturalContentHeight = constrainedHeight;
      debug(
        "size",
        `Initial content size: ${naturalContentWidth}x${naturalContentHeight}`,
      );
      startResizeObserver();
      debug("size", "Observing resize");
    } else {
      debug(
        "size",
        "Initial child is content phase, not setting natural dimensions",
      );
    }

    previousChild = initialChild.cloneNode(true);
  }

  const handleChildSlotMutation = () => {
    if (isUpdating) {
      debug("transition", "Preventing recursive update");
      return;
    }

    try {
      isUpdating = true;
      const firstChild = slot.children[0];
      const childUIName = firstChild?.getAttribute("data-ui-name");

      // Prefer data-content-key on child, fallback to slot
      let currentContentKey = null;
      let slotContentKey = slot.getAttribute("data-content-key");
      let childContentKey = firstChild?.getAttribute("data-content-key");
      if (childContentKey && slotContentKey) {
        console.warn(
          "Both data-content-key found on child and ui_transition_slot. Using child value.",
          { childContentKey, slotContentKey },
        );
      }
      currentContentKey = childContentKey || slotContentKey || null;

      wasContentPhase = isContentPhase;
      isContentPhase = firstChild
        ? firstChild.hasAttribute("data-content-phase")
        : true; // empty (no child) is treated as content phase

      if (DEBUG.transition) {
        console.group(
          `UI Update: ${childUIName || (firstChild ? "data-ui-name not specified" : "cleared/empty")}`,
        );
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

      debug("transition", "Content keys:", {
        previous: lastContentKey || "null",
        current: currentContentKey || "null",
        phase: `${wasContentPhase ? "content-phase" : "content"} → ${firstChild ? (isContentPhase ? "content-phase" : "content") : "null"}`,
      });

      // Handle resize observation
      stopResizeObserver();
      if (firstChild && !isContentPhase) {
        startResizeObserver();
        debug("size", "Observing child resize");
      }

      // Determine transition scenarios
      const hadChild = previousChild !== null;
      const hasChild = firstChild !== null;

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
      const previousIsContentPhase = !hadChild || wasContentPhase;
      const currentIsContentPhase = !hasChild || isContentPhase;

      // Content key change when either slot or child has data-content-key and it changed
      let shouldDoContentTransition = false;
      if (
        (slot.getAttribute("data-content-key") ||
          firstChild?.getAttribute("data-content-key")) &&
        lastContentKey !== null
      ) {
        shouldDoContentTransition = currentContentKey !== lastContentKey;
      }

      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;

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

      // Include becomesPopulated in content transition only if it's not a phase transition
      const shouldDoContentTransitionIncludingPopulation =
        shouldDoContentTransition ||
        (becomesPopulated && !shouldDoPhaseTransition) ||
        activeContentTransition !== null; // Continue managing active content transitions

      const decisions = [];
      if (shouldDoContentTransition) decisions.push("CONTENT TRANSITION");
      if (shouldDoPhaseTransition) decisions.push("PHASE TRANSITION");
      if (decisions.length === 0) decisions.push("NO TRANSITION");

      debug("transition", `Decision: ${decisions.join(" + ")}`);

      // Handle content transitions (slide-left, cross-fade for content key changes)
      if (shouldDoContentTransitionIncludingPopulation) {
        const existingOldContents = contentOverlay.querySelectorAll(
          "[data-ui-transition-old]",
        );
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
          debug("transition", "Continuing with same content transition type");
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

        const needsOldChildClone =
          (contentChange || becomesEmpty) &&
          previousChild &&
          !existingOldContents[0];

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
            existingOldContents,
            needsOldChildClone,
            previousChild,
            attributeToRemove: ["data-content-key"],
            oldElementAttribute: "data-ui-transition-old",
            transitionType: type,
          });

        activeContentTransition = animateTransition(
          transitionController,
          firstChild,
          setupContentTransition,
          {
            duration,
            type,
            animationProgress,
            isPhaseTransition: false,
            previousChild,
            onComplete: () => {
              activeContentTransition = null;
              activeContentTransitionType = null;
            },
          },
        );

        if (activeContentTransition) {
          activeContentTransition.play();
        }
        activeContentTransitionType = type;
      } else if (!shouldDoContentTransition) {
        // Clean up content overlay if no content transition needed
        contentOverlay.innerHTML = "";
        activeContentTransition = null;
        activeContentTransitionType = null;
      }

      // Handle phase transitions (cross-fade for content phase changes)
      if (shouldDoPhaseTransition) {
        const phaseTransitionType =
          container.getAttribute("data-phase-transition") || PHASE_TRANSITION;

        const existingOldPhaseContents = phaseOverlay.querySelectorAll(
          "[data-ui-transition-old]",
        );
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
          (becomesEmpty || becomesPopulated || phaseChange) &&
          previousChild &&
          !existingOldPhaseContents[0];

        const phaseDuration = parseInt(
          container.getAttribute("data-phase-transition-duration") ||
            PHASE_TRANSITION_DURATION,
        );

        const setupPhaseTransition = () =>
          setupTransition({
            isPhaseTransition: true,
            overlay: phaseOverlay,
            existingOldContents: existingOldPhaseContents,
            needsOldChildClone: needsOldPhaseClone,
            previousChild,
            attributeToRemove: ["data-content-key", "data-content-phase"],
            oldElementAttribute: "data-ui-transition-old",
            transitionType: phaseTransitionType,
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

        activePhaseTransition = animateTransition(
          transitionController,
          firstChild,
          setupPhaseTransition,
          {
            duration: phaseDuration,
            type: phaseTransitionType,
            animationProgress: phaseAnimationProgress,
            isPhaseTransition: true,
            previousChild,
            onComplete: () => {
              activePhaseTransition = null;
              activePhaseTransitionType = null;
              debug("transition", "Phase transition complete");
            },
          },
        );

        if (activePhaseTransition) {
          activePhaseTransition.play();
        }
        activePhaseTransitionType = phaseTransitionType;
      }

      // Store current child for next transition
      previousChild = firstChild ? firstChild.cloneNode(true) : null;
      lastContentKey = currentContentKey;

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

      // Skip animation if no size changes needed
      if (
        targetWidth === constrainedWidth &&
        targetHeight === constrainedHeight
      ) {
        debug("size", "No size change required");
        if (!isContentPhase) {
          releaseConstraints("no size change needed");
        }
        if (DEBUG.transition) {
          console.groupEnd();
        }
        return;
      }

      debug("size", "Size change needed:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
      });

      // Handle size updates based on content state
      const hasSizeTransitions = container.hasAttribute("data-size-transition");

      if (isContentPhase) {
        // Content phases (loading/error) always use size constraints for consistent sizing
        if (hasSizeTransitions) {
          // Animate to target size with constraints
          updateToSize(targetWidth, targetHeight);
        } else {
          // Apply constraints instantly (no animation)
          applySizeConstraints(targetWidth, targetHeight);
        }
      } else {
        // Actual content: update natural content dimensions for future content phases
        updateNaturalContentSize(targetWidth, targetHeight);

        if (hasSizeTransitions) {
          // With size transitions: animate to target size, constraints released after animation
          updateToSize(targetWidth, targetHeight);
        } else {
          // Without size transitions: release constraints immediately for natural sizing
          releaseConstraints("actual content - no size transitions needed");
        }
      }
    } finally {
      isUpdating = false;
      if (DEBUG.transition) {
        console.groupEnd();
      }
    }
  };

  // Watch for child changes and attribute changes on children
  const mutationObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        shouldUpdate = true;
        break;
      }
      if (mutation.type === "attributes") {
        const { attributeName, target } = mutation;
        // Check if data-content-key or data-content-phase changed
        if (
          attributeName === "data-content-key" ||
          attributeName === "data-content-phase"
        ) {
          debug(
            "transition",
            `Attribute change detected: ${attributeName} on`,
            target.getAttribute("data-ui-name") || "element",
          );
          shouldUpdate = true;
          break;
        }
      }
    }

    if (shouldUpdate) {
      handleChildSlotMutation();
    }
  });

  mutationObserver.observe(slot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-content-key", "data-content-phase"],
    characterData: false,
  });

  // Return API
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

const animateTransition = (
  transitionController,
  newChild,
  setupTransition,
  {
    type,
    duration,
    animationProgress = 0,
    previousChild = null,
    isPhaseTransition,
    onComplete,
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

  const { cleanup, oldElement, newElement } = setupTransition();

  // Get content keys before attributes are removed
  const fromContentKey =
    previousChild?.getAttribute("data-content-key") || "empty";
  const toContentKey = newChild?.getAttribute("data-content-key") || "empty";

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
  });

  debug(
    "transition",
    `Created ${transitions.length} transition(s) for animation`,
  );

  if (transitions.length === 0) {
    debug("transition", "No transitions to animate, cleaning up immediately");
    cleanup();
    onComplete?.();
    return null;
  }

  const groupTransition = transitionController.animate(transitions, {
    onFinish: () => {
      groupTransition.cancel();
      cleanup();
      onComplete?.();
    },
  });

  return groupTransition;
};

const slideLeft = {
  name: "slide-left",
  impactsBothPhases: true, // This transition affects both content and content-phase, so must be applied to their container
  apply: (
    oldElement,
    newElement,
    { duration, startProgress = 0, isPhaseTransition = false },
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
  impactsBothPhases: false, // This transition affects individual elements directly
  apply: (
    oldChild,
    newChild,
    { duration, startProgress = 0, isPhaseTransition = false },
  ) => {
    if (!oldChild && !newChild) {
      return [];
    }

    if (!newChild) {
      // Content -> Empty (fade out only)
      const from = getOpacity(oldChild);
      const to = 0;
      debug("transition", "Fade out to empty:", { from, to });
      return [
        createOpacityTransition(oldChild, to, {
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

    if (!oldChild) {
      // Empty -> Content (fade in only)
      const from = 0;
      const to = getOpacityWithoutTransition(newChild);
      debug("transition", "Fade in from empty:", { from, to });
      return [
        createOpacityTransition(newChild, to, {
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
    const oldOpacity = getOpacity(oldChild);
    const newOpacity = getOpacity(newChild);
    const newNaturalOpacity = getOpacityWithoutTransition(newChild);

    // Smart opacity starting point:
    // - For phase transitions: always start from 0 (new content appears)
    // - For content transitions: check for ongoing transitions
    let effectiveFromOpacity;
    if (isPhaseTransition) {
      effectiveFromOpacity = 0;
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
    });

    return [
      createOpacityTransition(oldChild, 0, {
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
      createOpacityTransition(newChild, newNaturalOpacity, {
        from: effectiveFromOpacity,
        duration,
        startProgress,
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
