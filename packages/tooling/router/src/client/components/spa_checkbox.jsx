import { SPAForm } from "./spa_form.jsx";

export const SPACheckbox = ({ action, method = "PUT", ...rest }) => {
  return (
    <SPAForm action={action} method={method}>
      <input
        type="checkbox"
        name="value"
        onChange={(e) => {
          const form = e.target.form;
          form.requestSubmit();
        }}
        {...rest}
      />
    </SPAForm>
  );
};
