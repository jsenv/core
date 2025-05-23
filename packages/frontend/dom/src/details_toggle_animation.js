import { addAttributeEffect } from "./add_attribute_effect";

export const animateDetails = (details) => {
  const duration = 3000;
  const cleanupCallbackSet = new Set();
  const summary = details.querySelector("summary");
  const content = details.querySelector("summary + *");
  let usesDataHeight;
  let detailsHeight;
  let summaryHeight;
  let contentHeight;
  const updateHeights = () => {
    usesDataHeight = details.hasAttribute("data-height");
    summaryHeight = summary.getBoundingClientRect().height;
    contentHeight = content.getBoundingClientRect().height;
    if (details.open) {
      detailsHeight = usesDataHeight
        ? parseFloat(details.getAttribute("data-height"))
        : summaryHeight + contentHeight;
    } else {
      detailsHeight = summaryHeight;
    }
  };
  updateHeights();

  let currentAnimation = null;
  const handleSizeChange = () => {
    const oldDetailsHeight = detailsHeight;
    updateHeights();
    if (detailsHeight === oldDetailsHeight) {
      return;
    }
    if (currentAnimation) {
      updateAnimationTarget();
      return;
    }
    details.style.height = details.open
      ? `${detailsHeight}px`
      : `${summaryHeight}px`;
  };
  const updateAnimationTarget = () => {
    if (!currentAnimation) return;

    // Get fresh height measurements
    updateHeights();

    // Create a new animation that starts from current position
    const currentHeight = parseFloat(getComputedStyle(details).height);
    const targetHeight = details.open ? detailsHeight : summaryHeight;

    // Calculate remaining duration based on progress
    const animDuration = currentAnimation.effect.getTiming().duration;
    const currentTime = currentAnimation.currentTime || 0;
    const progress = Math.min(currentTime / animDuration, 1);
    const remainingDuration = animDuration * (1 - progress);

    // Cancel current animation
    currentAnimation.cancel();

    // Create new animation from current position to updated target
    currentAnimation = details.animate(
      [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
      {
        duration: remainingDuration,
        easing: details.open ? "ease-out" : "ease-in",
      },
    );

    currentAnimation.onfinish = finalizeAnimation;
    currentAnimation.oncancel = () => {
      currentAnimation = null;
    };
  };
  const finalizeAnimation = () => {
    if (details.open) {
      // Before setting final height, update to get latest measurements
      updateHeights();
      details.style.height = `${detailsHeight}px`;
    } else {
      details.style.height = `${summaryHeight}px`;
    }
    if (currentAnimation) {
      currentAnimation.finish();
      currentAnimation.cancel();
      currentAnimation = null;
    }
  };

  overflow: {
    details.style.overflow = "hidden";
    cleanupCallbackSet.add(() => {
      details.style.overflow = "";
    });
  }
  initial_height: {
    if (details.open) {
      details.style.height = `${detailsHeight}px`;
    } else {
      details.style.height = `${summaryHeight}px`;
    }
    cleanupCallbackSet.add(() => {
      details.style.height = "";
    });
  }
  data_height_change_effects: {
    const mutationObserver = new MutationObserver(() => {
      handleSizeChange();
    });
    mutationObserver.observe(details, {
      attributes: true,
      attributeFilter: ["data-height"],
    });
    cleanupCallbackSet.add(() => {
      mutationObserver.disconnect();
    });
  }
  content_size_change_effects: {
    const contentResizeObserver = new ResizeObserver(() => {
      if (usesDataHeight) {
        return;
      }
      handleSizeChange();
    });
    contentResizeObserver.observe(content);
    cleanupCallbackSet.add(() => {
      contentResizeObserver.disconnect();
    });
  }
  summary_size_change_effects: {
    const summaryResizeObserver = new ResizeObserver(() => {
      handleSizeChange();
    });
    summaryResizeObserver.observe(summary);
    cleanupCallbackSet.add(() => {
      summaryResizeObserver.disconnect();
    });
  }

  animate_on_toggle: {
    const onToggle = (toggleEvent) => {
      const isOpening = toggleEvent.newState === "open";

      // If an animation is already running, just reverse it
      if (currentAnimation) {
        // Get the current animated height using the Animation API
        let currentHeight;

        try {
          // Get the height from the animation's current value
          const currentEffect = currentAnimation.effect;
          if (
            currentEffect &&
            typeof currentEffect.getComputedTiming === "function"
          ) {
            const computedTiming = currentEffect.getComputedTiming();
            const progress = computedTiming.progress || 0;

            // Get keyframes to interpolate between them
            const keyframes = currentAnimation.effect.getKeyframes();
            if (keyframes && keyframes.length >= 2) {
              const fromHeight = parseFloat(keyframes[0].height);
              const toHeight = parseFloat(keyframes[1].height);
              // Interpolate based on progress
              currentHeight = fromHeight + (toHeight - fromHeight) * progress;
            }
          }
        } catch (e) {
          // Fallback if the Animation API methods fail
          console.warn("Could not get animation progress, using fallback", e);
        }

        // If we couldn't get it from the animation, fall back to computed style
        if (!currentHeight || isNaN(currentHeight)) {
          currentHeight = parseFloat(getComputedStyle(details).height);
        }

        // Determine target height based on new state
        const targetHeight = isOpening ? detailsHeight : summaryHeight;

        // Cancel existing animation
        currentAnimation.cancel();
        currentAnimation = null;
        details.style.height = `${currentHeight}px`;

        // Create new animation from current position to new target
        currentAnimation = details.animate(
          [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
          {
            duration,
            easing: isOpening ? "ease-out" : "ease-in",
          },
        );

        currentAnimation.onfinish = finalizeAnimation;
        currentAnimation.oncancel = () => {
          currentAnimation = null;
        };
        return;
      }

      if (isOpening) {
        details.style.height = "auto";
        updateHeights();
        details.style.height = `${summaryHeight}px`;
        currentAnimation = details.animate(
          [{ height: `${summaryHeight}px` }, { height: `${detailsHeight}px` }],
          {
            duration,
            easing: "ease-out",
          },
        );
        currentAnimation.onfinish = finalizeAnimation;
        currentAnimation.oncancel = () => {
          currentAnimation = null;
        };
      } else {
        details.style.height = `${detailsHeight}px`;
        currentAnimation = details.animate(
          [{ height: `${detailsHeight}px` }, { height: `${summaryHeight}px` }],
          {
            duration,
            easing: "ease-in",
          },
        );
        currentAnimation.onfinish = finalizeAnimation;
        currentAnimation.oncancel = () => {
          currentAnimation = null;
        };
      }
    };

    details.addEventListener("toggle", onToggle);
    cleanupCallbackSet.add(() => {
      details.removeEventListener("toggle", onToggle);
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }
  };
};

addAttributeEffect("data-details-toggle-animate", (details) => {
  animateDetails(details);
});
