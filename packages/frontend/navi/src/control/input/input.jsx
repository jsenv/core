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
  // Resolve props (and in particular props.type) before dispatching so a
  // value signal (e.g. a boolean-typed one) can steer which input component
  // is rendered — a boolean signal resolves to type="checkbox" here.
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
