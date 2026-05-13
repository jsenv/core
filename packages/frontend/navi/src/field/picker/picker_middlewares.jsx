import { PickerHour } from "./preset/picker_hour.jsx";
import {
  PickerColor,
  PickerDatetime,
  PickerDay,
  PickerMonth,
  PickerTime,
  PickerWeek,
} from "./show_method/picker_show_method.jsx";

const PickerShowMethodMiddleware = (props) => {
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
  return null;
};

const PickerPresetMiddleware = (props) => {
  if (props.type === "hour") {
    return <PickerHour {...props} />;
  }
  return null;
};

export const pickerMiddlewares = [
  PickerShowMethodMiddleware,
  PickerPresetMiddleware,
];
