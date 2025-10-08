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

const MARKER_SIZE = 12;

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

      // Collect all markers to be created, then merge duplicates
      const markersToCreate = [];

      visible_area_markers: {
        if (direction.x) {
          markersToCreate.push({
            name: "visibleAreaLeft",
            x: visibleArea.left,
            y: 0,
            color: "0 0 255", // blue
            side: "left",
          });
          markersToCreate.push({
            name: "visibleAreaRight",
            x: visibleArea.right,
            y: 0,
            color: "0 128 0", // green
            side: "right",
          });
        }
        if (direction.y) {
          markersToCreate.push({
            name: "visibleAreaTop",
            x: 0,
            y: visibleArea.top,
            color: "255 0 0", // red
            side: "top",
          });
          markersToCreate.push({
            name: "visibleAreaBottom",
            x: 0,
            y: visibleArea.bottom,
            color: "255 165 0", // orange
            side: "bottom",
          });
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
          const { bounds } = constraint;
          leftBound = Math.max(leftBound, bounds.left);
          topBound = Math.max(topBound, bounds.top);
          rightBound = Math.min(rightBound, bounds.right);
          bottomBound = Math.min(bottomBound, bounds.bottom);
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(constraint, parentRect);
          currentConstraintMarkers.push(obstacleMarker);
        }
      }

      bound_markers: {
        if (direction.x) {
          if (leftBound > 0) {
            const leftBoundViewport = parentRect.left + leftBound;
            markersToCreate.push({
              name: "leftBound",
              x: leftBoundViewport,
              y: 0,
              color: "128 0 128", // purple
              side: "left",
            });
          }
          if (rightBound !== Infinity) {
            // For visual clarity, show rightBound at the right edge of the element
            // when element is positioned at rightBound (not the left edge position)
            const rightBoundViewport =
              parentRect.left + rightBound + elementWidth;
            markersToCreate.push({
              name: "rightBound",
              x: rightBoundViewport,
              y: 0,
              color: "128 0 128", // purple
              side: "right",
            });
          }
        }
        if (direction.y) {
          if (topBound > 0) {
            const topBoundViewport = parentRect.top + topBound;
            markersToCreate.push({
              name: "topBound",
              x: 0,
              y: topBoundViewport,
              color: "128 0 128", // purple
              side: "top",
            });
          }
          if (bottomBound !== Infinity) {
            // For visual clarity, show bottomBound at the bottom edge of the element
            // when element is positioned at bottomBound (not the left edge position)
            const bottomBoundViewport =
              parentRect.top + bottomBound + elementHeight;
            markersToCreate.push({
              name: "bottomBound",
              x: 0,
              y: bottomBoundViewport,
              color: "128 0 128", // purple
              side: "bottom",
            });
          }
        }
      }

      // Create markers with merging for overlapping positions
      const createdMarkers = createMergedMarkers(markersToCreate);
      currentDebugMarkers.push(
        ...createdMarkers.filter((m) => m.type !== "constraint"),
      );
      currentConstraintMarkers.push(
        ...createdMarkers.filter((m) => m.type === "constraint"),
      );
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

const createMergedMarkers = (markersToCreate) => {
  const mergedMarkers = [];
  const positionMap = new Map();

  // Group markers by position and side
  for (const marker of markersToCreate) {
    const key = `${marker.x},${marker.y},${marker.side}`;

    if (!positionMap.has(key)) {
      positionMap.set(key, []);
    }
    positionMap.get(key).push(marker);
  }

  // Create markers with merged labels for overlapping positions
  for (const [, markers] of positionMap) {
    if (markers.length === 1) {
      // Single marker - create as normal
      const marker = markers[0];
      const domMarker = createDebugMarker(marker);
      domMarker.type = marker.name.includes("Bound") ? "constraint" : "visible";
      mergedMarkers.push(domMarker);
    } else {
      // Multiple markers at same position - merge labels
      const firstMarker = markers[0];
      const combinedName = markers.map((m) => m.name).join(" + ");

      // Use the first marker's color, or mix colors if needed
      const domMarker = createDebugMarker({
        ...firstMarker,
        name: combinedName,
      });
      domMarker.type = markers.some((m) => m.name.includes("Bound"))
        ? "constraint"
        : "visible";
      mergedMarkers.push(domMarker);
    }
  }

  return mergedMarkers;
};

