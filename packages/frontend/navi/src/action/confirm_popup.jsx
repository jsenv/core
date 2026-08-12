/**
 * The popup an action asks its confirmation question in, before running.
 *
 * Opened imperatively rather than rendered by whoever owns the action: the
 * question is asked from inside the action execution path (see
 * use_execute_action.js), which is plain JS with no component of its own — and
 * the answer it needs back is a promise, not a state update. So the popup
 * mounts its own detached tree, resolves once, and tears itself down. It
 * reaches that path through confirm.js rather than being imported by it (see
 * that file for why).
 *
 * A Popover anchored on whatever requested the action (the button that was
 * pressed), not a modal dialog: the question is about that one control, and
 * showing it right there keeps the answer attached to what it answers for.
 * With no anchor it falls back to the center of the viewport, which is what
 * Popover already does for an anchor it cannot resolve.
 *
 * The answer always comes from the popup closing, never from the button that
 * was pressed: Escape, a click outside and the cancel button are the same
 * event, and a caller replacing the body entirely (`content`) then has one
 * protocol to follow — `--navi-confirm` for yes, anything that closes for no.
 */

import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Button } from "../control/input/button.jsx";
import { Popover } from "../layout/popover.jsx";
import { naviI18n } from "../text/navi_i18n.js";
import { registerConfirmImplementation } from "./confirm.js";

const css = /* css */ `
  @layer navi {
    .navi_confirm_popup {
      --popover-max-width: var(--navi-confirm-popup-max-width);
      --popover-min-width: var(--navi-confirm-popup-min-width);
    }
  }

  .navi_confirm_popup_body {
    display: flex;
    padding: var(--navi-confirm-popup-padding);
    flex-direction: column;
    gap: var(--navi-confirm-popup-spacing);
  }

  .navi_confirm_popup_actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--navi-confirm-popup-action-spacing);
  }
`;

/**
 * Asks the user to confirm, in a popup anchored on `anchor`.
 *
 * @param {object} options
 * @param {string|import("preact").ComponentChildren} [options.message] - The
 *   question, text or JSX.
 * @param {import("preact").ComponentChildren} [options.content] - The whole
 *   popup body, replacing the question and the buttons below it.
 * @param {Element} [options.anchor] - What the popup points at, usually the
 *   control that requested the action.
 * @returns {Promise<boolean>} `true` when confirmed, `false` when cancelled
 *   (the cancel button, Escape, or a click outside).
 */
export const openConfirmPopup = ({ message, content, anchor }) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return new Promise((resolve) => {
    const unmount = () => {
      render(null, container);
      container.remove();
    };
    render(
      <ConfirmPopup
        message={message}
        content={content}
        anchor={anchor}
        onAnswer={resolve}
        onClosed={unmount}
      />,
      container,
    );
  });
};
registerConfirmImplementation(openConfirmPopup);

// Long enough for any exit transition to have played out — the popup is still
// in the DOM while it fades away, so the tree cannot be torn down on the spot.
// Not read from the element's own transition-duration: nothing is visible past
// this point either way, so the only thing that matters is being generous.
const UNMOUNT_DELAY_MS = 1000;

const ConfirmPopup = ({ message, content, anchor, onAnswer, onClosed }) => {
  import.meta.css = css;

  // Mount closed, open on the next tick: an entrance animation plays on a
  // change, and a popup that mounts already open is treated as something that
  // was always there (see open_controller.js's own `silent` first open).
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, []);

  // Read once the popup has actually closed, so every way out — the buttons,
  // Escape, a click outside — goes through the same single answer.
  const answerRef = useRef(false);

  return (
    <Popover
      className="navi_confirm_popup"
      open={open}
      anchor={anchor}
      animation
      focusCapture
      pointerInteractionOutsideEffect="close"
      onnavi_request_confirm={() => {
        answerRef.current = true;
        setOpen(false);
      }}
      onClose={() => {
        onAnswer(answerRef.current);
        setTimeout(onClosed, UNMOUNT_DELAY_MS);
      }}
    >
      {content ?? (
        <div className="navi_confirm_popup_body">
          <div>{message}</div>
          <div className="navi_confirm_popup_actions">
            <Button command="--navi-cancel">{naviI18n("button.cancel")}</Button>
            <Button cta autoFocus command="--navi-confirm">
              {naviI18n("button.confirm")}
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
};
