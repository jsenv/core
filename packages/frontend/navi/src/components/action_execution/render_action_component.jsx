import { useParentAction } from "./action_context.js";

export const renderActionComponent = (
  props,
  ref,
  ComponentWithoutAction,
  ComponentWithAction,
) => {
  const { action, ignoreParentAction } = props;
  const parentAction = useParentAction();
  const hasActionProps = action || parentAction;

  if (!hasActionProps || ignoreParentAction) {
    return <ComponentWithoutAction {...props} ref={ref} />;
  }

  return (
    <ComponentWithAction
      {...props}
      parentAction={parentAction}
      action={action}
      ref={ref}
    />
  );
};
