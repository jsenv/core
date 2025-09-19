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

export const FontSizedSvg = ({
  width = "1em",
  height = "1em",
  children,
  ...props
}) => {
  return (
    <span
      {...props}
      style={{
        display: "flex",
        alignItems: "center",
        width,
        height,
        justifySelf: "center",
        lineHeight: "1em",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
};
