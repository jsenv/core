import { PickerCustom } from "./picker_custom.jsx";
import { PickerNative } from "./picker_native.jsx";

const PickerCustomResolver = (props) => {
  if (props.children === undefined) {
    return <PickerNative {...props} />;
  }
  return <PickerCustom {...props} />;
};

export const pickerResolvers = [PickerCustomResolver];
