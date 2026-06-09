import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useNextResolver } from "../../resolver/resolver.jsx";
import { InputRightSlot } from "./input_ui_components.jsx";

/**
 * Resolver for type="navi_hour" inputs.
 *
 * Renders a number input with:
 * - no spin buttons (data-no-spin)
 * - a "h" suffix in the right slot
 * - centered text
 * - width sized to fit the max value digits (minimum 1ch)
 */
export const InputNaviHourResolver = (props) => {
  const Next = useNextResolver();
  if (props["navi-input-type"] === "navi_hour") {
    return <InputNaviHour {...props} />;
  }
  return <Next {...props} />;
};

const InputNaviHour = (props) => {
  const Next = useNextResolver();
  const { unit = true } = props;
  let widthDefault;
  if (props.children === undefined) {
    let charCount = 0;
    if (props.max !== undefined) {
      const digitCount = String(Math.floor(props.max)).length;
      charCount += digitCount;
    }
    if (unit) {
      const unitText = naviI18n("time.duration.hour_symbol");
      charCount += unitText.length;
      props.ui = <InputNaviHourUI unitText={unitText} />;
    }
    widthDefault = charCount > 0 ? `${charCount}ch` : undefined;
  }

  return (
    <Next data-no-spin="" alignX="center" width={widthDefault} {...props} />
  );
};

const InputNaviHourUI = ({ unitText }) => {
  return <InputRightSlot>{unitText}</InputRightSlot>;
};
