import { useRef, useImperativeHandle, useLayoutEffect } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { useRouteUrl } from "../route/route_hooks.js";
import { SPAForm } from "./spa_form.jsx";

export const SPALink = forwardRef(
  (
    {
      autoFocus,
      route,
      routeParams,
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

    const routeUrl = useRouteUrl(route, routeParams);
    if (!deleteShortcutAction) {
      return (
        <a ref={innerRef} href={routeUrl} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <LinkWithDeleteShortcut
        ref={innerRef}
        href={routeUrl}
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
