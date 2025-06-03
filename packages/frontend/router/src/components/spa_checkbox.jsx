import { useInputValidationMessage } from "@jsenv/form";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../action/action_hooks.js";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { SPAForm } from "./spa_form.jsx";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const SPACheckbox = ({
  action,
  label,
  method = "PUT",
  onSubmitStart,
  onSubmitError,
  ...rest
}) => {
  const checkboxRef = useRef(null);
  const [addFormErrorOnInput, removeFormErrorFromInput] =
    useInputValidationMessage(checkboxRef, "form_error");
  const checkbox = <Checkbox ref={checkboxRef} action={action} {...rest} />;

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
    >
      {label ? (
        <label>
          {label}
          {checkbox}
        </label>
      ) : (
        checkbox
      )}
    </SPAForm>
  );
};

const Checkbox = forwardRef(({ action, name, checked, ...rest }, ref) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    checked,
    name,
    { revertOnFailure: true },
  );
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => {
    const input = innerRef.current;
    return input;
  });
  useRequestSubmitOnChange(innerRef, { preventWhenValueMissing: true });

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        name={name}
        checked={optimisticUIState}
        disabled={pending}
        onInput={(e) => {
          setOptimisticUIState(e.target.checked);
        }}
        // eslint-disable-next-line react/no-unknown-property
        onCancel={() => {
          innerRef.current.checked = checked;
        }}
      />
    </LoaderBackground>
  );
});
