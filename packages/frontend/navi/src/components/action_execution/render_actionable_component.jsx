import { useFormContext } from "./form_context.js";

export const renderActionableComponent = (
  props,
  ref,
  ComponentBasic,
  ComponentWithAction,
  ComponentInsideForm,
  ComponentWithActionInsideForm,
) => {
  const { action, shortcuts, ignoreForm } = props;
  const formContext = useFormContext();
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));
  const considerInsideForm = ignoreForm ? false : Boolean(formContext);

  if (hasActionProps) {
    if (considerInsideForm && ComponentWithActionInsideForm) {
      return (
        <ComponentWithActionInsideForm
          formContext={formContext}
          ref={ref}
          {...props}
        />
      );
    }
    return <ComponentWithAction ref={ref} {...props} />;
  }

  if (considerInsideForm) {
    if (import.meta.dev && !ComponentInsideForm) {
      throw new Error(
        "renderActionableComponent: ComponentInsideForm is required when inside a form context",
      );
    }
    return (
      <ComponentInsideForm formContext={formContext} ref={ref} {...props} />
    );
  }

  return <ComponentBasic ref={ref} {...props} />;
};
