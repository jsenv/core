/**
 * FontSizedSvg component
 *
 * This component wraps an SVG element to make it inherit the current font size.
 * It creates a container that's exactly 1em × 1em in size, allowing the SVG to scale
 * proportionally with the surrounding text.
 *
 * Usage:
 * ```jsx
 * <FontSizedSvg>
 *   <svg width="100%" height="100%" viewBox="...">
 *     <path d="..." />
 *    </svg>
 * </FontSizedSvg>
 * ```
 *
 * Notes:
 * - The wrapped SVG should use width="100%" and height="100%" to fill the container
 * - This ensures SVG icons match the current text size without additional styling
 * - Useful for inline icons that should respect the parent's font-size
 */

import { Box } from "../layout/box.jsx";

import.meta.css = /* css */ `
  .navi_font_sized_svg {
    display: flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    align-items: center;
    justify-self: center;
    line-height: 1em;
  }
`;

export const FontSizedSvg = ({ children, ...rest }) => {
  return (
    <Box {...rest} as="span" baseClassName="navi_font_sized_svg">
      {children}
    </Box>
  );
};
