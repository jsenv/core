import { Box } from "../../box/box.jsx";

import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

/**
 * A loading indicator with an explicit size and shape.
 * Renders as a positioned span that the inner fill indicator adapts to.
 *
 * @param {string|number} [props.width] - Width of the indicator
 * @param {string|number} [props.height] - Height of the indicator
 * @param {string} [props.color="currentColor"] - Stroke color
 * @param {number} [props.radius=0] - Corner radius in px
 * @param {number} [props.size=2] - Stroke width in px
 */
export const LoadingIndicator = (props) => {
  return (
    <Box as="span" {...props}>
      <LoadingIndicatorFluid />
    </Box>
  );
};
