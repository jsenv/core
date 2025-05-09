import { SPAForm } from "./spa_form.jsx";
import { useRef, useImperativeHandle } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";

export const SPACheckbox = ({ action, label, method = "PUT", ...rest }) => {
  const inputRef = useRef(null);
  const checkbox = <Checkbox ref={inputRef} action={action} {...rest} />;

  return (
    <SPAForm action={action} method={method} errorCustomValidityRef={inputRef}>
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
  );
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
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
