import { SPAForm } from "./spa_form.jsx";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";

export const SPAInputDateAndTime = ({
  action,
  method = "PUT",
  label,
  ...rest
}) => {
  const input = <InputDateAndTime action={action} {...rest} />;

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

const InputDateAndTime = ({ action, value, ...rest }) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    value,
    action.params.columnName,
  );

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        type="datetime-local"
        name="value"
        disabled={pending}
        value={optimisticUIState}
        onInput={(e) => {
          setOptimisticUIState(e.target.value);
        }}
      />
    </LoaderBackground>
  );
};
