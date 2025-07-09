import { useFormContext } from "./form_context.js";

export const renderActionableComponent = (
  props,
  ref,
  ComponentBasic,
  ComponentWithAction,
  ComponentInsideForm,
  ComponentWithActionInsideForm,
) => {
  const { action, shortcuts } = props;
  const formContext = useFormContext();
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));

  if (hasActionProps) {
    if (ComponentWithActionInsideForm && formContext) {
      return <ComponentWithActionInsideForm ref={ref} {...props} />;
    }
    return <ComponentWithAction ref={ref} {...props} />;
  }

  if (formContext) {
    return <ComponentInsideForm ref={ref} {...props} />;
  }

  return <ComponentBasic ref={ref} {...props} />;
};
