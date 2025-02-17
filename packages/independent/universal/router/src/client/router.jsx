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

import { cloneElement, toChildArray } from "preact";
import { useState } from "preact/hooks";
import { canUseNavigation } from "./router.js";

export const SPAForm = ({ action, method, children }) => {
  const [formStatus, formStatusSetter] = useState({
    pending: false,
    data: null,
    // method,
    // action,
  });
  children = toChildArray(children);

  return (
    <form
      onSubmit={async (submitEvent) => {
        formStatusSetter({ pending: true });
        submitEvent.preventDefault();
        const formData = new FormData(submitEvent.currentTarget);
        if (canUseNavigation) {
          try {
            await navigation.navigate(window.location.href, {
              history: "replace",
              info: {
                method,
                formData,
                formUrl: action,
              },
            }).finished;
          } catch {
            formStatusSetter({ pending: false });
            // navigation aborted (or other type of error already handled bu the router)
            return;
          }
          formStatusSetter({ pending: false });
        } else {
          // TODO
        }
      }}
      method={method === "get" ? "get" : "post"}
    >
      {children.map((child) => {
        return cloneElement(child, { formStatus });
      })}
    </form>
  );
};
