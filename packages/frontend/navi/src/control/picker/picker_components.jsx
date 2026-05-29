import { Text } from "@jsenv/navi/src/text/text.jsx";

export const PickerPlaceholder = (props) => {
  return <Text className="navi_picker_placeholder" {...props} />;
};

export const PickerValue = (props) => {
  return <Text className="navi_picker_value" {...props} />;
};
