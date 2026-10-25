import { useContext, useRef } from "preact/hooks";

import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Box } from "@jsenv/navi/src/box/box.jsx";
import { buttonI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { FormContext } from "../form_context.js";
import { useCalloutRequestClose } from "../rules/callout/callout.jsx";
import { provideBusyAbortMessage } from "../rules/interaction/busy_abort_message.js";
import { useSelfInteractionsHidden } from "../self_interactions.js";
import { ButtonConfirmResolver } from "./button_confirm.jsx";
import { ButtonHrefResolver } from "./button_href.jsx";
import { ButtonRouteResolver } from "./button_route.jsx";
import { ButtonUI } from "./button_ui.jsx";
import { ButtonUpdateAppliedResolver } from "./button_update_applied.jsx";

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
  // at import time) — buttonI18n(...) must be re-evaluated per call so a
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
    children: buttonI18n("button.clear"),
  }),
  "--navi-reset": () => ({
    children: buttonI18n("button.reset"),
  }),
  "--navi-define": () => ({
    children: buttonI18n("button.define"),
  }),
  "--navi-send": () => ({
    children: buttonI18n("button.send"),
    cta: true,
  }),
  "--navi-cancel": () => ({
    children: buttonI18n("button.cancel"),
  }),
  "--navi-confirm": () => ({
    children: buttonI18n("button.confirm"),
    cta: true,
  }),
  "--navi-close": () => ({
    children: buttonI18n("button.close"),
  }),
  "--navi-open": () => ({
    children: buttonI18n("button.open"),
  }),
};

