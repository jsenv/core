import { closeValidationMessage, useConstraints } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
import { renderActionComponent } from "../action_execution/render_action_component.jsx";
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

  .navi_link[aria-busy="true"],
  .navi_link[inert] {
    opacity: 0.5;
  }

  .navi_link[inert] {
    pointer-events: none;
  }
`;

export const Link = forwardRef((props, ref) => {
  return renderActionComponent(props, ref, SimpleLink, ActionLink);
});

const SimpleLink = forwardRef((props, ref) => {
  const {
    className = "",
    loading,
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
      ref={innerRef}
      {...rest}
      className={["navi_link", ...className.split(" ")].join(" ")}
      aria-busy={loading}
      inert={disabled}
      onClick={(e) => {
        closeValidationMessage(e.target, "click");
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
});

const ActionLink = forwardRef((props, ref) => {
  const {
    children,
    shortcuts = [],
    onKeyDown,
    loading,
    onActionPrevented,
    onActionStart,
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
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
  });

  return (
    <SimpleLink
      ref={innerRef}
      {...rest}
      loading={innerLoading}
      data-has-shortcuts={shortcuts.length > 0 ? "" : undefined}
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        onKeyDown?.(e);
      }}
    >
      {children}
    </SimpleLink>
  );
});
