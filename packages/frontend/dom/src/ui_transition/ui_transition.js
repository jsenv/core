import { getHeight } from "../size/get_height.js";
import { getWidth } from "../size/get_width.js";
import {
  createHeightTransition,
  createOpacityTransition,
  createTranslateXTransition,
  createWidthTransition,
} from "../transition/dom_transition.js";
import { createGroupTransitionController } from "../transition/group_transition.js";

import.meta.css = /* css */ `
  .ui-transition-container {
    position: relative;
    overflow: hidden;
  }

  .ui-transition-measure-wrapper {
    overflow: hidden; /* Ensure margins are taken into account */
  }

  .ui-transition-content {
    position: relative;
  }

  .ui-transition-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  /* Old content is positioned absolutely within the overlay */
  [data-ui-transition-old] {
  }
`;

const DEBUG = {
  size: false,
  transition: true,
};

const debug = (type, ...args) => {
  if (!DEBUG[type]) {
    return;
  }
  console.debug(`[${type}]`, ...args);
};

export const initUITransition = (container, { resizeDuration = 300 } = {}) => {
  // Validate and get references to required elements
  if (!container.classList.contains("ui-transition-container")) {
    console.error("Element must have ui-transition-container class");
    return { cleanup: () => {} };
  }

  // Required structure:
  // <div class="ui-transition-container">
  //   <div class="ui-transition-outer-wrapper"> <!-- for animation constraints -->
  //     <div class="ui-transition-measure-wrapper"> <!-- for content measurements -->
  //       <div class="ui-transition-content">
  //         <!-- actual content -->
  //       </div>
  //     </div>
  //   </div>
  //   <div class="ui-transition-overlay">
  //     <!-- transition elements (clones) are inserted here -->
  //   </div>
  // </div>

  const outerWrapper = container.querySelector(".ui-transition-outer-wrapper");
  const measureWrapper = container.querySelector(
    ".ui-transition-measure-wrapper",
  );
  const content = container.querySelector(".ui-transition-content");
  const transitionOverlay = container.querySelector(".ui-transition-overlay");

  // Create overlay if it doesn't exist
  if (!transitionOverlay) {
    const overlay = document.createElement("div");
    overlay.className = "ui-transition-overlay";
    container.appendChild(overlay);
  }
  if (!outerWrapper || !measureWrapper || !content) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const transitionController = createGroupTransitionController();

  // Track dimensions and UI state
  let lastContentWidth = 0; // Last known content state width
  let lastContentHeight = 0; // Last known content state height
  let currentWidth = 0; // Current width we're animating from
  let currentHeight = 0; // Current height we're animating from
  let lastUIKey = null; // Track the last UI key to detect content changes
  let wasInheritingDimensions = false; // Track if previous content was inheriting dimensions
  let resizeObserver = null;
  let sizeAnimation = null;

  const measureSize = () => {
    // We measure the inner wrapper which is not constrained by animations
    // This gives us the natural content size
    return [getWidth(measureWrapper), getHeight(measureWrapper)];
  };

  const updateLastContentDimensions = () => {
    // Measure natural size using measure wrapper which has no constraints
    // No need to remove constraints since measureWrapper is always unconstrained
    const [newWidth, newHeight] = measureSize();
    debug("size", "📊 Content natural size from ResizeObserver:", {
      width: `${lastContentWidth} → ${newWidth}`,
      height: `${lastContentHeight} → ${newHeight}`,
    });
    lastContentWidth = newWidth;
    lastContentHeight = newHeight;

    // If we have an ongoing size animation, update it
    if (sizeAnimation && sizeAnimation.playing) {
      debug(
        "size",
        "🎯 Updating animation target height to match content:",
        newHeight,
        `(current: ${currentHeight})`,
      );
      // Start animation from current constrained height to new height
      animateSize(newWidth, newHeight, {
        onEnd: () => {
          letContentSelfManage("size animation completed");
        },
      });
    } else {
      currentWidth = newWidth;
      currentHeight = newHeight;
    }
  };

  const stopObservingResize = () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  };

  const startObservingResize = () => {
    resizeObserver = new ResizeObserver(() => {
      updateLastContentDimensions(content);
    });
    resizeObserver.observe(measureWrapper);
  };

  const letContentSelfManage = (reason) => {
    debug("size", `↕️ Letting content self-manage size (${reason})`);
    // First measure the current size while constrained
    const [beforeWidth, beforeHeight] = measureSize();
    // Release constraints
    outerWrapper.style.width = "";
    outerWrapper.style.height = "";
    outerWrapper.style.overflow = "";
    // Measure actual size after releasing constraints
    const [afterWidth, afterHeight] = measureSize();
    debug("size", "📏 Size after self-manage:", {
      width: `${beforeWidth} → ${afterWidth}`,
      height: `${beforeHeight} → ${afterHeight}`,
    });
    // Update with actual measured values
    currentWidth = afterWidth;
    currentHeight = afterHeight;
    lastContentWidth = afterWidth;
    lastContentHeight = afterHeight;
  };

  const animateSize = (targetWidth, targetHeight, { onEnd } = {}) => {
    // if we already have an animation we want to resume from that point

    debug("size", "🎬 Starting size animation", {
      width: `${currentWidth} → ${targetWidth}`,
      height: `${currentHeight} → ${targetHeight}`,
    });
    outerWrapper.style.overflow = "hidden";
    const animations = [];
    if (targetHeight !== currentHeight) {
      const heightTransition = createHeightTransition(
        outerWrapper,
        targetHeight,
        {
          duration: resizeDuration,
          onProgress: ({ value }) => {
            currentHeight = value;
          },
        },
      );
      animations.push(heightTransition);
    }
    if (targetWidth !== currentWidth) {
      const widthTransition = createWidthTransition(outerWrapper, targetWidth, {
        duration: resizeDuration,
        onUpdate: ({ value }) => {
          currentWidth = value;
        },
      });
      animations.push(widthTransition);
    }
    sizeAnimation = transitionController.animate(animations, {
      onFinish: onEnd,
    });
    sizeAnimation.play();
  };

  let isUpdating = false;
  let previousContent = null; // Track previous content for transitions

  // Let initial content have its natural size
  [currentWidth, currentHeight] = measureSize();

  // Handle initial content if present
  const initialFirstChild = content.children[0];
  if (initialFirstChild) {
    debug("size", "📦 Found initial content, analyzing...");
    // Store initial content state
    lastUIKey = initialFirstChild.getAttribute("data-ui-key");
    wasInheritingDimensions = initialFirstChild.hasAttribute(
      "data-inherit-content-dimensions",
    );
    lastContentWidth = currentWidth;
    lastContentHeight = currentHeight;
    debug(
      "size",
      `📐 Initial content size: ${lastContentWidth}x${lastContentHeight}`,
    );

    // Start observing resize if needed
    if (!wasInheritingDimensions) {
      startObservingResize();
      debug("👀 ResizeObserver: Observing initial content");
    }
    // Store initial content for future transitions
    previousContent = initialFirstChild.cloneNode(true);
  }

  const onMutation = () => {
    if (isUpdating) {
      debug("⚠️ Preventing recursive update");
      return; // Prevent recursive updates
    }

    try {
      isUpdating = true;
      // Get current UI key and state information
      const firstChild = content.children[0];
      const childUIName = firstChild?.getAttribute("data-ui-name");
      const currentUIKey = firstChild?.getAttribute("data-ui-key");
      const inheritContentDimensions = firstChild?.hasAttribute(
        "data-inherit-content-dimensions",
      );

      if (DEBUG) {
        console.group(`UI Transition Update (${childUIName})`);
      }
      debug(
        "size",
        `🔄 Update triggered, current size: ${currentWidth}x${currentHeight}`,
      );

      // Cancel any ongoing animations
      if (sizeAnimation) {
        sizeAnimation.cancel();
      }
      // No need to remove constraints from outerWrapper since we measure the inner wrapper
      const [newWidth, newHeight] = measureSize();
      debug("size", `📐 Measured size: ${newWidth}x${newHeight}`);
      // Make sure outer wrapper has current constraints
      outerWrapper.style.width = `${currentWidth}px`;
      outerWrapper.style.height = `${currentHeight}px`;

      debug("🏷️ Content info:", {
        currentUIKey,
        lastUIKey,
        inheritContentDimensions,
        lastContentWidth,
        lastContentHeight,
      });

      // Handle resize observation based on content type
      stopObservingResize(); // Always cleanup first
      if (
        firstChild &&
        !firstChild.hasAttribute("data-inherit-content-dimensions")
      ) {
        startObservingResize();
        debug("👀 ResizeObserver: Observing content");
      } else {
        debug(
          "👀 ResizeObserver: Skipping observation for loading/error state",
        );
      }

      // Determine transition type based on UI key and content phase changes
      const isUIKeyChange = lastUIKey !== null && currentUIKey !== lastUIKey;
      const lastInheritContentDimensions = previousContent?.hasAttribute(
        "data-inherit-content-dimensions",
      );
      const isContentPhaseChange =
        lastUIKey === currentUIKey && // Same UI key
        lastInheritContentDimensions !== inheritContentDimensions; // But different content phase
      const shouldTransition = isUIKeyChange || isContentPhaseChange;

      // Define clear transition scenarios
      const hadContent = previousContent !== null;
      const hasContent = firstChild !== null;
      const becomesEmpty = hadContent && !hasContent;
      const becomesContent = !hadContent && hasContent;
      const contentToContent = hadContent && hasContent && isUIKeyChange;
      const phaseChange = hadContent && hasContent && isContentPhaseChange;

      debug("🔄 Transition scenarios:", {
        isUIKeyChange,
        isContentPhaseChange,
        shouldTransition,
        hadContent,
        hasContent,
        becomesEmpty,
        becomesContent,
        contentToContent,
        phaseChange,
        lastInheritContentDimensions,
        currentInheritContentDimensions: inheritContentDimensions,
        reason: isUIKeyChange
          ? `Key change from ${lastUIKey} to ${currentUIKey}`
          : isContentPhaseChange
            ? `Content phase change (inherit: ${lastInheritContentDimensions} → ${inheritContentDimensions})`
            : "Same content",
      });

      // Handle transitions between UI states - can happen even when becoming empty
      if (shouldTransition) {
        // First, clean up any existing old content in the overlay but preserve current transitions
        const existingOldContents = transitionOverlay.querySelectorAll(
          "[data-ui-transition-old]",
        );

        // Calculate animation progress before canceling for smooth continuation
        let animationProgress = 0;
        if (transitionController.pending && existingOldContents[0]) {
          // Calculate progress based on current position vs target
          const currentOldPos = getCurrentTranslateX(existingOldContents[0]);
          const containerWidth =
            existingOldContents[0].parentElement?.offsetWidth || 300;
          // Progress = how far we've moved toward the target (-containerWidth)
          // If we started at 0 and target is -300, then at -60 we're 20% done
          animationProgress = Math.abs(currentOldPos) / containerWidth;
          animationProgress = Math.max(0, Math.min(1, animationProgress)); // Clamp to [0,1]
          debug(
            "transition",
            "🎯 Preserving animation progress:",
            `${(animationProgress * 100).toFixed(1)}%`,
          );
        }

        // Cancel any ongoing transition before starting a new one
        transitionController.cancel();

        // Determine if we need to create a setup function that clones content
        const needsOldContentClone =
          (contentToContent || phaseChange || becomesEmpty) &&
          previousContent &&
          !existingOldContents[0];

        const setupTransition = () => {
          let oldContent = null;
          let cleanup = () => {};

          // Check if we have an ongoing transition element that we should continue from
          const currentTransitionElement = existingOldContents[0];

          if (currentTransitionElement) {
            // Use the current transitioning element as the old content
            oldContent = currentTransitionElement;
            debug(
              "transition",
              "🔄 Continuing from current transition element",
            );
            cleanup = () => {
              oldContent.remove();
            };
          } else if (needsOldContentClone) {
            // Clean up any old transition elements first
            transitionOverlay.innerHTML = "";
            // Clone and prepare the old content
            oldContent = previousContent.cloneNode(true);
            oldContent.removeAttribute("data-ui-key");
            oldContent.setAttribute("data-ui-transition-old", "");
            transitionOverlay.appendChild(oldContent);
            debug("transition", "🔄 Cloned previous content for transition");
            cleanup = () => {
              oldContent.remove();
            };
          } else {
            // Clean up any remaining old elements
            transitionOverlay.innerHTML = "";
            debug("transition", "🔄 No old content to clone");
          }

          return { oldContent, cleanup };
        };

        const duration = parseInt(
          container.getAttribute("data-ui-transition-duration") || 300,
        );
        const type = container.getAttribute("data-ui-transition");

        animateTransition(transitionController, firstChild, setupTransition, {
          duration,
          type,
          animationProgress,
        });
      } else {
        // No transition needed, clean up any remaining old elements
        transitionOverlay.innerHTML = "";
      }

      // Store the current content for next transition
      // We must clone it before any mutations occur
      previousContent = firstChild ? firstChild.cloneNode(true) : null;

      // Store current state for next update
      lastUIKey = currentUIKey;
      wasInheritingDimensions = inheritContentDimensions;

      const getTargetDimensions = () => {
        if (!inheritContentDimensions) {
          return [newWidth, newHeight];
        }
        const shouldUseNewDimensions =
          lastContentWidth === 0 && lastContentHeight === 0;
        const targetWidth = shouldUseNewDimensions
          ? newWidth
          : lastContentWidth || newWidth;
        const targetHeight = shouldUseNewDimensions
          ? newHeight
          : lastContentHeight || newHeight;
        return [targetWidth, targetHeight];
      };

      const [targetWidth, targetHeight] = getTargetDimensions();

      // Skip animation if no size changes needed
      if (targetWidth === currentWidth && targetHeight === currentHeight) {
        debug("⏭️ No size change required");
        // Even with no changes, we should release constraints for regular content
        // This is important for elements that manage their own height animation
        if (!inheritContentDimensions) {
          letContentSelfManage("no size change needed");
        }
        if (DEBUG) {
          console.groupEnd();
        }
        return;
      }

      debug("📏 Size change needed", {
        width: `${currentWidth} → ${targetWidth}`,
        height: `${currentHeight} → ${targetHeight}`,
      });

      // Handle height inheritance and animation based on state
      const becomesContentPhase =
        wasInheritingDimensions && !inheritContentDimensions;

      if (becomesContentPhase || (isUIKeyChange && !inheritContentDimensions)) {
        // Animate when:
        // 1. New content with different key
        // 2. Transitioning from loading/error state (wasInheriting) to actual content (!inheriting)
        debug("🎭 Transitioning to actual content, animating size");
        animateSize(targetWidth, targetHeight, {
          onEnd: () => {
            letContentSelfManage("all animations completed");
          },
        });
      } else if (isUIKeyChange || inheritContentDimensions) {
        // Either:
        // 1. UI key changed but we want to inherit content dimensions (loading/error state)
        // 2. Same UI key but inherit dimensions requested
        animateSize(targetWidth, targetHeight, {
          onEnd: () => {
            letContentSelfManage("all animations completed");
          },
        });
      } else {
        // Same UI key, no special states: no need to animate, let content handle its own size
        letContentSelfManage("direct content update");
      }
    } finally {
      isUpdating = false;
      if (DEBUG) {
        console.groupEnd();
      }
    }
  };

  // Watch for direct children mutations only in the content area
  // We only care about top-level content changes where data-ui-key lives
  const mutationObserver = new MutationObserver(() => {
    onMutation();
  });

  // Start observing only direct children of the content element
  mutationObserver.observe(content, {
    childList: true, // Only watch for direct children changes
    subtree: false, // Don't watch nested changes
    characterData: false, // Don't watch for text changes
  });

  // Return cleanup function and API
  return {
    cleanup: () => {
      mutationObserver.disconnect();
      stopObservingResize();
      if (sizeAnimation) {
        sizeAnimation.cancel();
      }
      transitionController.cancel();
    },
    pause: () => {
      transitionController.pause();
    },
    resume: () => {
      transitionController.resume();
    },
    getState: () => ({
      isPaused: transitionController.isPaused(),
      transitionInProgress: transitionController.pending,
    }),
    // Additional methods could be added here for direct control
    // setContent: (content) => {...}
    // transition: (from, to) => {...}
  };
};

