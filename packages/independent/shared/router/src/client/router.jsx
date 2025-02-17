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
import { useContext, useState } from "preact/hooks";
import { canUseNavigation } from "./router.js";

const FormContext = createContext();
export const useSPAFormStatus = () => {
  return useContext(FormContext);
};

export const SPAForm = ({ action, method, children }) => {
  const [formStatus, formStatusSetter] = useState({
    pending: false,
    error: null,
    // method,
    // action
  });

  return (
    <form
      onSubmit={async (submitEvent) => {
        formStatusSetter({ pending: true, error: null });
        submitEvent.preventDefault();
        const formData = new FormData(submitEvent.currentTarget);
        try {
          await applyRoutingOnFormSubmission({ method, formData, action });
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
    >
      <FormContext.Provider value={formStatus}>{children}</FormContext.Provider>
    </form>
  );
};

const applyRoutingOnFormSubmission = canUseNavigation
  ? async ({ method, formData, action }) => {
      await navigation.navigate(window.location.href, {
        history: "replace",
        info: {
          method,
          formData,
          formUrl: action,
        },
      }).finished;
    }
  : () => {
      // TODO
    };
