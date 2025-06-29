import { forwardRef } from "preact/compat";
import { SPAForm } from "../form/spa_form.jsx";
import { InputText } from "./input_text.jsx";

export const SPAInputText = forwardRef(
  ({ method = "PUT", label, name, ...rest }, ref) => {
    if (import.meta.dev && !name) {
      console.warn(
        "SPAInputText: name is required for the input to work property with <form> submission.",
      );
    }
    const input = (
      <InputText ref={ref} name={name} formPendingEffect="loading" {...rest} />
    );
    return (
      <SPAForm method={method} errorTarget="input">
        {label ? (
          <label>
            {label}
            {input}
          </label>
        ) : (
          input
        )}
      </SPAForm>
    );
  },
);
