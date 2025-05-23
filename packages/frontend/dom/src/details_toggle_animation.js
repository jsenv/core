import { addAttributeEffect } from "./add_attribute_effect";

export const animateDetails = (details) => {
  const cleanupCallbackSet = new Set();
  const summary = details.querySelector("summary");
  const content = details.querySelector("summary + *");
  let usesDataHeight = details.hasAttribute("data-height");

  let currentAnimation = null;
  let detailsHeight;
  let summaryHeight;
  const updateHeights = () => {
    summaryHeight = summary.getBoundingClientRect().height;
    if (details.open) {
      detailsHeight = usesDataHeight
        ? parseFloat(details.getAttribute("data-height"))
        : details.getBoundingClientRect().height;
    }
  };
  updateHeights();

  update_height_on_data_height_change: {
    const mutationObserver = new MutationObserver(() => {
      usesDataHeight = details.hasAttribute("data-height");
      // If we are using data-height, update the height immediately
      if (usesDataHeight && details.open) {
        detailsHeight = parseFloat(details.getAttribute("data-height"));
        // Only update if not animating to avoid interruptions
        if (!currentAnimation) {
          details.style.height = `${detailsHeight}px`;
        }
      } else if (!usesDataHeight && details.open) {
        // If data-height was removed, recalculate based on content
        updateHeights();
        details.style.height = `${detailsHeight}px`;
      }
    });
    mutationObserver.observe(details, {
      attributes: true,
      attributeFilter: ["data-height"],
    });
  }

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
  update_height_on_content_size_change: {
    const contentResizeObserver = new ResizeObserver(() => {
      if (details.open && !usesDataHeight) {
        detailsHeight = summaryHeight + content.getBoundingClientRect().height;
        requestAnimationFrame(() => {
          details.style.height = `${detailsHeight}px`;
        });
      }
    });
    contentResizeObserver.observe(content);
    cleanupCallbackSet.add(() => {
      contentResizeObserver.disconnect();
    });
  }
  update_heights_on_details_size_change: {
    const detailsResizeObserver = new ResizeObserver(() => {
      if (!currentAnimation) {
        updateHeights();
      }
    });
    detailsResizeObserver.observe(details);
    cleanupCallbackSet.add(() => {
      detailsResizeObserver.disconnect();
    });
  }
  update_height_on_summary_size_change: {
    const summaryResizeObserver = new ResizeObserver(() => {
      updateHeights();
    });
    summaryResizeObserver.observe(summary);
    cleanupCallbackSet.add(() => {
      summaryResizeObserver.disconnect();
    });
  }

  animate_on_toggle: {
    const finalizeAnimation = () => {
      if (details.open) {
        details.style.height = `${detailsHeight}px`;
      } else {
        details.style.height = `${summaryHeight}px`;
      }
      if (currentAnimation) {
        currentAnimation.finish();
        currentAnimation.cancel(); // This removes the animation's effect
        currentAnimation = null;
      }
    };
    const onToggle = (toggleEvent) => {
      usesDataHeight = details.hasAttribute("data-height");
      const isOpening = toggleEvent.newState === "open";

      // If an animation is already running, just reverse it
      if (currentAnimation) {
        const animDuration = currentAnimation.effect.getTiming().duration;
        const currentTime = currentAnimation.currentTime;
        const progress = currentTime / animDuration;
        const now = document.timeline.currentTime;
        const adjustedStartTime = now - (1 - progress) * animDuration;
        currentAnimation.startTime = adjustedStartTime;
        currentAnimation.reverse();
        return;
      }

      if (isOpening) {
        details.style.height = "auto";
        updateHeights();
        details.style.height = `${summaryHeight}px`;
        currentAnimation = details.animate(
          [{ height: `${summaryHeight}px` }, { height: `${detailsHeight}px` }],
          {
            duration: 300, // Shorter duration for better responsiveness
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
            duration: 300,
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
