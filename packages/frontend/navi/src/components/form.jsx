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
import { ActionContext } from "./action_execution/action_context.js";
import { renderActionComponent } from "./action_execution/render_action_component.jsx";
import { useAction } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { formDataToObject } from "./form_data.js";

export const Form = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, ActionForm, SimpleForm);
});

const SimpleForm = forwardRef((props, ref) => {
  return <form ref={ref} {...props} />;
});

const ActionForm = forwardRef((props, ref) => {
  let {
    action,
    method,
    actionErrorEffect = "show_validation_message", // "show_validation_message" or "throw"
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [boundAction, , setParams] = useAction(action);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const executingRef = useRef(false);

  if (method === undefined) {
    if (action && action.meta?.httpVerb) {
      method = action.meta.httpVerb;
    } else {
      method = "get";
    }
  }
  method = method.toLowerCase();

  return (
    <form
      {...rest}
      action={`javascript:void(${boundAction.name})`}
      ref={innerRef}
      method={method === "get" ? "get" : "post"}
      // eslint-disable-next-line react/no-unknown-property
      onactionprevented={onActionPrevented}
      // eslint-disable-next-line react/no-unknown-property
      onaction={(actionEvent) => {
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
        setParams(formDataToObject(formData));

        const actionToExecute = actionEvent.detail.action || boundAction;
        executeAction(actionToExecute, {
          requester: actionEvent.detail.requester,
        });
      }}
      // eslint-disable-next-line react/no-unknown-property
      onactionstart={onActionStart}
      // eslint-disable-next-line react/no-unknown-property
      onactionerror={onActionError}
      // eslint-disable-next-line react/no-unknown-property
      onactionend={onActionEnd}
    >
      <ActionContext.Provider value={[boundAction]}>
        {children}
      </ActionContext.Provider>
    </form>
  );
});

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };
