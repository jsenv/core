import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { FormContext } from "../form_context.js";
import { useOwnTargetHidden } from "../own_target.js";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";

const ButtonFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  const ownTargetHidden = useOwnTargetHidden(props);

  if (ownTargetHidden) {
    return null;
  }
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
  const { formCommand } = props;
  props.formCommand = undefined;
  props["data-after-send"] = formCommand;

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
  "--navi-confirm": () => ({
    children: naviI18n("button.confirm"),
    cta: true,
  }),
  "--navi-close": () => ({
    children: naviI18n("button.close"),
  }),
  "--navi-open": () => ({
    children: naviI18n("button.open"),
  }),
};

/**
 * @type {import("preact").FunctionComponent<{
 *   ownTarget?: boolean | "refuse" | "always",
 *   emojiAsIcon?: boolean,
 *   replace?: boolean,
 *   [key: string]: any,
 * }>}
 * @param {boolean} [replace] Go where the press leads — an `href`, a
 *   `--navi-nav-to` command — by TAKING THE PLACE of the current history entry
 *   rather than stacking on it: what `<Link replace>` says, for a press drawn
 *   as a button.
 * @param {Function} [action] On a button with an `href` or a `route`, the
 *   same order as a Link's: it runs on the press, before the navigation, and
 *   the navigation does not wait for it (see Link's `action`).
 * @param {boolean} [emojiAsIcon=true] Renders the emoji of the label as icons
 *   so the button keeps the height of its text — `Text`'s prop, on by default
 *   here. Pass `false` to let an emoji draw at its natural size.
 * @param {boolean|"refuse"|"always"} [ownTarget] A real target inside a zone
 *   that belongs to another control — a chip's cross on a picker's façade, an
 *   eye on a pressable row, a diskette inside a slide that travels. The press is
 *   this button's alone (no travel starts, no popup opens, no navi control above
 *   answers) and its `onClick` waits for its own interaction gate instead of
 *   firing from the DOM. What it does where the zone is read-only, disabled or
 *   busy depends on whether it WRITES to the control it sits in: it goes by
 *   default, `"refuse"` keeps it and refuses with a callout, `"always"` ignores
 *   the zone's state entirely — for a gesture that never touched that control.
 */
export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUI,
]);
