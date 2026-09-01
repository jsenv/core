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

import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "./control_hooks.jsx";
import { FormContext } from "./form_context.js";
import { isUIStateHeld } from "./held_ui_state.js";
import { dispatchRequestAction } from "./rules/control_action.js";
import { dispatchRequestResetUIState } from "./ui_state_dom.js";

/**
 * @param {object} props
 * @param {boolean} [props.standalone] - Its value is its own: the form does not
 *   register with the control group around it (a Picker, another form…), so
 *   what is typed in it never becomes part of that group's value, and nothing
 *   that group does — distributing a value, resetting, cascading validation —
 *   reaches it. For a form that lives INSIDE something else while answering a
 *   different question — "create the thing I am about to pick" inside a picker,
 *   say. Every control takes the same prop, for the same reason.
 * @param {boolean} [props.canSendWhileUnchanged] - Send even when nothing changed. By
 *   default a form only acts on an answer that is actually new: submitting a
 *   form nobody touched — one just rendered, one whose fields still hold their
 *   defaults, one reopened and left alone — runs no action, and after the first
 *   submission it is that value the next one is compared against. Everything
 *   around the action still happens either way: the constraints are checked,
 *   and what follows the send still follows it (the slide moves on, the popup
 *   closes) — the user is done regardless of whether there was anything to
 *   send. Set this for a form where sending the same thing twice is the point —
 *   a single button that fires off a notification, an action whose duplicates
 *   are fine. See also `readOnlyWhileFormUnchanged` on `Button`, for a submit that
 *   should say it is waiting rather than accept a press that sends nothing.
 * @param {any} [props.pristineKey] - What the form is measured against, taken
 *   again every time this changes. A form knows what it holds as soon as its
 *   fields have registered, which is the right moment for a form whose values
 *   are there on the first render — and never the right one for a screen that
 *   modifies something: the resource arrives a request later and fills the
 *   fields, and a form comparing against what it held BEFORE that opens already
 *   changed. Pass whatever says the filling is done (a boolean, the resource
 *   itself, a count of what has loaded) and what the fields carry at that
 *   moment becomes the reference — including the fields that settle in a render
 *   of their own, so there is no tick to wait for on the caller's side. Change
 *   it once, when the screen is ready: taken again after someone started
 *   typing, it would call what they wrote the reference.
 * @param {string} [props.command] - What follows a submission that went
 *   through: the form has answered its question, and this says what the screen
 *   does about it. Nothing runs when the submission is refused — the form then
 *   stays in front of the user, showing what it is waiting for.
 *
 *   `"--navi-close"` dismisses the popup the form is in,
 *   `"--navi-left"`/`"--navi-right"`/`"--navi-up"`/`"--navi-down"` move on the
 *   slide map it is in, `"--navi-nav-to:/the/url"` takes the user to a page,
 *   `"--navi-void"` stays put.
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
  return isNested ? <FormNested {...props} /> : <FormControl {...props} />;
};

// What both forms are made of: one group, one context for what is inside it.
const useFormGroup = (props) => {
  const propsForGroup = { ...props };
  delete propsForGroup.canSendWhileUnchanged;
  delete propsForGroup.pristineKey;
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
  const uiStateController = childrenWrapperProps.uiGroupStateController;
  // The signal, not the plain property: reading it here is what re-renders the
  // form as its fields change, which is what turns the submit button below
  // interactive the moment there is something to send.
  const uiState = uiStateController.uiStateSignal.value;
  // False until a field differs from what was last sent, true while it does,
  // and false again the moment it comes back to it — the plain fact about the
  // value, with no opinion about what a submit would do with it.
  const changed = !compareTwoJsValues(
    withoutEmptyFields(uiState),
    uiStateController.sentUIState,
  );
  // Read by READONLY_CONSTRAINT from a submit button held back by this form,
  // which has to be able to say what it is waiting for.
  uiStateController.changed = changed;
  // Asked by the action gate at submit time, whichever way the submit came in —
  // a submit event, a --navi-send command, requestSubmit() (see
  // control_action.js). The value it is given, not `changed` above: a
  // field changing updates the state synchronously while the re-render is a
  // microtask away, so typing and pressing Enter right after must not be read
  // against the state of the previous frame.
  uiStateController.shouldRequestAction = (value) =>
    Boolean(props.canSendWhileUnchanged) ||
    !compareTwoJsValues(
      withoutEmptyFields(value),
      uiStateController.sentUIState,
    );
  useHeldUIStateAsSent(uiStateController, props.pristineKey);
  useUnregisteredControlWarning(props.ref);

  const { basePseudoState, children } = formProps;
  // const disabled = basePseudoState[":disabled"];
  // const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const formContextValue = useMemo(() => {
    return { loading, changed };
  }, [loading, changed]);

  return {
    formRootProps,
    formProps,
    // What was sent is what the next submit is measured against. On success
    // only: an action that failed has not been sent, and the user must be able
    // to try the same value again.
    onnavi_action_end: () => {
      uiStateController.sentUIState = withoutEmptyFields(
        uiStateController.uiState,
      );
    },
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
  const { formRootProps, formProps, onnavi_action_end, inside } =
    useFormGroup(props);

  return (
    <Box
      {...formRootProps}
      {...formProps}
      onnavi_action_end={onnavi_action_end}
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
  const { formRootProps, formProps, onnavi_action_end, inside } =
    useFormGroup(props);

  return (
    <Box
      {...formRootProps}
      {...formProps}
      onnavi_action_end={onnavi_action_end}
      pseudoClasses={FormPseudoClasses}
    >
      {inside}
    </Box>
  );
};

// What the form HOLDS, as opposed to what it is showing — field by field, the
// question isUIStateHeld answers: a field it was given an answer for is held,
// a field merely showing a suggestion is not, and confirming that suggestion IS
// an answer ("yes, 18").
const readHeldUIState = (uiStateController) => {
  const uiState = uiStateController.uiState;
  // A form given a value holds all of it, whatever its fields say.
  if (uiStateController.hasValueProp) {
    return withoutEmptyFields(uiState);
  }
  const held = { ...uiState };
  for (const child of uiStateController.getChildControllers?.() || []) {
    if (child.name && !isUIStateHeld(child)) {
      delete held[child.name];
    }
  }
  return withoutEmptyFields(held);
};

// A field holding nothing is a field the form has nothing to say about, and
// whether it is absent or present-and-empty is an accident of when it
// registered — the baseline is taken before the fields have had their say, the
// value at submit after. Compared as they are, an empty form would look changed
// by the mere existence of an empty field.
const withoutEmptyFields = (uiState) => {
  if (!uiState || typeof uiState !== "object") {
    return {};
  }
  const kept = {};
  for (const key of Object.keys(uiState)) {
    const value = uiState[key];
    if (value !== undefined && value !== "") {
      kept[key] = value;
    }
  }
  return kept;
};

// Taken in a layout effect rather than during render because the fields
// register themselves in their own effects, which run first — this is the
// earliest moment the form knows what it holds. Everything after this baseline
// is a real send moving it forward (see useFormGroup's own onnavi_action_end).
//
// Taken a second time at the end of the tick, because "the earliest moment" is
// not always late enough: a field that re-renders on its own schedule rather
// than with the form — a row whose value is computed from signals, sitting
// behind a memo — brings its value in a render of its own, which lands after
// these effects. A form measured before it would open already changed, and
// would never take the reference again. Both takes are the same arrival, so the
// second one costs a render only when it moves something.
const useHeldUIStateAsSent = (uiStateController, pristineKey) => {
  // The render that brought a new pristineKey read `changed` against the
  // previous baseline, and nothing else is going to move: the button would stay
  // lit on a form that holds exactly what it was just given. So ask for the one
  // render that reads the new baseline — the first take on mount has nobody to
  // tell, every field it is waiting for re-renders the form as it registers.
  const [, rereadBaseline] = useState(0);
  const isFirstRef = useRef(true);
  useLayoutEffect(() => {
    const takeBaseline = () => {
      const baselineBefore = uiStateController.sentUIState;
      const baseline = readHeldUIState(uiStateController);
      uiStateController.sentUIState = baseline;
      return !compareTwoJsValues(baselineBefore, baseline);
    };
    const moved = takeBaseline();
    const isFirst = isFirstRef.current;
    isFirstRef.current = false;
    if (moved && !isFirst) {
      rereadBaseline((count) => count + 1);
    }
    // A microtask, not a timeout: everything that belongs to this arrival —
    // the renders preact still has queued, the state they push into the form —
    // happens before the tick ends, and nothing a person does can land in
    // between.
    let abandoned = false;
    queueMicrotask(() => {
      if (abandoned) {
        return;
      }
      if (takeBaseline()) {
        rereadBaseline((count) => count + 1);
      }
    });
    return () => {
      abandoned = true;
    };
  }, [uiStateController, pristineKey]);
};

// A named form element the form does not know about is worse than a field with
// no value: the form reads the controls registered with it, never the DOM, so
// that element is absent from the action AND absent from what makes the form
// look changed. A form whose only edit was that field then submits nothing at
// all — no request, no error, nothing to inspect. Say it out loud instead.
const NAMED_FORM_ELEMENT_SELECTOR = "input[name], select[name], textarea[name]";
const alreadyWarnedSet = new WeakSet();
const useUnregisteredControlWarning = (ref) => {
  // No dependency array: fields appear and disappear as the form re-renders,
  // and a field rendered later is exactly the one worth catching.
  useLayoutEffect(() => {
    if (!import.meta.dev) {
      return;
    }
    const root = ref.current;
    if (!root) {
      return;
    }
    for (const element of root.querySelectorAll(NAMED_FORM_ELEMENT_SELECTOR)) {
      if (element.hasAttribute("navi-control-host")) {
        continue;
      }
      if (alreadyWarnedSet.has(element)) {
        continue;
      }
      alreadyWarnedSet.add(element);
      console.warn(
        `[navi] <${element.tagName.toLowerCase()} name="${element.name}"> is inside a <Form> but is not a navi control: ` +
          `its value will not reach the action, and it will not make the form look changed (a submit may then do nothing at all). ` +
          `Use the navi control for it (Input, Select, Textarea…).`,
      );
      console.log(element);
    }
  });
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
