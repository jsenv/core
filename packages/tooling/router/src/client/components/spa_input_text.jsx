import { SPAForm } from "./spa_form.jsx";
import { forwardRef } from "preact/compat";
import { useRef, useLayoutEffect, useImperativeHandle } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useDataActive } from "./use_data_active.js";

export const SPAInputText = forwardRef(
  ({ action, onActionSuccess, method = "PUT", label, ...rest }, ref) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const input = <InputText ref={innerRef} action={action} {...rest} />;

    return (
      <SPAForm
        action={action}
        method={method}
        errorCustomValidityRef={innerRef}
        onActionSuccess={onActionSuccess}
      >
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

const InputText = forwardRef(
  ({ autoFocus, required, action, name, value, ...rest }, ref) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const { pending } = useActionStatus(action);
    const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
      value,
      name,
    );
    useRequestSubmitOnChange(innerRef);

    useDataActive(innerRef);
    // autoFocus does not work so we focus in a useLayoutEffect,
    // see https://github.com/preactjs/preact/issues/1255
    useLayoutEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.focus();
      }
    }, [autoFocus]);

    return (
      <LoaderBackground pending={pending}>
        <input
          {...rest}
          ref={innerRef}
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
  },
);
