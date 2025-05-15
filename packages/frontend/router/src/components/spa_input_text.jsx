import { forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { SPAForm } from "./spa_form.jsx";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { useValidity } from "./validity/use_validity.js";

export const SPAInputText = forwardRef(
  (
    { action, onSubmitStart, onSubmitError, method = "PUT", label, ...rest },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => {
      const input = innerRef.current;
      return input;
    });
    // custom validity is great as long as you don't have many error hapenning in parallel
    // in that case only the last once will be displayed
    // ideally they would all be displayed
    // but for this we would have to implement our own way to display errors
    // for now we'll stick to the custom validity api
    const [addFormErrorValidity, removeFormErrorValidity] =
      useValidity(innerRef);
    const input = <InputText ref={innerRef} action={action} {...rest} />;

    return (
      <SPAForm
        action={action}
        method={method}
        onSubmitStart={() => {
          removeFormErrorValidity();
          if (onSubmitStart) {
            onSubmitStart();
          }
        }}
        onSubmitError={(e) => {
          addFormErrorValidity(e);
          if (onSubmitError) {
            onSubmitError(e);
          }
        }}
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
    {
      autoFocus,
      autoSelect,
      required,
      action,
      name,
      value,
      onCancel,
      onInput,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => {
      const input = innerRef.current;
      return input;
    });
    const { pending } = useActionStatus(action);
    const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
      value,
      name,
    );
    useRequestSubmitOnChange(innerRef, { preventWhenValueMissing: true });
    useValidity(innerRef, null, {
      onCancel: (reason) => {
        innerRef.current.value = value;
        if (onCancel) {
          onCancel(reason);
        }
      },
    });

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
