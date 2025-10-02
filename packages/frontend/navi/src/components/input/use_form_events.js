import { useLayoutEffect } from "preact/hooks";
import { addManyEventListeners } from "../../utils/add_many_event_listeners.js";

export const useFormEvents = (
  elementRef,
  { onFormReset, onFormActionAbort, onFormActionError },
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    let form = element.form;
    if (!form) {
      // some non input elements may want to listen form events (<RadioList> is a <div>)
      form = element.closest("form");
      if (!form) {
        console.warn("No form found for element", element);
        return null;
      }
    }
    return addManyEventListeners(form, {
      reset: onFormReset,
      actionabort: onFormActionAbort,
      actionerror: (e) => {
        onFormActionError?.(e.detail.error);
      },
    });
  }, [onFormReset, onFormActionAbort, onFormActionError]);
};
