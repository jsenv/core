import { Text } from "@jsenv/navi/src/text/text.jsx";

export const PickerValue = (props) => {
  return <Text className="navi_picker_value" {...props} />;
};

export const PickerPlaceholder = (props) => {
  return <PickerValue {...props} navi-placeholder="" />;
};
