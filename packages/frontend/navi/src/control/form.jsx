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

import { useContext, useMemo, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "./control_hooks.jsx";
import { FormContext } from "./form_context.js";
import { dispatchRequestAction } from "./rules/control_action.js";
import { ParentUIStateControllerContext } from "./ui_state_controller.js";
import { dispatchRequestResetUIState } from "./ui_state_dom.js";

/**
 * @param {object} props
 * @param {boolean} [props.standalone] - Its value is its own: the form does not
 *   register with the control group around it (a Picker, another form…), so
 *   what is typed in it never becomes part of that group's value. For a form
 *   that lives INSIDE something else while answering a different question —
 *   "create the thing I am about to pick" inside a picker, say.
 */
export const Form = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // A <form> cannot contain a <form> — the parser closes the first one at the
  // second's opening tag, so the inner fields would silently belong to the
  // outer form. Rather than forbidding the shape (a form inside a picker
  // inside a form is a legitimate thing to want), the inner one renders as a
  // <div>: everything navi does — grouping, validation, action — is ours, and
  // only the browser's own submit machinery needs a real <form>.
  const isNested = Boolean(useContext(FormContext));
  const form = <FormControl {...props} nested={isNested} />;
  if (props.standalone) {
    // Nothing above to register with: the group hooks read the parent from
    // this context, so emptying it here is the whole opt-out.
    return (
      <ParentUIStateControllerContext.Provider value={undefined}>
        {form}
      </ParentUIStateControllerContext.Provider>
    );
  }
  return form;
};

const FormControl = (props) => {
  const { ref, method = "GET", nested } = props;
  // nested/standalone are ours, not the DOM's: standalone was already consumed
  // by Form above, and nested only decides what is rendered here.
  const propsForGroup = { ...props };
  delete propsForGroup.nested;
  delete propsForGroup.standalone;
  props = propsForGroup;
  const [formRootProps, formProps, childrenWrapperProps] = useControlgroupProps(
    props,
    {
      allowCapture: true,
      wantRequesterButtonState: true,
      controlType: "form",
      stateType: "object",
      cascadeValidationToChildren: true,
    },
  );
  const { basePseudoState, children } = formProps;
  // const disabled = basePseudoState[":disabled"];
  // const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const formContextValue = useMemo(() => {
    return { loading };
  }, [loading]);

  return (
    <Box
      {...formRootProps}
      {...formProps}
      as={nested ? "div" : "form"}
      data-method={nested ? undefined : method}
      // make sure browser don't prevent "submit" when invalid, nor display messages
      novalidate={nested ? undefined : ""}
      pseudoClasses={FormPseudoClasses}
      // Nothing native to intercept on a <div>: there is no submit event and no
      // requestSubmit() to go through, so a nested form is driven the way every
      // other group is — a command, or an action requested on it.
      onSubmit={
        nested
          ? undefined
          : (e) => {
              const form = e.currentTarget;
              dispatchRequestAction(form, {
                event: e,
                name: "form_submit",
                always: () => {
                  e.preventDefault();
                },
                requester: e.submitter || form,
              });
            }
      }
      onReset={
        nested
          ? undefined
          : (e) => {
              const form = ref.current;
              dispatchRequestResetUIState(form, e);
              // browser would empty all fields to their default values (likely
              // empty/unchecked) we want to reset to the last known external
              // state instead
              e.preventDefault();
            }
      }
    >
      <FormContext.Provider value={formContextValue}>
        <ControlgroupChildrenWrapper
          {...childrenWrapperProps}
          // do not propagate name to children like radio group or checkbox group does
          // (otherwise anonymous button end up using that name)
          name={undefined}
        >
          {children}
        </ControlgroupChildrenWrapper>
      </FormContext.Provider>
    </Box>
  );
};
const FormPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];

// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
// Override requestSubmit so that programmatic form submissions go through the
// navi interaction gate (interactivity check) and then the action gate (validity).
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  const form = this;
  const controller = form.__uiStateController__;
  if (!controller) {
    requestSubmit.call(form, submitter);
    return;
  }
  const programmaticEvent = new CustomEvent("programmatic_request_submit", {
    cancelable: true,
    detail: { submitter },
  });
  dispatchRequestAction(form, {
    event: programmaticEvent,
    name: "requestSubmit",
    requester: submitter,
  });
};

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };
