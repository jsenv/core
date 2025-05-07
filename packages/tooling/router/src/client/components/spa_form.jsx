/**
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
import { ABORTED } from "../action/action_status.js";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { useResetErrorBoundary } from "../hooks/use_reset_error_boundary.js";
import { canUseNavigation } from "../router.js";
import { FormContext } from "./use_spa_form_status.js";

const submit = HTMLFormElement.prototype.submit;
HTMLFormElement.prototype.submit = function (...args) {
  const form = this;
  if (form.hasAttribute("data-method")) {
    console.warn("You must use form.requestSubmit() instead of form.submit()");
    return form.requestSubmit();
  }
  return submit.apply(this, args);
};

export const SPAForm = forwardRef(
  ({ action: formAction, method = "get", formDataMappings, children }, ref) => {
    const innerRef = useRef();
    // see https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
    // and https://codepen.io/dmail/pen/XJJqeGp?editors=0010
    // To change if https://github.com/preactjs/preact/issues/4754 lands
    const [error, setError] = useState(null);
    const resetErrorBoundary = useResetErrorBoundary();
    useEffect(() => {
      if (error) {
        error.__handled__ = true; // prevent jsenv from displaying it
        throw error;
      }
    }, [error]);

    method = method.toLowerCase();

    const [formStatus, formStatusSetter] = useState({
      pending: false,
      aborted: false,
      error: null,
      method,
      action: formAction,
    });
    const formActionMapRef = useRef(new Map());

    useImperativeHandle(ref, () => innerRef.current);

    return (
      <form
        ref={innerRef}
        onSubmit={async (submitEvent) => {
          submitEvent.preventDefault();
          if (formStatus.pending) {
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
          if (resetErrorBoundary) {
            resetErrorBoundary();
          }
          setError(null);
          const action =
            formActionMapRef.current.get(submitEvent.submitter) || formAction;
          formStatusSetter({
            pending: true,
            aborted: false,
            error: null,
            method,
            action,
          });
          const formData = new FormData(submitEvent.currentTarget);
          if (formDataMappings) {
            for (const [key, mapping] of Object.entries(formDataMappings)) {
              const value = formData.get(key);
              if (value) {
                const valueMapped = mapping(value);
                formData.set(key, valueMapped);
              }
            }
          }
          await applyRoutingOnFormSubmission({
            method: method.toUpperCase(),
            formData,
            action,
          });
          const error = action.errorSignal.peek();
          formStatusSetter({
            pending: false,
            aborted: action.executionStateSignal.peek() === ABORTED,
            error,
            method,
            action,
          });
          if (error) {
            setError(error);
          }
        }}
        method={method === "get" ? "get" : "post"}
        data-method={method}
      >
        <FormContext.Provider value={[formStatus, formActionMapRef]}>
          {children}
        </FormContext.Provider>
      </form>
    );
  },
);

export const SPAButton = forwardRef(
  ({ formAction, children, ...props }, ref) => {
    const innerRef = useRef();
    const [, formActionMapRef] = useContext(FormContext);
    useImperativeHandle(ref, () => innerRef.current);

    useEffect(() => {
      return () => {
        formActionMapRef.current.delete(innerRef.current);
      };
    }, []);

    return (
      <button
        ref={innerRef}
        {...props}
        onClick={(clickEvent) => {
          formActionMapRef.current.set(innerRef.current, formAction);
          if (props.onClick) {
            props.onClick(clickEvent);
          }
        }}
      >
        {children}
      </button>
    );
  },
);
SPAForm.Button = SPAButton;

const applyRoutingOnFormSubmission = canUseNavigation
  ? async ({ method, formData, action }) => {
      try {
        await navigation.navigate(window.location.href, {
          history: "replace",
          info: {
            method,
            formAction: action,
            formData,
          },
        }).finished;
      } catch (e) {
        if (e.name === "AbortError") {
          return;
        }
        console.error(e);
        throw e;
      }
    }
  : () => {
      // TODO
    };
