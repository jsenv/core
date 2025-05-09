import { SPAForm } from "./spa_form.jsx";
import { useRef, useLayoutEffect } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useDataInteracting } from "./use_data_interacting.js";

export const SPAInputText = ({ action, method = "PUT", label, ...rest }) => {
  const input = <InputText action={action} {...rest} />;

  return (
    <SPAForm action={action} method={method}>
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
};

const InputText = ({ autoFocus, required, action, name, value, ...rest }) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    value,
    name,
  );
  const inputRef = useRef(null);
  useRequestSubmitOnChange(inputRef);

  useDataInteracting(inputRef);
  // autoFocus does not work so we focus in a useLayoutEffect,
  // see https://github.com/preactjs/preact/issues/1255
  useLayoutEffect(() => {
    if (autoFocus) {
      const input = inputRef.current;
      input.focus();
    }
  }, [autoFocus]);

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        ref={inputRef}
        type="text"
        name={name}
        value={optimisticUIState}
        disabled={pending}
        required={required}
        onInput={(e) => {
          const input = e.target;
          setOptimisticUIState(input.value);
          if (input.validity.valueMissing) {
            input.form.requestSubmit();
          }
        }}
      />
    </LoaderBackground>
  );
};
