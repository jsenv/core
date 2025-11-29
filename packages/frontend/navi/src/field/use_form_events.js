import { useLayoutEffect } from "preact/hooks";

import { addManyEventListeners } from "../utils/add_many_event_listeners.js";
import { useStableCallback } from "../utils/use_stable_callback.js";

export const useFormEvents = (
  elementRef,
  {
    onFormReset,
    onFormActionRequested,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  },
) => {
  onFormReset = useStableCallback(onFormReset);
  onFormActionRequested = useStableCallback(onFormActionRequested);
  onFormActionPrevented = useStableCallback(onFormActionPrevented);
  onFormActionStart = useStableCallback(onFormActionStart);
  onFormActionAbort = useStableCallback(onFormActionAbort);
  onFormActionError = useStableCallback(onFormActionError);
  onFormActionEnd = useStableCallback(onFormActionEnd);

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
      actionrequested: onFormActionRequested,
      actionprevented: onFormActionPrevented,
      actionstart: onFormActionStart,
      actionabort: onFormActionAbort,
      actionerror: onFormActionError,
      actionend: onFormActionEnd,
    });
  }, [
    onFormReset,
    onFormActionRequested,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  ]);
};
