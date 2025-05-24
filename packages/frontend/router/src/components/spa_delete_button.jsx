import { SPAForm } from "./spa_form.jsx";

export const SPADeleteButton = ({ action, children, ...rest }) => {
  return (
    <SPAForm action={action} method="DELETE">
      <button type="submit" {...rest}>
        {children}
      </button>
    </SPAForm>
  );
};
