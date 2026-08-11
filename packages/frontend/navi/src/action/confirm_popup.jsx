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
 */

import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { Button } from "../control/input/button.jsx";
import { Popover } from "../layout/popover.jsx";
import { naviI18n } from "../text/navi_i18n.js";
import { registerConfirmImplementation } from "./confirm.js";

/**
 * Asks the user to confirm, in a popup anchored on `anchor`.
 *
 * @param {object} options
 * @param {string} options.message - The question.
 * @param {Element} [options.anchor] - What the popup points at, usually the
 *   control that requested the action.
 * @returns {Promise<boolean>} `true` when confirmed, `false` when cancelled
 *   (the cancel button, Escape, or a click outside).
 */
export const openConfirmPopup = ({ message, anchor }) => {
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

const ConfirmPopup = ({ message, anchor, onAnswer, onClosed }) => {
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
  const answer = (value) => {
    answerRef.current = value;
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      anchor={anchor}
      animation
      focusCapture
      pointerInteractionOutsideEffect="close"
      maxWidth="320px"
      onClose={() => {
        onAnswer(answerRef.current);
        setTimeout(onClosed, UNMOUNT_DELAY_MS);
      }}
    >
      <Box flex="y" spacing="m" padding="s">
        <Box>{message}</Box>
        <Box flex="x" spacing="s" alignX="end">
          <Button
            onClick={() => {
              answer(false);
            }}
          >
            {naviI18n("button.cancel")}
          </Button>
          <Button
            cta
            autoFocus
            onClick={() => {
              answer(true);
            }}
          >
            {naviI18n("button.confirm")}
          </Button>
        </Box>
      </Box>
    </Popover>
  );
};
