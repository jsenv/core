import { useInputValidationMessage } from "@jsenv/form";
import { forwardRef } from "preact/compat";
import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { SPAForm } from "./spa_form.jsx";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const SPAInputText = forwardRef(
  (
    {
      action,
      onSubmitStart,
      onSubmitEnd,
      onSubmitError,
      method = "PUT",
      label,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef(null);
    useImperativeHandle(ref, () => {
      const input = innerRef.current;
      return input;
    });
    const [addFormErrorOnInput, removeFormErrorFromInput] =
      useInputValidationMessage(innerRef, "form_error");
    const input = <InputText ref={innerRef} action={action} {...rest} />;

    return (
      <SPAForm
        action={action}
        method={method}
        onSubmitStart={() => {
          removeFormErrorFromInput();
          if (onSubmitStart) {
            onSubmitStart();
          }
        }}
        onSubmitError={(e) => {
          addFormErrorOnInput(e);
          if (onSubmitError) {
            onSubmitError(e);
          }
        }}
        onSubmitEnd={onSubmitEnd}
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

    useEffect(() => {
      if (autoFocus) {
        const input = innerRef.current;
        input.scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    }, []);

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
          // eslint-disable-next-line react/no-unknown-property
          onCancel={(reason) => {
            innerRef.current.value = value === undefined ? "" : value;
            if (onCancel) {
              onCancel(reason);
            }
          }}
        />
      </LoaderBackground>
    );
  },
);
