import { useLayoutEffect } from "preact/hooks";
import { addManyEventListeners } from "../../utils/add_many_event_listeners.js";

export const useFormEvents = (
  elementRef,
  { onFormReset, onFormActionAbort, onFormActionError },
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    const form = element.form;

    return addManyEventListeners(form, {
      reset: onFormReset,
      actionabort: onFormActionAbort,
      actionerror: (e) => {
        onFormActionError?.(e.detail.error);
      },
    });
  }, [onFormReset, onFormActionAbort, onFormActionError]);
};
