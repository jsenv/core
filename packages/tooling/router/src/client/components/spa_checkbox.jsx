import { SPAForm } from "./spa_form.jsx";
import { useRef, useImperativeHandle } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";
import { useValidity } from "./validity/use_validity.js";

export const SPACheckbox = ({
  action,
  label,
  method = "PUT",
  onPending,
  ...rest
}) => {
  const checkboxRef = useRef(null);
  const [addFormErrorValidity, removeFormErrorValidity] =
    useValidity(checkboxRef);
  const checkbox = <Checkbox ref={checkboxRef} action={action} {...rest} />;

  return (
    <SPAForm
      action={action}
      method={method}
      onPending={async (pendingInfo) => {
        if (onPending) {
          onPending(pendingInfo);
        }
        removeFormErrorValidity();
        try {
          await pendingInfo.finished;
        } catch (e) {
          addFormErrorValidity(e);
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
  useValidity(innerRef, null, {
    onCancel: () => {
      innerRef.current.checked = checked;
    },
  });

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
