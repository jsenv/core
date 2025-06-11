import { forwardRef } from "preact/compat";
import { InputCheckbox } from "./input_checkbox.jsx";
import { SPAForm } from "./spa_form.jsx";

export const SPAInputCheckbox = forwardRef(
  ({ label, name, method = "PUT", ...rest }, ref) => {
    if (import.meta.dev && !name) {
      console.warn(
        "SPAInputCheckbox: name is required for the input to work property with <form> submission.",
      );
    }

    const inputCheckbox = (
      <InputCheckbox
        ref={ref}
        name={name}
        formPendingEffect="loading"
        requestSubmitOnChange
        {...rest}
      />
    );

    return (
      <SPAForm method={method} errorTarget="input">
        {label ? (
          <label>
            {label}
            {inputCheckbox}
          </label>
        ) : (
          inputCheckbox
        )}
      </SPAForm>
    );
  },
);
