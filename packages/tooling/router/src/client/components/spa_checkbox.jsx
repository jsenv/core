import { SPAForm } from "./spa_form.jsx";
import { useRef, useImperativeHandle } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { createCustomValidityWrapper } from "./custom_validity_wrapper.js";

export const SPACheckbox = ({ action, label, method = "PUT", ...rest }) => {
  const checkboxRef = useRef(null);
  const checkbox = <Checkbox ref={checkboxRef} action={action} {...rest} />;

  return (
    <SPAForm
      action={action}
      method={method}
      errorCustomValidityRef={checkboxRef}
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
    const customValidation = createCustomValidityWrapper(input);
    input.customValidation = customValidation;
    return input;
  });
  useRequestSubmitOnChange(innerRef);

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
      />
    </LoaderBackground>
  );
});
