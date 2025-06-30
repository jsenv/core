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
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { useAction } from "../use_action.js";
import { useOnExecute } from "../use_action_or_form_action.js";
import { useExecuteAction } from "../use_execute_action.js";
import { FormContext } from "./use_form_status.js";

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
      method = "get",
      errorEffect = "show_validation_message", // "show_validation_message" or "throw"
      onExecute,
      onExecutePrevented,
      children,
      ...rest
    },
    ref,
  ) => {
    method = method.toLowerCase();
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    action = useAction(action);
    const executeAction = useExecuteAction(innerRef, { errorEffect });
    const [formStatus, formStatusSetter] = useState({
      pending: false,
      aborted: false,
      error: null,
      method,
      action,
    });
    const formActionRef = useRef();
    const executingRef = useRef(false);

    // It's important to use useOnExecute which uses useLayoutEffect
    // to register the event listener so that
    // ```js
    // formActionRef.current = action;
    // ```
    // is executed first (code declared in use_action_or_form_action#L19 )
    useOnExecute(innerRef, async (executeEvent) => {
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
      let resolveResultPromise;
      if (onExecute) {
        const resultPromise = new Promise((resolve) => {
          resolveResultPromise = resolve;
        });
        onExecute({ resultPromise });
      }
      const formAction = formActionRef.current || action;
      formStatusSetter({
        pending: true,
        aborted: false,
        error: null,
        method,
        action: formAction,
      });
      const { aborted, error } = await executeAction(
        formAction,
        executeEvent.detail.requester,
      );
      formActionRef.current = null;
      setTimeout(() => {
        executingRef.current = false;
      }, 0);
      formStatusSetter({
        pending: false,
        aborted,
        error,
        method,
        action: formAction,
      });
      if (resolveResultPromise) {
        resolveResultPromise({ aborted, error });
      }
    });

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
        onexecuteprevented={(executePreventedEvent) => {
          onExecutePrevented?.(executePreventedEvent);
        }}
      >
        <FormContext.Provider value={[formStatus, formActionRef]}>
          {children}
        </FormContext.Provider>
      </form>
    );
  },
);

// const formData = new FormData(submitEvent.currentTarget);
// if (formDataMappings) {
//   for (const [key, mapping] of Object.entries(formDataMappings)) {
//     const value = formData.get(key);
//     if (value) {
//       const valueMapped = mapping(value);
//       formData.set(key, valueMapped);
//     }
//   }
// }
// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };
