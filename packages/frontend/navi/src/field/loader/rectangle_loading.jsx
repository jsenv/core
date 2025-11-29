/**
 * RectangleLoading Component
 *
 * A responsive loading indicator that dynamically adjusts to fit its container.
 * Displays an animated outline with a traveling dot that follows the container's shape.
 *
 * Features:
 * - Adapts to any container dimensions using ResizeObserver
 * - Scales stroke width, margins and corner radius proportionally
 * - Animates using native SVG animations for smooth performance
 * - High-quality SVG rendering with proper path calculations
 *
 * @param {Object} props - Component props
 * @param {string} [props.color="#383a36"] - Color of the loading indicator
 * @param {number} [props.radius=0] - Corner radius of the rectangle (px)
 */

import { useLayoutEffect, useRef, useState } from "preact/hooks";

import { useNetworkSpeed } from "./network_speed.js";

import.meta.css = /* css */ `
  .navi_rectangle_loading {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .navi_rectangle_loading[data-visible] {
    opacity: 1;
  }
`;

export const RectangleLoading = ({
  shouldShowSpinner,
  color = "currentColor",
  radius = 0,
  size = 2,
}) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const { width, height } = container.getBoundingClientRect();
    setContainerWidth(width);
    setContainerHeight(height);

    let animationFrameId = null;
    // Create a resize observer to detect changes in the container's dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to debounce updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const [containerEntry] = entries;
        const { width, height } = containerEntry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      });
    });
    resizeObserver.observe(container);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <span
      ref={containerRef}
      className="navi_rectangle_loading"
      data-visible={shouldShowSpinner ? "" : undefined}
    >
      {containerWidth > 0 && containerHeight > 0 && (
        <RectangleLoadingSvg
          radius={radius}
          color={color}
          width={containerWidth}
          height={containerHeight}
          strokeWidth={size}
        />
      )}
    </span>
  );
};

const RectangleLoadingSvg = ({
  width,
  height,
  color,
  radius,
  trailColor = "transparent",
  strokeWidth,
}) => {
  const margin = Math.max(2, Math.min(width, height) * 0.03);

  // Calculate the drawable area
  const drawableWidth = width - margin * 2;
  const drawableHeight = height - margin * 2;

  // ✅ Check if this should be a circle - only if width and height are nearly equal
  const maxPossibleRadius = Math.min(drawableWidth, drawableHeight) / 2;
  const actualRadius = Math.min(
    radius || Math.min(drawableWidth, drawableHeight) * 0.05,
    maxPossibleRadius, // ✅ Limité au radius maximum possible
  );

  const aspectRatio =
    Math.max(drawableWidth, drawableHeight) /
    Math.min(drawableWidth, drawableHeight);
  const isNearlySquare = aspectRatio <= 1.2; // Allow some tolerance for nearly square shapes
  const isCircle = isNearlySquare && actualRadius >= maxPossibleRadius * 0.95;

  let pathLength;
  let rectPath;

  if (isCircle) {
    // ✅ Circle: perimeter = 2πr
    pathLength = 2 * Math.PI * actualRadius;

    // ✅ Circle path centered in the drawable area
    const centerX = margin + drawableWidth / 2;
    const centerY = margin + drawableHeight / 2;

    rectPath = `
      M ${centerX + actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX - actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX + actualRadius},${centerY}
    `;
  } else {
    // ✅ Rectangle: calculate perimeter properly
    const straightEdges =
      2 * (drawableWidth - 2 * actualRadius) +
      2 * (drawableHeight - 2 * actualRadius);
    const cornerArcs = actualRadius > 0 ? 2 * Math.PI * actualRadius : 0;
    pathLength = straightEdges + cornerArcs;

    rectPath = `
      M ${margin + actualRadius},${margin}
      L ${margin + drawableWidth - actualRadius},${margin}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth},${margin + actualRadius}
      L ${margin + drawableWidth},${margin + drawableHeight - actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth - actualRadius},${margin + drawableHeight}
      L ${margin + actualRadius},${margin + drawableHeight}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin},${margin + drawableHeight - actualRadius}
      L ${margin},${margin + actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + actualRadius},${margin}
    `;
  }

  // Fixed segment size in pixels
  const maxSegmentSize = 40;
  const segmentLength = Math.min(maxSegmentSize, pathLength * 0.25);
  const gapLength = pathLength - segmentLength;

  // Vitesse constante en pixels par seconde
  const networkSpeed = useNetworkSpeed();
  const pixelsPerSecond =
    {
      "slow-2g": 40,
      "2g": 60,
      "3g": 80,
      "4g": 120,
    }[networkSpeed] || 80;
  const animationDuration = Math.max(1.5, pathLength / pixelsPerSecond);

  // ✅ Calculate correct offset based on actual segment size
  const segmentRatio = segmentLength / pathLength;
  const circleOffset = -animationDuration * segmentRatio;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style="overflow: visible"
      xmlns="http://www.w3.org/2000/svg"
      shape-rendering="geometricPrecision"
    >
      {/* Base outline - circle ou rectangle */}
      {isCircle ? (
        <circle
          cx={margin + drawableWidth / 2}
          cy={margin + drawableHeight / 2}
          r={actualRadius}
          fill="none"
          stroke={trailColor}
          strokeWidth={strokeWidth}
        />
      ) : (
        <rect
          x={margin}
          y={margin}
          width={drawableWidth}
          height={drawableHeight}
          fill="none"
          stroke={trailColor}
          strokeWidth={strokeWidth}
          rx={actualRadius}
        />
      )}

      {/* Progress segment that grows and moves */}
      <path
        d={rectPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${segmentLength} ${gapLength}`}
        pathLength={pathLength}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={pathLength}
          to="0"
          dur={`${animationDuration}s`}
          repeatCount="indefinite"
          begin="0s"
        />
      </path>

      {/* Leading dot that follows the path */}
      <circle r={strokeWidth} fill={color}>
        <animateMotion
          path={rectPath}
          dur={`${animationDuration}s`}
          repeatCount="indefinite"
          rotate="auto"
          begin={`${circleOffset}s`}
        />
      </circle>
    </svg>
  );
};
