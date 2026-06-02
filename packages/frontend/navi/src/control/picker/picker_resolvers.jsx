import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { PickerCustom } from "./picker_custom.jsx";
import { PickerNative } from "./picker_native.jsx";
import {
  PickerArray,
  PickerColor,
  PickerDatetime,
  PickerDay,
  PickerFile,
  PickerMonth,
  PickerText,
  PickerTime,
  PickerWeek,
} from "./picker_types.jsx";
import { PickerNaviTime } from "./preset/picker_navi_time.jsx";

const PickerPresetResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "navi_time") {
    return <PickerNaviTime {...props} />;
  }
  return <Next {...props} />;
};

const PickerCustomResolver = (props) => {
  if (props.children === undefined) {
    return <PickerNative {...props} />;
  }
  return <PickerCustom {...props} />;
};

const PickerTypeResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "color") {
    return <PickerColor {...props} />;
  }
  if (props.type === "day") {
    return <PickerDay {...props} />;
  }
  if (props.type === "month") {
    return <PickerMonth {...props} />;
  }
  if (props.type === "week") {
    return <PickerWeek {...props} />;
  }
  if (props.type === "time") {
    return <PickerTime {...props} />;
  }
  if (props.type === "datetime") {
    return <PickerDatetime {...props} />;
  }
  if (props.type === "file") {
    return <PickerFile {...props} />;
  }
  if (props.type === "text") {
    return <PickerText {...props} />;
  }
  if (props.type === "array") {
    return <PickerArray {...props} />;
  }
  return <Next {...props} />;
};

export const pickerResolvers = [
  PickerPresetResolver,
  PickerCustomResolver,
  PickerTypeResolver,
];
