import { closeValidationMessage } from "@jsenv/validation";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef } from "preact/hooks";
import { useActionStatus } from "../../use_action_status.js";
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

  .navi_link[disabled] {
    opacity: 0.5;
    pointer-events: none;
  }
`;

export const Link = forwardRef((props, ref) => {
  const {
    children,
    onClick,
    shortcuts = [],
    onKeyDown,
    className = "",
    disabled,
    loading,
    ...rest
  } = props;

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [action, onKeyDownForShortcuts] = useKeyboardShortcuts(
    innerRef,
    shortcuts,
  );
  const { pending } = useActionStatus(action);

  return (
    <a
      ref={innerRef}
      {...rest}
      className={["navi_link", ...className.split(" ")].join(" ")}
      disabled={disabled || pending}
      loading={loading || pending}
      data-has-shortcuts={shortcuts.length > 0 ? "" : undefined}
      onKeyDown={(e) => {
        onKeyDownForShortcuts(e);
        onKeyDown?.(e);
      }}
      onClick={(e) => {
        closeValidationMessage(e.target, "click");
        onClick?.(e);
      }}
    >
      {children}
    </a>
  );
});
