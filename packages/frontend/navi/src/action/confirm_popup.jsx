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
 * By default a Popover anchored on whatever requested the action (the button
 * that was pressed): the question is about that one control, and showing it
 * right there keeps the answer attached to what it answers for. An app that
 * wants every confirmation to be a modal dialog instead says so once, with
 * defineNaviConfirmPopupOptions({ mode: "dialog" }).
 *
 * The answer always comes from the popup closing, never from the button that
 * was pressed: Escape, a click outside and the cancel button are the same
 * event, and a caller replacing the body entirely then has one protocol to
 * follow — `--navi-confirm` for yes, anything that closes for no.
 */

import { render } from "preact";
import { useRef } from "preact/hooks";

import { Button } from "../control/input/button.jsx";
import { Dialog } from "../layout/dialog.jsx";
import { Popover } from "../layout/popover.jsx";
import { naviI18n } from "../text/navi_i18n.js";
import { registerConfirmImplementation } from "./confirm.js";

const css = /* css */ `
  /* The width lives on the body rather than on the popup, so that custom
     content (which replaces this body entirely) sizes itself instead of
     inheriting a ceiling meant for a sentence-long question. */
  .navi_confirm_popup_body {
    display: flex;
    min-width: var(--navi-confirm-popup-min-width);
    max-width: var(--navi-confirm-popup-max-width);
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
 * How every confirmation in this app looks and behaves. Paddings, gaps and
 * widths are CSS instead (`--navi-confirm-popup-*`, see navi_css_vars.js) —
 * what lives here is what CSS cannot say.
 *
 * @typedef {object} NaviConfirmPopupOptions
 * @property {"popover"|"dialog"} [mode] - `"popover"` (default) points the
 *   question at the control that raised it. `"dialog"` centers it and makes the
 *   rest of the page inert — for apps where a confirmation is always a full
 *   stop, or where the control asking is often off-screen by then.
 * @property {import("preact").ComponentChildren} [confirmLabel] - What the
 *   "yes" button reads. Defaults to the translated `"button.confirm"`.
 * @property {import("preact").ComponentChildren} [cancelLabel] - What the "no"
 *   button reads. Defaults to the translated `"button.cancel"`.
 * @property {"confirm"|"cancel"|false} [autoFocus] - Which button the keyboard
 *   lands on. `"cancel"` is the careful choice for an app whose confirmations
 *   guard destructive work: a stray Enter then answers no.
 * @property {boolean|"auto"|"fading"|"scaling"|"sliding"} [animation] - How the
 *   popup enters. `false` for no animation at all.
 * @property {string} [animationDuration] - e.g. `"0.4s"`.
 * @property {string} [positionArea] - Where the popup sits: relative to the
 *   control it points at in `"popover"` mode, relative to the viewport in
 *   `"dialog"` mode. See Popover/Dialog's own `positionArea`.
 * @property {"close"|"cancel"|"capture"|"none"} [pointerInteractionOutsideEffect]
 *   - What a click outside does. `"capture"`/`"none"` force an explicit answer
 *   by refusing to treat a click elsewhere as one.
 * @property {boolean} [dockedOnSmallTouchScreen] - `"dialog"` mode only: turn
 *   the popup into a bottom sheet on a small touch screen.
 * @property {(params: { message: import("preact").ComponentChildren }) => import("preact").ComponentChildren} [renderContent]
 *   - Replaces the popup body — the question and the two buttons — for every
 *   confirmation at once. The per-button `confirmPopupContent` prop is the same
 *   thing for one button. Whatever is returned answers with the
 *   `--navi-confirm` and `--navi-cancel` commands.
 */

/** @type {NaviConfirmPopupOptions} */
const confirmPopupOptions = {
  mode: "popover",
  confirmLabel: undefined,
  cancelLabel: undefined,
  autoFocus: "confirm",
  animation: true,
  animationDuration: undefined,
  positionArea: undefined,
  pointerInteractionOutsideEffect: "close",
  dockedOnSmallTouchScreen: false,
  renderContent: undefined,
};

/**
 * Sets how confirmations look and behave, for the whole app. Merges into what
 * was defined before, so unrelated options can be set from wherever they are
 * decided.
 *
 * @example
 * defineNaviConfirmPopupOptions({ mode: "dialog", autoFocus: "cancel" });
 *
 * @param {NaviConfirmPopupOptions} options
 */
export const defineNaviConfirmPopupOptions = (options) => {
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(confirmPopupOptions, key)) {
      console.warn(`defineNaviConfirmPopupOptions: unknown option "${key}"`);
      continue;
    }
    confirmPopupOptions[key] = options[key];
  }
};

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

  const {
    mode,
    confirmLabel,
    cancelLabel,
    autoFocus,
    animation,
    animationDuration,
    positionArea,
    pointerInteractionOutsideEffect,
    dockedOnSmallTouchScreen,
    renderContent,
  } = confirmPopupOptions;

  // Written by --navi-confirm on its way out, read once the popup has actually
  // closed — so every way out (the buttons, Escape, a click outside) goes
  // through the same single answer.
  const answerRef = useRef(false);

  // defaultOpen="interaction": this tree is mounted because the user just
  // pressed something, so the popup opening IS the interaction and its entrance
  // plays (see open_controller.js).
  const popupProps = {
    defaultOpen: "interaction",
    animation,
    animationDuration,
    positionArea,
    pointerInteractionOutsideEffect,
    onnavi_request_confirm: () => {
      answerRef.current = true;
    },
    onClose: () => {
      onAnswer(answerRef.current);
      setTimeout(onClosed, UNMOUNT_DELAY_MS);
    },
  };
  const body =
    content ??
    renderContent?.({ message }) ??
    defaultBody(message, {
      confirmLabel,
      cancelLabel,
      autoFocus,
    });

  if (mode === "dialog") {
    return (
      <Dialog
        className="navi_confirm_popup"
        dockedOnSmallTouchScreen={dockedOnSmallTouchScreen}
        {...popupProps}
      >
        {body}
      </Dialog>
    );
  }
  return (
    <Popover
      className="navi_confirm_popup"
      anchor={anchor}
      focusCapture
      {...popupProps}
    >
      {body}
    </Popover>
  );
};

const defaultBody = (message, { confirmLabel, cancelLabel, autoFocus }) => {
  return (
    <div className="navi_confirm_popup_body">
      <div>{message}</div>
      <div className="navi_confirm_popup_actions">
        <Button command="--navi-cancel" autoFocus={autoFocus === "cancel"}>
          {cancelLabel ?? naviI18n("button.cancel")}
        </Button>
        <Button
          cta
          command="--navi-confirm"
          autoFocus={autoFocus === "confirm"}
        >
          {confirmLabel ?? naviI18n("button.confirm")}
        </Button>
      </div>
    </div>
  );
};
