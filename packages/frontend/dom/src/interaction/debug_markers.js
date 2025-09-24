export let DRAG_DEBUG_MARKERS = true;
export const enableDebugMarkers = () => {
  DRAG_DEBUG_MARKERS = true;
};
export const disableDebugMarkers = () => {
  DRAG_DEBUG_MARKERS = false;
};

// Keep visual markers (debug markers, obstacle markers, constraint feedback line) in DOM after drag ends
// Useful for debugging constraint systems and understanding why elements behave certain ways
// When enabled, markers persist until next drag gesture starts or page is refreshed
const KEEP_MARKERS_ON_RELEASE = true;

let currentDebugMarkers = [];
let currentConstraintMarkers = [];

export const setupVisualMarkers = ({ direction, positionedParent }) => {
  if (!DRAG_DEBUG_MARKERS) {
    return {
      onDrag: () => {},
      onRelease: () => {},
    };
  }

  // Clean up any existing persistent markers from previous drag gestures
  if (KEEP_MARKERS_ON_RELEASE) {
    // Remove any existing markers from previous gestures
    document
      .querySelectorAll(".navi_debug_marker, .navi_obstacle_marker")
      .forEach((marker) => marker.remove());
  }

  return {
    onDrag: ({ constraints, visibleArea, elementWidth, elementHeight }) => {
      // Schedule removal of previous markers if they exist
      const previousDebugMarkers = [...currentDebugMarkers];
      const previousConstraintMarkers = [...currentConstraintMarkers];

      if (
        previousDebugMarkers.length > 0 ||
        previousConstraintMarkers.length > 0
      ) {
        setTimeout(() => {
          previousDebugMarkers.forEach((marker) => marker.remove());
          previousConstraintMarkers.forEach((marker) => marker.remove());
        }, 100);
      }

      // Clear current marker arrays
      currentDebugMarkers.length = 0;
      currentConstraintMarkers.length = 0;

      visible_area_markers: {
        if (direction.x) {
          currentDebugMarkers.push(
            createDebugMarker({
              name: "visibleAreaLeft",
              x: visibleArea.left,
              y: 0,
              color: "blue",
              orientation: "vertical",
            }),
          );
          currentDebugMarkers.push(
            createDebugMarker({
              name: "visibleAreaRight",
              x: visibleArea.right,
              y: 0,
              color: "green",
              orientation: "vertical",
            }),
          );
        }
        if (direction.y) {
          currentDebugMarkers.push(
            createDebugMarker({
              name: "visibleAreaTop",
              x: 0,
              y: visibleArea.top,
              color: "red",
              orientation: "horizontal",
            }),
          );
          currentDebugMarkers.push(
            createDebugMarker({
              name: "visibleAreaBottom",
              x: 0,
              y: visibleArea.bottom,
              color: "orange",
              orientation: "horizontal",
            }),
          );
        }
      }

      // Create dynamic constraint markers based on current element size
      const parentRect = positionedParent.getBoundingClientRect();

      // For debug markers, we'll show bounds constraints and obstacle zones
      let leftBound = 0;
      let topBound = 0;
      let rightBound = Infinity;
      let bottomBound = Infinity;
      // Extract bounds from bounds constraints and collect obstacle data
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          leftBound = Math.max(leftBound, constraint.left);
          topBound = Math.max(topBound, constraint.top);
          rightBound = Math.min(rightBound, constraint.right);
          bottomBound = Math.min(bottomBound, constraint.bottom);
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(constraint, parentRect);
          currentConstraintMarkers.push(obstacleMarker);
        }
      }

      bound_markers: {
        if (direction.x) {
          if (leftBound > 0) {
            const leftBoundViewport = parentRect.left + leftBound;
            currentConstraintMarkers.push(
              createDebugMarker({
                name: "leftBound",
                x: leftBoundViewport,
                y: 0,
                color: "red",
                orientation: "vertical",
              }),
            );
          }
          if (rightBound !== Infinity) {
            // For visual clarity, show rightBound at the right edge of the element
            // when element is positioned at rightBound (not the left edge position)
            const rightBoundViewport =
              parentRect.left + rightBound + elementWidth;
            currentConstraintMarkers.push(
              createDebugMarker({
                name: "rightBound",
                x: rightBoundViewport,
                y: 0,
                color: "red",
                orientation: "vertical",
              }),
            );
          }
        }
        if (direction.y) {
          if (topBound > 0) {
            const topBoundViewport = parentRect.top + topBound;
            currentConstraintMarkers.push(
              createDebugMarker({
                name: "topBound",
                x: 0,
                y: topBoundViewport,
                color: "red",
                orientation: "horizontal",
              }),
            );
          }
          if (bottomBound !== Infinity) {
            // For visual clarity, show bottomBound at the bottom edge of the element
            // when element is positioned at bottomBound (not the top edge position)
            const bottomBoundViewport =
              parentRect.top + bottomBound + elementHeight;
            currentConstraintMarkers.push(
              createDebugMarker({
                name: "bottomBound",
                x: 0,
                y: bottomBoundViewport,
                color: "red",
                orientation: "horizontal",
              }),
            );
          }
        }
      }
    },
    onRelease: () => {
      if (KEEP_MARKERS_ON_RELEASE) {
        return;
      }

      currentDebugMarkers.forEach((marker) => {
        marker.remove();
      });
      currentConstraintMarkers.forEach((marker) => {
        marker.remove();
      });
      currentDebugMarkers = [];
      currentConstraintMarkers = [];
    },
  };
};

