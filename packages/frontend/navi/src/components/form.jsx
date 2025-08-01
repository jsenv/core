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

import { requestAction, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { FormContext } from "./action_execution/form_context.js";
import { renderActionableComponent } from "./action_execution/render_actionable_component.jsx";
import { useFormActionBoundToFormParams } from "./action_execution/use_action.js";
import { useExecuteAction } from "./action_execution/use_execute_action.js";
import { collectFormElementValues } from "./collect_form_element_values.js";
import { useActionEvents } from "./use_action_events.js";

export const Form = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: FormBasic,
    WithAction: FormWithAction,
  });
});

const FormBasic = forwardRef((props, ref) => {
  return <form ref={ref} {...props} />;
});

const FormWithAction = forwardRef((props, ref) => {
  let {
    action,
    method,
    readOnly = false,
    allowConcurrentActions: formAllowConcurrentActions = false,
    actionErrorEffect = "show_validation_message", // "show_validation_message" or "throw"
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  // instantiation validation to:
  // - receive "requestsubmit" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  useConstraints(innerRef, []);

  const [boundAction, formParamsSignal, setFormParams] =
    useFormActionBoundToFormParams(action);
  const [formActionRequester, setFormActionRequester] = useState(null);
  const [formIsBusy, setFormIsBusy] = useState(false);
  const [formActionError, setFormActionError] = useState(null);
  const [formActionAborted, setFormActionAborted] = useState(false);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
  });
  const formIsReadOnly =
    readOnly || (formIsBusy && !formAllowConcurrentActions);

  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const form = innerRef.current;
      const formElementValues = collectFormElementValues(form);
      setFormParams(formElementValues);

      setFormActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: (e) => {
      setFormIsBusy(true);
      setFormActionError(null);
      setFormActionAborted(false);
      onActionStart?.(e);
    },
    onAbort: (e) => {
      setFormIsBusy(false);
      setFormActionAborted(true);
      onActionAbort?.(e);
    },
    onError: (e) => {
      setFormIsBusy(false);
      setFormActionError(e);
      onActionError?.(e);
    },
    onEnd: (e) => {
      setFormIsBusy(false);
      onActionEnd?.(e);
    },
  });

  return (
    <form
      {...rest}
      data-action={boundAction.name}
      data-method={action.meta?.httpVerb || method || "GET"}
      ref={innerRef}
      // eslint-disable-next-line react/no-unknown-property
      onrequestsubmit={(e) => {
        // prevent "submit" event that would be dispatched by the browser after form.requestSubmit()
        // (not super important because our <form> listen the "action" and do does preventDefault on "submit")
        e.preventDefault();
        requestAction(boundAction, { event: e });
      }}
    >
      <FormContext.Provider
        value={{
          formAllowConcurrentActions,
          formAction: boundAction,
          formParamsSignal,
          formActionRequester,
          formIsReadOnly,
          formIsBusy,
          formActionAborted,
          formActionError,
        }}
      >
        {children}
      </FormContext.Provider>
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
