import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useNextResolver } from "../../resolver/resolver.jsx";
import { InputUnitSlot } from "./input_ui_components.jsx";

export const InputNaviMinuteResolver = (props) => {
  const Next = useNextResolver();

  if (props["navi-input-type"] === "minute") {
    return <InputNaviMinute {...props} />;
  }
  return <Next {...props} />;
};

const InputNaviMinute = (props) => {
  const Next = useNextResolver();
  const { unit = true } = props;

  return (
    <Next
      alignX="center"
      ui={unit ? <InputNaviMinuteUI /> : undefined}
      {...props}
    />
  );
};

const InputNaviMinuteUI = () => {
  const unitText = naviI18n("time.duration.minute_symbol");

  return <InputUnitSlot>{unitText}</InputUnitSlot>;
};
