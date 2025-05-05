import { SPAForm } from "./spa_form.jsx";

export const SPADeleteButton = ({ href, children, ...rest }) => {
  return (
    <SPAForm action={href} method="DELETE">
      <button type="submit" {...rest}>
        {children}
      </button>
    </SPAForm>
  );
};
