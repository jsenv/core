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

// Ensure markers container exists and return it
const getMarkersContainer = () => {
  let container = document.getElementById("navi_debug_markers_container");
  if (!container) {
    container = document.createElement("div");
    container.id = "navi_debug_markers_container";
    container.className = "navi_debug_markers_container";
    document.body.appendChild(container);
  }
  return container;
};

const MARKER_SIZE = 12;

// Convert scrollable-relative coordinates to viewport coordinates for marker positioning
const scrollableToViewportCoords = (x, y, scrollableParent) => {
  const { documentElement } = document;

  if (scrollableParent === documentElement) {
    // For document scrollable parent, scrollable-relative coordinates are already
    // in the correct space for viewport positioning (position: fixed)
    return { x, y };
  }

  // For container scrollable parent, convert from container-relative to viewport
  const scrollableRect = scrollableParent.getBoundingClientRect();
  return {
    x: x + scrollableRect.left,
    y: y + scrollableRect.top,
  };
};

export const setupVisualMarkers = ({ direction, scrollableParent }) => {
  if (!DRAG_DEBUG_MARKERS) {
    return {
      onDrag: () => {},
      onRelease: () => {},
    };
  }

  // Clean up any existing persistent markers from previous drag gestures
  if (KEEP_MARKERS_ON_RELEASE) {
    // Remove any existing markers from previous gestures
    const container = document.getElementById("navi_debug_markers_container");
    if (container) {
      container.innerHTML = ""; // Clear all markers efficiently
    }
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
          const leftCoords = scrollableToViewportCoords(
            visibleArea.left,
            0,
            scrollableParent,
          );
          const rightCoords = scrollableToViewportCoords(
            visibleArea.right,
            0,
            scrollableParent,
          );
          markersToCreate.push({
            name: "visibleAreaLeft",
            x: leftCoords.x,
            y: leftCoords.y,
            color: "0 0 255", // blue
            side: "left",
          });
          markersToCreate.push({
            name: "visibleAreaRight",
            x: rightCoords.x,
            y: rightCoords.y,
            color: "0 128 0", // green
            side: "right",
          });
        }
        if (direction.y) {
          const topCoords = scrollableToViewportCoords(
            0,
            visibleArea.top,
            scrollableParent,
          );
          const bottomCoords = scrollableToViewportCoords(
            0,
            visibleArea.bottom,
            scrollableParent,
          );
          markersToCreate.push({
            name: "visibleAreaTop",
            x: topCoords.x,
            y: topCoords.y,
            color: "255 0 0", // red
            side: "top",
          });
          markersToCreate.push({
            name: "visibleAreaBottom",
            x: bottomCoords.x,
            y: bottomCoords.y,
            color: "255 165 0", // orange
            side: "bottom",
          });
        }
      }

      // Process each constraint individually to preserve names
      for (const constraint of constraints) {
        if (constraint.type === "bounds") {
          const { bounds } = constraint;

          // Create individual markers for each bound with constraint name
          if (direction.x) {
            if (bounds.left !== undefined) {
              const leftCoords = scrollableToViewportCoords(
                bounds.left,
                0,
                scrollableParent,
              );
              markersToCreate.push({
                name: `${constraint.name}.left`,
                x: leftCoords.x,
                y: leftCoords.y,
                color: "128 0 128", // purple
                side: "left",
              });
            }
            if (bounds.right !== undefined) {
              // For visual clarity, show rightBound at the right edge of the element
              // when element is positioned at rightBound (not the left edge position)
              const rightCoords = scrollableToViewportCoords(
                bounds.right + elementWidth,
                0,
                scrollableParent,
              );
              markersToCreate.push({
                name: `${constraint.name}.right`,
                x: rightCoords.x,
                y: rightCoords.y,
                color: "128 0 128", // purple
                side: "right",
              });
            }
          }
          if (direction.y) {
            if (bounds.top !== undefined) {
              const topCoords = scrollableToViewportCoords(
                0,
                bounds.top,
                scrollableParent,
              );
              markersToCreate.push({
                name: `${constraint.name}.top`,
                x: topCoords.x,
                y: topCoords.y,
                color: "128 0 128", // purple
                side: "top",
              });
            }
            if (bounds.bottom !== undefined) {
              // For visual clarity, show bottomBound at the bottom edge of the element
              // when element is positioned at bottomBound (not the left edge position)
              const bottomCoords = scrollableToViewportCoords(
                0,
                bounds.bottom + elementHeight,
                scrollableParent,
              );
              markersToCreate.push({
                name: `${constraint.name}.bottom`,
                x: bottomCoords.x,
                y: bottomCoords.y,
                color: "128 0 128", // purple
                side: "bottom",
              });
            }
          }
        } else if (constraint.type === "obstacle") {
          const obstacleMarker = createObstacleMarker(
            constraint,
            scrollableParent,
          );
          currentConstraintMarkers.push(obstacleMarker);
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

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};
const createObstacleMarker = (obstacleObj, scrollableParent) => {
  const width = obstacleObj.bounds.right - obstacleObj.bounds.left;
  const height = obstacleObj.bounds.bottom - obstacleObj.bounds.top;

  // Convert scrollable-relative coordinates to viewport coordinates
  const topLeftCoords = scrollableToViewportCoords(
    obstacleObj.bounds.left,
    obstacleObj.bounds.top,
    scrollableParent,
  );

  const marker = document.createElement("div");
  marker.className = "navi_obstacle_marker";
  marker.style.left = `${topLeftCoords.x}px`;
  marker.style.top = `${topLeftCoords.y}px`;
  marker.style.width = `${width}px`;
  marker.style.height = `${height}px`;
  marker.title = obstacleObj.name;

  // Add label
  const label = document.createElement("div");
  label.className = "navi_obstacle_marker_label";
  label.textContent = obstacleObj.name;
  marker.appendChild(label);

  const container = getMarkersContainer();
  container.appendChild(marker);
  return marker;
};

import.meta.css = /* css */ `
  .navi_debug_markers_container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    pointer-events: none;
    z-index: 999998;
    --marker-size: ${MARKER_SIZE}px;
  }

  .navi_debug_marker {
    position: absolute;
    pointer-events: none;
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
    color: rgb(from var(--marker-color) r g b / 1);
    border-color: rgb(from var(--marker-color) r g b / 1);
  }

  /* Label positioning based on side data attributes */

  /* Left side markers - vertical with 90° rotation */
  .navi_debug_marker[data-left] .navi_debug_marker_label {
    left: 10px;
    top: 20px;
    transform: rotate(90deg);
    transform-origin: left center;
  }

  /* Right side markers - vertical with -90° rotation */
  .navi_debug_marker[data-right] .navi_debug_marker_label {
    right: 10px;
    left: auto;
    top: 20px;
    transform: rotate(-90deg);
    transform-origin: right center;
  }

  /* Top side markers - horizontal, label on the line */
  .navi_debug_marker[data-top] .navi_debug_marker_label {
    top: 0px;
    left: 20px;
  }

  /* Bottom side markers - horizontal, label on the line */
  .navi_debug_marker[data-bottom] .navi_debug_marker_label {
    bottom: 0px;
    top: auto;
    left: 20px;
  }

  .navi_obstacle_marker {
    position: absolute;
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
