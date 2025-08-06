/**
 * Required HTML structure for UI transitions with smooth size animations:
 *
 * <div class="ui_transition_container">
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
 *     </div>
 *   </div>
 *
 *   <div class="ui-transition-overlay">
 *     <!-- Transition overlay: cloned old content is positioned here for slide/fade animations -->
 *   </div>
 * </div>
 *
 * This separation allows:
 * - Smooth size transitions by constraining outer-wrapper dimensions
 * - Accurate content measurement via measure-wrapper ResizeObserver
 * - Visual transitions using overlay-positioned clones
 * - Independent content updates in the slot without affecting ongoing animations
 */

import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import {
  createHeightTransition,
  createOpacityTransition,
  createTranslateXTransition,
  createWidthTransition,
  getTranslateX,
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

  .ui_transition_overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
`;

const DEBUG = {
  size: false,
  transition: true,
};

const debug = (type, ...args) => {
  if (DEBUG[type]) {
    console.debug(`[${type}]`, ...args);
  }
};

export const initUITransition = (container, { resizeDuration = 300 } = {}) => {
  if (!container.classList.contains("ui_transition_container")) {
    console.error("Element must have ui_transition_container class");
    return { cleanup: () => {} };
  }

  const outerWrapper = container.querySelector(".ui_transition_outer_wrapper");
  const measureWrapper = container.querySelector(
    ".ui_transition_measure_wrapper",
  );
  const slot = container.querySelector(".ui_transition_slot");
  let overlay = container.querySelector(".ui_transition_overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "ui_transition_overlay";
    container.appendChild(overlay);
  }

  if (!outerWrapper || !measureWrapper || !slot) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const transitionController = createGroupTransitionController();

  // Transition state
  let activeTransition = null;
  let activeTransitionType = null;
  let isPaused = false;

  // Size state
  let naturalContentWidth = 0; // Natural size of actual content (not loading/error states)
  let naturalContentHeight = 0;
  let constrainedWidth = 0; // Current constrained dimensions (what outer wrapper is set to)
  let constrainedHeight = 0;
  let sizeAnimation = null;
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
    naturalContentWidth = newWidth;
    naturalContentHeight = newHeight;

    if (sizeAnimation) {
      debug("size", "Updating animation target:", newHeight);
      animateToSize(newWidth, newHeight, {
        onEnd: () => releaseConstraints("size animation completed"),
      });
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

  const animateToSize = (targetWidth, targetHeight, { onEnd } = {}) => {
    debug("size", "Animating size:", {
      width: `${constrainedWidth} → ${targetWidth}`,
      height: `${constrainedHeight} → ${targetHeight}`,
    });
    outerWrapper.style.overflow = "hidden";
    const animations = [];

    if (targetHeight !== constrainedHeight) {
      animations.push(
        createHeightTransition(outerWrapper, targetHeight, {
          duration: resizeDuration,
          onUpdate: ({ value }) => {
            constrainedHeight = value;
          },
        }),
      );
    }

    if (targetWidth !== constrainedWidth) {
      animations.push(
        createWidthTransition(outerWrapper, targetWidth, {
          duration: resizeDuration,
          onUpdate: ({ value }) => {
            constrainedWidth = value;
          },
        }),
      );
    }

    sizeAnimation = transitionController.animate(animations, {
      onFinish: onEnd,
    });
    sizeAnimation.play();
  };

  let isUpdating = false;

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
      const currentContentKey = firstChild?.getAttribute("data-content-key");
      wasContentPhase = isContentPhase;
      isContentPhase = firstChild?.hasAttribute("data-content-phase");

      if (DEBUG.transition) {
        console.group(`UI Update: ${childUIName || "unknown"}`);
      }

      debug(
        "size",
        `Update triggered, size: ${constrainedWidth}x${constrainedHeight}`,
      );

      if (sizeAnimation) {
        sizeAnimation.cancel();
      }

      const [newWidth, newHeight] = measureContentSize();
      debug("size", `Measured size: ${newWidth}x${newHeight}`);
      outerWrapper.style.width = `${constrainedWidth}px`;
      outerWrapper.style.height = `${constrainedHeight}px`;

      debug("transition", "Child info:", {
        currentContentKey,
        lastContentKey,
        isContentPhase,
        wasContentPhase,
        naturalContentWidth,
        naturalContentHeight,
      });

      // Handle resize observation
      stopResizeObserver();
      if (firstChild && !isContentPhase) {
        startResizeObserver();
        debug("size", "Observing child resize");
      }

      // Determine transition scenarios
      const isContentKeyChange =
        lastContentKey !== null && currentContentKey !== lastContentKey;
      const isContentPhaseChange =
        lastContentKey === currentContentKey &&
        wasContentPhase !== isContentPhase;
      const shouldTransition = isContentKeyChange || isContentPhaseChange;

      const hadChild = previousChild !== null;
      const hasChild = firstChild !== null;
      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;
      const contentChange = hadChild && hasChild && isContentKeyChange;
      const phaseChange = hadChild && hasChild && isContentPhaseChange;

      debug("transition", "Transition scenarios:", {
        isContentKeyChange,
        isContentPhaseChange,
        shouldTransition,
        hadChild,
        hasChild,
        becomesEmpty,
        becomesPopulated,
        contentChange,
        phaseChange,
      });

      // Handle transitions
      if (shouldTransition) {
        const existingOldContents = overlay.querySelectorAll(
          "[data-ui-transition-old]",
        );
        const animationProgress = activeTransition?.progress || 0;

        if (animationProgress > 0) {
          debug(
            "transition",
            `Preserving progress: ${(animationProgress * 100).toFixed(1)}%`,
          );
        }

        const newTransitionType = container.getAttribute("data-ui-transition");
        const canContinueSmoothly =
          activeTransitionType === newTransitionType && activeTransition;

        if (canContinueSmoothly) {
          debug("transition", "Continuing with same transition type");
          activeTransition.cancel();
        } else if (
          activeTransition &&
          activeTransitionType !== newTransitionType
        ) {
          debug(
            "transition",
            "Different transition type, keeping both",
            `${activeTransitionType} → ${newTransitionType}`,
          );
        } else if (activeTransition) {
          debug("transition", "Cancelling current transition");
          activeTransition.cancel();
        }

        const needsOldChildClone =
          (contentChange || phaseChange || becomesEmpty) &&
          previousChild &&
          !existingOldContents[0];

        const setupTransition = () => {
          let oldChild = null;
          let cleanup = () => {};
          const currentTransitionElement = existingOldContents[0];

          if (currentTransitionElement) {
            oldChild = currentTransitionElement;
            debug("transition", "Continuing from current transition element");
            cleanup = () => oldChild.remove();
          } else if (needsOldChildClone) {
            overlay.innerHTML = "";
            oldChild = previousChild.cloneNode(true);
            oldChild.removeAttribute("data-content-key");
            oldChild.setAttribute("data-ui-transition-old", "");
            overlay.appendChild(oldChild);
            debug("transition", "Cloned previous child for transition");
            cleanup = () => oldChild.remove();
          } else {
            overlay.innerHTML = "";
            debug("transition", "No old child to clone");
          }

          return { oldChild, cleanup };
        };

        const duration = parseInt(
          container.getAttribute("data-ui-transition-duration") || 300,
        );
        const type = container.getAttribute("data-ui-transition");

        activeTransition = animateTransition(
          transitionController,
          firstChild,
          setupTransition,
          {
            duration,
            type,
            animationProgress,
            onComplete: () => {
              activeTransition = null;
              activeTransitionType = null;
            },
          },
        );

        if (activeTransition) {
          activeTransition.play();
        }
        activeTransitionType = type;
      } else {
        overlay.innerHTML = "";
        activeTransition = null;
        activeTransitionType = null;
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

      // Handle size animation based on content state
      const becomesContent = wasContentPhase && !isContentPhase;

      if (becomesContent || (isContentKeyChange && !isContentPhase)) {
        debug("size", "Transitioning to actual content");
        animateToSize(targetWidth, targetHeight, {
          onEnd: () => releaseConstraints("all animations completed"),
        });
      } else if (isContentKeyChange || isContentPhase) {
        animateToSize(targetWidth, targetHeight, {
          onEnd: () => releaseConstraints("all animations completed"),
        });
      } else {
        releaseConstraints("direct content update");
      }
    } finally {
      isUpdating = false;
      if (DEBUG.transition) {
        console.groupEnd();
      }
    }
  };

  // Watch for child changes
  const mutationObserver = new MutationObserver(() => {
    handleChildSlotMutation();
  });

  mutationObserver.observe(slot, {
    childList: true,
    subtree: false,
    characterData: false,
  });

  // Return API
  return {
    slot,

    cleanup: () => {
      mutationObserver.disconnect();
      stopResizeObserver();
      if (sizeAnimation) {
        sizeAnimation.cancel();
      }
      if (activeTransition) {
        activeTransition.cancel();
      }
    },
    pause: () => {
      if (activeTransition?.pause) {
        activeTransition.pause();
        isPaused = true;
      }
    },
    resume: () => {
      if (activeTransition?.play && isPaused) {
        activeTransition.play();
        isPaused = false;
      }
    },
    getState: () => ({
      isPaused,
      transitionInProgress: activeTransition !== null,
    }),
  };
};

const animateTransition = (
  transitionController,
  newChild,
  setupTransition,
  { type, duration, animationProgress = 0, onComplete },
) => {
  let applyTransition;
  if (type === "cross-fade") {
    applyTransition = applyCrossFade;
  } else if (type === "slide-left") {
    applyTransition = applySlideLeft;
  } else {
    return null;
  }

  const { oldChild, cleanup } = setupTransition();
  debug("transition", "Starting animation:", {
    type,
    from: oldChild?.getAttribute("data-content-key") || "none",
    to: newChild?.getAttribute("data-content-key") || "none",
    progress: `${(animationProgress * 100).toFixed(1)}%`,
  });

  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("transition", "Duration:", remainingDuration);

  const transitions = applyTransition(oldChild, newChild, {
    duration: remainingDuration,
    startProgress: animationProgress,
  });

  const groupTransition = transitionController.animate(transitions, {
    onFinish: () => {
      groupTransition.cancel();
      cleanup();
      onComplete?.();
    },
  });

  return groupTransition;
};

const applySlideLeft = (
  oldChild,
  newChild,
  { duration, startProgress = 0 },
) => {
  if (!oldChild && !newChild) {
    return [];
  }

  if (!newChild) {
    // Content -> Empty (slide out left only)
    const containerWidth = oldChild.parentElement?.offsetWidth || 0;
    const currentOldPos = getTranslateX(oldChild);

    debug("transition", "Slide out to empty:", {
      old: currentOldPos,
      target: -containerWidth,
    });

    return [
      createTranslateXTransition(oldChild, -containerWidth, {
        from: currentOldPos,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition", "Slide out progress:", value);
          if (timing === "end") {
            debug("transition", "Slide out complete");
          }
        },
      }),
    ];
  }

  const containerWidth = newChild.parentElement?.offsetWidth || 0;

  if (!oldChild) {
    // Empty -> Content (slide in from right)
    const currentPos = getTranslateX(newChild);
    const startPos = currentPos || containerWidth;

    return [
      createTranslateXTransition(newChild, 0, {
        from: startPos,
        duration,
        startProgress,
        onUpdate: ({ value }) => {
          debug("transition", "Slide in progress:", value);
        },
      }),
    ];
  }

  // Content -> Content (slide out left, slide in from right)
  const currentOldPos = getTranslateX(oldChild);
  const currentNewPos = getTranslateX(newChild);

  // For smooth continuation: if old element is mid-transition,
  // calculate new element position to maintain seamless sliding
  let startNewPos;
  if (currentOldPos !== 0 && currentNewPos === 0) {
    startNewPos = currentOldPos + containerWidth;
    debug(
      "transition",
      "Calculated seamless position:",
      `${currentOldPos} + ${containerWidth} = ${startNewPos}`,
    );
  } else {
    startNewPos = currentNewPos || containerWidth;
  }

  debug("transition", "Starting slide positions:", {
    old: currentOldPos,
    new: startNewPos,
  });

  return [
    createTranslateXTransition(oldChild, -containerWidth, {
      from: currentOldPos,
      duration,
      startProgress,
      onUpdate: ({ value }) => {
        debug("transition", "Old content slide out:", value);
      },
    }),
    createTranslateXTransition(newChild, 0, {
      from: startNewPos,
      duration,
      startProgress,
      onUpdate: ({ value, timing }) => {
        debug("transition", "New content slide in:", value);
        if (timing === "end") {
          debug("transition", "Slide complete");
        }
      },
    }),
  ];
};

const applyCrossFade = (
  oldChild,
  newChild,
  { duration, startProgress = 0 },
) => {
  if (!oldChild && !newChild) {
    return [];
  }

  if (!newChild) {
    // Content -> Empty (fade out only)
    const oldOpacity = parseFloat(getComputedStyle(oldChild).opacity);
    const startOpacity = isNaN(oldOpacity) ? 1 : oldOpacity;

    debug("transition", "Fade out to empty:", { startOpacity });

    return [
      createOpacityTransition(oldChild, 0, {
        from: startOpacity,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition", "Content fade out:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Fade out complete");
          }
        },
      }),
    ];
  }

  // Get current opacity for both elements
  const oldOpacity = oldChild
    ? parseFloat(getComputedStyle(oldChild).opacity)
    : 0;
  const newOpacity = parseFloat(getComputedStyle(newChild).opacity);

  // Use highest opacity as starting point for smooth continuation
  const startOpacity = Math.max(
    isNaN(oldOpacity) ? 0 : oldOpacity,
    isNaN(newOpacity) ? 0 : newOpacity,
  );
  debug("transition", "Starting opacity:", {
    oldOpacity,
    newOpacity,
    startOpacity,
  });

  if (!oldChild) {
    // Empty -> Content (fade in only)
    return [
      createOpacityTransition(newChild, 1, {
        from: startOpacity,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition", "Fade in progress:", value.toFixed(3));
          if (timing === "end") {
            debug("transition", "Fade in complete");
          }
        },
      }),
    ];
  }

  // Content -> Content (cross-fade)
  return [
    createOpacityTransition(oldChild, 0, {
      from: Math.max(isNaN(oldOpacity) ? 1 : oldOpacity, startOpacity),
      duration,
      startProgress,
      onUpdate: ({ value }) => {
        if (value > 0) {
          debug("transition", "Old content fade out:", value.toFixed(3));
        }
      },
    }),
    createOpacityTransition(newChild, 1, {
      from: Math.max(isNaN(newOpacity) ? 0 : newOpacity, startOpacity),
      duration,
      startProgress,
      onUpdate: ({ value, timing }) => {
        const currentOpacity = parseFloat(getComputedStyle(newChild).opacity);
        if (isNaN(currentOpacity) || value > currentOpacity) {
          debug("transition", "New content fade in:", value.toFixed(3));
        }
        if (timing === "end") {
          debug("transition", "Cross-fade complete");
        }
      },
    }),
  ];
};
