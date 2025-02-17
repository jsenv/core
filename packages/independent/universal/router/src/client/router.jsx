import { canUseNavigation } from "./router.js";

export const SPAForm = ({ action, method, children }) => {
  return (
    <form
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        const formData = new FormData(submitEvent.currentTarget);
        if (canUseNavigation) {
          navigation.navigate(action, {
            history: "replace",
            info: { formData, method },
          });
        } else {
          // TODO
        }
      }}
      method={method === "get" ? "get" : "post"}
    >
      {children}
    </form>
  );
};
