import { forwardRef } from "preact/compat";
import { InputCheckbox } from "./input_checkbox.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputText } from "./input_text.jsx";

export const Input = forwardRef((props, ref) => {
  const { type } = props;
  if (type === "radio") {
    return <InputRadio {...props} ref={ref} />;
  }
  if (type === "checkbox") {
    return <InputCheckbox {...props} ref={ref} />;
  }
  return <InputText {...props} ref={ref} />;
});
