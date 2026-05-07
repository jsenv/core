import { Icon } from "../../text/icon.jsx";
import { LoadingIndicatorFluid } from "./loading_indicator_fluid.jsx";

/**
 * A circular loading indicator sized to match the surrounding text (1em × 1em).
 * Inherits color from the current text color by default.
 *
 * @param {string} [props.color="currentColor"] - Stroke color
 * @param {number} [props.size=2] - Stroke width in px
 */
export const LoadingIndicator = (props) => {
  return (
    <Icon circle {...props}>
      <LoadingIndicatorFluid />
    </Icon>
  );
};
