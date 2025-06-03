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

export const RectangleLoading = ({ color = "currentColor", radius = 0 }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    let animationFrameId = null;

    // Create a resize observer to detect changes in the container's dimensions
    const resizeObserver = new ResizeObserver((entries) => {
      // Use requestAnimationFrame to debounce updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ width, height });
        }
      });
    });

    resizeObserver.observe(container);

    // Initial measurement
    setDimensions({
      width: container.offsetWidth,
      height: container.offsetHeight,
    });

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style="width: 100%; height: 100%; position: relative;"
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <RectangleLoadingSvg
          radius={radius}
          color={color}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}
    </div>
  );
};

const RectangleLoadingSvg = ({ width, height, color, radius }) => {
  // Calculate stroke width and margins based on container size
  const strokeWidth = Math.max(1, Math.min(width, height) * 0.01);
  const margin = Math.max(2, Math.min(width, height) * 0.03);

  // Calculate the drawable area
  const drawableWidth = width - margin * 2;
  const drawableHeight = height - margin * 2;

  // Calculate corner radius - use the provided radius or a size-based default
  const actualRadius = Math.min(
    radius || Math.min(drawableWidth, drawableHeight) * 0.05,
    Math.min(drawableWidth, drawableHeight) * 0.25, // Cap at 1/4 of the smaller dimension
  );

  // Calculate the perimeter of the rectangle for dash animation
  const pathLength =
    2 * (drawableWidth + drawableHeight) +
    (actualRadius > 0 ? 2 * Math.PI * actualRadius : 0);

  // Starting at top-left corner + radius
  const rectPath = `
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
      {/* Base rectangle outline */}
      <rect
        x={margin}
        y={margin}
        width={drawableWidth}
        height={drawableHeight}
        fill="none"
        stroke="rgba(0,0,0,0.05)"
        strokeWidth={strokeWidth}
        rx={actualRadius}
      />

      {/* Progress segment that grows and moves */}
      <path
        d={rectPath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 2}
        strokeLinecap="round"
        opacity="0.8"
        strokeDasharray={`${pathLength * 0.25} ${pathLength * 0.75}`}
        pathLength={pathLength}
      >
        <animate
          attributeName="stroke-dashoffset"
          from={pathLength}
          to="0"
          dur="1.8s"
          repeatCount="indefinite"
          begin="0s"
        />
      </path>

      {/* Leading dot that follows the path */}
      <circle r={strokeWidth * 1.75} opacity="0.8" fill={color}>
        <animateMotion
          path={rectPath}
          dur="1.8s"
          repeatCount="indefinite"
          rotate="auto"
          begin="-0.45s"
        />
      </circle>
    </svg>
  );
};
