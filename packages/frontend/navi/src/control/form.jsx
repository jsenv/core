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

import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
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
 * @param {boolean} [props.sendUnchanged] - Send even when nothing changed. By
 *   default a form only acts on an answer that is actually new: submitting a
 *   form nobody touched — one just rendered, one whose fields still hold their
 *   defaults, one reopened and left alone — runs no action, and after the first
 *   submission it is that value the next one is compared against. What follows
 *   the send still happens either way (the slide moves on, the popup closes):
 *   the user is done regardless of whether there was anything to send. Set this
 *   for a form where sending the same thing twice is the point — a single
 *   button that fires off a notification, an action whose duplicates are fine.
 * @param {string} [props.command] - What follows a submission that went
 *   through: the form has answered its question, and this says what the screen
 *   does about it. Nothing runs when the submission is refused — the form then
 *   stays in front of the user, showing what it is waiting for.
 *
 *   `"--navi-close"` dismisses the popup the form is in, `"--navi-previous"` /
 *   `"--navi-next"` walk the slide list it is in, `"--navi-void"` stays put.
 *   Any navi command, really: it is triggered from the form, so it finds its
 *   target the way that command always does.
 *
 *   Left out, the surface the form sits in decides (see resolveAfterSend in
 *   commands.js): a popup closes, a slide goes on to the next one — or back to
 *   the one it came from when there is no next — and a form on a page does
 *   nothing.
 */
export const Form = (props) => {
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // A <form> cannot contain a <form> — the parser closes the first one at the
  // second's opening tag, so the inner fields would silently belong to the
  // outer form. Rather than forbidding the shape (a form inside a picker inside
  // a form is a legitimate thing to want), a form that finds itself inside one
  // is a different component: same group, no <form> element and none of the
  // browser machinery that comes with it.
  const isNested = Boolean(useContext(FormContext));
  const form = isNested ? (
    <FormNested {...props} />
  ) : (
    <FormControl {...props} />
  );
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

// What both forms are made of: one group, one context for what is inside it.
// standalone is read by Form above and never goes further — least of all to the
// DOM.
const useFormGroup = (props) => {
  const propsForGroup = { ...props };
  delete propsForGroup.standalone;
  delete propsForGroup.sendUnchanged;
  // Not the generic control `command`, which a control triggers on its own ui
  // actions — here it is what follows a SUCCESSFUL submission. So it is kept
  // out of the control machinery and left in the DOM for the send to read
  // (resolveAfterSend in commands.js).
  delete propsForGroup.command;
  propsForGroup["data-after-send"] = props.command;
  const [formRootProps, formProps, childrenWrapperProps] = useControlgroupProps(
    propsForGroup,
    {
      allowCapture: true,
      wantRequesterButtonState: true,
      controlType: "form",
      stateType: "object",
      cascadeValidationToChildren: true,
    },
  );
  useSentValue(
    childrenWrapperProps.uiGroupStateController,
    props.sendUnchanged,
  );

  const { basePseudoState, children } = formProps;
  // const disabled = basePseudoState[":disabled"];
  // const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const formContextValue = useMemo(() => {
    return { loading };
  }, [loading]);

  return {
    formRootProps,
    formProps,
    inside: (
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
    ),
  };
};

const FormControl = (props) => {
  const { ref, method = "GET" } = props;
  const { formRootProps, formProps, inside } = useFormGroup(props);

  return (
    <Box
      {...formRootProps}
      {...formProps}
      as="form"
      data-method={method}
      novalidate="" // make sure browser don't prevent "submit" when invalid, nor display messages
      pseudoClasses={FormPseudoClasses}
      onSubmit={(e) => {
        const form = e.currentTarget;
        dispatchRequestAction(form, {
          event: e,
          name: "form_submit",
          always: () => {
            e.preventDefault();
          },
          requester: e.submitter || form,
        });
      }}
      onReset={(e) => {
        const form = ref.current;
        dispatchRequestResetUIState(form, e);
        // browser would empty all fields to their default values (likely empty/unchecked)
        // we want to reset to the last known external state instead
        e.preventDefault();
      }}
    >
      {inside}
    </Box>
  );
};

// A form inside a form: the group, without the element. There is no submit
// event to intercept and no requestSubmit() to go through, so it is driven the
// way every other group is — a command, or an action requested on it. method
// belongs to the browser's own submission, so it means nothing here either.
const FormNested = (props) => {
  const { formRootProps, formProps, inside } = useFormGroup(props);

  return (
    <Box {...formRootProps} {...formProps} pseudoClasses={FormPseudoClasses}>
      {inside}
    </Box>
  );
};

// Same idea as an input's own lastActionValueRef (control_hooks.jsx): what was
// last sent, kept so the same thing is not sent twice. A form is only asked
// about it at submit time, and the answer is read by the action gate wherever
// the submit came from — a submit event, a `--navi-send` command,
// `requestSubmit()` — so it is exposed on the controller rather than checked
// in one of those three places.
const NOTHING_SENT_YET = Symbol.for("nothing_sent_yet");

const useSentValue = (uiStateController, sendUnchanged) => {
  const sentValueRef = useRef(NOTHING_SENT_YET);

  uiStateController.shouldRequestAction = (value) => {
    if (sendUnchanged) {
      return true;
    }
    return !compareTwoJsValues(value, sentValueRef.current);
  };

  useLayoutEffect(() => {
    // The value the form opens on counts as already sent: a form nobody has
    // touched has nothing to say, defaults filled in or not. Read here rather
    // than during render because the fields register themselves in their own
    // effects, which run first — this is the earliest the form knows what it
    // holds.
    sentValueRef.current = uiStateController.uiState;
    const element = uiStateController.ref.current;
    if (!element) {
      return null;
    }
    // On success only: an action that failed has not been sent, and the user
    // must be able to try the same value again.
    const onActionEnd = () => {
      sentValueRef.current = uiStateController.uiState;
    };
    element.addEventListener("navi_action_end", onActionEnd);
    return () => {
      element.removeEventListener("navi_action_end", onActionEnd);
    };
  }, [uiStateController]);
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
