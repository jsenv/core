import { PickerHour } from "./picker_hour.jsx";

export const PickerPresetMiddleware = (props) => {
  if (props.type === "hour") {
    return <PickerHour {...props} />;
  }
  return null;
};
