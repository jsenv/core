import { SPAForm } from "../form/spa_form.jsx";
import { Button } from "./button.jsx";

export const SPAButton = ({
  method = "GET",
  action,
  confirmMessage,
  children,
  canSkipConfirm,
  ...rest
}) => {
  return (
    <SPAForm action={action} method={method}>
      <Button
        type="submit"
        onClick={
          canSkipConfirm
            ? undefined
            : (e) => {
                // eslint-disable-next-line no-alert
                const confirmResult = window.confirm(confirmMessage);
                if (!confirmResult) {
                  e.preventDefault();
                }
              }
        }
        {...rest}
      >
        {children}
      </Button>
    </SPAForm>
  );
};
