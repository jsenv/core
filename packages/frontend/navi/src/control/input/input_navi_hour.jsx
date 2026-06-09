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

  return (
    <Next
      alignX="center"
      ui={unit ? <InputNaviHourUI /> : undefined}
      {...props}
    />
  );
};

const InputNaviHourUI = () => {
  const unitText = naviI18n("time.duration.hour_symbol");

  return <InputRightSlot>{unitText}</InputRightSlot>;
};
