import { SPAForm } from "./spa_form.jsx";
import { forwardRef } from "preact/compat";
import { useRef, useLayoutEffect, useImperativeHandle } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useDataActive } from "./use_data_active.js";

export const SPAInputText = forwardRef(
  (
    { action, onActionSuccess, onActionStart, method = "PUT", label, ...rest },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const input = <InputText ref={innerRef} action={action} {...rest} />;

    return (
      <SPAForm
        action={action}
        method={method}
        errorCustomValidityRef={innerRef}
        onActionStart={onActionStart}
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
  (
    { autoFocus, autoSelect, required, action, name, value, onInput, ...rest },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => innerRef.current);
    const { pending } = useActionStatus(action);
    const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
      value,
      name,
    );
    useRequestSubmitOnChange(innerRef, { preventWhenValueMissing: true });
    useRequired(innerRef, value);

    useDataActive(innerRef);
    // autoFocus does not work so we focus in a useLayoutEffect,
    // see https://github.com/preactjs/preact/issues/1255
    useLayoutEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.focus();
        if (autoSelect) {
          input.select();
        }
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
            if (onInput) {
              onInput(e);
            }
          }}
        />
      </LoaderBackground>
    );
  },
);

const useRequired = (inputRef, value) => {
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input.required) {
      return null;
    }
    const oninput = () => {
      if (input.validity.valueMissing) {
        input.reportValidity();
      }
    };
    const onblur = () => {
      if (input.validity.valueMissing) {
        // dont keep the invalid invalid and empty, restore
        // the value when user stops interacting
        input.value = value;
      }
    };
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);
    return () => {
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    };
  }, []);
};
