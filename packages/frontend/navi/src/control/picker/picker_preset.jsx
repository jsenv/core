import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { PickerNaviMinute } from "./preset/picker_navi_minute.jsx";
import { PickerNaviTime } from "./preset/picker_navi_time.jsx";

export const PickerPresetResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "navi_time") {
    return <PickerNaviTime {...props} />;
  }
  if (props.type === "navi_minute") {
    return <PickerNaviMinute {...props} />;
  }
  return <Next {...props} />;
};
