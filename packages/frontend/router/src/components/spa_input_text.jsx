import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { InputText } from "./input_text.jsx";
import { SPAForm } from "./spa_form.jsx";

export const SPAInputText = forwardRef(
  ({ action, method = "PUT", label, name, ...rest }, ref) => {
    if (import.meta.dev && !name) {
      console.warn(
        "SPAInputText: name is required for the input to work property with <form> submission.",
      );
    }

    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);

    const input = (
      <InputText
        ref={innerRef}
        action={action}
        name={name}
        formPendingEffect="loading"
        {...rest}
      />
    );

    return (
      <SPAForm action={action} method={method} errorTarget="input">
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