const animateTransition = (
  transitionController,
  newElement,
  setupTransition,
  { type, duration, animationProgress = 0 },
) => {
  let applyTransition;
  if (type === "cross-fade") {
    applyTransition = applyCrossFade;
  } else if (type === "slide-left") {
    applyTransition = applySlideLeft;
  } else {
    return;
  }

  // Call setup function to prepare transition elements
  const { oldContent, cleanup } = setupTransition();
  debug("transition", "🎭 Starting transition animation", {
    type,
    from: oldContent ? oldContent.getAttribute("data-ui-key") : "none",
    to: newElement.getAttribute("data-ui-key"),
    progress: `${(animationProgress * 100).toFixed(1)}%`,
  });
  debug("transition", "⏱️ Transition duration:", duration);

  // Adjust duration based on remaining progress
  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("transition", "⏱️ Remaining duration:", remainingDuration);

  const transitions = applyTransition(oldContent, newElement);
  transitionController.animate(transitions, {
    onFinish: () => {
      cleanup();
    },
  });
};

const getCurrentTranslateX = (element) => {
  const transform = getComputedStyle(element).transform;
  if (transform === "none") return 0;

  // Parse matrix/matrix3d values
  const match = transform.match(/matrix(?:3d)?\((.*)\)/);
  if (!match) return 0;

  const values = match[1].split(", ");
  // For both matrix and matrix3d, the X translation is the second to last value
  return parseFloat(values[values.length - 2]) || 0;
};

