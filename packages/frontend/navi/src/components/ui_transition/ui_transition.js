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
 *     <div class="ui_transition_slot" data-content-key></div> <!-- Content slot: actual content is here, ResizeObserver watches this to detect natural content size changes -->
 *     <div class="ui_transition_phase_overlay"> <!-- Used to transition to new phase: crossfade to new phase -->
 *       <!-- Clone of ".ui_transition_slot" children for phase transition -->
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
 * - Accurate content measurement via slot ResizeObserver
 * - Content transitions (slide, etc.) that operate at container level and can outlive content phase changes
 * - Phase transitions (cross-fade only) that operate on individual elements for loading/error states
 * - Independent content updates in the slot without affecting ongoing animations
 */

import {
  createGroupTransitionController,
  createHeightTransition,
  createOpacityTransition,
  createPubSub,
  createTranslateXTransition,
  createWidthTransition,
  getElementSignature,
  getHeightWithoutTransition,
  getInnerWidth,
  getOpacity,
  getOpacityWithoutTransition,
  getTranslateX,
  getTranslateXWithoutTransition,
  getWidthWithoutTransition,
} from "@jsenv/dom";

import.meta.css = /* css */ `
  .ui_transition_container[data-transition-running] {
    /* When transition are running we need to put overflow: hidden */
    /* Either because the transition slides */
    /* Or when size transition are disabled because we need to immediatly crop old content when it's bigger than new content */
    overflow: hidden;
  }

  .ui_transition_container,
  .ui_transition_outer_wrapper,
  .ui_transition_slot,
  .ui_transition_phase_overlay,
  .ui_transition_content_overlay {
    display: flex;
    width: fit-content;
    min-width: 100%;
    height: fit-content;
    min-height: 100%;
    flex-direction: inherit;
    align-items: inherit;
    justify-content: inherit;
    border-radius: inherit;
    cursor: inherit;
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
  detection: false,
  size: false,
  content: false,
  transition_updates: false,
};

const SIZE_TRANSITION_DURATION = 150; // Default size transition duration
const SIZE_DIFF_EPSILON = 0.5; // Ignore size transition when difference below this (px)
const CONTENT_TRANSITION = "cross-fade"; // Default content transition type
const CONTENT_TRANSITION_DURATION = 300; // Default content transition duration
const PHASE_TRANSITION = "cross-fade"; // Default phase transition type (only cross-fade supported)
const PHASE_TRANSITION_DURATION = 300; // Default phase transition duration

export const initUITransition = (container) => {
  if (!container.classList.contains("ui_transition_container")) {
    console.error("Element must have ui_transition_container class");
    return { cleanup: () => {} };
  }

  const localDebug = {
    ...DEBUG,
    detection: container.hasAttribute("data-debug-detection"),
    size: container.hasAttribute("data-debug-size"),
  };
  const hasSomeDebugLogs =
    localDebug.detection || localDebug.size || localDebug.content;
  const debugClones = container.hasAttribute("data-debug-clones");
  const debugBreakAfterClone = container.getAttribute(
    "data-debug-break-after-clone",
  );
  const debug = (type, ...args) => {
    if (localDebug[type]) {
      console.debug(`[${type}]`, ...args);
    }
  };

  const outerWrapper = container.querySelector(".ui_transition_outer_wrapper");
  const slot = container.querySelector(".ui_transition_slot");
  const phaseOverlay = outerWrapper.querySelector(
    ".ui_transition_phase_overlay",
  );
  const contentOverlay = container.querySelector(
    ".ui_transition_content_overlay",
  );
  if (!outerWrapper || !slot || !phaseOverlay || !contentOverlay) {
    console.error("Missing required ui-transition structure");
    return { cleanup: () => {} };
  }

  const state = {
    isPaused: false,
  };
  const initialTransitionEnabled = container.hasAttribute(
    "data-initial-transition",
  );
  const transitionController = createGroupTransitionController();
  const setupTransition = ({
    isPhaseTransition = false,
    overlay,
    needsOldChildNodesClone,
    previousChildNodes,
    childNodes,
    slotInfo,
    attributeToRemove = [],
  }) => {
    let cleanup = () => {};
    let elementToImpact;

    if (overlay.childNodes.length > 0) {
      elementToImpact = overlay;
      cleanup = () => {
        if (!debugClones) {
          overlay.innerHTML = "";
        }
      };
      debug(
        "content",
        `Continuing from current ${isPhaseTransition ? "phase" : "content"} transition element`,
      );
    } else if (needsOldChildNodesClone) {
      overlay.innerHTML = "";
      for (const previousChildNode of previousChildNodes) {
        const previousChildClone = previousChildNode.cloneNode(true);
        if (previousChildClone.nodeType !== Node.TEXT_NODE) {
          for (const attrToRemove of attributeToRemove) {
            previousChildClone.removeAttribute(attrToRemove);
          }
          previousChildClone.setAttribute("data-ui-transition-clone", "");
        }
        overlay.appendChild(previousChildClone);
      }
      elementToImpact = overlay;
      cleanup = () => {
        if (!debugClones) {
          overlay.innerHTML = "";
        }
      };
      debug(
        "content",
        `Cloned previous child for ${isPhaseTransition ? "phase" : "content"} transition:`,
        getElementSignature(previousChildNodes),
      );
      if (debugBreakAfterClone === slotInfo.contentKey) {
        debugger;
      }
    } else {
      overlay.innerHTML = "";
      debug(
        "content",
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
      oldElement = previousChildNodes.length ? elementToImpact : null;
      newElement = childNodes.length ? slot : null;
    }

    return {
      cleanup,
      oldElement,
      newElement,
    };
  };
  const [teardown, addTeardown] = createPubSub();
  const [publishPause, addPauseCallback] = createPubSub();
  const [publishResume, addResumeCallback] = createPubSub();

  const [publishChange, subscribeChange] = createPubSub();
  let triggerChildSlotMutation;
  let previousSlotInfo;
  let slotInfo;
  let changeInfo;
  {
    const createSlotInfo = (childNodes, { contentKey, contentPhase }) => {
      const hasChild = childNodes.length > 0;
      let contentKeyFormatted;
      let contentName;
      if (hasChild) {
        if (contentKey) {
          contentKeyFormatted = `[data-content-key="${contentKey}"]`;
        } else {
          let onlyTextNodes = true;
          for (const child of childNodes) {
            if (child.nodeType !== Node.TEXT_NODE) {
              onlyTextNodes = false;
              break;
            }
          }
          contentKeyFormatted = onlyTextNodes ? "[text]" : "[unkeyed]";
        }
        contentName = contentPhase ? "content-phase" : "content";
      } else {
        contentKeyFormatted = "[empty]";
        contentName = "null";
      }

      return {
        childNodes,
        contentKey,
        contentPhase,

        hasChild: childNodes.length > 0,
        contentKeyFormatted,
        isContentPhase: Boolean(contentPhase),
        contentName,
      };
    };
    previousSlotInfo = createSlotInfo([], {
      contentKey: undefined,
      contentPhase: undefined,
    });
    slotInfo = previousSlotInfo;
    let isUpdating = false;
    triggerChildSlotMutation = (reason) => {
      if (isUpdating) {
        debug("detection", "Preventing recursive update");
        return;
      }
      try {
        const childNodes = Array.from(slot.childNodes);
        if (hasSomeDebugLogs) {
          const updateLabel =
            childNodes.length === 0
              ? "cleared/empty"
              : childNodes.length === 1
                ? getElementSignature(childNodes[0])
                : getElementSignature(slot);
          console.group(`UI Update: ${updateLabel} (reason: ${reason})`);
        }
        updateSlotChangeInfo(childNodes, reason);
        if (changeInfo.isStateChangeOnly) {
        } else {
          publishChange();
          previousSlotInfo = slotInfo;
          if (
            changeInfo.isInitialPopulationWithoutTransition ||
            changeInfo.becomesPopulated
          ) {
            hasPopulatedOnce = true;
          }
        }
      } finally {
        isUpdating = false;
        if (hasSomeDebugLogs) {
          console.groupEnd();
        }
      }
    };

    let hasPopulatedOnce = false; // track if we've already populated once (null → something)
    const updateSlotChangeInfo = (currentChildNodes, reason = "mutation") => {
      let childContentKey;
      let contentPhase;
      if (currentChildNodes.length === 0) {
        contentPhase = true; // empty treated as phase
      } else {
        for (const childNode of currentChildNodes) {
          if (childNode.nodeType === Node.TEXT_NODE) {
            continue;
          }
          if (childNode.hasAttribute("data-content-phase")) {
            const contentPhaseAttr =
              childNode.getAttribute("data-content-phase");
            contentPhase = contentPhaseAttr || true;
          }
          if (childNode.hasAttribute("data-content-key")) {
            childContentKey = childNode.getAttribute("data-content-key");
          }
        }
      }
      const slotContentKey = slot.getAttribute("data-content-key");
      if (childContentKey && slotContentKey) {
        console.warn(
          `Slot and slot child both have a [data-content-key]. Slot is ${slotContentKey} and child is ${childContentKey}, using the child.`,
        );
      }
      const contentKey = childContentKey || slotContentKey || undefined;
      slotInfo = createSlotInfo(currentChildNodes, {
        contentKey,
        contentPhase,
      });

      const hadChild = previousSlotInfo.hasChild;
      const hasChild = currentChildNodes.length > 0;
      const becomesEmpty = hadChild && !hasChild;
      const becomesPopulated = !hadChild && hasChild;
      const isInitialPopulationWithoutTransition =
        becomesPopulated && !hasPopulatedOnce && !initialTransitionEnabled;
      const shouldDoContentTransition =
        contentKey &&
        previousSlotInfo.contentKey &&
        contentKey !== previousSlotInfo.contentKey;
      const previousIsContentPhase = !hadChild || previousSlotInfo.contentPhase;
      const currentIsContentPhase = !hasChild || contentPhase;
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
      const isTransitionLess =
        !shouldDoContentTransition &&
        !shouldDoPhaseTransition &&
        !becomesPopulated &&
        !becomesEmpty;
      const shouldDoContentTransitionIncludingPopulation =
        shouldDoContentTransition ||
        (becomesPopulated && !shouldDoPhaseTransition);
      // nothing to transition if no previous and no current child
      // (Either it's the initial call or just content-key changes but there is no child yet)
      const isStateChangeOnly = !hadChild && !hasChild;
      if (isStateChangeOnly) {
        const prevKey = previousSlotInfo.contentKey;
        const keyIsTheSame = prevKey === contentKey;
        if (keyIsTheSame) {
          debug(
            "detection",
            `Childless change: no changes found -> do nothing and skip transitions`,
          );
        } else if (!prevKey && contentKey) {
          debug(
            "detection",
            `Childless change: ${contentKey} added -> registering it and skip transitions`,
          );
        } else if (prevKey && !contentKey) {
          debug(
            "detection",
            `Childless change: ${contentKey} removed -> registering it and skip transitions`,
          );
        } else {
          debug(
            "detection",
            `Childless change: content key updated from ${prevKey} to ${contentKey} -> registering it and skip transitions`,
          );
        }
      } else if (isInitialPopulationWithoutTransition) {
        debug(
          "detection",
          "Initial population detected -> skipping transitions (opt-in with [data-initial-transition])",
        );
      } else if (previousSlotInfo.contentKey !== slotInfo.contentKey) {
        let contentKeysSentence = `Content key: ${previousSlotInfo.contentKeyFormatted} → ${slotInfo.contentKeyFormatted}`;
        debug("detection", contentKeysSentence);
      } else if (previousSlotInfo.contentPhase !== slotInfo.contentPhase) {
        let contentPhasesSentence = `Content phase: ${previousSlotInfo.contentPhase} → ${slotInfo.contentPhase}`;
        debug("detection", contentPhasesSentence);
      }

      changeInfo = {
        reason,
        previousSlotInfo,
        becomesEmpty,
        becomesPopulated,
        isInitialPopulationWithoutTransition,
        shouldDoContentTransition,
        shouldDoPhaseTransition,
        contentChange,
        phaseChange,
        isTransitionLess,
        shouldDoContentTransitionIncludingPopulation,
        isStateChangeOnly,
      };
    };
  }

  let onContentTransitionComplete;
  let hasSizeTransitions = container.hasAttribute("data-size-transition");
  size_transition: {
    let naturalContentWidth = 0; // Natural size of actual content (not loading/error states)
    let naturalContentHeight = 0;
    let constrainedWidth = 0; // Current constrained dimensions (what outer wrapper is set to)
    let constrainedHeight = 0;
    let sizeTransition = null;

    let pauseResizeObserver;
    resize_observer: {
      let resizeObserver = null;
      let isWithinResizeObserverTick = false;
      const pauseReasonSet = new Set();
      let state = "disconnected"; // "disconnected" | "paused" | "observing"
      let pendingResizeCount = 0;
      let resumeAnimationFrame;

      pauseResizeObserver = (reason = "pause_requested") => {
        cancelAnimationFrame(resumeAnimationFrame);
        pauseReasonSet.add(reason);
        if (isWithinResizeObserverTick) {
          if (resizeObserver) {
            debug("size", `[resize observer] stop while "${reason}"`);
            stopResizeObserver();
          }
        } else {
          debug("size", `[resize observer] pause while "${reason}"`);
          // we keep the resize observer alive because we are not in a resize tick
          state = "paused";
        }
        const resume = () => {
          pauseReasonSet.delete(reason);
          if (pauseReasonSet.size > 0) {
            return;
          }
          resumeAnimationFrame = requestAnimationFrame(() => {
            debug("size", `[resize observer] resume after "${reason}"`);
            if (pendingResizeCount) {
              debug(
                "size",
                `[resize observer] was called while paused -> syncContentDimensions()`,
              );
              pendingResizeCount = 0;
              syncContentDimensions();
            }
            if (state === "disconnected") {
              debug(
                "size",
                `[resize observer] was disconnected -> reconnect it`,
              );
              startResizeObserver();
            }
          });
        };
        return resume;
      };
      const stopResizeObserver = () => {
        state = "disconnected";
        if (!resizeObserver) return;
        resizeObserver.disconnect();
        resizeObserver = null;
      };
      const startResizeObserver = () => {
        state = "observing";
        resizeObserver = new ResizeObserver(() => {
          if (!hasSizeTransitions) {
            return;
          }
          if (!slotInfo.hasChild || slotInfo.isContentPhase) {
            debug(
              "size",
              "[resize observer] size change ignored (no child or content-phase)",
            );
            return;
          }
          if (state === "paused") {
            pendingResizeCount++;
            debug("size", "[resize observer] size change ignore (paused)");
            return;
          }
          debug("size", "[resize observer] size change detected");
          isWithinResizeObserverTick = true;
          syncContentDimensions();
          requestAnimationFrame(() => {
            isWithinResizeObserverTick = false;
          });
        });
        resizeObserver.observe(slot);
      };
      startResizeObserver();
      addTeardown(() => {
        stopResizeObserver();
      });
    }

    const measureContentSize = () => [
      getWidthWithoutTransition(slot),
      getHeightWithoutTransition(slot),
    ];
    const syncContentDimensions = () => {
      // check content dimensions to see if they changed and sync them
      const [currentWidth, currentHeight] = measureContentSize();
      updateNaturalContentSize(currentWidth, currentHeight);
      if (sizeTransition) {
        updateToSize(currentWidth, currentHeight);
      } else {
        constrainedWidth = currentWidth;
        constrainedHeight = currentHeight;
      }
    };
    const applySizeConstraintsUntil = (
      width,
      height,
      reason,
      releaseImmediatly = false,
    ) => {
      const hasDiff =
        constrainedWidth !== width || constrainedHeight !== height;
      if (releaseImmediatly && !hasDiff) {
        return null;
      }
      // we want to pause either because we have a diff and don't want to trigger the resize observer
      // or if we have no diff because we're about to do something that would trigger it (transition)
      const resumeResizeObserver = pauseResizeObserver(reason);
      if (hasDiff) {
        debug("size", `Applying size constraints (${reason})`, {
          width: `${constrainedWidth} → ${width}`,
          height: `${constrainedHeight} → ${height}`,
        });
        outerWrapper.style.width = `${width}px`;
        outerWrapper.style.height = `${height}px`;
        constrainedWidth = width;
        constrainedHeight = height;
      }
      // force content overlay to take the right size
      // (this way the content clone is not distorted by the new content size)
      contentOverlay.style.width = `${width}px`;
      contentOverlay.style.height = `${height}px`;
      return (reason) => {
        releaseSizeConstraints(reason);
        resumeResizeObserver(reason);
      };
    };
    const applySizeConstraints = (width, height, reason) => {
      applySizeConstraintsUntil(width, height, reason, true);
    };
    const releaseSizeConstraints = (reason) => {
      debug("size", `Releasing constraints (${reason})`);
      const [beforeWidth, beforeHeight] = measureContentSize();
      outerWrapper.style.width = "";
      outerWrapper.style.height = "";
      const [afterWidth, afterHeight] = measureContentSize();
      debug("size", "Size after release:", {
        width: `${beforeWidth} → ${afterWidth}`,
        height: `${beforeHeight} → ${afterHeight}`,
      });
      constrainedWidth = afterWidth;
      constrainedHeight = afterHeight;
      naturalContentWidth = afterWidth;
      naturalContentHeight = afterHeight;
      contentOverlay.style.width = ``;
      contentOverlay.style.height = ``;
    };
    const updateToSize = (targetWidth, targetHeight) => {
      if (
        constrainedWidth === targetWidth &&
        constrainedHeight === targetHeight
      ) {
        return;
      }
      if (!hasSizeTransitions) {
        applySizeConstraints(
          targetWidth,
          targetHeight,
          "size update without transition",
        );
        return;
      }
      const widthDiff = Math.abs(targetWidth - constrainedWidth);
      const heightDiff = Math.abs(targetHeight - constrainedHeight);
      if (widthDiff <= SIZE_DIFF_EPSILON && heightDiff <= SIZE_DIFF_EPSILON) {
        applySizeConstraints(
          targetWidth,
          targetHeight,
          "skip transition (negligible diff)",
        );
        return;
      }
      const duration = parseInt(
        container.getAttribute("data-size-transition-duration") ||
          SIZE_TRANSITION_DURATION,
      );
      debug("size", "prepare transition:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
        duration,
      });

      const transitions = [];
      if (widthDiff === 0) {
        // nothing to do
      } else if (widthDiff <= SIZE_DIFF_EPSILON) {
        debug(
          "size",
          `Skip width transition (negligible diff ${widthDiff.toFixed(4)}px)`,
        );
      } else {
        transitions.push(
          createWidthTransition(outerWrapper, targetWidth, {
            setup: () =>
              notifyTransition(outerWrapper, {
                modelId: "ui_transition_width",
                canOverflow: true,
                id:
                  targetWidth > constrainedWidth
                    ? "grow_to_new_width"
                    : "shrink_to_new_width",
              }),
            duration,
            onUpdate: ({ value }) => {
              constrainedWidth = value;
            },
          }),
        );
      }
      if (heightDiff === 0) {
        // nothing to do
      } else if (heightDiff <= SIZE_DIFF_EPSILON) {
        debug(
          "size",
          `Skip height transition (negligible diff ${heightDiff.toFixed(4)}px)`,
        );
      } else {
        transitions.push(
          createHeightTransition(outerWrapper, targetHeight, {
            setup: () =>
              notifyTransition(outerWrapper, {
                modelId: "ui_transition_height",
                canOverflow: true,
                id:
                  targetHeight > constrainedHeight
                    ? "grow_to_new_height"
                    : "shrink_to_new_height",
              }),
            duration,
            onUpdate: ({ value }) => {
              constrainedHeight = value;
            },
          }),
        );
      }
      const release = applySizeConstraintsUntil(
        constrainedWidth,
        constrainedHeight,
        "size transitioning",
      );
      sizeTransition = transitionController.animate(transitions, {
        onFinish: () => {
          release("size transition finished");
        },
      });
      sizeTransition.play();
    };
    const updateNaturalContentSize = (width, height) => {
      if (width === naturalContentWidth && height === naturalContentHeight) {
        return;
      }
      debug("size", "Updating natural content size:", {
        width: `${naturalContentWidth} → ${width}`,
        height: `${naturalContentHeight} → ${height}`,
      });
      naturalContentWidth = width;
      naturalContentHeight = height;
    };

    // Initialize with current size
    [constrainedWidth, constrainedHeight] = measureContentSize();

    const updateSizeTransition = () => {
      hasSizeTransitions = container.hasAttribute("data-size-transition");
      const { isContentPhase } = slotInfo;
      const { isInitialPopulationWithoutTransition } = changeInfo;
      debug(
        "size",
        `updateSizeTransition(), current constrained size: ${constrainedWidth.toFixed(2)}x${constrainedHeight.toFixed(2)}`,
      );
      sizeTransition?.cancel();

      // Initial population skip (first null → something): no content or size animations
      if (isInitialPopulationWithoutTransition) {
        const [newWidth, newHeight] = measureContentSize();
        debug("size", `content size measured to: ${newWidth}x${newHeight}`);
        if (isContentPhase) {
          applySizeConstraints(
            newWidth,
            newHeight,
            "content phase initial population",
          );
        } else {
          updateNaturalContentSize(newWidth, newHeight);
          releaseSizeConstraints("initial population - skip transitions");
        }
        return;
      }

      const [newWidth, newHeight] = measureContentSize();
      debug("size", `content size measured to: ${newWidth}x${newHeight}`);
      outerWrapper.style.width = `${constrainedWidth}px`;
      outerWrapper.style.height = `${constrainedHeight}px`;

      // If size transitions are disabled and the new content is smaller,
      // hold the previous size to avoid cropping during the content transition.
      if (!hasSizeTransitions) {
        sizeTransition?.cancel();
        const willShrinkWidth = constrainedWidth > newWidth;
        const willShrinkHeight = constrainedHeight > newHeight;
        const sizeHoldActive = willShrinkWidth || willShrinkHeight;
        if (sizeHoldActive) {
          debug(
            "size",
            `Holding previous size during content transition: ${constrainedWidth}x${constrainedHeight}`,
          );
          applySizeConstraints(
            constrainedWidth,
            constrainedHeight,
            "hold size for content transition",
          );
          onContentTransitionComplete = () => {
            onContentTransitionComplete = null;
            releaseSizeConstraints(
              "content transition completed - release size hold",
            );
          };
        }
        releaseSizeConstraints("size transitions disabled - no size animation");
        return;
      }

      const getTargetDimensions = () => {
        if (!isContentPhase) {
          // Actual content: use its natural dimensions and update our natural content size
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
      if (
        targetWidth === constrainedWidth &&
        targetHeight === constrainedHeight
      ) {
        sizeTransition?.cancel();
        debug("size", "No size change required");
        // no size changes planned; possibly release constraints
        if (!isContentPhase) {
          releaseSizeConstraints("no size change needed");
        }
        return;
      }
      debug("size", "Size change needed:", {
        width: `${constrainedWidth} → ${targetWidth}`,
        height: `${constrainedHeight} → ${targetHeight}`,
      });
      if (isContentPhase) {
        // Content phases (loading/error) always use size constraints for consistent sizing
        updateToSize(targetWidth, targetHeight);
      } else {
        // Actual content: update natural content dimensions for future content phases
        updateNaturalContentSize(targetWidth, targetHeight);
        updateToSize(targetWidth, targetHeight);
      }
    };
    subscribeChange(updateSizeTransition);

    addPauseCallback(() => {
      sizeTransition?.pause();
    });
    addResumeCallback(() => {
      sizeTransition?.play();
    });
    addTeardown(() => {
      sizeTransition?.cancel();
    });
  }

  content_transition: {
    let activeContentTransition = null;
    let activeContentTransitionType = null;
    let activePhaseTransition = null;
    let activePhaseTransitionType = null;

    const updateContentTransitions = () => {
      const { childNodes, contentName: fromContentName } = slotInfo;
      const {
        previousSlotInfo,
        becomesEmpty,
        becomesPopulated,
        shouldDoContentTransition,
        shouldDoPhaseTransition,
        contentChange,
        phaseChange,
        isTransitionLess,
        shouldDoContentTransitionIncludingPopulation,
      } = changeInfo;
      const { hasChild: hadChild, contentName: toContentName } =
        previousSlotInfo;

      const preserveOnlyContentTransition =
        isTransitionLess && activeContentTransition !== null;
      const previousChildNodes = previousSlotInfo.childNodes;

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
      // Content key change detection already computed in getSlotChangeInfo.
      // We rely on the shouldDoContentTransition value coming from changeInfo.

      const decisions = [];
      if (shouldDoContentTransition) decisions.push("CONTENT TRANSITION");
      if (shouldDoPhaseTransition) decisions.push("PHASE TRANSITION");
      if (preserveOnlyContentTransition)
        decisions.push("PRESERVE CONTENT TRANSITION");
      if (decisions.length === 0) decisions.push("NO TRANSITION");

      debug("content", `Decision: ${decisions.join(" + ")}`);
      if (preserveOnlyContentTransition) {
        const progress = (activeContentTransition.progress * 100).toFixed(1);
        debug(
          "content",
          `Preserving existing content transition (progress ${progress}%)`,
        );
      }

      if (changeInfo.isInitialPopulationWithoutTransition) {
        return;
      }

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
            "content",
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
            "content",
            "Continuing with same content transition type (restarting due to actual change)",
          );
          activeContentTransition.cancel();
        } else if (
          activeContentTransition &&
          activeContentTransitionType !== newTransitionType
        ) {
          debug(
            "content",
            "Different content transition type, keeping both",
            `${activeContentTransitionType} → ${newTransitionType}`,
          );
        } else if (activeContentTransition) {
          debug("content", "Cancelling current content transition");
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
            slotInfo,
            attributeToRemove: ["data-content-key"],
          });

        activeContentTransition = applyTransition(
          transitionController,
          setupContentTransition,
          {
            duration,
            type,
            animationProgress,
            isPhaseTransition: false,
            previousSlotInfo,
            slotInfo,
            onComplete: () => {
              activeContentTransition = null;
              activeContentTransitionType = null;
              onContentTransitionComplete?.();
            },
            debug,
          },
        );

        if (activeContentTransition) {
          activeContentTransition.play();
        }
        activeContentTransitionType = type;
      } else if (!shouldDoContentTransition && !preserveOnlyContentTransition) {
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
            "content",
            `Preserving phase transition progress: ${(phaseAnimationProgress * 100).toFixed(1)}%`,
          );
        }

        const canContinueSmoothly =
          activePhaseTransitionType === phaseTransitionType &&
          activePhaseTransition;

        if (canContinueSmoothly) {
          debug("content", "Continuing with same phase transition type");
          activePhaseTransition.cancel();
        } else if (
          activePhaseTransition &&
          activePhaseTransitionType !== phaseTransitionType
        ) {
          debug(
            "content",
            "Different phase transition type, keeping both",
            `${activePhaseTransitionType} → ${phaseTransitionType}`,
          );
        } else if (activePhaseTransition) {
          debug("content", "Cancelling current phase transition");
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
            slotInfo,
            attributeToRemove: ["data-content-key", "data-content-phase"],
          });

        debug(
          "content",
          `Starting transition: ${fromContentName} → ${toContentName}`,
        );

        activePhaseTransition = applyTransition(
          transitionController,
          setupPhaseTransition,
          {
            duration: phaseDuration,
            type: phaseTransitionType,
            animationProgress: phaseAnimationProgress,
            isPhaseTransition: true,
            previousSlotInfo,
            slotInfo,
            onComplete: () => {
              activePhaseTransition = null;
              activePhaseTransitionType = null;
              debug("content", "Phase transition complete");
            },
            debug,
          },
        );

        if (activePhaseTransition) {
          activePhaseTransition.play();
        }
        activePhaseTransitionType = phaseTransitionType;
      }
    };
    subscribeChange(updateContentTransitions);

    addPauseCallback(() => {
      activeContentTransition?.pause();
      activePhaseTransition?.pause();
    });
    addResumeCallback(() => {
      activeContentTransition?.play();
      activePhaseTransition?.play();
    });
    addTeardown(() => {
      activeContentTransition?.cancel();
      activePhaseTransition?.cancel();
    });
  }

  update_transition_running_attribute: {
    const transitionSet = new Set();
    const updateTransitionOverflowAttribute = () => {
      if (transitionSet.size > 0) {
        container.setAttribute("data-transition-running", "");
      } else {
        container.removeAttribute("data-transition-running");
      }
    };
    const onTransitionStart = (event) => {
      transitionSet.add(event.detail.id);
      updateTransitionOverflowAttribute();
    };
    const onTransitionEnd = (event) => {
      transitionSet.delete(event.detail.id);
      updateTransitionOverflowAttribute();
    };
    container.addEventListener("ui_transition_start", onTransitionStart);
    container.addEventListener("ui_transition_end", onTransitionEnd);
    addTeardown(() => {
      container.removeEventListener("ui_transition_start", onTransitionStart);
      container.removeEventListener("ui_transition_end", onTransitionEnd);
    });
  }

  // Run once at init to process current slot content
  triggerChildSlotMutation("init");
  observe_changes: {
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
            attributeName === "data-content-key" ||
            attributeName === "data-content-phase"
          ) {
            reasonParts.push(`[${attributeName}] change`);
          }
        }
      }

      if (reasonParts.length === 0) {
        return;
      }
      const reason = reasonParts.join("+");
      triggerChildSlotMutation(reason);
    });
    mutationObserver.observe(slot, {
      childList: true,
      attributes: true,
      attributeFilter: ["data-content-key", "data-content-phase"],
      characterData: false,
    });
    addTeardown(() => {
      mutationObserver.disconnect();
    });
  }

  return {
    slot,

    cleanup: () => {
      teardown();
    },
    pause: () => {
      if (state.isPaused) {
        return;
      }
      publishPause();
      state.isPaused = true;
    },
    resume: () => {
      if (!state.isPaused) {
        return;
      }
      state.isPaused = false;
      publishResume();
    },
    getState: () => state,
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
    previousSlotInfo,
    slotInfo,
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
  const fromContentKey = previousSlotInfo.contentKeyFormatted;
  const toContentKey = slotInfo.contentKeyFormatted;

  debug("content", "Setting up animation:", {
    type,
    from: fromContentKey,
    to: toContentKey,
    progress: `${(animationProgress * 100).toFixed(1)}%`,
  });

  const remainingDuration = Math.max(100, duration * (1 - animationProgress));
  debug("content", `Animation duration: ${remainingDuration}ms`);

  const transitions = transitionType.apply(oldElement, newElement, {
    duration: remainingDuration,
    startProgress: animationProgress,
    isPhaseTransition,
    debug,
  });

  debug("content", `Created ${transitions.length} transition(s) for animation`);

  if (transitions.length === 0) {
    debug("content", "No transitions to animate, cleaning up immediately");
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
  id: "ui_transition_slide_left",
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
      debug("content", "Slide out to empty:", { from, to });

      return [
        createTranslateXTransition(oldElement, to, {
          setup: () =>
            notifyTransition(newElement, {
              modelId: slideLeft.id,
              canOverflow: true,
              id: "slide_out_old_content",
            }),
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide out progress:", value);
            if (timing === "end") {
              debug("content", "Slide out complete");
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
      debug("content", "Slide in from empty:", { from, to });
      return [
        createTranslateXTransition(newElement, to, {
          setup: () =>
            notifyTransition(newElement, {
              modelId: slideLeft.id,
              canOverflow: true,
              id: "slide_in_new_content",
            }),
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Slide in progress:", value);
            if (timing === "end") {
              debug("content", "Slide in complete");
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
        "content",
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

    debug("content", "Slide transition:", {
      oldContent: `${oldContentPosition} → ${-containerWidth}`,
      newContent: `${effectiveFromPosition} → ${naturalNewPosition}`,
    });

    const transitions = [];

    // Slide old content out
    transitions.push(
      createTranslateXTransition(oldElement, -containerWidth, {
        setup: () =>
          notifyTransition(newElement, {
            modelId: slideLeft.id,
            canOverflow: true,
            id: "slide_out_old_content",
          }),
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
        setup: () =>
          notifyTransition(newElement, {
            modelId: slideLeft.id,
            canOverflow: true,
            id: "slide_in_new_content",
          }),
        from: effectiveFromPosition,
        duration,
        startProgress,
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content slide in:", value);
          if (timing === "end") {
            debug("content", "Slide complete");
          }
        },
      }),
    );

    return transitions;
  },
};

const crossFade = {
  id: "ui_transition_cross_fade",
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
      debug("content", "Fade out to empty:", { from, to });
      return [
        createOpacityTransition(oldElement, to, {
          setup: () =>
            notifyTransition(newElement, {
              modelId: crossFade.id,
              canOverflow: true,
              id: "fade_out_old_content",
            }),
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Content fade out:", value.toFixed(3));
            if (timing === "end") {
              debug("content", "Fade out complete");
            }
          },
        }),
      ];
    }

    if (!oldElement) {
      // Empty -> Content (fade in only)
      const from = 0;
      const to = getOpacityWithoutTransition(newElement);
      debug("content", "Fade in from empty:", { from, to });
      return [
        createOpacityTransition(newElement, to, {
          setup: () =>
            notifyTransition(newElement, {
              modelId: crossFade.id,
              canOverflow: true,
              id: "fade_in_new_content",
            }),
          from,
          duration,
          startProgress,
          onUpdate: ({ value, timing }) => {
            debug("transition_updates", "Fade in progress:", value.toFixed(3));
            if (timing === "end") {
              debug("content", "Fade in complete");
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

    debug("content", "Cross-fade transition:", {
      oldOpacity: `${oldOpacity} → 0`,
      newOpacity: `${effectiveFromOpacity} → ${newNaturalOpacity}`,
      isPhaseTransition,
    });

    return [
      createOpacityTransition(oldElement, 0, {
        setup: () =>
          notifyTransition(newElement, {
            modelId: crossFade.id,
            canOverflow: true,
            id: "fade_out_old_content",
          }),
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
        setup: () =>
          notifyTransition(newElement, {
            modelId: crossFade.id,
            canOverflow: true,
            id: "fade_in_new_content",
          }),
        from: effectiveFromOpacity,
        duration,
        startProgress: isPhaseTransition ? 0 : startProgress, // Phase transitions: new content always starts fresh
        onUpdate: ({ value, timing }) => {
          debug("transition_updates", "New content fade in:", value.toFixed(3));
          if (timing === "end") {
            debug("content", "Cross-fade complete");
          }
        },
      }),
    ];
  },
};

const notifyTransition = (element, detail) => {
  dispatchUITransitionStartCustomEvent(element, detail);
  return () => {
    dispatchUITransitionEndCustomEvent(element, detail);
  };
};
const dispatchUITransitionStartCustomEvent = (element, detail) => {
  const customEvent = new CustomEvent("ui_transition_start", {
    bubbles: true,
    detail,
  });
  element.dispatchEvent(customEvent);
};
const dispatchUITransitionEndCustomEvent = (element, detail) => {
  const customEvent = new CustomEvent("ui_transition_end", {
    bubbles: true,
    detail,
  });
  element.dispatchEvent(customEvent);
};
