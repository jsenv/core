import { closeValidationMessage, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionableComponent } from "../action_execution/render_actionable_component.jsx";
import { useExecuteAction } from "../action_execution/use_execute_action.js";
import { useActionEvents } from "../use_action_events.js";
import { useAutoFocus } from "../use_auto_focus.js";
import { useKeyboardShortcuts } from "../use_keyboard_shortcuts.js";

import.meta.css = /* css */ `
  .navi_link {
  }

  /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */
  .navi_link[data-has-shortcuts]:focus,
  .navi_link[data-has-shortcuts]:focus-visible {
    outline: 2px solid #1d4ed8;
    outline-offset: 1px;
    border-radius: 1px;
  }

  .navi_link[data-readonly],
  .navi_link[inert] {
    opacity: 0.5;
  }

  .navi_link[inert] {
    pointer-events: none;
  }
`;

export const Link = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, LinkBasic, LinkWithAction);
});

const LinkBasic = forwardRef((props, ref) => {
  const {
    className = "",
    loading,
    readOnly,
    disabled,
    children,
    autoFocus,
    constraints = [],
    onClick,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);

  return (
    <a
      {...rest}
      ref={innerRef}
      className={["navi_link", ...className.split(" ")].join(" ")}
      aria-busy={loading}
      inert={disabled}
      data-readonly={readOnly ? "" : undefined}
      onClick={(e) => {
        closeValidationMessage(e.target, "click");
        if (readOnly) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
});

const LinkWithAction = forwardRef((props, ref) => {
  const {
    children,
    shortcuts = [],
    onKeyDown,
    readOnly,
    loading,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [action, onKeyDownForShortcuts] = useKeyboardShortcuts(shortcuts);
  const { pending } = useActionStatus(action);
  const innerLoading = Boolean(loading || pending);
  const executeAction = useExecuteAction(innerRef);
  useActionEvents(innerRef, {
    onAction: executeAction,
    onPrevented: onActionPrevented,
    onAbort: onActionAbort,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <LinkBasic
      ref={innerRef}
      {...rest}
      loading={innerLoading}
      readOnly={readOnly || pending}
      data-readonly-silent={pending && !readOnly ? "" : undefined}
      data-has-shortcuts={shortcuts.length > 0 ? "" : undefined}
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        onKeyDown?.(e);
      }}
    >
      {children}
    </LinkBasic>
  );
});
