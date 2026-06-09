import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { useNextResolver } from "../../resolver/resolver.jsx";
import { InputRightSlot } from "./input_ui_components.jsx";

export const InputNaviHourResolver = (props) => {
  const Next = useNextResolver();

  if (props["navi-input-type"] === "hour") {
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
