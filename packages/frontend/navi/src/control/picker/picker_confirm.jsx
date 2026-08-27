/**
 * A trigger that asks "are you sure?" before doing what it stands for.
 *
 * A picker rather than a button with a question attached: the question is
 * shown in a popup, and a picker already owns one — placed, sized, popover or
 * dialog, styled by the same props every other picker takes. This one holds no
 * value (it is a door, not a field): its popup IS the question, and the only
 * thing that comes out of it is yes or no.
 *
 * Yes is said with `--navi-confirm` (see commands.js). The popup closes on it,
 * and only then does the picker do what it was standing in for — run its
 * `action`, or trigger its `command` — so the work runs on the trigger, where
 * the loading state and the error callout are drawn, and where the user is
 * looking again. Anything else that closes the popup (the cancel button,
 * Escape, a click outside) is no.
 */

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { triggerNaviCommand } from "../commands.js";
import { Button } from "../input/button.jsx";
import { dispatchRequestAction } from "../rules/control_action.js";
import { getPickerInput } from "./picker_custom.jsx";

const css = /* css */ `
  .navi_picker_confirm_body {
    display: flex;
    min-width: 180px;
    max-width: 320px;
    padding: var(--navi-m);
    flex-direction: column;
    gap: var(--navi-m);
  }

  .navi_picker_confirm_actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--navi-s);
  }
`;

export const PickerConfirmResolver = (props) => {
  import.meta.css = css;
  const Next = useNextResolver();

  if (props.type !== "confirm") {
    return <Next {...props} />;
  }
  const {
    ref,
    action,
    command,
    children,
    message,
    confirmLabel,
    cancelLabel,
    confirmTestId,
    cancelTestId,
    focusOnOpen = "confirm",
    // A popover whatever the screen: the question is short and about the
    // control it points at, and a sheet sliding up for one sentence is too
    // much of a stop.
    mode = "popover",
    focusCapture = true,
    // Nothing to read in the question: a read-only confirm refuses the press
    // on the trigger, where the refusal can be explained, rather than opening
    // a popup whose buttons then refuse in turn.
    openWhileReadOnly = false,
  } = props;
  // A button, unless told otherwise: nothing is picked here, the popup is a
  // question, and a question is asked by pressing something. "picker" — or an
  // explicit `variant={undefined}` — is how a caller asks for the field-like
  // drawing back; a destructuring default could not tell that from nothing
  // being said.
  const variant = Object.hasOwn(props, "variant")
    ? props.variant === "picker"
      ? undefined
      : props.variant
    : "button";

  // From the picker's own input, as its press would have been: the input is
  // what carries `command`/`commandFor` in the DOM, and what a form sending
  // through it names as requester — so the wait and the error land on the
  // trigger.
  const onConfirm = (confirmEvent) => {
    const inputEl = getPickerInput(ref.current);
    if (action !== undefined) {
      dispatchRequestAction(inputEl, {
        event: confirmEvent,
        name: "confirm",
      });
      return;
    }
    if (command) {
      triggerNaviCommand(inputEl, command, confirmEvent);
    }
  };

  return (
    <Next
      {...props}
      type="navi_js"
      allowNameless
      variant={variant}
      mode={mode}
      focusCapture={focusCapture}
      openWhileReadOnly={openWhileReadOnly}
      onConfirm={onConfirm}
      // A question holds no value to read before it is asked: the popup is
      // built on the first open, like that of a picker told its value (see
      // mountWhenClosed in picker_custom.jsx).
      mountWhenClosed={false}
      message={undefined}
      confirmLabel={undefined}
      cancelLabel={undefined}
      confirmTestId={undefined}
      cancelTestId={undefined}
      focusOnOpen={undefined}
    >
      {children === undefined ? (
        <PickerConfirmBody
          message={message}
          confirmLabel={confirmLabel}
          cancelLabel={cancelLabel}
          confirmTestId={confirmTestId}
          cancelTestId={cancelTestId}
          focusOnOpen={focusOnOpen}
        />
      ) : (
        children
      )}
    </Next>
  );
};

const PickerConfirmBody = ({
  message,
  confirmLabel,
  cancelLabel,
  confirmTestId,
  cancelTestId,
  focusOnOpen,
}) => {
  return (
    <div className="navi_picker_confirm_body">
      <div>{message === undefined ? naviI18n("confirm.message") : message}</div>
      <div className="navi_picker_confirm_actions">
        <Button
          command="--navi-cancel"
          autoFocus={focusOnOpen === "cancel"}
          data-testid={cancelTestId}
        >
          {cancelLabel}
        </Button>
        <Button
          command="--navi-confirm"
          autoFocus={focusOnOpen === "confirm"}
          data-testid={confirmTestId}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
};