const createDebugMarker = ({
  name,
  x,
  y,
  color = "red",
  orientation = "vertical",
}) => {
  const marker = document.createElement("div");
  marker.className = `navi_debug_marker navi_debug_marker--${orientation} navi_debug_marker--${color}`;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label navi_debug_marker_label--${color}`;
  label.textContent = name;
  marker.appendChild(label);

  document.body.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, parentRect) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;
  const left = parentRect.left + obstacleObj.bounds.left;
  const top = parentRect.top + obstacleObj.bounds.top;

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${left}px`;
  marker.style.top = `${top}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);

  document.body.appendChild(marker);
  return marker;
};

import.meta.css = /* css */ `
  .navi_debug_marker {
    position: fixed;
    width: 2px;
    height: 100vh;
    z-index: 999999;
    pointer-events: none;
    opacity: 0.5;
  }

  .navi_debug_marker--vertical {
    width: 2px;
    height: 100vh;
  }

  .navi_debug_marker--horizontal {
    width: 100vw;
    height: 2px;
  }

  .navi_debug_marker--red {
    background-color: red;
  }

  .navi_debug_marker--blue {
    background-color: blue;
  }

  .navi_debug_marker--green {
    background-color: green;
  }

  .navi_debug_marker--orange {
    background-color: orange;
  }

  .navi_debug_marker--purple {
    background-color: purple;
  }

  .navi_debug_marker_label {
    position: absolute;
    top: 10px;
    left: 5px;
    font-size: 12px;
    font-weight: bold;
    text-shadow: 1px 1px 1px rgba(255, 255, 255, 0.8);
    pointer-events: none;
  }

  .navi_debug_marker_label--red {
    color: red;
  }

  .navi_debug_marker_label--blue {
    color: blue;
  }

  .navi_debug_marker_label--green {
    color: green;
  }

  .navi_debug_marker_label--orange {
    color: orange;
  }

  .navi_debug_marker_label--purple {
    color: purple;
  }

  .navi_obstacle_marker {
    position: fixed;
    background-color: orange;
    opacity: 0.6;
    z-index: 9999;
    pointer-events: none;
  }

  .navi_obstacle_marker_label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: bold;
    color: white;
    text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }
`;
