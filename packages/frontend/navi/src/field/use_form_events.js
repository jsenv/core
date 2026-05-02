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
      navi_action_requested: onFormActionRequested,
      navi_action_prevented: onFormActionPrevented,
      navi_action_start: onFormActionStart,
      navi_action_abort: onFormActionAbort,
      navi_action_error: onFormActionError,
      navi_action_end: onFormActionEnd,
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