/**
 * @type {import("preact").FunctionComponent<{
 *   selfInteractions?: string,
 *   whenSelfInteractionsBlocked?: "hide" | "refuse" | "ignore",
 *   replace?: boolean,
 *   asReturn?: boolean,
 *   open?: string | { id: string, type?: "push" | "replace" },
 *   document?: boolean,
 *   actionStandalone?: boolean,
 *   actionAbortable?: boolean,
 *   optimistic?: boolean,
 *   route?: object,
 *   routeParams?: object,
 *   current?: boolean,
 *   currentExcept?: object | object[],
 *   currentAlso?: object | object[],
 *   actionVerb?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
 *   badge?: boolean | import("preact").ComponentChildren,
 *   badgeLabel?: string,
 *   [key: string]: any,
 * }>}
 * @param {boolean|import("preact").ComponentChildren} [badge] A mark across the
 *   top-right corner of the button's frame saying something waits where it
 *   leads (a contact means to repair, a task to do). `true` draws a dot;
 *   anything else is drawn there as given. Drawn from the state:
 *   `badge={brokenCount > 0}`. An icon button without a size of its own has a
 *   frame hugging its icon, so the mark sits on the icon; a button whose press
 *   area is larger than its glyph puts `badge` on its `<Icon>` instead. Read
 *   through `--navi-badge-mark-color` (the accent), `--navi-badge-mark-size`,
 *   `--navi-badge-mark-ring-color` (the paper) and
 *   `--navi-badge-mark-ring-width`.
 * @param {string} [badgeLabel] What the mark means, joined to the button's name
 *   ("Réglages, Un moyen de contact à réparer") — to its `aria-label` when it
 *   has one. Without it the mark is silent.
 * @param {object} [route] Where the press leads, as a `<Link route>` says it:
 *   the button is drawn as an `<a>` to the route's url (with `routeParams`),
 *   and says whether it is the page one is on — `[data-href-current]` for the
 *   eye, `aria-current="page"` for assistive tech. A bar entry drawn as a
 *   button for its press feedback.
 * @param {boolean} [current] Forces that "current" state: `true` on, `false`
 *   off. Left out, it is read from the route (or the `href`).
 * @param {object|object[]} [currentExcept] Route(s) inside the button's own
 *   that are NOT it, and `currentAlso` route(s) beside it that are: what they
 *   mean on a `<Link>`.
 * @param {boolean} [replace] Go where the press leads — an `href`, a
 *   `--navi-nav-to` command — by TAKING THE PLACE of the current history entry
 *   rather than stacking on it: what `<Link replace>` says, for a press drawn
 *   as a button.
 * @param {boolean} [asReturn] The push is a return by meaning: the page lands
 *   where its address was last left (the document's offset, the positions its
 *   lists kept), as a back would bring it — what `<Link asReturn>` says, read
 *   off an `href`, a `route` or a `--navi-nav-to` command.
 * @param {string|{id: string, type?: "push"|"replace"}} [open] Lands with one
 *   of the destination's popups open, named the way its `navState` names it:
 *   what `<Link open>` says, for a press drawn as a button.
 * @param {boolean} [document] The `href` is ANOTHER DOCUMENT of this origin —
 *   an admin panel, a status page, anything built as its own entry point — so
 *   the press is left to the browser and loads that page, instead of being
 *   routed to the app's not-found screen. What `<Link document>` says, for a
 *   press drawn as a button; and the reason to say it rather than navigate
 *   from an `action` is that the button stays a real link (an address, a
 *   middle click, "open in new tab"). Nothing is prefetched on the way there.
 * @param {string} [commandFor] The id of what `command` acts on. The button is
 *   the command's source — what a Popover is placed against, what a lifting
 *   Dialog lifts from and lands back into. A button bigger than what the popup
 *   comes out of names that part with `navi-command-proxy-for="<id>"`: the
 *   element with that id is the source the popup reads, while the press, the
 *   value and the focus stay the button's (docs/popup_open.md#the-anchor).
 * @param {boolean} [prefetch=true] Fetch the code of where this leads when the
 *   pointer or the focus arrives, ahead of the press (see
 *   docs/dynamic_import.md): the route actions that ask nothing of the
 *   address — a page's code, a read without params — are prerun; one keyed by
 *   a param waits for the arrival. With a `--navi-open`/`--navi-toggle`
 *   command instead, the press — not the hover: what it asks is keyed by the
 *   popup — preruns the route actions whose params the popup's opening
 *   changes, read as if its `signal` held its `value`. `false` for a
 *   destination not worth fetching ahead.
 * @param {boolean} [pressableDuringRouteTransition] Keep answering presses
 *   while a route transition plays: what a movement photographs goes deaf to
 *   the pointer for its whole length, and the door that opened the page — a
 *   button in a bar the two states share, standing exactly where its picture is
 *   drawn — must still close it. What `<Link pressableDuringRouteTransition>`
 *   says, for the other half of a toggle. Only for a control that does not
 *   travel with the pages.
 * @param {Function} [action] What the press runs: a button holds no value, so
 *   every press is one call. The button is busy while it runs, refuses a second
 *   press and draws the error on itself. On a button with an `href` or a
 *   `route`, the same order as a Link's: it runs on the press, before the
 *   navigation, and the navigation does not wait for it (see Link's `action`).
 * @param {"GET"|"POST"|"PUT"|"PATCH"|"DELETE"} [actionVerb] What a plain
 *   function `action` does to the server. A write verb puts the button under
 *   the network policy: held read-only up front, with the policy's message,
 *   instead of failing after the press (docs/network_policy.md). An action
 *   bound to a resource verb says it already.
 * @param {Function} [uiAction] The same press, for what cannot fail and takes
 *   no time — moving something else on screen: a plain callback, no busy
 *   state, nothing drawn if it throws (see docs/actions.md#action-or-uiaction).
 *   A button that stays pressed (a mode, show/hide, a setting) is a checkbox
 *   drawn as a button (`<Input type="checkbox" variant="button" signal>`), not
 *   a button writing a signal on each press.
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
 * @param {boolean} [actionStandalone] The wait this button's action creates is
 *   its own: it renders busy, refuses a second press and raises the error
 *   callout as always, and nothing above it is told — the form around it still
 *   submits, the popup it sits in still closes. For a run started to be left
 *   running, which the app watches from somewhere else; never for one holding
 *   an answer the screen is the only place to read (see
 *   docs/interactions.md#the-fourth-question-whose-wait-is-it).
 * @param {boolean} [optimistic] The action is taken as done on the button's own
 *   word: no busy state, a second press queues behind the run, and its
 *   `command` runs at once — the popup it sits in closes over the run, which
 *   goes on behind. A failure then has no popup to be read in: `resetOnError`
 *   puts the button back and the error callout is drawn on what surrounds the
 *   closed popup (see
 *   docs/popup_open.md#closing-when-a-button-also-runs-an-action).
 * @param {boolean} [actionAbortable] The person waiting may give up on this
 *   button's action: closing the popup the run holds calls it off and goes
 *   through, instead of being refused, and a second press on the busy button
 *   answers « in progress » with a way to call it off (« Annuler »,
 *   `button.abort_run`). The button leaving the page while it runs calls it
 *   off too — removed, or parked by a suspension around it: nobody is left to
 *   read the answer. For a run whose answer may never come —
 *   a request over a network that stops answering — where a popup with no way
 *   out is worse than an answer lost. Aborting frees the client and nothing
 *   more: the work may already have happened on the other side (see
 *   docs/actions.md#aborting-saves-resources-it-does-not-undo), so say it only
 *   where the screen can be re-opened on what is actually there.
 * @param {boolean|import("preact").ComponentChildren} [confirm] Ask before
 *   doing it, in the place the button stands: the first press replaces the
 *   button with this question and a "Confirmer"/"Annuler" pair, the second one
 *   does what the button was for. `true` asks navi's default question. The
 *   press stays under the finger and there is nothing to dismiss — "Annuler",
 *   Escape, or the focus leaving puts the button back. So does the act itself,
 *   once it went through: an `action` that succeeded, a submit whose form has
 *   sent, a command on the press that runs it — while a failure keeps the
 *   question up, its message on the button that asked. Use `<Picker
 *   type="confirm">` instead when the question is long enough to want a popup,
 *   or when the row has no space for it.
 * @param {import("preact").ComponentChildren} [confirmLabel] Label of the
 *   second press.
 * @param {import("preact").ComponentChildren} [cancelLabel] Label of the way
 *   out of the question.
 * @param {string} [confirmTestId] `data-testid` of the second press.
 * @param {string} [cancelTestId] `data-testid` of the way out.
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
export const Button = /*#__PURE__*/ createComponentResolver([
  ButtonFirstResolver,
  ButtonRouteResolver,
  ButtonCommandPropResolver,
  ButtonUpdateAppliedResolver,
  ButtonConfirmResolver,
  ButtonHrefResolver,
  ButtonUI,
]);

// The way out a busy control offers when its wait may be called off (see
// busy_abort_message.js): filled from here, the one module that may import a
// Button without closing a cycle through the control hooks.
const BusyAbortMessage = ({ message, abort }) => {
  const requestClose = useCalloutRequestClose();
  return (
    <Box flex="x" alignY="center" spacing="s">
      <span>{message}</span>
      <Button
        uiAction={(value, e) => {
          abort();
          requestClose?.(e, "aborted");
        }}
      >
        {buttonI18n("button.abort_run")}
      </Button>
    </Box>
  );
};
provideBusyAbortMessage((message, abort) => (
  <BusyAbortMessage message={message} abort={abort} />
));
