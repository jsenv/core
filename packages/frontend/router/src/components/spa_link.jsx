import { forwardRef } from "preact/compat";
import { useImperativeHandle, useLayoutEffect, useRef } from "preact/hooks";
import { SPAForm } from "./spa_form.jsx";

export const SPALink = forwardRef(
  (
    {
      autoFocus,
      deleteShortcutAction,
      deleteShortcutConfirmContent,
      children,
      ...rest
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    useLayoutEffect(() => {
      if (autoFocus) {
        const link = innerRef.current;
        link.focus();
      }
    }, [autoFocus]);

    if (!deleteShortcutAction) {
      return (
        <a ref={innerRef} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <LinkWithDeleteShortcut
        ref={innerRef}
        deleteShortcutAction={deleteShortcutAction}
        deleteShortcutConfirmContent={deleteShortcutConfirmContent}
        {...rest}
      >
        {children}
      </LinkWithDeleteShortcut>
    );
  },
);

const LinkWithDeleteShortcut = forwardRef(
  (
    {
      children,
      deleteShortcutConfirmContent = "Are you sure you want to delete this?",
      deleteShortcutAction,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);
    const formRef = useRef();

    return (
      <a
        ref={innerRef}
        {...props}
        // does not work because chrome does not set the <a> as document.activeElement when focused (WTF)
        // https://github.com/reactjs/react-modal/issues/389
        onKeyDown={(e) => {
          if (e.metaKey && e.key === "Backspace") {
            // eslint-disable-next-line no-alert
            if (confirm(deleteShortcutConfirmContent)) {
              formRef.current.requestSubmit();
            }
          } else if (props.onKeydown) {
            props.onKeydown(e);
          }
        }}
      >
        <SPAForm
          ref={formRef}
          action={deleteShortcutAction}
          data-hidden
        ></SPAForm>
        {children}
      </a>
    );
  },
);
