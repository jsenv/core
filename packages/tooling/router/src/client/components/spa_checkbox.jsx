import { SPAForm } from "./spa_form.jsx";
import { useUIOrFrontendState } from "./use_ui_or_frontend_state.js";
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
  const [UIOrFrontendValue, setUIValue] = useUIOrFrontendState(checked);

  const input = (
    <input
      type="checkbox"
      name="value"
      onChange={(e) => {
        setUIValue(e.target.checked);
        const form = e.target.form;
        form.requestSubmit();
      }}
      {...rest}
      checked={UIOrFrontendValue}
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
