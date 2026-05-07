import { Icon } from "../../text/icon.jsx";
import { LoadingDotsSvg } from "./loading_dots_svg.jsx";
import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

/**
 * A loading indicator sized to match the surrounding text (1em × 1em).
 * Inherits color from the current text color by default.
 *
 * @param {"circle"|"dots"} [props.variant="circle"] - Visual style of the indicator
 * @param {string} [props.color="currentColor"] - Stroke color (circle variant only)
 * @param {number} [props.size=2] - Stroke width in px (circle variant only)
 */
export const LoadingIndicator = ({ variant = "circle", ...props }) => {
  if (variant === "dots") {
    return (
      <Icon {...props}>
        <LoadingDotsSvg />
      </Icon>
    );
  }
  return (
    <Icon circle {...props}>
      <LoadingIndicatorFluid />
    </Icon>
  );
};
