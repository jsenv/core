import { forwardRef } from "preact/compat";

import { InputCheckbox } from "./input_checkbox.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputTextual } from "./input_textual.jsx";

export const Input = forwardRef((props, ref) => {
  const { type } = props;
  if (type === "radio") {
    return <InputRadio {...props} ref={ref} />;
  }
  if (type === "checkbox") {
    return <InputCheckbox {...props} ref={ref} />;
  }
  return <InputTextual {...props} ref={ref} />;
});