const applySlideLeft = (oldElement, newElement) => {
  if (!oldElement && !newElement) {
    // Edge case: no elements to animate
    return [];
  }

  if (!newElement) {
    // Case: Content -> Empty (slide out left only)
    const containerWidth = oldElement.parentElement?.offsetWidth || 0;
    const currentOldPos = getCurrentTranslateX(oldElement);

    oldElement.style.transform = `translateX(${currentOldPos}px)`;

    debug("transition", "🎯 Slide out to empty:", {
      old: currentOldPos,
      target: -containerWidth,
    });

    return [
      createTranslateXTransition(oldElement, -containerWidth, {
        onProgress: ({ value, timing }) => {
          debug("transition", "🔄 Content slide out to empty:", value);
          if (timing === "end") {
            debug("transition", "✨ Slide out complete");
          }
        },
      }),
    ];
  }

  const containerWidth = newElement.parentElement?.offsetWidth || 0;

  if (!oldElement) {
    // Case: Empty -> Content (slide in from right)
    const currentPos = getCurrentTranslateX(newElement);
    const startPos =
      currentPos || (containerWidth ? `${containerWidth}px` : "100%");
    newElement.style.transform = `translateX(${startPos})`;

    return [
      createTranslateXTransition(newElement, 0, {
        sideEffect: ({ value }) => {
          debug("transition", "🔄 Slide in progress:", value);
        },
      }),
    ];
  }

  // Case: Content -> Content (slide out left, slide in from right)
  // Get current positions - if elements are mid-animation, use their current position
  const currentOldPos = getCurrentTranslateX(oldElement);
  const currentNewPos = getCurrentTranslateX(newElement);

  // For smooth continuation: if the old element is mid-transition (not at position 0),
  // calculate the new element's position to maintain seamless sliding effect
  let startNewPos;
  if (currentOldPos !== 0 && currentNewPos === 0) {
    // Old element is mid-transition, calculate where new element should start
    // to maintain the sliding illusion: old_pos + container_width
    // This ensures the new element appears to be "pushing" the old one
    startNewPos = currentOldPos + containerWidth;
    debug(
      "transition",
      "📐 Calculated new position for seamless slide:",
      `${currentOldPos} + ${containerWidth} = ${startNewPos}`,
    );
  } else {
    // Use current new position if it exists, otherwise start from container width
    startNewPos = currentNewPos || containerWidth;
  }

  oldElement.style.transform = `translateX(${currentOldPos}px)`;
  newElement.style.transform = `translateX(${startNewPos}px)`;

  debug("transition", "🎯 Starting slide positions:", {
    old: currentOldPos,
    new: startNewPos,
  });

  return [
    createTranslateXTransition(oldElement, -containerWidth, {
      onProgress: ({ value }) => {
        debug("transition", "🔄 Old content slide out:", value);
      },
    }),
    createTranslateXTransition(newElement, 0, {
      onProgress: ({ value, timing }) => {
        debug("transition", "🔄 New content slide in:", value);
        if (timing === "end") {
          debug("transition", "✨ Slide complete");
        }
      },
    }),
  ];
};

