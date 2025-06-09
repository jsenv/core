/**
 * SVGComposition Component
 *
 * Creates composite SVGs by combining independent SVG elements with masking.
 *
 * This component solves the challenge of combining independently created SVGs into
 * a single visual composition. Each SVG can have its own coordinate system, viewBox,
 * and styling, allowing for maximum reusability of individual icons or graphics.
 *
 * When overlaying SVGs, each subsequent overlay "cuts out" its portion from the base SVG,
 * creating a seamless integration where SVGs appear to interact with each other visually.
 *
 * Key benefits:
 * - Maintains each SVG's independence - use them individually elsewhere
 * - Handles different viewBox dimensions automatically
 * - Works with any SVG components regardless of internal implementation
 * - Supports unlimited overlay elements
 * - Creates proper masking between elements for visual integration
 *
 * Usage example combining two independent icon components:
 * ```jsx
 * <SVGMaskOverlay viewBox="0 0 24 24">
 *   <DatabaseSvg />
 *   <svg x="12" y="12" width="16" height="16" overflow="visible">
 *     <PlusSvg />
 *   </svg>
 * </SVGMaskOverlay>
 * ```
 *
 * @param {Object} props - Component properties
 * @param {string} props.viewBox - The main viewBox for the composition (required)
 * @param {ReactNode[]} props.children - SVG elements (first is base, rest are overlays)
 * @returns {ReactElement} A composed SVG with all elements properly masked
 */

import { toChildArray } from "preact";

import.meta.css = /* css */ `
  .svg_mark_overlay_group * {
    fill: black !important;
    stroke: black !important;
    fill-opacity: 1 !important;
    stroke-opacity: 1 !important;
    color: black !important;
    opacity: 1 !important;
  }
`;

export const SVGMaskOverlay = ({ viewBox, children }) => {
  if (!Array.isArray(children)) {
    return children;
  }
  if (children.length === 1) {
    return children[0];
  }
  if (!viewBox) {
    console.error("SVGComposition requires an explicit viewBox");
    return null;
  }

  // First SVG is the base, all others are overlays
  const [baseSvg, ...overlaySvgs] = children;

  // Get viewBox from baseSvg
  const baseViewBox = findViewBox(baseSvg);
  if (!baseViewBox) {
    console.error("Could not find viewBox in baseSvg");
    return null;
  }

  // Generate unique ID for this instance
  const instanceId = `svgmo-${Math.random().toString(36).slice(2, 9)}`;

  // Generate masks for each overlay
  const masks = overlaySvgs
    .map((overlaySvg, index) => {
      const overlayViewBox = findViewBox(overlaySvg);
      if (!overlayViewBox) {
        console.error(
          `Could not find viewBox in overlay SVG at index ${index + 1}`,
        );
        return null;
      }

      const overlaySvgProps = overlaySvg.props;
      const overlayPosition = {
        x: parseFloat(overlaySvgProps.x || 0),
        y: parseFloat(overlaySvgProps.y || 0),
        width: parseFloat(overlaySvgProps.width || viewBox.split(" ")[2]),
        height: parseFloat(overlaySvgProps.height || viewBox.split(" ")[3]),
      };

      const maskId = `mask-${instanceId}-${index}`;
      const contentId = `content-${instanceId}-${index}`;
      const secondId = `second-${instanceId}`;

      const [, , overlayWidth, overlayHeight] = overlayViewBox
        .split(" ")
        .map(parseFloat);

      return {
        maskId,
        contentId,
        secondId,
        overlayPosition,
        overlayWidth,
        overlayHeight,
        overlaySvg,
      };
    })
    .filter(Boolean);

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  for (const mask of masks) {
    maskedElement = <g mask={`url(#${mask.maskId})`}>{maskedElement}</g>;
  }

  return (
    <svg viewBox={viewBox} width="100%" height="100%">
      <defs>
        {/* Define masks that respect position */}
        {masks.map((mask) => (
          <>
            <svg id={mask.secondId}>
              <rect width="100%" height="100%" fill="black" />
            </svg>
            <mask id={mask.maskId}>
              {/* White background makes everything visible by default */}
              <rect width="100%" height="100%" fill="white" />

              {/* SOLUTION AMÉLIORÉE: Utiliser une transformation directe au lieu de foreignObject */}
              <svg
                x={mask.overlayPosition.x}
                y={mask.overlayPosition.y}
                width={mask.overlayPosition.width}
                height={mask.overlayPosition.height}
                viewBox={`0 0 ${mask.overlayWidth} ${mask.overlayHeight}`}
                overflow="visible"
                className="svg_mark_overlay_group"
              >
                <use href={`#${mask.secondId}`} />
              </svg>
            </mask>
          </>
        ))}
      </defs>

      {/* Base SVG with all masks applied */}
      {maskedElement}

      {/* Render all overlays */}
      {masks.map((mask) => mask.overlaySvg)}
    </svg>
  );
};

const findViewBox = (element) => {
  if (!element) return null;

  // If it's a function component that returns an SVG
  if (typeof element.type === "function") {
    try {
      // Try to render the component and check its output
      const rendered = element.type(element.props);
      return findViewBox(rendered);
    } catch (e) {
      // Silently fail if render fails
      console.warn("Failed to render component to find viewBox", e);
    }
  }

  // Check if the element itself has a viewBox
  if (element.props && element.props.viewBox) {
    return element.props.viewBox;
  }

  // Check children
  if (element.props && element.props.children) {
    const children = toChildArray(element.props.children);

    // Try to find viewBox in any child
    for (const child of children) {
      const childViewBox = findViewBox(child);
      if (childViewBox) {
        return childViewBox;
      }
    }
  }

  return null;
};
