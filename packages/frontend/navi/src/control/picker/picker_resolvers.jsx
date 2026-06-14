import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { PickerCustom } from "./picker_custom.jsx";
import { PickerNative } from "./picker_native.jsx";
import { PickerNaviMinute } from "./preset/picker_navi_minute.jsx";
import { PickerNaviTime } from "./preset/picker_navi_time.jsx";

const PickerPresetResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "navi_time") {
    return <PickerNaviTime {...props} />;
  }
  if (props.type === "navi_minute") {
    return <PickerNaviMinute {...props} />;
  }
  return <Next {...props} />;
};

const PickerCustomResolver = (props) => {
  if (props.children === undefined) {
    return <PickerNative {...props} />;
  }
  return <PickerCustom {...props} />;
};

export const pickerResolvers = [PickerPresetResolver, PickerCustomResolver];
