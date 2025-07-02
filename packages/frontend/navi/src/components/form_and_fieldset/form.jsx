/**
 *
 * Here we want the same behaviour as web standards:
 *
 * 1. When submitting the form URL does not change
 * 2. When form submission id done user is redirected (by default the current one)
 *    (we can configure this using target)
 *    So for example user might be reidrect to a page with the resource he just created
 *    I could create an example where we would put a link on the page to let user see what he created
 *    but by default user stays on the form allowing to create multiple resources at once
 *    And an other where he is redirected to the resource he created
 * 3. If form submission fails ideally we should display this somewhere on the UI
 *    right now it's just logged to the console I need to see how we can achieve this
 */

import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useAction } from "../use_action.js";
import { useActionParamsSignal } from "../use_action_params_signal.js";
import { useExecuteAction } from "../use_execute_action.js";
import { ActionContext } from "./action_context.js";

const submit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function (...args) {
  const form = this;
  if (form.hasAttribute("data-method")) {
    console.warn("You must use form.requestSubmit() instead of form.submit()");
    return form.requestSubmit();
  }
  return submit.apply(this, args);
};

export const Form = forwardRef(
  (
    {
      action,
      method,
      errorEffect = "show_validation_message", // "show_validation_message" or "throw"
      onExecute,
      onExecutePrevented,
      onActionStart,
      onActionError,
      onActionEnd,
      children,
      ...rest
    },
    ref,
  ) => {
    if (method === undefined) {
      if (action && action.meta.httpVerb) {
        method = action.meta.httpVerb;
      } else {
        method = "get";
      }
    }
    method = method.toLowerCase();
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    const paramsSignal = useActionParamsSignal({});

    action = useAction(action, paramsSignal);
    const executeAction = useExecuteAction(innerRef, { errorEffect });
    const executingRef = useRef(false);

    return (
      <form
        {...rest}
        ref={innerRef}
        method={method === "get" ? "get" : "post"}
        data-method={method}
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
        }}
        // eslint-disable-next-line react/no-unknown-property
        onexecute={async (executeEvent) => {
          if (executingRef.current) {
            /**
             * Without this check, when user types in <input> then hit enter 2 http requests are sent
             * - First one is correct
             * - Second one is sent without any value
             *
             * This happens because in the following html structure
             * <form>
             *   <input name="value" type="text" onChange={() => form.requestSubmit()} />
             * </form>
             * The following happens after hitting "enter" key:
             * 1. Browser trigger "change" event, form is submitted, an http request is sent
             * 2. We do input.disabled = true;
             * 3. Browser trigger "submit" event
             * 4. new FormData(form).get("value") is empty because input.disabled is true
             * -> We end up with the faulty http request that we don't want
             */
            return;
          }
          executingRef.current = true;
          setTimeout(() => {
            executingRef.current = false;
          }, 0);

          const form = innerRef.current;
          const formData = new FormData(form);
          const params = {};
          for (const [name, value] of formData) {
            if (name in params) {
              if (Array.isArray(params[name])) {
                params[name].push(value);
              } else {
                params[name] = [params[name], value];
              }
            } else {
              params[name] = value;
            }
          }
          paramsSignal.value = params;

          if (onExecute) {
            onExecute();
          }
          await executeAction(action, {
            requester: executeEvent.detail.requester,
          });
        }}
        // eslint-disable-next-line react/no-unknown-property
        onexecuteprevented={onExecutePrevented}
        // eslint-disable-next-line react/no-unknown-property
        onactionstart={onActionStart}
        // eslint-disable-next-line react/no-unknown-property
        onactionend={onActionEnd}
        // eslint-disable-next-line react/no-unknown-property
        onactionerror={onActionError}
      >
        <ActionContext.Provider value={action}>
          {children}
        </ActionContext.Provider>
      </form>
    );
  },
);

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };
