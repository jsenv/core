import { useParentAction } from "./use_action.js";

export const renderActionComponent = (
  props,
  ref,
  ComponentWithoutAction,
  ComponentWithAction,
) => {
  const { action, ignoreParentAction, shortcuts } = props;
  const parentAction = useParentAction();
  const hasActionProps = Boolean(
    action ||
      (ignoreParentAction ? false : parentAction) ||
      (shortcuts && shortcuts.length > 0),
  );

  if (!hasActionProps) {
    return <ComponentWithoutAction ref={ref} {...props} />;
  }

  return (
    <ComponentWithAction
      ref={ref}
      {...props}
      // parentAction={parentAction}
      action={action}
    />
  );
};
