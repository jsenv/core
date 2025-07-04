import { forwardRef } from "preact/compat";
import { InputCheckbox } from "./input_checkbox.jsx";
import { InputRadio } from "./input_radio.jsx";
import { InputText } from "./input_text.jsx";

import.meta.css = /*css*/ `
  label[data-disabled] {
    opacity: 0.5;
  }
`;

export const Input = forwardRef((props, ref) => {
  const { type, children } = props;

  let input;

  if (type === "radio") {
    input = <InputRadio {...props} ref={ref} />;
  } else if (type === "checkbox") {
    input = <InputCheckbox {...props} ref={ref} />;
  } else {
    input = <InputText {...props} ref={ref} />;
  }

  if (children) {
    return (
      <label>
        {children}
        {input}
      </label>
    );
  }
  return input;
});
