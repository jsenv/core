import { addAttributeEffect } from "./add_attribute_effect";

export const animateDetails = (details) => {
  const duration = 1500;
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

    console.log("update target");

    // Get fresh height measurements
    updateHeights();

    // Create a new animation that starts from current position
    const currentHeight = getAnimatedHeight(details, currentAnimation);
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
      details.style.height = `${detailsHeight}px`;
    } else {
      details.style.height = `${summaryHeight}px`;
    }
    if (currentAnimation) {
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
    const getAnimation = () => {
      if (currentAnimation) {
        const animatedHeight = getAnimatedHeight(details, currentAnimation);
        const targetHeight = details.open ? detailsHeight : summaryHeight;

        console.log("animate from", animatedHeight, "to", targetHeight);
        details.style.height = `${animatedHeight}px`;
        currentAnimation.cancel();

        // Create new animation from current position to new target
        const reverseAnimation = details.animate(
          [{ height: `${animatedHeight}px` }, { height: `${targetHeight}px` }],
          {
            duration,
            easing: details.open ? "ease-out" : "ease-in",
          },
        );
        return reverseAnimation;
      }

      if (details.open) {
        details.style.height = `${summaryHeight}px`;
        const openAnimation = details.animate(
          [{ height: `${summaryHeight}px` }, { height: `${detailsHeight}px` }],
          {
            duration,
            easing: "ease-out",
          },
        );
        return openAnimation;
      }

      details.style.height = `${detailsHeight}px`;
      const closeAnimation = details.animate(
        [{ height: `${detailsHeight}px` }, { height: `${summaryHeight}px` }],
        {
          duration,
          easing: "ease-in",
        },
      );
      return closeAnimation;
    };

    const onToggle = () => {
      const newAnimation = getAnimation();
      currentAnimation = newAnimation;
      newAnimation.onfinish = finalizeAnimation;
      newAnimation.oncancel = () => {
        currentAnimation = null;
      };
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

const getAnimatedHeight = (element, animation) => {
  try {
    // Get the height from the animation's current value
    const currentEffect = animation.effect;
    if (
      currentEffect &&
      typeof currentEffect.getComputedTiming === "function"
    ) {
      const computedTiming = currentEffect.getComputedTiming();
      const progress = computedTiming.progress || 0;

      // Get keyframes to interpolate between them
      const keyframes = animation.effect.getKeyframes();
      if (keyframes && keyframes.length >= 2) {
        const fromHeight = parseFloat(keyframes[0].height);
        const toHeight = parseFloat(keyframes[1].height);
        // Interpolate based on progress
        const animatedHeight = fromHeight + (toHeight - fromHeight) * progress;
        return animatedHeight;
      }
    }
  } catch (e) {
    // Fallback if the Animation API methods fail
    console.warn("Could not get animation progress, using fallback", e);
  }
  return parseFloat(getComputedStyle(element).height);
};

addAttributeEffect("data-details-toggle-animate", (details) => {
  animateDetails(details);
});
