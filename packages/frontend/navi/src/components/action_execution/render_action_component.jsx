import { useParentAction } from "./action_context.js";

export const renderActionComponent = (
  props,
  ref,
  ComponentWithAction,
  ComponentWithoutAction,
) => {
  const { action } = props;
  const parentAction = useParentAction();
  const hasActionProps = action || parentAction;

  if (hasActionProps) {
    return (
      <ComponentWithAction
        {...props}
        parentAction={parentAction}
        action={action}
        ref={ref}
      />
    );
  }

  return <ComponentWithoutAction {...props} ref={ref} />;
};
