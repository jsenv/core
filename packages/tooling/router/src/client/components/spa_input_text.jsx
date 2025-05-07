import { SPAForm } from "./spa_form.jsx";
import { useRef } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";

export const SPAInputText = ({ action, method = "PUT", label, ...rest }) => {
  const input = <InputText action={action} {...rest} />;

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

const InputText = ({ action, value, ...rest }) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    value,
    action.params.columnName,
  );
  const inputRef = useRef(null);
  useRequestSubmitOnChange(inputRef);

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        ref={inputRef}
        type="text"
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
