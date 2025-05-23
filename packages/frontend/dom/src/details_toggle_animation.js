import { addAttributeEffect } from "./add_attribute_effect";

const DURATION = 1000;
const OPEN_EASING = "ease-out";
const CLOSE_EASING = "ease-in";

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
    requestAnimationFrame(() => {
      // when opening details browser notify first of the resize then of the toggle
      // if we set size right away we would shortly display the details in full height
      // while we should let toggle kicks in to gradually increas height
      if (!currentAnimation) {
        details.style.height = `${detailsHeight}px`;
        return;
      }
    });
  };

  const getAnimatedHeight = () => {
    return parseFloat(getComputedStyle(details).height);
  };

  const updateAnimationTarget = ({ resetDuration } = {}) => {
    if (!currentAnimation) {
      console.log("No current animation");
      return;
    }
    const currentHeight = getAnimatedHeight();
    const targetHeight = details.open ? detailsHeight : summaryHeight;
    const duration = resetDuration
      ? DURATION
      : getRemainingDuration(currentAnimation);

    console.log(
      `update animation ${currentHeight} -> ${targetHeight} in ${duration} ms`,
    );

    // Cancel current animation
    currentAnimation.cancel();
    currentAnimation = null;
    // details.style.height = `${currentHeight}px`;
    // details.offsetHeight;
    // Create new animation from current position to updated target
    const newAnimation = details.animate(
      [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
      {
        duration,
        easing: details.open ? OPEN_EASING : CLOSE_EASING,
      },
    );
    currentAnimation = newAnimation;
    currentAnimation.onfinish = () => {
      finalizeAnimation();
      if (currentAnimation === newAnimation) {
        currentAnimation = null;
      }
    };
    currentAnimation.oncancel = () => {
      if (currentAnimation === newAnimation) {
        currentAnimation = null;
      }
    };
  };
  const finalizeAnimation = () => {
    details.style.height = `${detailsHeight}px`;
    currentAnimation = null;
  };

  overflow: {
    details.style.overflow = "hidden";
    cleanupCallbackSet.add(() => {
      details.style.overflow = "";
    });
  }
  initial_height: {
    details.style.height = `${detailsHeight}px`;
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
      updateHeights();
      if (currentAnimation) {
        updateAnimationTarget({ resetDuration: true });
        return;
      }

      if (details.open) {
        const openAnimation = details.animate(
          [{ height: `${summaryHeight}px` }, { height: `${detailsHeight}px` }],
          {
            duration: DURATION,
            easing: OPEN_EASING,
          },
        );
        currentAnimation = openAnimation;
        currentAnimation.onfinish = () => {
          finalizeAnimation();
          if (currentAnimation === openAnimation) {
            currentAnimation = null;
          }
        };
        currentAnimation.oncancel = () => {
          if (currentAnimation === openAnimation) {
            currentAnimation = null;
          }
        };
        return;
      }
      const closeAnimation = details.animate(
        [{ height: `${detailsHeight}px` }, { height: `${summaryHeight}px` }],
        {
          duration: DURATION,
          easing: CLOSE_EASING,
        },
      );
      currentAnimation = closeAnimation;
      currentAnimation.onfinish = () => {
        finalizeAnimation();
        if (currentAnimation === closeAnimation) {
          currentAnimation = null;
        }
      };
      currentAnimation.oncancel = () => {
        if (currentAnimation === closeAnimation) {
          currentAnimation = null;
        }
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

const getRemainingDuration = (animation) => {
  const animDuration = animation.effect.getTiming().duration;
  const currentTime = animation.currentTime || 0;
  const progress = Math.min(currentTime / animDuration, 1);
  const remainingDuration = animDuration * (1 - progress);
  return remainingDuration;
};

addAttributeEffect("data-details-toggle-animate", (details) => {
  animateDetails(details);
});
