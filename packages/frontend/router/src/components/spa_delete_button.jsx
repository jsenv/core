import { SPAForm } from "./spa_form.jsx";

export const SPADeleteButton = ({
  action,
  itemName,
  confirmMessage,
  children,
  canSkipConfirm,
  ...rest
}) => {
  confirmMessage =
    confirmMessage || itemName
      ? `Are you sure you want to delete "${itemName}"?`
      : `Are you sure you want to delete this item?`;

  return (
    <SPAForm action={action} method="DELETE">
      <button
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
      </button>
    </SPAForm>
  );
};
