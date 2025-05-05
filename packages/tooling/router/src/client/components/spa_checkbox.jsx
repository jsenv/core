import { SPAForm } from "./spa_form.jsx";

export const SPACheckbox = ({ action, method = "PUT", label, ...rest }) => {
  const input = (
    <input
      type="checkbox"
      name="value"
      onChange={(e) => {
        const form = e.target.form;
        form.requestSubmit();
      }}
      {...rest}
    />
  );

  return (
    <SPAForm action={action} method={method}>
      {label ? (
        <label>
          <span>{label}:</span>
          {input}
        </label>
      ) : (
        input
      )}
    </SPAForm>
  );
};
