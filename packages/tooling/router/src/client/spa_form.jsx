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

import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { canUseNavigation } from "./router.js";

const FormContext = createContext();
export const useSPAFormStatus = () => {
  const [formStatus] = useContext(FormContext);
  return formStatus;
};

export const SPAForm = ({ action, method, children }) => {
  const [formStatus, formStatusSetter] = useState({
    pending: false,
    error: null,
    method,
    action,
  });
  const formActionMapRef = useRef(new Map());

  return (
    <form
      onSubmit={async (submitEvent) => {
        formStatusSetter({ pending: true, error: null });
        submitEvent.preventDefault();
        const formData = new FormData(submitEvent.currentTarget);
        const actionToPerform =
          formActionMapRef.current.get(submitEvent.submitter) || action;
        try {
          await applyRoutingOnFormSubmission({
            method,
            formData,
            action: actionToPerform,
          });
        } catch (e) {
          formStatusSetter({ pending: false, error: e });
          return;
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
};

export const DeleteLink = ({ href, children, ...rest }) => {
  return (
    <SPAForm action={href} method="DELETE">
      <button type="submit" {...rest}>
        {children}
      </button>
    </SPAForm>
  );
};

const SPAFormButton = forwardRef(({ formAction, children, ...props }, ref) => {
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
        if (props.onClick) {
          props.onClick(clickEvent);
        }
        formActionMapRef.current.set(innerRef.current, formAction);
      }}
    >
      {children}
    </button>
  );
});
SPAForm.Button = SPAFormButton;

const applyRoutingOnFormSubmission = canUseNavigation
  ? async ({ method, formData, action }) => {
      const startNav = async () => {
        if (typeof action === "function") {
          await navigation.navigate(window.location.href, {
            history: "replace",
            info: {
              action,
              formData,
            },
          }).finished;
        } else {
          await navigation.navigate(window.location.href, {
            history: "replace",
            info: {
              method,
              formData,
              formUrl: action,
            },
          }).finished;
        }
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
