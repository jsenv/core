import { addAttributeEffect } from "./add_attribute_effect";

let debug = true;
const DURATION = 300;
const OPEN_EASING = "ease-out";
const CLOSE_EASING = "ease-in";

export const animateDetails = (details, { duration = DURATION } = {}) => {
  const cleanupCallbackSet = new Set();
  const summary = details.querySelector("summary");
  const content = details.querySelector("summary + *");
  let open = false;
  let usesDataHeight;
  let detailsHeightOpened;
  let detailsHeightClosed;
  let summaryHeight;
  let contentHeight;
  const updateHeights = () => {
    open = details.open;
    usesDataHeight = details.hasAttribute("data-height");
    summaryHeight = summary.getBoundingClientRect().height;
    contentHeight = content.getBoundingClientRect().height;
    detailsHeightClosed = summaryHeight;
    detailsHeightOpened = usesDataHeight
      ? parseFloat(details.getAttribute("data-height"))
      : summaryHeight + contentHeight;
  };
  updateHeights();

  const setDetailsHeight = (reason) => {
    const height = details.open ? detailsHeightOpened : detailsHeightClosed;

    if (debug) {
      console.log(`set height to ${height}, reason: ${reason}`);
    }
    details.style.height = `${height}px`;
  };

  let currentAnimation = null;
  const handleSizeChange = (reason) => {
    let previousOpen = open;
    let previousDetailsHeightOpened = detailsHeightOpened;
    let previousDetailsHeightClosed = detailsHeightClosed;
    updateHeights();
    if (
      previousOpen === open &&
      previousDetailsHeightOpened === detailsHeightOpened &&
      previousDetailsHeightClosed === detailsHeightClosed
    ) {
      return;
    }
    if (currentAnimation) {
      updateAnimationTarget();
      return;
    }
    setDetailsHeight(reason);
  };

  const getAnimatedHeight = () => {
    return parseFloat(getComputedStyle(details).height);
  };

  const updateAnimationTarget = ({ resetDuration } = {}) => {
    if (!currentAnimation) {
      return;
    }
    const currentHeight = getAnimatedHeight();
    const targetHeight = details.open
      ? detailsHeightOpened
      : detailsHeightClosed;
    currentAnimation.cancel();
    const newAnimation = details.animate(
      [{ height: `${currentHeight}px` }, { height: `${targetHeight}px` }],
      {
        duration: resetDuration
          ? duration
          : getRemainingDuration(currentAnimation),
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
    setDetailsHeight("animation_finished");
    currentAnimation = null;
  };

  overflow: {
    details.style.overflow = "hidden";
    cleanupCallbackSet.add(() => {
      details.style.overflow = "";
    });
  }
  initial_height: {
    // setting height here is important to avoid the content to be fully displayed
    // when details will open. This ensure that when detail is closed
    // it takes exactly summary height
    if (!details.hasAttribute("data-resize")) {
      setDetailsHeight("initial_height");
    }
    cleanupCallbackSet.add(() => {
      details.style.height = "";
    });
  }
  data_height_change_effects: {
    const mutationObserver = new MutationObserver(() => {
      handleSizeChange("data_height_attribute_change");
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
      const newContentHeight = content.getBoundingClientRect().height;
      if (newContentHeight === contentHeight) {
        // when opening details browser notify the content size has changed
        // but it did not actually change
        // if we don't prevent this the details height will jump to full height because it is opened
        // and open animation did not start yet
        // making the details content flash to full height before animation from 0 to actual height
        return;
      }
      handleSizeChange("content_size_change");
    });
    contentResizeObserver.observe(content);
    cleanupCallbackSet.add(() => {
      contentResizeObserver.disconnect();
    });
  }
  summary_size_change_effects: {
    const summaryResizeObserver = new ResizeObserver(() => {
      handleSizeChange("summary_size_change");
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
          [
            { height: `${detailsHeightClosed}px` },
            { height: `${detailsHeightOpened}px` },
          ],
          {
            duration,
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
        [
          { height: `${detailsHeightOpened}px` },
          { height: `${detailsHeightClosed}px` },
        ],
        {
          duration,
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

addAttributeEffect("data-details-toggle-animation", (details) => {
  const duration = details.getAttribute("data-toggle-animation-duration");
  animateDetails(details, {
    duration: duration ? parseFloat(duration) : undefined,
  });
});
