import { forwardRef } from "preact/compat";
import { InputCheckbox } from "./input_checkbox.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputText } from "./input_text.jsx";

export const Input = forwardRef((props, ref) => {
  const { type } = props;
  let input;
  if (type === "radio") {
    input = <InputRadio {...props} ref={ref} />;
  } else if (type === "checkbox") {
    input = <InputCheckbox {...props} ref={ref} />;
  } else {
    input = <InputText {...props} ref={ref} />;
  }
  return input;
});