const applyCrossFade = (oldElement, newElement) => {
  if (!oldElement && !newElement) {
    // Edge case: no elements to animate

    return [];
  }

  if (!newElement) {
    // Case: Content -> Empty (fade out only)
    const oldOpacity = parseFloat(getComputedStyle(oldElement).opacity);
    const startOpacity = isNaN(oldOpacity) ? 1 : oldOpacity;

    oldElement.style.opacity = startOpacity.toString();

    debug("transition", "🎨 Fade out to empty:", {
      startOpacity,
    });

    return [
      createOpacityTransition(oldElement, 0, {
        onProgress: ({ value, timing }) => {
          debug(
            "transition",
            "🔄 Content fade out to empty:",
            value.toFixed(3),
          );
          if (timing === "end") {
            debug("transition", "✨ Fade out complete");
          }
        },
      }),
    ];
  }

  // Get the current opacity - check both old content and new element
  const oldOpacity = oldElement
    ? parseFloat(getComputedStyle(oldElement).opacity)
    : 0;
  const newOpacity = parseFloat(getComputedStyle(newElement).opacity);

  // Use the highest opacity as our starting point
  // This ensures we continue from wherever the previous transition left off
  const startOpacity = Math.max(
    isNaN(oldOpacity) ? 0 : oldOpacity,
    isNaN(newOpacity) ? 0 : newOpacity,
  );
  debug("transition", "🎨 Starting opacity:", {
    oldOpacity,
    newOpacity,
    startOpacity,
  });

  // Setup initial state
  if (oldElement) {
    oldElement.style.opacity = startOpacity.toString();
  }
  // Only set new element opacity if it's not already higher
  if (isNaN(newOpacity) || newOpacity < startOpacity) {
    newElement.style.opacity = startOpacity.toString();
  }

  if (!oldElement) {
    // Case: Empty -> Content (fade in only)
    return [
      createOpacityTransition(newElement, 1, {
        onProgress: ({ value, timing }) => {
          debug("transition", "🔄 Fade in progress:", value.toFixed(3));

          if (timing === "end") {
            debug("transition", "✨ Transition complete");
          }
        },
      }),
    ];
  }

  // Case: Content -> Content (cross-fade between states)
  return [
    createOpacityTransition(oldElement, 0, {
      onProgress: ({ value }) => {
        // Skip if old content opacity is already 0
        if (value > 0) {
          debug("transition", "🔄 Old content fade out:", value.toFixed(3));
        }
      },
    }),
    createOpacityTransition(newElement, 1, {
      onProgress: ({ value, timing }) => {
        // Skip if new content opacity is already at or above target
        const currentOpacity = parseFloat(getComputedStyle(newElement).opacity);
        if (isNaN(currentOpacity) || value > currentOpacity) {
          debug("transition", "🔄 New content fade in:", value.toFixed(3));
        }
        if (timing === "end") {
          debug("transition", "✨ Cross-fade complete");
        }
      },
    }),
  ];
};
