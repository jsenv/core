import { useLayoutEffect } from "preact/hooks";
import { useActionStatus } from "../use_action_status.js";
import { useParentAction } from "./form_and_fieldset/action_context.js";
import { useAction } from "./use_action.js";
import { useExecuteAction } from "./use_execute_action.js";

export const useActionOrParentActionStatus = (
  elementRef,
  action,
  actionParamsSignal,
) => {
  action = useAction(action, actionParamsSignal);
  const parentAction = useParentAction();
  const executeAction = useExecuteAction(elementRef);
  const actionStatus = useActionStatus(action);
  const parentActionStatus = useActionStatus(parentAction);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (parentAction) {
      // const removeExecuteListener = addEventListener(
      //   element.form,
      //   "execute",
      //   () => {
      //     // <form> will use this action
      //     formActionRef.current = action;
      //   },
      // );
      // const customEventCleanupSet = new Set();
      // const redispatchCustomEvent = (name) => {
      //   const removeListener = addEventListener(element.form, name, (e) => {
      //     const customEventCopy = new CustomEvent(name, {
      //       detail: e.detail,
      //     });
      //     element.dispatchEvent(customEventCopy);
      //   });
      //   customEventCleanupSet.add(removeListener);
      // };
      // redispatchCustomEvent("actionstart");
      // redispatchCustomEvent("actionend");
      // redispatchCustomEvent("actionerror");
      // return () => {
      //   removeExecuteListener();
      //   for (const customEventCleanup of customEventCleanupSet) {
      //     customEventCleanup();
      //   }
      // };
    }
    if (action) {
      return addEventListener(element, "execute", () => {
        executeAction(action);
      });
    }
    return null;
  }, [parentAction, action, executeAction]);

  return action ? actionStatus : parentActionStatus;
};

export const useOnExecute = (elementRef, callback) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    return addEventListener(element, "execute", callback);
  }, [callback]);
};

const addEventListener = (element, eventName, listener) => {
  element.addEventListener(eventName, listener);
  return () => {
    element.removeEventListener(eventName, listener);
  };
};
