import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { FormContext } from "../form_context.js";
import { useSelfInteractionsHidden } from "../self_interactions.js";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";

const ButtonFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  const selfInteractionsHidden = useSelfInteractionsHidden(props);

  if (selfInteractionsHidden) {
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
 *   selfInteractions?: string,
 *   whenSelfInteractionsBlocked?: "hide" | "refuse" | "ignore",
 *   replace?: boolean,
 *   [key: string]: any,
 * }>}
 * @param {boolean} [replace] Go where the press leads — an `href`, a
 *   `--navi-nav-to` command — by TAKING THE PLACE of the current history entry
 *   rather than stacking on it: what `<Link replace>` says, for a press drawn
 *   as a button.
 * @param {boolean} [pressableDuringRouteTransition] Keep answering presses
 *   while a route transition plays: what a movement photographs goes deaf to
 *   the pointer for its whole length, and the door that opened the page — a
 *   button in a bar the two states share, standing exactly where its picture is
 *   drawn — must still close it. What `<Link pressableDuringRouteTransition>`
 *   says, for the other half of a toggle. Only for a control that does not
 *   travel with the pages.
 * @param {Function} [action] On a button with an `href` or a `route`, the
 *   same order as a Link's: it runs on the press, before the navigation, and
 *   the navigation does not wait for it (see Link's `action`).
 * @param {string} [selfInteractions] The interactions this button takes for
 *   itself inside a zone that belongs to another control — a chip's cross on a
 *   picker's façade, an eye on a pressable row, a badge against the edge of a
 *   card one carries. A required list, because a press is not a drag:
 *   `"click"` makes the press this button's alone (no popup opens, no navi
 *   control above answers) and leaves the grab to whatever it sits in,
 *   `"click drag"` takes both, `"*"` takes every gesture there is. Whatever is
 *   claimed, the button's `onClick` waits for its own interaction gate instead
 *   of firing from the DOM.
 * @param {"hide"|"refuse"|"ignore"} [whenSelfInteractionsBlocked] What becomes
 *   of it where the zone around it is disabled or read-only, which is settled
 *   by whether it WRITES to the control it sits in: it goes (`"hide"`, the
 *   default), `"refuse"` keeps it and refuses with a callout, `"ignore"` lets
 *   it through untouched — for an affordance that never wrote to that control.
 * @param {string} [contentDisplay] The display of the frame the button draws
 *   around its children. It follows the button's own by default — its display
 *   and, a display alone saying nothing about direction, the rest of its flow
 *   with it — so what the button is laid out as is what its children are laid
 *   out in. `"contents"` takes that frame out of the layout entirely, for a
 *   button whose drawing is the caller's from edge to edge — the same badge
 *   drawn as a Box somewhere else and as a Button here: the children then ARE
 *   the button's children, laid out by whatever lays the button out, and an
 *   absolutely positioned one among them resolves against the button rather
 *   than against the frame. There is no box left to paint then, so the frame's
 *   padding, border and background go with it; the button keeps the focus ring
 *   (it wears it itself) and loses the shrink under the finger, which has
 *   nothing left to scale but the interactive area itself.
 */
export const Button = createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUI,
]);
