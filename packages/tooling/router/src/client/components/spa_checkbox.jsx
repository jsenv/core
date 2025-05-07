import { SPAForm } from "./spa_form.jsx";
import { useRef, useImperativeHandle } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";

export const SPACheckbox = ({ action, label, method = "PUT", ...rest }) => {
  const inputRef = useRef(null);
  const checkbox = <Checkbox ref={inputRef} action={action} {...rest} />;

  return (
    <SPAForm action={action} method={method} customValidityErrorRef={inputRef}>
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

const Checkbox = forwardRef(({ action, checked, ...rest }) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    checked,
    action.params.columnName,
  );
  const innerRef = useRef(null);
  useImperativeHandle(innerRef, () => innerRef.current);

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        ref={innerRef}
        type="checkbox"
        name="value"
        onChange={(e) => {
          setOptimisticUIState(e.target.checked);
          const form = e.target.form;
          form.requestSubmit();
        }}
        checked={optimisticUIState}
        disabled={pending}
      />
    </LoaderBackground>
  );
});
