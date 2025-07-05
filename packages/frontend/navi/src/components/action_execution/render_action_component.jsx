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
    return <ComponentWithoutAction ref={ref} {...props} />;
  }

  return (
    <ComponentWithAction
      ref={ref}
      {...props}
      parentAction={parentAction}
      action={action}
    />
  );
};
