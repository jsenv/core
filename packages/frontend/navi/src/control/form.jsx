/**
 * <Form>: the <form> element as a navi control group. Its named fields
 * aggregate into one object; a submit checks their constraints, runs `action`
 * with that object when it changed (docs/form_changed.md), and `command` — or
 * the surface the form sits in — says what follows. The URL does not change on
 * a submit, and a failing action is drawn as an error callout on the button
 * that sent it (docs/error_handling.md). A form inside another form renders no
 * <form> element (FormNested).
 */

import { computed, signal } from "@preact/signals";
import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { triggerNaviCommand } from "./commands.js";
import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "./control_hooks.jsx";
import { FormContext } from "./form_context.js";
import { isUIStateHeld } from "./held_ui_state.js";
import { uiStateIsChildEmpty } from "./ui_state_controller.js";
import { dispatchRequestResetUIState } from "./ui_state_dom.js";

/**
 * @param {object} props
 * @param {boolean} [props.standalone] - Its value is its own: the form does not
 *   register with the control group around it (a Picker, a ControlGroup), so
 *   what is typed in it never becomes part of that group's value, and nothing
 *   that group does — distributing a value, resetting, cascading validation —
 *   reaches it. For a form that lives INSIDE something else while answering a
 *   different question — "create the thing I am about to pick" inside a picker,
 *   say. Every control takes the same prop, for the same reason. A form inside
 *   another form is that by construction and does not need the prop: the group
 *   it would register into is a form, which never owns another form's fields.
 * @param {boolean} [props.canSendWhileUnchanged] - Send even when nothing changed. By
 *   default a form only acts on an answer that is actually new: submitting a
 *   form nobody touched — one just rendered, one reopened and left alone — runs
 *   no action (a field still showing its `defaultValue` is an answer: confirming
 *   a suggestion), and after the first submission it is that value the next
 *   one is compared against. A form holding no field at all always sends: the
 *   press is its whole answer. Everything around the action still happens either
 *   way: the constraints are checked, and what follows the send still follows
 *   it (the slide moves on, the popup closes) — the user is done regardless of
 *   whether there was anything to send. Set this for a form where sending the
 *   same thing twice is the point — the same message sent as a notification
 *   again, an action whose duplicates are fine. See also
 *   `readOnlyWhileFormUnchanged` on `Button`, for a submit that should say it
 *   is waiting rather than accept a press that sends nothing.
 * @param {"POST"|"PUT"|"PATCH"|"DELETE"} [props.actionVerb] - What a plain
 *   function `action` does to the server. A write verb puts the form under the
 *   network policy: its fields and its submit held read-only up front, with the
 *   policy's message, instead of failing after the press
 *   (docs/network_policy.md). An action bound to a resource verb says it
 *   already. A form whose function writes one verb or another depending on what
 *   it holds says either: the policy only asks whether it writes.
 * @param {boolean} [props.actionAbortable] - The person waiting may give up on
 *   the send: closing the popup this form holds calls the run off and goes
 *   through, instead of being refused, and a press on its busy submit answers
 *   « in progress » with a way to call it off. The form leaving the page while
 *   it sends calls it off too — removed, or parked by a suspension around it.
 *   For a send whose answer may never come —
 *   a request over a network that stops answering — where a sheet with no way
 *   out is worse than an answer lost. Aborting frees the client and nothing
 *   more: the write may already have landed on the other side (see
 *   docs/actions.md#aborting-saves-resources-it-does-not-undo), so say it only
 *   where the screen can be re-opened on what is actually there. Every control
 *   inside the form inherits it along with the wait itself.
 * @param {boolean} [props.optimistic] - The send is taken as done on the form's
 *   own word: no busy state, and what follows it (`command="--navi-close"`, a
 *   slide moving on) runs at once, the run going on behind. A failure then has
 *   no sheet to be read in: `resetOnError` puts the form back and the error
 *   callout is drawn on what surrounds the closed sheet — while the form is
 *   still mounted: a sheet that unmounts its content once closed
 *   (`mount="while-opened"`) leaves the failure to the report, and the value
 *   where it was. For a write not worth being
 *   waited for — a score, a note — never for one whose refusal changes what the
 *   person does next (see
 *   docs/popup_open.md#closing-when-a-button-also-runs-an-action).
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
 * @param {object} [props.record] - The record this form edits in place, for a
 *   screen that stays open after Save (a settings block). Each named field
 *   starts on its key, and the form holds it: a Save with nothing touched sends
 *   nothing. A new record — compared by content, so the same one read again is
 *   no move — is taken key by key: a field nobody touched shows it, a field
 *   being typed in keeps what is typed (and the form reads changed), and the
 *   form is measured against the new record from then on. After a send that
 *   went through, its answer landing as the next record is what the form
 *   holds. Undefined while the record loads, so no `pristineKey` is needed.
 *   The action receives the record with the fields' answers in it, keys no
 *   field answers for included. Excludes `value` and `defaultValue`.
 * @param {string} [props.command] - What follows a submission that went
 *   through: the form has answered its question, and this says what the screen
 *   does about it. Nothing runs when the submission is refused — the form then
 *   stays in front of the user, showing what it is waiting for.
 *
 *   `"--navi-close"` dismisses the popup the form is in,
 *   `"--navi-left"`/`"--navi-right"`/`"--navi-up"`/`"--navi-down"` move on the
 *   slide map it is in, `"--navi-nav-to:/the/url"` takes the user to a page,
 *   `"--navi-void"` stays put — the one for a form inside a popup that must
 *   stay open once it is sent (a side panel one keeps editing in),
 *   `"--navi-reset"` empties the form itself and stays.
 *   Any navi command, really: it is triggered from the form, so it finds its
 *   target the way that command always does — a command aimed at a control
 *   (`--navi-reset`, `--navi-clear`) is about the form itself.
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
  // is a different component: a group of its own, no <form> element and none of
  // the browser machinery that comes with it (see FormNested).
  const isNested = Boolean(useContext(FormContext));
  return isNested ? <FormNested {...props} /> : <FormControl {...props} />;
};

// What both forms are made of: one group, one context for what is inside it.
const useFormGroup = (props) => {
  const propsForGroup = { ...props };
  delete propsForGroup.canSendWhileUnchanged;
  delete propsForGroup.pristineKey;
  // The record is the group's default — placed on the fields as they
  // register, followed key by key (see placeAroundEdits in
  // ui_state_controller.js) — and what the form is measured against
  // (useHeldUIStateAsSent).
  delete propsForGroup.record;
  const { record } = props;
  if (record !== undefined) {
    if (
      import.meta.dev &&
      (Object.hasOwn(props, "value") || Object.hasOwn(props, "defaultValue"))
    ) {
      console.warn(
        `[navi] <Form record> excludes value and defaultValue: the record is what the fields start on.`,
      );
    }
    propsForGroup.defaultValue = record;
  }
  // Not the generic control `command`, which a control triggers on its own ui
  // actions — here it is what follows a SUCCESSFUL submission. So it is kept
  // out of the control machinery and left in the DOM for the send to read
  // (resolveAfterSend in commands.js).
  delete propsForGroup.command;
  propsForGroup["data-after-send"] = props.command;
  // What the form is measured against (useHeldUIStateAsSent, and each send
  // that went through). A signal read in the render below, so the form
  // re-renders whenever it moves — the first take included, which nothing else
  // re-renders when the fields were already filled at their first render (a
  // record).
  const sentUIStateSignal = useMemo(() => signal(undefined), []);
  // What was sent is what the next submit is measured against. On success
  // only: an action that failed has not been sent, and the user must be able
  // to try the same value again. The value the run was asked with, carried by
  // the navi_action_allowed event that started it — not what the form holds
  // now: what was typed while the run was out has not been sent yet. Handed to
  // the group, which calls it from its own action end, before acknowledging
  // what was sent.
  propsForGroup.onnavi_action_end = (e) => {
    const actionAllowedEvent = e.detail.event;
    const groupController = childrenWrapperProps.uiGroupStateController;
    sentUIStateSignal.value = withoutEmptyFields(
      readSentBaseline(actionAllowedEvent.detail.uiState, groupController),
      groupController,
    );
  };
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
  // False until a field differs from what was last sent, true while it does,
  // and false again the moment it comes back to it — the plain fact about the
  // value, with no opinion about what a submit would do with it. A form
  // holding no field — a "Continue", an "Accept", a "Join" alone in it — has
  // no answer that could ever differ from the last one: "unchanged" would
  // refuse every send, and its action would never run. The press is its whole
  // answer, so it always has something to send.
  //
  // A signal read by the submit button waiting for it
  // (`readOnlyWhileFormUnchanged`), which re-renders on its own as it flips.
  // A plain value in FormContext would re-render every control of the form
  // instead: each reads that context, to know it is in a form.
  const changedSignal = useMemo(
    () =>
      computed(
        () =>
          !uiStateController.holdsFieldSignal.value ||
          !compareTwoJsValues(
            withoutEmptyFields(
              uiStateController.uiStateSignal.value,
              uiStateController,
            ),
            sentUIStateSignal.value,
          ),
      ),
    [uiStateController],
  );
  // Asked by the action gate at submit time, whichever way the submit came in —
  // a submit event, a --navi-send command, requestSubmit() (see
  // control_action.js). The value it is given, not `changed` above: a
  // field changing updates the state synchronously while the re-render is a
  // microtask away, so typing and pressing Enter right after must not be read
  // against the state of the previous frame.
  uiStateController.shouldRequestAction = (value) =>
    Boolean(props.canSendWhileUnchanged) ||
    !uiStateController.holdsFieldSignal.peek() ||
    !compareTwoJsValues(
      withoutEmptyFields(value, uiStateController),
      sentUIStateSignal.peek(),
    );
  useHeldUIStateAsSent(
    uiStateController,
    sentUIStateSignal,
    props.pristineKey,
    record,
  );
  useUnregisteredControlWarning(props.ref);

  const { children } = formProps;
  const formContextValue = useMemo(() => {
    return { changedSignal };
  }, [changedSignal]);

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
  useRequestSubmitThroughGates(ref);

  return (
    <Box
      {...formRootProps}
      {...formProps}
      as="form"
      data-method={method}
      novalidate="" // make sure browser don't prevent "submit" when invalid, nor display messages
      pseudoClasses={FormPseudoClasses}
      onSubmit={(e) => {
        // The browser would load the form's action URL.
        e.preventDefault();
        const form = e.currentTarget;
        // The send a press on the form's submit makes: the action, then what
        // follows it (`command`, or the surface the form is in).
        triggerNaviCommand(form, "--navi-send", e, {
          requester: e.submitter,
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
//
// And it owns what it holds: `standalone`, unconditionally. A <Form> is a
// question with a send of its own, so its fields answer to it and to nothing
// above it — they are not in the outer form's value, not in its "changed", and
// not in the constraints it checks before sending. That last one is what a
// caller feels: a required field in a popup nobody opened would otherwise
// refuse the outer submit, pointing at something the screen is not even
// showing. A cluster of fields that IS part of the value around it is a
// <ControlGroup>, which is the shape without the send (see
// docs/control_object.md).
const FormNested = (props) => {
  const { formRootProps, formProps, inside } = useFormGroup({
    ...props,
    standalone: true,
  });

  return (
    <Box {...formRootProps} {...formProps} pseudoClasses={FormPseudoClasses}>
      {inside}
    </Box>
  );
};

// What the form HOLDS, as opposed to what it is showing — field by field, the
// question isUIStateHeld answers: a field it was given an answer for is held,
// a field merely showing a suggestion is not, and confirming that suggestion IS
// an answer ("yes, 18"). A key of the record is an answer it was given, even
// where the field's own suggestion says the same.
const readHeldUIState = (uiStateController, record) => {
  const uiState = uiStateController.uiState;
  // A form given a value holds all of it, whatever its fields say.
  if (uiStateController.hasValueProp) {
    return withoutEmptyFields(uiState, uiStateController);
  }
  const held = { ...uiState };
  for (const child of uiStateController.getChildControllers?.() || []) {
    if (
      child.name &&
      !isUIStateHeld(child) &&
      !Object.hasOwn(asObject(record), child.name)
    ) {
      delete held[child.name];
    }
  }
  return withoutEmptyFields(held, uiStateController);
};

// What a send leaves the form measured against: what it carried — except
// where a field shows a value the outside put there while the send was out (a
// record answering it, read back normalized): holding no edit, the field
// shows what the form holds now.
const readSentBaseline = (sentUIState, groupController) => {
  const baseline = { ...asObject(sentUIState) };
  const uiState = asObject(groupController.uiState);
  for (const [key, field] of readFieldsByKey(groupController)) {
    if (!field.holdsEdit()) {
      baseline[key] = uiState[key];
    }
  }
  return baseline;
};

// The record moved: the baseline moves with it where it moved, and nowhere
// else. A key nobody is editing is measured against what its field shows of
// the record now; a key being edited, against the record itself — the edit
// stays a change, and typing the record's value back makes it none.
const moveBaselineWithRecord = (
  uiStateController,
  baselineBefore,
  recordBefore,
  record,
) => {
  const before = asObject(recordBefore);
  const after = asObject(record);
  const uiState = asObject(uiStateController.uiState);
  const baseline = { ...baselineBefore };
  const fieldsByKey = readFieldsByKey(uiStateController);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (compareTwoJsValues(before[key], after[key])) {
      continue;
    }
    const field = fieldsByKey.get(key);
    baseline[key] = field && field.holdsEdit() ? after[key] : uiState[key];
  }
  return withoutEmptyFields(baseline, uiStateController);
};
// The field answering each key of a group's value. A nameless grouping
// answers for its controls' keys (see readNamedChildUIStates in
// ui_state_controller.js).
const readFieldsByKey = (groupController, fieldsByKey = new Map()) => {
  for (const child of groupController.getChildControllers?.() || []) {
    if (child.name) {
      if (!fieldsByKey.has(child.name)) {
        fieldsByKey.set(child.name, child);
      }
      continue;
    }
    if (child.getChildControllers) {
      readFieldsByKey(child, fieldsByKey);
    }
  }
  return fieldsByKey;
};
const asObject = (value) =>
  value !== null && typeof value === "object" ? value : {};

// A field holding nothing is a field the form has nothing to say about, and
// whether it is absent or present-and-empty is an accident of when it
// registered — the baseline is taken before the fields have had their say, the
// value at submit after, and a field mounted later (a slide built when near, an
// Expandable opened) is absent from one and present in the other. Compared as
// they are, an empty form would look changed by the mere existence of an empty
// field. So both sides leave out what each field holds when nothing was
// answered, in that field's own shape.
const withoutEmptyFields = (uiState, groupController) => {
  if (!uiState || typeof uiState !== "object") {
    return {};
  }
  const fieldsByKey = readFieldsByKey(groupController);
  const kept = {};
  for (const key of Object.keys(uiState)) {
    const value = uiState[key];
    if (!holdsNothing(value, fieldsByKey.get(key))) {
      kept[key] = value;
    }
  }
  return kept;
};
// No value, an empty text, the field's own empty (an unchecked yes/no is
// `false`, an empty list `[]` — see resolveEmptyUIState), or a group of fields
// each holding nothing. `field` is undefined for a key no field answers (a key
// of the record, say): only the shapes that say nothing whatever asks.
const holdsNothing = (value, field) => {
  if (value === undefined || value === "") {
    return true;
  }
  if (field && uiStateIsChildEmpty(value, field)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (isPlainObject(value)) {
    const partsByKey = field ? readFieldsByKey(field) : new Map();
    return Object.keys(value).every((key) =>
      holdsNothing(value[key], partsByKey.get(key)),
    );
  }
  return false;
};
const isPlainObject = (value) => {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

// Taken in a layout effect rather than during render because the fields
// register themselves in their own effects, which run first — this is the
// earliest moment the form knows what it holds. Everything after this baseline
// is a real send moving it forward (see useFormGroup's own onnavi_action_end).
// Written into a signal the form reads in its render: a take that moves the
// baseline re-renders the form, which reads `changed` against it.
//
// Taken a second time at the end of the tick, because "the earliest moment" is
// not always late enough: a field that re-renders on its own schedule rather
// than with the form — a row whose value is computed from signals, sitting
// behind a memo — brings its value in a render of its own, which lands after
// these effects. A form measured before it would open already changed, and
// would never take the reference again. Both takes are the same arrival, so the
// second one costs a render only when it moves something.
//
// A record moving needs no retake: its follow is placed in the render that
// brought it (followDefaultValue), so the baseline moves in the effect after,
// and only where the record moved — a whole retake would call what is being
// typed the reference.
const useHeldUIStateAsSent = (
  uiStateController,
  sentUIStateSignal,
  pristineKey,
  record,
) => {
  const recordTakenRef = useRef(record);
  const writeBaseline = (baseline) => {
    if (compareTwoJsValues(sentUIStateSignal.peek(), baseline)) {
      return;
    }
    sentUIStateSignal.value = baseline;
  };
  useLayoutEffect(() => {
    const takeBaseline = () => {
      writeBaseline(readHeldUIState(uiStateController, recordTakenRef.current));
    };
    takeBaseline();
    // A microtask, not a timeout: everything that belongs to this arrival —
    // the renders preact still has queued, the state they push into the form —
    // happens before the tick ends, and nothing a person does can land in
    // between.
    let abandoned = false;
    queueMicrotask(() => {
      if (abandoned) {
        return;
      }
      takeBaseline();
    });
    return () => {
      abandoned = true;
    };
  }, [uiStateController, pristineKey]);
  useLayoutEffect(() => {
    const recordBefore = recordTakenRef.current;
    if (compareTwoJsValues(recordBefore, record)) {
      return;
    }
    recordTakenRef.current = record;
    writeBaseline(
      moveBaselineWithRecord(
        uiStateController,
        sentUIStateSignal.peek(),
        recordBefore,
        record,
      ),
    );
  }, [uiStateController, record]);
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
// requestSubmit overridden on the form element so that a programmatic
// submission is the send a press makes: through the navi interaction gate
// (interactivity check), the action gate (validity), and on to what follows a
// send. On the element rather than on HTMLFormElement.prototype: only a navi
// form has those gates, and a prototype patch would be installed by importing
// navi, whether a form is used or not.
const useRequestSubmitThroughGates = (ref) => {
  useLayoutEffect(() => {
    const form = ref.current;
    form.requestSubmit = (submitter) => {
      const controller = form.__uiStateController__;
      if (!controller) {
        HTMLFormElement.prototype.requestSubmit.call(form, submitter);
        return;
      }
      triggerNaviCommand(
        form,
        "--navi-send",
        new CustomEvent("request_submit"),
        { requester: submitter },
      );
    };
    return () => {
      delete form.requestSubmit;
    };
  }, []);
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
