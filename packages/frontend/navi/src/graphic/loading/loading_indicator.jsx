import { Icon } from "../../text/text.jsx";
import { LoadingDotsSvg } from "./loading_dots_svg.jsx";
import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

/**
 * A loading indicator sized to match the surrounding text (1em × 1em).
 * Inherits color from the current text color by default.
 *
 * @param {"circle"|"dots"} [props.variant="circle"] - Visual style of the indicator
 * @param {string} [props.color="currentColor"] - Color of the indicator; inherits from CSS `color` by default
 *
 * Every other prop goes to the `Icon` it is drawn in: `size` is a font size
 * (the indicator being 1em), `width`/`height` size it as a block.
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
