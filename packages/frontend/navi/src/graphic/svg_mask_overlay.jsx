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

import { cloneElement } from "preact";

import.meta.css = /* css */ `
  .svg_mask_content * {
    color: black !important;
    opacity: 1 !important;
    fill: black !important;
    fill-opacity: 1 !important;
    stroke: black !important;
    stroke-opacity: 1 !important;
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

  // Generate unique ID for this instance
  const instanceId = `svgmo-${Math.random().toString(36).slice(2, 9)}`;

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  overlaySvgs.forEach((overlaySvg, index) => {
    const maskId = `mask-${instanceId}-${index}`;
    maskedElement = <g mask={`url(#${maskId})`}>{maskedElement}</g>;
  });

  return (
    <svg viewBox={viewBox} width="100%" height="100%">
      <defs>
        {/* Define masks that respect position */}
        {overlaySvgs.map((overlaySvg, index) => {
          const maskId = `mask-${instanceId}-${index}`;

          // IMPORTANT: clone the overlay SVG exactly as is, just add the mask class
          return (
            <mask id={maskId} key={maskId}>
              {/* White background makes everything visible by default */}
              <rect width="100%" height="100%" fill="white" />

              {/* EXACT CLONE of the overlay SVG */}
              {cloneElement(overlaySvg, {
                className: "svg_mask_content", // Apply styling to make it black
              })}
            </mask>
          );
        })}
      </defs>

      {/* Base SVG with all masks applied */}
      {maskedElement}

      {/* Render all overlays */}
      {overlaySvgs}
    </svg>
  );
};
