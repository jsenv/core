import { SPAForm } from "./spa_form.jsx";
import { useRef, useLayoutEffect } from "preact/hooks";
import { useOptimisticUIState } from "../hooks/use_optimistic_ui_state.js";
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
  // see https://github.com/preactjs/preact/issues/1034#issuecomment-2857877043
  useLayoutEffect(() => {
    const onChange = (e) => {
      const form = e.target.form;
      form.requestSubmit();
    };
    inputRef.current.addEventListener("change", onChange);
    return () => {
      inputRef.current.removeEventListener("change", onChange);
    };
  }, []);

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
