import { InputCheckbox } from "./input_checkbox.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputRange } from "./input_range.jsx";
import { InputTextual } from "./input_textual.jsx";

export const Input = (props) => {
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
