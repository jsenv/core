import { addAttributeEffect } from "./add_attribute_effect";

const DURATION = 2500;
// const OPEN_EASING = "ease-out";
// const CLOSE_EASING = "ease-in";
const OPEN_EASING = "linear";
const CLOSE_EASING = "linear";

export const animateDetails = (details) => {
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

  const getAnimatedHeight = () => {
    return parseFloat(getComputedStyle(details).height);
  };

  const updateAnimationTarget = () => {
    if (!currentAnimation) {
      return;
    }

    // Create a new animation that starts from current position
    const currentHeight = getAnimatedHeight();
    const targetHeight = details.open ? detailsHeight : summaryHeight;

    console.log(`update animation ${currentHeight} -> ${targetHeight}`);

    // Calculate remaining duration based on progress
    const animDuration = currentAnimation.effect.getTiming().duration;
    const currentTime = currentAnimation.currentTime || 0;
    const progress = Math.min(currentTime / animDuration, 1);
    const remainingDuration = animDuration * (1 - progress);

    // Cancel current animation
    currentAnimation.cancel();
    details.style.height = `${currentHeight}px`;
    details.offsetHeight;

    // Create new animation from current position to updated target
    currentAnimation = details.animate(
      [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
      {
        duration: remainingDuration,
        easing: details.open ? OPEN_EASING : CLOSE_EASING,
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
    currentAnimation = null;
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
    const onToggle = () => {
      if (currentAnimation) {
        updateAnimationTarget();
        return;
      }
      if (details.open) {
        details.style.height = `${summaryHeight}px`;
        details.offsetHeight;
        const openAnimation = details.animate(
          [{ height: `${summaryHeight}px` }, { height: `${detailsHeight}px` }],
          {
            duration: DURATION,
            easing: OPEN_EASING,
          },
        );
        currentAnimation = openAnimation;
        currentAnimation.onfinish = finalizeAnimation;
        currentAnimation.oncancel = () => {
          currentAnimation = null;
        };
        return;
      }
      details.style.height = `${detailsHeight}px`;
      details.offsetHeight;
      const closeAnimation = details.animate(
        [{ height: `${detailsHeight}px` }, { height: `${summaryHeight}px` }],
        {
          duration: DURATION,
          easing: CLOSE_EASING,
        },
      );
      currentAnimation = closeAnimation;
      currentAnimation.onfinish = finalizeAnimation;
      currentAnimation.oncancel = () => {
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

addAttributeEffect("data-details-toggle-animate", (details) => {
  animateDetails(details);
});
