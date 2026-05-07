import { Box } from "../../box/box.jsx";

import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

/**
 * A loading indicator with an explicit size and shape.
 * Renders as a positioned span that the inner fluid indicator adapts to.
 *
 * Use `circle` to render as a circle (sets border-radius to 50%).
 * Color defaults to `currentColor`, so it inherits the surrounding text color.
 *
 * @param {string|number} [props.width] - Width of the indicator
 * @param {string|number} [props.height] - Height of the indicator
 * @param {string} [props.color="currentColor"] - Stroke color
 * @param {boolean} [props.circle] - Render as a circle
 * @param {number} [props.radius] - Corner radius in px (ignored when circle is set)
 * @param {number} [props.size=2] - Stroke width in px
 */
export const LoadingIndicator = ({ circle, ...props }) => {
  return (
    <Box as="span" circle={circle} {...props}>
      <LoadingIndicatorFluid />
    </Box>
  );
};
