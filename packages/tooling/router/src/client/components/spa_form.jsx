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
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { useResetErrorBoundary } from "../hooks/use_reset_error_boundary.js";
import { canUseNavigation } from "../router.js";
import { FormContext } from "../hooks/use_spa_form_status.js";

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
  ({ action, method = "get", children }, ref) => {
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
      error: null,
      method,
      action,
    });
    const formActionMapRef = useRef(new Map());

    useImperativeHandle(ref, () => innerRef.current);

    return (
      <form
        ref={innerRef}
        onSubmit={async (submitEvent) => {
          if (resetErrorBoundary) {
            resetErrorBoundary();
          }
          setError(null);
          formStatusSetter({ pending: true, error: null });
          submitEvent.preventDefault();
          const formData = new FormData(submitEvent.currentTarget);
          const actionToPerform =
            formActionMapRef.current.get(submitEvent.submitter) || action;
          try {
            await applyRoutingOnFormSubmission({
              method: method.toUpperCase(),
              formData,
              action: actionToPerform,
            });
          } catch (e) {
            formStatusSetter({ pending: false, error: e });
            setError(e);
          }
          // the data we don't need them here, we can read them from the route
          // by the way the error is likely also stored on the PATH route
          // but for now let's ignore
          formStatusSetter({ pending: false });
        }}
        method={method === "get" ? "get" : "post"}
        data-action={typeof action === "string" ? action : undefined}
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
      const startNav = async () => {
        await navigation.navigate(window.location.href, {
          history: "replace",
          info: {
            method,
            formData,
            formAction: action,
          },
        }).finished;
      };
      try {
        await startNav();
      } catch (e) {
        if (e && e.name === "AbortError") {
          return;
        }
        throw e;
      }
    }
  : () => {
      // TODO
    };
