import { SPAForm } from "./spa_form.jsx";
import { useOptimisticUIState } from "./use_optimistic_ui_state.js";
import { useSPAFormStatus } from "../hooks/use_spa_form_status.js";

export const SPACheckbox = ({ action, method = "PUT", ...rest }) => {
  return (
    <SPAForm action={action} method={method}>
      <SPACheckboxInput {...rest} />
    </SPAForm>
  );
};

const SPACheckboxInput = ({ label, checked, ...rest }) => {
  const { pending } = useSPAFormStatus();
  const [optimisticUIState, setOptimisticUIState] =
    useOptimisticUIState(checked);

  const input = (
    <input
      type="checkbox"
      name="value"
      onChange={(e) => {
        setOptimisticUIState(e.target.checked);
        const form = e.target.form;
        form.requestSubmit();
      }}
      {...rest}
      checked={optimisticUIState}
      disabled={pending}
    />
  );

  if (label) {
    return (
      <label>
        {label}
        {input}
      </label>
    );
  }
  return input;
};
