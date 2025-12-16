export const setupConstraintFeedbackLine = () => {
  const constraintFeedbackLine = createConstraintFeedbackLine();

  // Track last known mouse position for constraint feedback line during scroll
  let lastMouseX = null;
  let lastMouseY = null;

  // Internal function to update constraint feedback line
  const onDrag = (gestureInfo) => {
    const { grabEvent, dragEvent } = gestureInfo;
    if (
      grabEvent.type === "programmatic" ||
      dragEvent.type === "programmatic"
    ) {
      // programmatic drag
      return;
    }

    const mouseX = dragEvent.clientX;
    const mouseY = dragEvent.clientY;
    // Use last known position if current position not available (e.g., during scroll)
    const effectiveMouseX = mouseX !== null ? mouseX : lastMouseX;
    const effectiveMouseY = mouseY !== null ? mouseY : lastMouseY;
    if (effectiveMouseX === null || effectiveMouseY === null) {
      return;
    }

    // Store current mouse position for potential use during scroll
    lastMouseX = mouseX;
    lastMouseY = mouseY;

    const grabClientX = grabEvent.clientX;
    const grabClientY = grabEvent.clientY;

    // Calculate distance between mouse and current grab point
    const deltaX = effectiveMouseX - grabClientX;
    const deltaY = effectiveMouseY - grabClientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    // Show line only when distance is significant (> 20px threshold)
    const threshold = 20;
    if (distance <= threshold) {
      constraintFeedbackLine.style.opacity = "";
      constraintFeedbackLine.removeAttribute("data-visible");
      return;
    }

    // Calculate angle and position
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    // Position line at current grab point (follows element movement)
    constraintFeedbackLine.style.left = `${grabClientX}px`;
    constraintFeedbackLine.style.top = `${grabClientY}px`;
    constraintFeedbackLine.style.width = `${distance}px`;
    constraintFeedbackLine.style.transform = `rotate(${angle}deg)`;
    // Fade in based on distance (more visible as distance increases)
    const maxOpacity = 0.8;
    const opacityFactor = Math.min((distance - threshold) / 100, 1);
    constraintFeedbackLine.style.opacity = `${maxOpacity * opacityFactor}`;
    constraintFeedbackLine.setAttribute("data-visible", "");
  };

  return {
    onDrag,
    onRelease: () => {
      constraintFeedbackLine.remove();
    },
  };
};

const createConstraintFeedbackLine = () => {
  const line = document.createElement("div");
  line.className = "navi_constraint_feedback_line";
  line.title =
    "Constraint feedback - shows distance between mouse and moving grab point";
  document.body.appendChild(line);
  return line;
};

import.meta.css = /* css */ `
  .navi_constraint_feedback_line {
    position: fixed;
    z-index: 9998;
    border-top: 2px dotted rgba(59, 130, 246, 0.7);
    visibility: hidden;
    transform-origin: left center;
    transition: opacity 0.15s ease;
    pointer-events: none;
  }

  .navi_constraint_feedback_line[data-visible] {
    visibility: visible;
  }
`;
