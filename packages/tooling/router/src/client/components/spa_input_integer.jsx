import { SPAForm } from "./spa_form.jsx";
import { useRef } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
import { useRequestSubmitOnChange } from "./user_request_submit_on_change.js";
import { LoaderBackground } from "./loader_background.jsx";
import { useActionStatus } from "../action/action_hooks.js";

export const SPAInputInteger = ({ action, method = "PUT", label, ...rest }) => {
  const input = <InputInteger action={action} {...rest} />;

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

const InputInteger = ({ action, value, name, ...rest }) => {
  const { pending } = useActionStatus(action);
  const [optimisticUIState, setOptimisticUIState] = useOptimisticUIState(
    value,
    name,
  );
  const inputRef = useRef(null);
  useRequestSubmitOnChange(inputRef);

  return (
    <LoaderBackground pending={pending}>
      <input
        {...rest}
        ref={inputRef}
        type="number"
        name={name}
        value={optimisticUIState}
        disabled={pending}
        onInput={(e) => {
          setOptimisticUIState(e.target.valueAsNumber);
        }}
      />
    </LoaderBackground>
  );
};
