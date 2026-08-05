import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { FormContext } from "../form_context.js";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";

const ButtonFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  return <Next {...props} />;
};

const ButtonCommandPropResolver = (props) => {
  const Next = useNextResolver();
  const form = useContext(FormContext);

  if (props.type === "submit") {
    props.type = "button";
    props.command = props.command || "--navi-send";
  }
  const command = props.command;
  // What follows a send THIS button asked for, overriding the form's own
  // `command` (see resolveAfterSend in commands.js). Named after the browser's
  // formaction/formmethod/formtarget, which are the same idea: a submit button
  // saying how its own submission differs. For a form with two ways out —
  // "save" stays, "delete" goes back to the list.
  // Written only when the caller said something, empty string included: an
  // empty one means "nothing follows my send", which is not the same as saying
  // nothing at all (then the form, or the surface around it, decides).
  const { formCommand } = props;
  props.formCommand = undefined;
  if (formCommand !== undefined) {
    props["data-after-send"] = formCommand;
  }

  // `readOnlyWhileFormUnchanged`: hold the send button back until the form
  // around it holds something new, so it says it is waiting instead of
  // accepting a press that would send nothing.
  //
  // Opt-in, because a press that sends nothing is usually still worth
  // accepting: in a dialog or a slide it closes the dialog / moves to the next
  // step all the same — the user IS done, there was simply nothing to send. It
  // is only in a form that goes nowhere on its own (one in the document) that
  // the press would visibly do nothing at all.
  //
  // Passed to Next rather than written onto props like everything else here:
  // these answer to something outside the button and flip back, and the props
  // object outlives the render (a button inside a form is the same vnode when
  // the form re-renders around it), so a write would never be undone.
  const heldByForm = Boolean(
    props.readOnlyWhileFormUnchanged &&
    command === "--navi-send" &&
    form?.changed === false,
  );
  const readOnly = heldByForm ? true : props.readOnly;

  // Called fresh on every render (not a module-level object computed once
  // at import time) — naviI18n(...) must be re-evaluated per call so a
  // Button using a command's built-in default label actually follows
  // setPreferredLanguage()/a "languagechange" event instead of staying
  // stuck with whatever language was active the first time this module was
  // imported.
  const getCommandDefaultProps = COMMAND_DEFAULT_PROPS_FACTORIES[command];
  if (getCommandDefaultProps) {
    const commandDefaultProps = getCommandDefaultProps();
    for (const key of Object.keys(commandDefaultProps)) {
      if (props[key] === undefined) {
        props[key] = commandDefaultProps[key];
      }
    }
  }

  return (
    <Next
      {...props}
      readOnlyWhileFormUnchanged={undefined}
      readOnly={readOnly}
      // Why it is read-only, for READONLY_CONSTRAINT to say the right thing:
      // read-only for some other reason (a caller's own prop, a read-only form
      // around it) must not be explained as "waiting for a change".
      data-readonly-reason={heldByForm ? "form-unchanged" : undefined}
    />
  );
};
const COMMAND_DEFAULT_PROPS_FACTORIES = {
  "--navi-clear": () => ({
    children: naviI18n("button.clear"),
  }),
  "--navi-reset": () => ({
    children: naviI18n("button.reset"),
  }),
  "--navi-define": () => ({
    children: naviI18n("button.define"),
  }),
  "--navi-send": () => ({
    children: naviI18n("button.send"),
    cta: true,
  }),
  "--navi-cancel": () => ({
    children: naviI18n("button.cancel"),
  }),
  "--navi-close": () => ({
    children: naviI18n("button.close"),
  }),
  "--navi-open": () => ({
    children: naviI18n("button.open"),
  }),
};

export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUI,
]);
