import { Box } from "@jsenv/navi/src/box/box.jsx";

export const PickerPlaceholder = (props) => {
  return <Box as="span" className="navi_picker_placeholder" {...props} />;
};

export const PickerValue = (props) => {
  return <Box as="span" className="navi_picker_value" {...props} />;
};
