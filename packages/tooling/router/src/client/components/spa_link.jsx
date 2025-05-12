import { useRouteUrl } from "../route/route_hooks.js";
import { useRef } from "preact/hooks";
import { SPAForm } from "./spa_form.jsx";

export const SPALink = ({
  route,
  routeParams,
  deleteShortcutAction,
  deleteShortcutConfirmContent,
  children,
  ...rest
}) => {
  const routeUrl = useRouteUrl(route, routeParams);
  if (!deleteShortcutAction) {
    return (
      <a href={routeUrl} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <LinkWithDeleteShortcut
      href={routeUrl}
      deleteShortcutAction={deleteShortcutAction}
      deleteShortcutConfirmContent={deleteShortcutConfirmContent}
      {...rest}
    >
      {children}
    </LinkWithDeleteShortcut>
  );
};

const LinkWithDeleteShortcut = ({
  children,
  deleteShortcutConfirmContent = "Are you sure you want to delete this?",
  deleteShortcutAction,
  ...props
}) => {
  const formRef = useRef();

  return (
    <a
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
};