const createDebugMarker = ({ name, x, y, color = "255 0 0", side }) => {
  const marker = document.createElement("div");
  marker.className = `navi_debug_marker`;
  marker.setAttribute(`data-${side}`, "");
  // Set the color as a CSS custom property
  marker.style.setProperty("--marker-color", `rgb(${color})`);
  // Position markers exactly at the boundary coordinates
  marker.style.left = side === "right" ? `${x - MARKER_SIZE}px` : `${x}px`;
  marker.style.top = side === "bottom" ? `${y - MARKER_SIZE}px` : `${y}px`;
  marker.title = name;

  // Add label
  const label = document.createElement("div");
  label.className = `navi_debug_marker_label`;
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
    z-index: 999999;
    pointer-events: none;

    --marker-size: ${MARKER_SIZE}px;
  }

  .navi_debug_marker--vertical {
    width: var(--marker-size);
    height: 100vh;
  }

  .navi_debug_marker--horizontal {
    width: var(--marker-size);
    height: 100vh;
  }

  /* Markers based on side rather than orientation */
  .navi_debug_marker[data-left],
  .navi_debug_marker[data-right] {
    width: var(--marker-size);
    height: 100vh;
  }

  .navi_debug_marker[data-top],
  .navi_debug_marker[data-bottom] {
    width: 100vw;
    height: var(--marker-size);
  }

  /* Gradient directions based on side, using CSS custom properties for color */
  .navi_debug_marker[data-left] {
    background: linear-gradient(
      to right,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-right] {
    background: linear-gradient(
      to left,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-top] {
    background: linear-gradient(
      to bottom,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  .navi_debug_marker[data-bottom] {
    background: linear-gradient(
      to top,
      rgba(from var(--marker-color) r g b / 0.9) 0%,
      rgba(from var(--marker-color) r g b / 0.7) 30%,
      rgba(from var(--marker-color) r g b / 0.3) 70%,
      rgba(from var(--marker-color) r g b / 0) 100%
    );
  }

  /* Bounds markers - solid color for constraints */
  .navi_debug_marker--purple {
    background-color: purple;
    opacity: 0.8;
  }

  .navi_debug_marker_label {
    position: absolute;
    font-size: 12px;
    font-weight: bold;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 3px;
    border: 1px solid;
    white-space: nowrap;
    pointer-events: none;
  }

  /* Label positioning based on side data attributes */

  /* Left side markers - vertical with 90° rotation */
  .navi_debug_marker[data-left] .navi_debug_marker_label {
    left: 10px; /* Exactly on the line */
    top: 20px; /* Small offset from top */
    transform: rotate(90deg);
    transform-origin: left center;
  }

  /* Right side markers - vertical with -90° rotation */
  .navi_debug_marker[data-right] .navi_debug_marker_label {
    right: 10px; /* Exactly on the line */
    left: auto;
    top: 20px; /* Small offset from top */
    transform: rotate(-90deg);
    transform-origin: right center;
  }

  /* Top side markers - horizontal, label on the line */
  .navi_debug_marker[data-top] .navi_debug_marker_label {
    top: 0px; /* Exactly on the line */
    left: 20px; /* Small offset from left edge */
  }

  /* Bottom side markers - horizontal, label on the line */
  .navi_debug_marker[data-bottom] .navi_debug_marker_label {
    bottom: 0px; /* Exactly on the line */
    top: auto;
    left: 20px; /* Small offset from left edge */
  }

  .navi_debug_marker_label {
    color: rgb(from var(--marker-color) r g b / 1);
    border-color: rgb(from var(--marker-color) r g b / 1);
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
