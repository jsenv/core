import { InputCheckbox } from "./input_checkbox.jsx";
import {
  InputIconSlot,
  InputLeftSlot,
  InputRightSlot,
  InputUnitSlot,
} from "./input_components.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputRange } from "./input_range.jsx";
import { InputTextual } from "./input_textual.jsx";
import { resolveInputProps } from "./resolve_input_props.js";

export const Input = (props) => {
  resolveInputProps(props);

  const { type } = props;
  if (type === "radio") {
    return <InputRadio {...props} />;
  }
  if (type === "checkbox") {
    return <InputCheckbox {...props} />;
  }
  if (type === "range") {
    return <InputRange {...props} />;
  }
  return <InputTextual {...props} />;
};

Input.UI = {
  LeftSlot: InputLeftSlot,
  RightSlot: InputRightSlot,
  IconSlot: InputIconSlot,
  UnitSlot: InputUnitSlot,
};
