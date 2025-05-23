export const animateDetails = (details) => {
  const summary = details.querySelector("summary");
  const content = details.querySelector("summary + *");

  const contentResizeObserver = new ResizeObserver(() => {
    if (details.open) {
      detailsHeight = summaryHeight + content.getBoundingClientRect().height;
      requestAnimationFrame(() => {
        details.style.height = `${detailsHeight}px`;
      });
    }
  });
  contentResizeObserver.observe(content);

  let detailsHeight;
  let summaryHeight;
  const updateHeights = () => {
    summaryHeight = summary.getBoundingClientRect().height;
    if (details.open) {
      detailsHeight = details.getBoundingClientRect().height;
    }
  };
  updateHeights();

  details.style.overflow = "hidden";
  if (details.open) {
    details.style.height = `${detailsHeight}px`;
  } else {
    details.style.height = `${summaryHeight}px`;
  }

  let currentAnimation = null;
  const detailsResizeObserver = new ResizeObserver(() => {
    if (!currentAnimation) {
      updateHeights();
    }
  });
  detailsResizeObserver.observe(details);
  const summaryResizeObserver = new ResizeObserver(() => {
    updateHeights();
  });
  summaryResizeObserver.observe(summary);

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

  details.ontoggle = (toggleEvent) => {
    const isOpening = toggleEvent.newState === "open";

    // If an animation is already running, just reverse it
    if (currentAnimation) {
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

  return () => {
    contentResizeObserver.disconnect();
    detailsResizeObserver.disconnect();
    summaryResizeObserver.disconnect();
    details.ontoggle = null;
    if (currentAnimation) {
      currentAnimation.cancel();
      currentAnimation = null;
    }
    details.style.overflow = "";
    details.style.height = "";
  };
};
