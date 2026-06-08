import { useContext } from "preact/hooks";

import { useNextResolver } from "../../resolver/resolver.jsx";
import { InputTextualContext } from "./input_textual_context.js";
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
  if (props.type === "navi_hour") {
    return <InputNaviHour {...props} />;
  }
  return <Next {...props} />;
};

const InputNaviHour = (props) => {
  const digitCount =
    props.max !== undefined ? String(Math.floor(props.max)).length : 2;
  const inputWidth = `${digitCount}ch`;

  if (props.children === undefined) {
    props.children = <InputNaviHourUI />;
  }

  return <Next data-no-spin="" alignX="center" {...props} width={inputWidth} />;
};

const InputNaviHourUI = () => {
  const { id } = useContext(InputTextualContext);

  return <InputRightSlot htmlFor={id}>h</InputRightSlot>;
};
